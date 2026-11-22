import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataStore, useUIStore, useAuthStore } from '../store';
import Modal from '../components/ui/Modal';
import { sterileSetsAPI, moduleAPI } from '../services/api';

// ── AI ile fotoğrafla sayım — görsel sıkıştırma ─────────────────
// Fotoğraf, canvas'a çizilip maks. 1280px genişliğe indirilir ve JPEG
// kalite ~0.7 ile sıkıştırılır (mobil kamera fotoğrafları birkaç MB
// olabilir — backend'e tüm çözünürlüğü göndermemek için).
//
// Test ortamı (jsdom) gerçek canvas çizimini desteklemiyor —
// HTMLCanvasElement.getContext('2d') burada her zaman null döner ve
// <img>'in onload/onerror olayı HİÇ tetiklenmez (bir zaman aşımına
// güvenmek yerine burada senkron feature-detect ile atlanıyor). Bu
// yüzden önce bir "prob" canvas ile gerçek 2D context mevcut mu diye
// bakılıyor; yoksa (test ortamı) ham (sıkıştırılmamış) base64 ile
// devam ediliyor — gerçek tarayıcılarda bu dal hiç çalışmaz.
const VISION_MAX_WIDTH = 1280;
const VISION_JPEG_QUALITY = 0.7;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function compressImageFile(file) {
  const fallbackMediaType = (file?.type && file.type.startsWith('image/')) ? file.type : 'image/jpeg';

  return readFileAsDataUrl(file).then((dataUrl) => {
    const rawBase64 = dataUrl.split(',')[1] || '';

    const probe = document.createElement('canvas');
    const probeCtx = probe.getContext && probe.getContext('2d');
    if (!probeCtx) {
      // Canvas çizimi desteklenmiyor (test ortamı) — sıkıştırmadan gönder.
      return { imageBase64: rawBase64, mediaType: fallbackMediaType };
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, VISION_MAX_WIDTH / (img.width || VISION_MAX_WIDTH));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round((img.width || VISION_MAX_WIDTH) * scale));
          canvas.height = Math.max(1, Math.round((img.height || VISION_MAX_WIDTH) * scale));
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const jpegDataUrl = canvas.toDataURL('image/jpeg', VISION_JPEG_QUALITY);
          resolve({ imageBase64: jpegDataUrl.split(',')[1] || rawBase64, mediaType: 'image/jpeg' });
        } catch {
          resolve({ imageBase64: rawBase64, mediaType: fallbackMediaType });
        }
      };
      img.onerror = () => resolve({ imageBase64: rawBase64, mediaType: fallbackMediaType });
      img.src = dataUrl;
    });
  }).catch(() => ({ imageBase64: '', mediaType: fallbackMediaType }));
}

const AKIS_ASAMALARI = [
  { key:'kirli_teslim',    lbl:'Kirli Teslim Alma',   icon:'📦', desc:'QR okutarak alet sayımı yap',          renk:'#DC2626' },
  { key:'yikamada',        lbl:'Yıkamada',             icon:'💧', desc:'Yıkama işlemi başladı',               renk:'#0284C7' },
  { key:'sterilizasyonda', lbl:'Sterilizasyonda',      icon:'⚙',  desc:'Otoklav süresi gir',                  renk:'#D97706' },
  { key:'steril',          lbl:'Steril Oldu',          icon:'✅', desc:'QR okutarak steril onayla',            renk:'#059669' },
  { key:'depoda',          lbl:'Steril Depoda',        icon:'🏪', desc:'Rafa yerleştir ve konumu kaydet',      renk:'#14B8A6' },
];

