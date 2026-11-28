import { useState, useEffect, useRef } from 'react';
import { useAuthStore, useUIStore } from '../store';
import { ROLES } from '../data/roles';
import Modal from '../components/ui/Modal';
import { voiceProfileAPI, spotifyAPI } from '../services/api.js';

// Kayıt sırasında kullanıcıya okutulan sabit pasaj — plan kararı, aynen kullanılıyor.
const SES_PASAJI = 'Operio ses profilimi oluşturuyorum, bu cümleyi kendi doğal konuşma hızımla okuyorum.';
// Kayıt otomatik olarak bu süre (ms) sonunda durur — basitlik için sabit süre tercih edildi
// (kullanıcının elle durdurması yerine); 5 saniye tek cümlelik pasaj için yeterli.
const KAYIT_SURESI_MS = 5000;
// Speaker-ID modeli daha güvenilir bir ses profili için birden fazla örnek bekliyor —
// aynı pasaj art arda bu kadar kez okutulup tek bir enroll() çağrısında gönderiliyor.
const KAYIT_ADIM_SAYISI = 3;
// Final review Finding 4: kayıtlar arasında kısa bir duraklama — kullanıcıya
// pasajı YENİDEN okuması için görünür bir "hazırlanın" penceresi verir. Bu
// olmadan kullanıcı pasajı sadece 1. kayıtta okuyup 2. ve 3. kayıtlarda sessiz
// kalma eğiliminde oluyor (enrollment embedding'inin ortalamasını bozar).
const KAYIT_ARASI_BEKLEME_MS = 500;

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function Profil() {
  const { curRole, user } = useAuthStore();
  const { showToast } = useUIStore();
  const token = localStorage.getItem('operio_access');
  const [dbUser, setDbUser] = useState(null);
  const [sifreModal, setSifreModal] = useState(false);
  const [sifreForm, setSifreForm] = useState({ eski: '', yeni: '', tekrar: '' });

  // Ses profili (konuşmacı doğrulama kaydı)
  const [sesProfili, setSesProfili] = useState(null);
  // 0 = kayıt akışı başlamadı; 1..KAYIT_ADIM_SAYISI = o anda aktif olan kayıt adımı.
  const [kayitAdimi, setKayitAdimi] = useState(0);
  // Finding 4: kayıtlar arası kısa duraklama sırasında true — kullanıcıya pasajı
  // tekrar okumaya hazırlanması için görünür bir ipucu/metin gösterir.
  const [kayitArasiBekleniyor, setKayitArasiBekleniyor] = useState(false);
  const [kayitGonderiliyor, setKayitGonderiliyor] = useState(false);
  const recorderRef = useRef(null);
  const kayitTimeoutRef = useRef(null);

  // Spotify hesabı bağlantısı (OAuth — tam sayfa yönlendirmesiyle çalışır)
  const [spotifyBagli, setSpotifyBagli] = useState(false);

  useEffect(() => {
    fetch('http://localhost:4000/api/auth/me', {
      headers: { 'Authorization': 'Bearer ' + token }
    }).then(r => r.ok ? r.json() : null)
      .then(data => { if(data) setDbUser(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let mounted = true;
    voiceProfileAPI.get()
      .then(profil => { if (mounted) setSesProfili(profil); })
      .catch(() => {});
    return () => {
      mounted = false;
      if (kayitTimeoutRef.current) clearTimeout(kayitTimeoutRef.current);
    };
  }, []);

  // Spotify OAuth, backend'in /api/spotify/callback'inden tam sayfa yönlendirmesiyle
  // geri döner (?spotify=connected|error) — başka bir "bağlı mı?" durum kontrolü
  // (getStatus) backend'de henüz yok, bu yüzden bağlı durumu sadece bu dönüşten
  // anlaşılabiliyor ve sayfa taze mount olduğunda varsayılan "bağlı değil"dir.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const spotifyParam = params.get('spotify');
    if (spotifyParam === 'connected') {
      setSpotifyBagli(true);
      showToast('Spotify hesabınız bağlandı');
    } else if (spotifyParam === 'error') {
      showToast('Spotify bağlantısı başarısız oldu, lütfen tekrar deneyin');
    }
    if (spotifyParam) {
      // Query param'ı URL'den sil — aksi halde sayfa yenilendiğinde toast tekrar tetiklenir.
      params.delete('spotify');
      const yeniArama = params.toString();
      const yeniUrl = window.location.pathname + (yeniArama ? `?${yeniArama}` : '') + window.location.hash;
      window.history.replaceState({}, '', yeniUrl);
    }
  }, []);

  async function spotifyBaglan() {
    try {
      const { url } = await spotifyAPI.connect();
      window.location.href = url;
    } catch (err) {
      showToast('Spotify bağlantısı başlatılamadı');
    }
  }

  async function spotifyBaglantiyiKaldir() {
    try {
      await spotifyAPI.disconnect();
      setSpotifyBagli(false);
      showToast('Spotify bağlantısı kaldırıldı');
    } catch (err) {
      showToast('Spotify bağlantısı kaldırılamadı');
    }
  }

  // Tek bir kayıt döngüsü: mikrofon izni ister, pasajı KAYIT_SURESI_MS süresince
  // kaydeder ve kaydın base64'ünü döndürür. Mevcut MediaRecorder/getUserMedia
  // mekanizması değişmedi — sesKaydiBaslat artık bunu 3 kez art arda çağırıyor.
  function birKayitYap() {
    return new Promise((resolve, reject) => {
      // Final review Finding 5: kiosk'un useVoiceDeviceControl.js'teki doğrulama
      // yakalaması ile aynı gürültü/eko kısıtları — enrollment ve doğrulama
      // sesinin kalitesi tutarlı olsun diye (ikisi de aynı modele besleniyor).
      navigator.mediaDevices.getUserMedia({ audio: { noiseSuppression: true, echoCancellation: true } }).then((stream) => {
        const chunks = [];
        const recorder = new MediaRecorder(stream);
        recorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = async () => {
          stream.getTracks().forEach(t => t.stop());
          try {
            const blob = new Blob(chunks, { type: 'audio/webm' });
            const base64 = await blobToBase64(blob);
            resolve(base64);
          } catch (err) {
            reject(err);
          }
        };

        recorder.start();
        kayitTimeoutRef.current = setTimeout(() => {
          if (recorderRef.current && recorderRef.current.state === 'recording') {
            recorderRef.current.stop();
          }
        }, KAYIT_SURESI_MS);
      }).catch(reject);
    });
  }

  async function sesKaydiBaslat() {
    const audioBase64Array = [];
    try {
      for (let adim = 1; adim <= KAYIT_ADIM_SAYISI; adim++) {
        if (adim > 1) {
          // Finding 4: bir sonraki kayda hemen geçmek yerine kısa bir duraklama —
          // kullanıcı bu pencerede pasajı tekrar okumaya hazırlanabilir, aksi
          // halde sessiz kalıp sadece ilk kaydı dolduruyor.
          setKayitArasiBekleniyor(true);
          await new Promise((resolve) => setTimeout(resolve, KAYIT_ARASI_BEKLEME_MS));
          setKayitArasiBekleniyor(false);
        }
        setKayitAdimi(adim);
        const base64 = await birKayitYap();
        audioBase64Array.push(base64);
      }
    } catch (err) {
      setKayitAdimi(0);
      setKayitArasiBekleniyor(false);
      showToast('Mikrofon izni verilmedi');
      return;
    }

    setKayitAdimi(0);
    setKayitGonderiliyor(true);
    try {
      const profil = await voiceProfileAPI.enroll(audioBase64Array);
      setSesProfili(profil);
      showToast('Ses profiliniz oluşturuldu');
    } catch (err) {
      showToast('Ses profili kaydedilemedi, lütfen tekrar deneyin');
    } finally {
      setKayitGonderiliyor(false);
    }
  }

  async function sifreDegistir() {
    if (!sifreForm.yeni || sifreForm.yeni !== sifreForm.tekrar) { showToast('Yeni sifreler eslesmiyor'); return; }
    if (sifreForm.yeni.length < 8) { showToast('Sifre en az 8 karakter olmali'); return; }
    try {
      // Gerçek backend #1 uç noktası: POST /api/security/password/change
      // (security.routes.js) — currentPassword/newPassword/confirmPassword
      // ÜÇÜ de zorunlu (confirmPassword backend şemasında .refine() ile
      // newPassword'e eşitlik kontrolünden geçiyor). Backend ayrıca kendi
      // validatePasswordStrength kurallarını da uyguluyor (8 karakterden daha
      // fazlasını istiyor) — başarısız olursa 400 + error.message ile dönüyor.
      const res = await fetch('http://localhost:4000/api/security/password/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({
          currentPassword: sifreForm.eski,
          newPassword:     sifreForm.yeni,
          confirmPassword: sifreForm.tekrar,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        showToast(json?.error?.message || 'Hata');
        return;
      }
      showToast('Sifre basariyla degistirildi');
      setSifreModal(false);
      setSifreForm({ eski: '', yeni: '', tekrar: '' });
    } catch(e) { showToast('Sunucu hatasi'); }
  }
  const role = ROLES[curRole];
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ ad: role?.full || '', telefon: '', eposta: '' });

  const sicil = `OPX-2024-0${curRole + 1}42`;
  const eposta = `${(role?.av || 'UY').toLowerCase()}@merkezdevlet.gov.tr`;

  const sertifikalar = [
    ['Ameliyathane Hemşireliği Sertifikası', '2022'],
    ['İleri Yaşam Desteği (ACLS)', '2023'],
    ['Laparoskopik Cerrahi Asistanlığı', '2024'],
    ['Enfeksiyon Kontrolü Eğitimi', '2024'],
  ];

  const aktivite = [
    { val:'148', lbl:'Bu Ay Ameliyat', renk:'var(--teal)' },
    { val:'22',  lbl:'Çalışma Günü',   renk:'var(--slate)' },
    { val:'8',   lbl:'Nöbet Sayısı',   renk:'#7C3AED' },
    { val:'176s',lbl:'Toplam Mesai',   renk:'#059669' },
  ];

  return (
    <div>
      {/* Cover */}
      <div style={{ background:`linear-gradient(135deg, ${role?.bg || '#14B8A6'}, ${role?.bg || '#14B8A6'}99)`, borderRadius:16, height:140, position:'relative', marginBottom:48, overflow:'visible' }}>
        <button className="btn btn-secondary" onClick={() => setSifreModal(true)}
          style={{ position:'absolute', top:12, right:160, fontSize:11, background:'rgba(255,255,255,0.15)', color:'white', border:'1px solid rgba(255,255,255,0.3)' }}>
          Sifre Degistir
        </button>
        <button className="btn btn-secondary" onClick={() => setEditOpen(true)}
          style={{ position:'absolute', top:12, right:12, fontSize:11, background:'rgba(255,255,255,0.15)', color:'white', border:'1px solid rgba(255,255,255,0.3)' }}>
          ✏ Profili Düzenle
        </button>
        {/* Avatar */}
        <div style={{
          position:'absolute', bottom:-36, left:24,
          width:72, height:72, borderRadius:'50%',
          background: role?.bg || '#14B8A6', color:'white',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:22, fontWeight:800, border:'3px solid var(--card-bg)',
          boxShadow:'0 4px 12px rgba(0,0,0,0.15)',
        }}>{role?.av || 'ÜY'}</div>
      </div>

      {/* İsim + Rol */}
      <div style={{ padding:'0 24px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:800, color:'var(--slate)', fontFamily:"'Outfit',sans-serif" }}>{dbUser?.name || role?.full || 'Kullanici'}</div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:5, flexWrap:'wrap' }}>
            <span className="tag t-teal">{role?.name || 'Üst Yönetici'}</span>
            <span style={{ color:'var(--slate-light)', fontSize:11.5 }}>• {dbUser?.email || 'Merkez Devlet Hastanesi'}</span>
            <span style={{ color:'#059669', fontSize:11, fontWeight:600 }}>● Çevrimiçi</span>
          </div>
        </div>
      </div>

      {/* İçerik */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18, padding:'0 0 24px' }}>

        {/* Kişisel bilgiler */}
        <div className="panel">
          <div className="panel-hd">
            <div className="panel-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight:6, verticalAlign:'middle' }}>
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              Kişisel Bilgiler
            </div>
          </div>
          <div style={{ padding:'8px 0' }}>
            {[
              ['Ad Soyad',      role?.full || '—'],
              ['Unvan',         role?.name || '—'],
              ['Sicil No',      sicil],
              ['E-posta',       eposta, '#14B8A6'],
              ['Telefon',       `+90 5${30+curRole*7} ${100+curRole*37} ${20+curRole*11} ${30+curRole*5}`],
              ['Kurum',         'Merkez Devlet Hastanesi'],
              ['Sisteme Kayıt', '14 Ocak 2024'],
              ['Son Giriş',     'Bugün, 07:42'],
            ].map(([l, v, renk]) => (
              <div key={l} style={{ display:'flex', padding:'10px 18px', borderBottom:'1px solid var(--border)' }}>
                <span style={{ fontSize:11, fontWeight:600, color:'var(--slate-light)', width:130, flexShrink:0 }}>{l}</span>
                <span style={{ fontSize:12.5, color: renk || 'var(--slate)', fontWeight:500 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Aktivite + Sertifikalar */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {/* Aktivite */}
          <div className="panel">
            <div className="panel-hd">
              <div className="panel-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight:6, verticalAlign:'middle' }}>
                  <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
                Aktivite Özeti
              </div>
            </div>
            <div style={{ padding:'14px 18px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {aktivite.map((a, i) => (
                <div key={i} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'14px', textAlign:'center' }}>
                  <div style={{ fontSize:24, fontWeight:900, color:a.renk, fontFamily:"'Outfit',sans-serif", letterSpacing:'-0.5px' }}>{a.val}</div>
                  <div style={{ fontSize:11, color:'var(--slate-light)', marginTop:4 }}>{a.lbl}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Sertifikalar */}
          <div className="panel">
            <div className="panel-hd">
              <div className="panel-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight:6, verticalAlign:'middle' }}>
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                Sertifikalar & Eğitimler
              </div>
            </div>
            <div style={{ padding:'8px 18px 14px' }}>
              {sertifikalar.map(([ad, yil], i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom: i<sertifikalar.length-1?'1px solid var(--border)':'none' }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--teal)', flexShrink:0 }}/>
                  <span style={{ flex:1, fontSize:12.5, color:'var(--slate)' }}>{ad}</span>
                  <span style={{ fontSize:11, color:'var(--slate-light)', fontWeight:600 }}>{yil}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Ses Profili */}
          <div className="panel">
            <div className="panel-hd">
              <div className="panel-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight:6, verticalAlign:'middle' }}>
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
                Ses Profili
              </div>
            </div>
            <div style={{ padding:'14px 18px' }}>
              {sesProfili ? (
                <>
                  <div style={{ fontSize:12.5, color:'var(--slate)', fontWeight:600 }}>Ses profiliniz oluşturuldu</div>
                  <div style={{ fontSize:11, color:'var(--slate-light)', marginTop:4 }}>
                    Kayıt tarihi: {new Date(sesProfili.enrolledAt).toLocaleDateString('tr-TR')}
                  </div>
                  <div style={{ fontSize:12, color:'var(--slate-light)', lineHeight:1.5, marginTop:10 }}>
                    Yeniden kaydederken aşağıdaki cümleyi <strong>3 kez</strong>, her seferinde kendi doğal konuşma hızınızla okuyacaksınız:
                  </div>
                  <div style={{ fontSize:12.5, color:'var(--slate)', fontWeight:600, fontStyle:'italic', margin:'8px 0 12px', padding:'10px 12px', background:'var(--surface)', borderRadius:8, border:'1px solid var(--border)' }}>
                    "{SES_PASAJI}"
                  </div>
                  {kayitArasiBekleniyor && (
                    <div style={{ fontSize:11.5, color:'#059669', fontWeight:600, marginBottom:10 }}>
                      Hazır olun, cümleyi tekrar okuyun...
                    </div>
                  )}
                  <button
                    className="btn btn-secondary"
                    style={{ marginTop:12 }}
                    disabled={kayitAdimi > 0 || kayitGonderiliyor || kayitArasiBekleniyor}
                    onClick={sesKaydiBaslat}
                  >
                    {kayitArasiBekleniyor ? 'Tekrar okuyun...' : kayitAdimi > 0 ? `Kayıt ${kayitAdimi}/${KAYIT_ADIM_SAYISI}...` : kayitGonderiliyor ? 'Gönderiliyor...' : 'Yeniden Kaydet'}
                  </button>
                </>
              ) : (
                <>
                  <div style={{ fontSize:12, color:'var(--slate-light)', lineHeight:1.5 }}>
                    Ses profili oluşturmak için aşağıdaki cümleyi <strong>3 kez</strong>, her seferinde kendi doğal konuşma hızınızla okuyacaksınız. Her kayıttan sonra kısa bir duraklama olacak — o sırada cümleyi tekrar okumaya hazırlanın:
                  </div>
                  <div style={{ fontSize:12.5, color:'var(--slate)', fontWeight:600, fontStyle:'italic', margin:'8px 0 12px', padding:'10px 12px', background:'var(--surface)', borderRadius:8, border:'1px solid var(--border)' }}>
                    "{SES_PASAJI}"
                  </div>
                  {kayitArasiBekleniyor && (
                    <div style={{ fontSize:11.5, color:'#059669', fontWeight:600, marginBottom:10 }}>
                      Hazır olun, cümleyi tekrar okuyun...
                    </div>
                  )}
                  <button
                    className="btn btn-secondary"
                    disabled={kayitAdimi > 0 || kayitGonderiliyor || kayitArasiBekleniyor}
                    onClick={sesKaydiBaslat}
                  >
                    {kayitArasiBekleniyor ? 'Tekrar okuyun...' : kayitAdimi > 0 ? `Kayıt ${kayitAdimi}/${KAYIT_ADIM_SAYISI}...` : kayitGonderiliyor ? 'Gönderiliyor...' : 'Kayda Başla'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Spotify Hesabı */}
          <div className="panel">
            <div className="panel-hd">
              <div className="panel-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight:6, verticalAlign:'middle' }}>
                  <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                </svg>
                Spotify Hesabı
              </div>
            </div>
            <div style={{ padding:'14px 18px' }}>
              {spotifyBagli ? (
                <>
                  <div style={{ fontSize:12.5, color:'var(--slate)', fontWeight:600 }}>Spotify hesabınız bağlı</div>
                  <div style={{ fontSize:11, color:'var(--slate-light)', marginTop:4 }}>
                    Kiosk sesli asistanı artık müzik çalabilir.
                  </div>
                  <button className="btn btn-secondary" style={{ marginTop:12 }} onClick={spotifyBaglantiyiKaldir}>
                    Bağlantıyı Kaldır
                  </button>
                </>
              ) : (
                <>
                  <div style={{ fontSize:12, color:'var(--slate-light)', lineHeight:1.5 }}>
                    Kiosk sesli asistanının müzik çalabilmesi için Spotify hesabınızı bağlayın.
                  </div>
                  <button className="btn btn-secondary" style={{ marginTop:12 }} onClick={spotifyBaglan}>
                    Spotify Hesabımı Bağla
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Profil düzenle modal */}
      {sifreModal && (
        <Modal title="Sifre Degistir" onClose={() => setSifreModal(false)} width={400}>
          <div style={{background:'linear-gradient(135deg,#7C3AED,#6366F1,#0891b2)',borderRadius:10,padding:'12px 16px',marginBottom:16,color:'white',fontSize:12}}>
            Guclu bir sifre icin buyuk/kucuk harf ve rakam kullanin.
          </div>
          <div className="fg" style={{marginBottom:12}}>
            <label className="fl">MEVCUT SIFRE</label>
            <input className="fi" type="password" value={sifreForm.eski} onChange={e=>setSifreForm(p=>({...p,eski:e.target.value}))} placeholder="Mevcut sifreniz"/>
          </div>
          <div className="fg" style={{marginBottom:12}}>
            <label className="fl">YENI SIFRE</label>
            <input className="fi" type="password" value={sifreForm.yeni} onChange={e=>setSifreForm(p=>({...p,yeni:e.target.value}))} placeholder="En az 8 karakter"/>
          </div>
          <div className="fg" style={{marginBottom:16}}>
            <label className="fl">YENI SIFRE (TEKRAR)</label>
            <input className="fi" type="password" value={sifreForm.tekrar} onChange={e=>setSifreForm(p=>({...p,tekrar:e.target.value}))} placeholder="Tekrar girin"/>
          </div>
          <div className="mf">
            <button className="btn btn-secondary" onClick={()=>setSifreModal(false)}>Iptal</button>
            <button className="btn btn-primary" onClick={sifreDegistir}>Degistir</button>
          </div>
        </Modal>
      )}
      {editOpen && (
        <Modal title="Profili Düzenle" onClose={() => setEditOpen(false)} width={460}>
          <div className="fg" style={{ marginBottom:12 }}>
            <label className="fl">Ad Soyad</label>
            <input className="fi" value={form.ad} onChange={e => setForm({...form, ad:e.target.value})}/>
          </div>
          <div className="fg" style={{ marginBottom:12 }}>
            <label className="fl">Telefon</label>
            <input className="fi" placeholder="+90 5xx xxx xx xx" value={form.telefon} onChange={e => setForm({...form, telefon:e.target.value})}/>
          </div>
          <div className="fg" style={{ marginBottom:0 }}>
            <label className="fl">E-posta</label>
            <input className="fi" value={form.eposta || eposta} onChange={e => setForm({...form, eposta:e.target.value})}/>
          </div>
          <div className="mf">
            <button className="btn btn-secondary" onClick={() => setEditOpen(false)}>İptal</button>
            <button className="btn btn-primary" onClick={() => { showToast('Profil güncellendi ✓'); setEditOpen(false); }}>Kaydet</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