function SayimModal({ setId, onClose }) {
  const { sterilSetlerV2, sterilAkis, sterilAkisGecis, updateSterilAkis } = useDataStore();
  const { showToast } = useUIStore();
  const { curRole } = useAuthStore();
  const navigate = useNavigate();
  const s = sterilSetlerV2.find(x => x.id === setId);
  const akis = sterilAkis[setId] || { gercekSayim: {} };
  // Task 1-4'ün hazırladığı 6 seed setinde backendSetId mevcut — bu dal onlar
  // için SayimModal'ı gerçek /sterile-sets backend'ine bağlar. backendSetId
  // olmayan tüm diğer setler (ve ileride eklenecek yeni mock setler) eski,
  // tamamen yerel/mock davranışına AYNEN devam eder.
  const hasBackend = Boolean(s?.backendSetId);

  // Gerçek backend dalı: API'den gelen enstrüman listesi. null = henüz yüklenmedi.
  const [realInstruments, setRealInstruments] = useState(null);
  const [sayimlar, setSayimlar] = useState(() => {
    if (hasBackend) return {};
    return (s?.aletler || []).reduce((o, _, i) => { o[i] = akis.gercekSayim[i] ?? 1; return o; }, {});
  });
  const [teslimEden, setTeslimEden] = useState('');
  const [salon, setSalon] = useState('');
  const [notlar, setNotlar] = useState('');

  // AI ile fotoğrafla sayım — modül-gated CTA + yakalama akışı.
  // null = henüz kontrol edilmedi (moduleAPI.mine() dönmedi), true/false = kesin durum.
  const [visionActive, setVisionActive] = useState(null);
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (!hasBackend) return;
    let aktif = true;
    sterileSetsAPI.get(s.backendSetId).then((data) => {
      if (!aktif) return;
      const instruments = data?.instruments || [];
      setRealInstruments(instruments);
      setSayimlar(instruments.reduce((o, ins) => { o[ins.id] = ins.expected_count; return o; }, {}));
    });
    return () => { aktif = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBackend, s?.backendSetId]);

  useEffect(() => {
    if (!hasBackend) return;
    let aktif = true;
    moduleAPI.mine().then((mods) => {
      if (!aktif) return;
      const list = Array.isArray(mods) ? mods : [];
      setVisionActive(list.some((m) => m?.slug === 'vision_counting'));
    }).catch(() => { if (aktif) setVisionActive(false); });
    return () => { aktif = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBackend, s?.backendSetId]);

  // Modal kapanırken açık kamera akışı varsa bırak — arka planda çalışan
  // bir kamera cihazı sızdırılmasın.
  useEffect(() => () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast('Bu cihazda kamera erişimi desteklenmiyor');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraOpen(true);
    } catch {
      showToast('Kameraya erişilemedi');
    }
  }

  function captureFromCamera() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) { showToast('Kamera görüntüsü yakalanamadı'); return; }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => { if (blob) handleImageCaptured(blob); }, 'image/jpeg', 0.9);
    stopCamera();
  }

  async function handleImageCaptured(fileOrBlob) {
    if (!fileOrBlob) return;
    setAiBusy(true);
    try {
      const { imageBase64, mediaType } = await compressImageFile(fileOrBlob);
      const result = await sterileSetsAPI.visionCount(s.backendSetId, { imageBase64, mediaType });
      if (result?.parsed) {
        const updates = {};
        (result.suggestions || []).forEach((sug) => {
          if (sug?.detectedCount != null) updates[sug.instrumentId] = sug.detectedCount;
        });
        setSayimlar(p => ({ ...p, ...updates }));
      } else {
        showToast('AI sayamadı, lütfen elle sayın');
      }
    } catch (e) {
      showToast('Fotoğraf analiz edilemedi: ' + (e?.message || ''));
    } finally {
      setAiBusy(false);
      setPhotoMenuOpen(false);
    }
  }

  function handleFileInputChange(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (file) handleImageCaptured(file);
  }

  if (!s) return null;

  function degistir(key, delta, varsayilan = 1) {
    setSayimlar(p => ({ ...p, [key]: Math.max(0, (p[key] ?? varsayilan) + delta) }));
  }

  // Backend dalında, gerçek enstrüman listesi henüz yüklenmeden (GET devam
  // ederken) kaydet() tetiklenirse realInstruments hâlâ null olur — bu
  // durumda counts:[] gönderilip tamMi yanlışlıkla true olurdu. Bu yüzden
  // hem kaydet() hem de gönder butonu bu pencerede devre dışı bırakılır.
  const yukleniyor = hasBackend && realInstruments === null;

  function kaydet() {
    if (yukleniyor) { showToast('Aletler yükleniyor, lütfen bekleyin'); return; }
    if (!teslimEden.trim()) { showToast('Teslim eden personeli girin'); return; }
    if (!salon) { showToast('Salon seçin'); return; }
    const now = new Date();
    const saat = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');

    let tamMi;
    if (hasBackend) {
      const instruments = realInstruments || [];
      tamMi = instruments.every(ins => (sayimlar[ins.id] ?? 0) >= ins.expected_count);
      sterileSetsAPI.addTracking(s.backendSetId, {
        stage: 'teslim_alindi',
        operator: teslimEden,
        notes: notlar,
        counts: instruments.map(ins => ({ instrumentId: ins.id, count: sayimlar[ins.id] })),
      });
    } else {
      tamMi = s.aletler.every((_, i) => (sayimlar[i] ?? 1) >= 1);
    }

    // Görsel akış göstergesini ilerleten mock-store çağrıları — her iki dalda da AYNEN çalışır.
    updateSterilAkis(setId, {
      gercekSayim: sayimlar,
      zamanlar: { ...(akis.zamanlar || {}), kirli_teslim: saat + ' — Teslim alındı · ' + teslimEden },
    });
    sterilAkisGecis(setId, 'yikamada', teslimEden);
    showToast(tamMi ? s.name + ' kirli teslim alındı ✓' : '⚠ Eksik alet bildirimi oluşturuldu');
    onClose();
  }

  const toplamAdet = hasBackend ? (realInstruments || []).length : s.aletler.length;
  const tamSayisi = hasBackend
    ? (realInstruments || []).filter(ins => (sayimlar[ins.id] ?? 0) === ins.expected_count).length
    : s.aletler.filter((_, i) => (sayimlar[i] ?? 1) === 1).length;
  const eksiVar = hasBackend
    ? (realInstruments || []).some(ins => (sayimlar[ins.id] ?? 0) < ins.expected_count)
    : s.aletler.some((_, i) => (sayimlar[i] ?? 1) < 1);

  return (
    <Modal title={`Alet Sayım Formu — ${s.name}`} onClose={onClose} width={560}>
      <div style={{ background:'rgba(220,38,38,0.06)', border:'1px solid rgba(220,38,38,0.2)', borderRadius:9, padding:'11px 14px', marginBottom:14, fontSize:'11.5px', color:'var(--slate-mid)' }}>
        ⚠ Teslim alınan tüm aletler tek tek sayılmalı ve teyit edilmelidir.
      </div>

      {/* Set bilgi kartı */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', background:'var(--surface)', borderRadius:10, marginBottom:14 }}>
        <div style={{ width:40, height:40, borderRadius:10, background:`${s.color}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--slate)' }}>{s.name}</div>
          <div style={{ fontSize:11, color:'var(--slate-light)', marginTop:2 }}>{s.doktor} · Raf: {s.raf} · {toplamAdet} alet</div>
        </div>
        <span className="tag t-red" style={{ fontSize:9 }}>Kirli Teslim</span>
      </div>

      {/* AI ile fotoğrafla sayım — sadece gerçek backend setlerinde, aletler
          yüklendikten (yukleniyor) sonra ve modül satın alınmışsa gösterilir. */}
      {hasBackend && !yukleniyor && visionActive === false && (
        <div className="empty" style={{ marginBottom:14, padding:'16px 14px' }}>
          <div className="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:22, height:22 }}>
              <rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7l1.5-3h5L16 7"/><circle cx="12" cy="13.5" r="3.5"/>
            </svg>
          </div>
          <div className="empty-text">Görsel Alet Sayımı modülü bu kurum için aktif değil.</div>
          {curRole === 0 && (
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/abonelik')}>
              Abonelik sayfasına git →
            </button>
          )}
        </div>
      )}

      {hasBackend && !yukleniyor && visionActive === true && (
        <div style={{ marginBottom:14 }}>
          {!photoMenuOpen ? (
            <button type="button" className="btn btn-secondary" onClick={() => setPhotoMenuOpen(true)}>
              📷 Fotoğrafla Say
            </button>
          ) : (
            <div style={{ border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px' }}>
              <div style={{ fontSize:11, color:'var(--slate-mid)', marginBottom:10 }}>
                AI ile aletleri say — fotoğraf yükleyin veya kamerayı kullanın. Öneriler sayaçları doldurur, siz hâlâ +/- ile düzeltebilirsiniz.
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom: cameraOpen ? 10 : 0 }}>
                <button type="button" className="btn btn-secondary btn-sm" disabled={aiBusy} onClick={() => fileInputRef.current?.click()}>
                  Dosyadan Yükle / Kamera
                </button>
                <button type="button" className="btn btn-secondary btn-sm" disabled={aiBusy} onClick={() => (cameraOpen ? stopCamera() : startCamera())}>
                  {cameraOpen ? 'Canlı Kamerayı Kapat' : 'Canlı Kamera'}
                </button>
                <button type="button" className="btn btn-secondary btn-sm" disabled={aiBusy} onClick={() => { stopCamera(); setPhotoMenuOpen(false); }}>
                  Kapat
                </button>
              </div>
              <input
                ref={fileInputRef}
                data-testid="vision-photo-input"
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display:'none' }}
                onChange={handleFileInputChange}
              />
              {cameraOpen && (
                <div className="qr-zone" style={{ padding:10 }}>
                  <video ref={videoRef} autoPlay playsInline muted style={{ width:'100%', borderRadius:8, background:'#000' }} />
                  <button type="button" className="btn btn-primary btn-sm" style={{ marginTop:8 }} disabled={aiBusy} onClick={captureFromCamera}>
                    Çek
                  </button>
                </div>
              )}
              {aiBusy && <div style={{ fontSize:11, color:'var(--slate-light)', marginTop:8 }}>AI analiz ediyor…</div>}
            </div>
          )}
        </div>
      )}

      {/* Salon + teslim eden */}
      <div className="fr" style={{ marginBottom:12 }}>
        <div className="fg"><label className="fl">Salon *</label>
          <select className="fi" value={salon} onChange={e=>setSalon(e.target.value)}>
            <option value="">Seçin</option>
            {['Salon 1','Salon 2','Salon 3','Salon 4','Salon 5'].map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="fg"><label className="fl">Teslim Eden *</label>
          <input className="fi" value={teslimEden} onChange={e=>setTeslimEden(e.target.value)} placeholder="Dr. / Hemşire adı"/>
        </div>
      </div>

      {/* Alet sayım tablosu */}
      <div style={{ border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', marginBottom:14 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 72px 108px 52px', padding:'7px 12px', background:'var(--surface)', borderBottom:'1px solid var(--border)' }}>
          {['Alet Adı','Beklenen','Sayılan','Durum'].map(h => (
            <span key={h} style={{ fontSize:9, fontWeight:700, color:'var(--slate-light)', textTransform:'uppercase', letterSpacing:'0.5px', textAlign:'center' }}>{h}</span>
          ))}
        </div>
        {hasBackend ? (
          realInstruments === null ? (
            <div style={{ padding:'16px 12px', textAlign:'center', fontSize:12, color:'var(--slate-light)' }}>Aletler yükleniyor…</div>
          ) : realInstruments.map((ins) => {
            const say = sayimlar[ins.id] ?? ins.expected_count;
            const ok = say === ins.expected_count; const fazla = say > ins.expected_count;
            return (
              <div key={ins.id} style={{ display:'grid', gridTemplateColumns:'1fr 72px 108px 52px', alignItems:'center', padding:'9px 12px', borderBottom:'1px solid var(--border)' }}>
                <div style={{ fontSize:12, fontWeight:500, color:'var(--slate)' }}>{ins.name}</div>
                <div style={{ textAlign:'center', fontSize:12, fontWeight:600, color:'var(--slate-mid)' }}>{ins.expected_count}</div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                  <div className="cnt-btn" onClick={() => degistir(ins.id, -1, ins.expected_count)}>−</div>
                  <div data-testid={`sayim-value-${ins.id}`} className={`cnt-val ${ok?'cnt-ok':fazla?'cnt-fazla':'cnt-miss'}`} style={{ width:30, fontSize:13, fontWeight:800 }}>{say}</div>
                  <div className="cnt-btn" onClick={() => degistir(ins.id, 1, ins.expected_count)}>+</div>
                </div>
                <div style={{ textAlign:'center', fontSize:16 }}>
                  {ok ? <span style={{ color:'var(--success)' }}>✓</span> : fazla ? <span style={{ color:'var(--warning)', fontSize:13 }}>↑</span> : <span style={{ color:'var(--danger)' }}>⚠</span>}
                </div>
              </div>
            );
          })
        ) : s.aletler.map((a, i) => {
          const say = sayimlar[i] ?? 1;
          const ok = say === 1; const fazla = say > 1;
          return (
            <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 72px 108px 52px', alignItems:'center', padding:'9px 12px', borderBottom:'1px solid var(--border)' }}>
              <div style={{ fontSize:12, fontWeight:500, color:'var(--slate)' }}>{a.ad}</div>
              <div style={{ textAlign:'center', fontSize:12, fontWeight:600, color:'var(--slate-mid)' }}>1</div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                <div className="cnt-btn" onClick={() => degistir(i, -1)}>−</div>
                <div className={`cnt-val ${ok?'cnt-ok':fazla?'cnt-fazla':'cnt-miss'}`} style={{ width:30, fontSize:13, fontWeight:800 }}>{say}</div>
                <div className="cnt-btn" onClick={() => degistir(i, 1)}>+</div>
              </div>
              <div style={{ textAlign:'center', fontSize:16 }}>
                {ok ? <span style={{ color:'var(--success)' }}>✓</span> : fazla ? <span style={{ color:'var(--warning)', fontSize:13 }}>↑</span> : <span style={{ color:'var(--danger)' }}>⚠</span>}
              </div>
            </div>
          );
        })}
        <div style={{ padding:'8px 12px', display:'flex', justifyContent:'space-between', background:'var(--surface)' }}>
          <span style={{ fontSize:11, color:'var(--slate-mid)' }}>Toplam: <strong style={{ color:'var(--slate)' }}>{toplamAdet} alet</strong></span>
          <span style={{ fontSize:11, fontWeight:700, color: eksiVar ? 'var(--danger)' : 'var(--success)' }}>{tamSayisi}/{toplamAdet} tam</span>
        </div>
      </div>

      <div className="fg" style={{ marginBottom:14 }}>
        <label className="fl">Notlar</label>
        <textarea className="fi" rows={2} value={notlar} onChange={e=>setNotlar(e.target.value)} placeholder="Ek notlar…"/>
      </div>

      <div className="mf">
        <button className="btn btn-secondary" onClick={onClose}>İptal</button>
        <button className="btn btn-primary" onClick={kaydet} disabled={yukleniyor} title={yukleniyor ? 'Aletler yükleniyor…' : undefined}>
          {yukleniyor ? 'Aletler yükleniyor…' : 'Sayımı Onayla & Teslim Al'}
        </button>
      </div>
    </Modal>
  );
}

function TakipSidePanel({ setId }) {
  const { sterilSetlerV2, sterilAkis, sterilAkisGecis, updateSterilAkis } = useDataStore();
  const { showToast } = useUIStore();
  const [sayimAcik, setSayimAcik] = useState(false);
  const sureRef = useRef(null);

  const s = sterilSetlerV2.find(x => x.id === setId);
  if (!s) return <div className="empty"><div className="empty-text">Set seçin</div></div>;

  const akis = sterilAkis[setId] || { asama:'kirli_teslim', zamanlar:{} };
  const asamaIdx = akis.asama === 'tamamlandi' ? AKIS_ASAMALARI.length : AKIS_ASAMALARI.findIndex(a => a.key === akis.asama);

  function handleStep(stepKey) {
    const now = new Date();
    const saat = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
    if (stepKey === 'kirli_teslim') { setSayimAcik(true); return; }
    if (stepKey === 'sterilizasyonda') {
      const sure = parseInt(sureRef.current?.value) || 45;
      const [h, m] = saat.split(':').map(Number);
      const total = h*60 + m + sure;
      const bitis = `${String(Math.floor(total/60)%24).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
      updateSterilAkis(setId, { sure, sterilBitis: bitis });
      sterilAkisGecis(setId, 'steril', sure);
      showToast(`${s.name} sterilizasyona girdi ⚙ (${sure} dk)`);
      return;
    }
    if (stepKey === 'steril') {
      showToast('QR taranıyor…');
      setTimeout(() => {
        sterilAkisGecis(setId, 'depoda');
        showToast(`${s.name} steril oldu ✅`);
      }, 1600);
      return;
    }
    sterilAkisGecis(setId, stepKey);
  }

  return (
    <>
      <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:'var(--radius-xl)', overflow:'hidden', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:11 }}>
          <div style={{ width:38, height:38, borderRadius:10, background:`${s.color}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--slate)', letterSpacing:'-0.3px' }}>{s.name}</div>
            <div style={{ fontSize:10, color:'var(--teal)', fontWeight:600, marginTop:2 }}>{s.doktor}</div>
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'14px 16px' }}>
          <div style={{ fontSize:'9.5px', fontWeight:700, color:'var(--slate-light)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:10 }}>İş Akışı</div>
          <div className="flow-steps">
            {AKIS_ASAMALARI.map((a, i) => {
              const isDone   = i < asamaIdx;
              const isActive = i === asamaIdx;
              const isLocked = i > asamaIdx;
              const zaman    = akis.zamanlar?.[a.key] || '';
              return (
                <div key={a.key} className={`flow-step${isDone?' done':isActive?' active':' locked'}`}
                  onClick={() => isActive && handleStep(a.key)}>
                  <div className="fs-icon" style={{ background:isDone?`${a.renk}22`:isActive?`${a.renk}18`:'var(--surface)', border:isActive?`2px solid ${a.renk}`:'1.5px solid var(--border)' }}>
                    {isDone
                      ? <svg viewBox="0 0 24 24" fill="none" stroke={a.renk} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      : <span style={{ fontSize:14 }}>{a.icon}</span>}
                  </div>
                  <div className="fs-body">
                    <div className="fs-title">{a.lbl}</div>
                    <div className="fs-sub">{isDone ? ('✓ ' + zaman) : isActive ? a.desc : 'Bekliyor'}</div>
                    {isActive && a.key === 'sterilizasyonda' && (
                      <div className="sure-input" onClick={e => e.stopPropagation()}>
                        <input ref={sureRef} type="number" defaultValue={akis.sure||45} min="10" max="180"
                          onClick={e=>e.stopPropagation()} onChange={e=>e.stopPropagation()}
                          style={{ width:70, border:'1px solid var(--border)', borderRadius:6, padding:'4px 8px', fontSize:12, background:'var(--input-bg)', color:'var(--slate)', outline:'none' }}/>
                        <span style={{ fontSize:11, color:'var(--slate-light)' }}>dakika · otoklav süresi</span>
                      </div>
                    )}
                  </div>
                  <div className="fs-action">
                    {isDone ? (
                      <div className="fs-check">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                    ) : isActive ? (
                      <button className="btn btn-primary btn-sm" style={{ fontSize:10 }}
                        onClick={e => { e.stopPropagation(); handleStep(a.key); }}>
                        {a.key==='kirli_teslim'?'Teslim Al':a.key==='yikamada'?'Yıkamayı Başlat':a.key==='sterilizasyonda'?'Sterilize Et':a.key==='steril'?'Onayla':'Depoya Yerleştir'}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {sayimAcik && <SayimModal setId={setId} onClose={() => setSayimAcik(false)} />}
    </>
  );
}

export default function SetTakip() {
  const { sterilSetlerV2, sterilAkis, durumSetCfg } = useDataStore();
  const [aktifSetId, setAktifSetId] = useState(sterilSetlerV2[0]?.id ?? null);
  const [qrScanning, setQrScanning] = useState(false);

  function simQrScan() {
    if (qrScanning) return;
    setQrScanning(true);
    setTimeout(() => setQrScanning(false), 1800);
  }

  return (
    <div>
      <div className="page-hd" style={{ marginBottom:16 }}>
        <div>
          <div className="page-hd-title">Set Takip Paneli</div>
          <div className="page-hd-sub">Cerrahi set akışını takip edin — kirli teslimden steril depoya</div>
        </div>
      </div>

      {/* Akış göstergesi */}
      <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'16px 20px', marginBottom:16 }}>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--slate-light)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:12 }}>Sterilizasyon Akışı</div>
        <div style={{ display:'flex', alignItems:'center', gap:0 }}>
          {AKIS_ASAMALARI.map((a, i) => (
            <div key={a.key} style={{ display:'flex', alignItems:'center', flex:1, minWidth:0 }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5, flex:1 }}>
                <div style={{ width:36, height:36, borderRadius:'50%', background:`${a.renk}18`, border:`2px solid ${a.renk}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>{a.icon}</div>
                <span style={{ fontSize:9, fontWeight:600, color:'var(--slate-mid)', textAlign:'center', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:72 }}>{a.lbl}</span>
              </div>
              {i < AKIS_ASAMALARI.length - 1 && (
                <div style={{ flex:1, height:1, background:'var(--border)', margin:'0 4px', marginBottom:18 }}/>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="takip-layout">
        <div>
          {/* QR Tarama alanı */}
          <div className={`qr-zone${qrScanning?' scanning':''}`} id="qrZoneEl" onClick={simQrScan} style={{ marginBottom:14 }}>
            <div className="qr-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/>
                <line x1="17" y1="17" x2="21" y2="17"/><line x1="21" y1="14" x2="21" y2="21"/>
              </svg>
            </div>
            <div className="qr-title">{qrScanning ? 'Taranıyor…' : 'QR Kod Okut'}</div>
            <div className="qr-sub">{qrScanning ? 'Lütfen bekleyin' : 'Cerrahi seti taramak için tıklayın veya kamerayı açın'}</div>
            {!qrScanning && <button className="btn btn-primary btn-sm" style={{ pointerEvents:'none' }}>Kamerayı Aç</button>}
          </div>

          {/* Set listesi */}
          <div>
            {sterilSetlerV2.map(s => {
              const akis     = sterilAkis[s.id] || { asama:'kirli_teslim' };
              const asamaIdx = akis.asama === 'tamamlandi' ? AKIS_ASAMALARI.length : AKIS_ASAMALARI.findIndex(a => a.key === akis.asama);
              const dcfg     = durumSetCfg[s.durum] || { tag:'t-gray' };
              const isActive = s.id === aktifSetId;
              return (
                <div key={s.id} className={`set-flow-card${isActive?' active-flow':''}`} id={`sfc-${s.id}`}>
                  <div className="sfc-header" onClick={() => setAktifSetId(s.id)}>
                    <div className="sfc-icon" style={{ background:`${s.color}18` }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div className="sfc-name">{s.name}</div>
                      <div className="sfc-doc">{s.doktor} · {s.aletler.length} alet</div>
                    </div>
                    <div className="sfc-durum">
                      <span className={`tag ${dcfg.tag}`} style={{ fontSize:9 }}>
                        {AKIS_ASAMALARI[asamaIdx]?.lbl || s.durum}
                      </span>
                    </div>
                  </div>
                  {/* Mini akış bar */}
                  <div style={{ padding:'8px 16px 10px', display:'flex', alignItems:'center', gap:3 }}
                    onClick={() => setAktifSetId(s.id)}>
                    {AKIS_ASAMALARI.map((a, i) => (
                      <div key={a.key} style={{ flex:1, height:4, borderRadius:4, background:i<=asamaIdx?a.renk:'var(--border)', transition:'all 0.3s' }}/>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sağ panel */}
        <div id="takipSidePanel">
          {aktifSetId !== null
            ? <TakipSidePanel key={aktifSetId} setId={aktifSetId} />
            : <div className="empty"><div className="empty-text">Set seçin</div></div>}
        </div>
      </div>
    </div>
  );
}
