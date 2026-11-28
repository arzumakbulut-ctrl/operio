import { useState, useEffect } from 'react';
import { useAuthStore, useUIStore } from '../store';
import { ROLES } from '../data/roles';
import { listSurgeries, updateSurgeryStatus, STATUS_TO_BACKEND } from '../services/surgeriesAdapter.js';

// Bu sayfanın kendi talep-triyaj sözlüğü ('Onaylandi'/'Reddedildi') backend'in
// gerçek ameliyat-durumu enum'u DEĞİL (WAITING|PREPARING|IN_PROGRESS|COMPLETED|
// CANCELLED|POSTPONED).
//
// Final review Finding 1: önceden Onaylandi→WAITING yazılıyordu. Ama WAITING,
// henüz hiç dokunulmamış/onaylanmamış bir ameliyatın da varsayılan durumu —
// reload sonrası dbToTalep ikisini ayırt edemiyor, onaylanmış bir talep her
// reload'da yeniden "Bekleyenler" sekmesine düşüyordu (bu dosyanın kendi
// "onaylandi" tab'ı SADECE backend durumuna bakıyor, ayırt edici başka bir
// alan yok — aşağıdaki dbToTalep'e bakınız). Onaylandi artık PREPARING
// yazıyor: STATUS_TO_TR'de 'Hazırlanıyor' TR etiketine okunuyor, hem
// WAITING'den ayırt edilebilir hem de "onay sonrası hazırlık aşaması"
// olarak anlamlı bir karşılık.
// Reddedildi→CANCELLED değişmedi (STATUS_TO_BACKEND['Iptal'] ile AYNI değer —
// AmeliyatDetay.jsx'teki 'Iptal' seçeneğiyle tutarlı, Task 3'ün kendi fix'i);
// burada STATUS_TO_BACKEND'den okunarak tek kaynaktan türetiliyor.
const TALEP_DURUM_TO_BACKEND = { Onaylandi: 'PREPARING', Reddedildi: STATUS_TO_BACKEND['Iptal'] };

// NOT: s.hasta/s.dr/s.tarihRaw/s.saat/s.bitis/s.salon/s.op/s.durum/s.hastaDetay
// surgeriesAdapter.listSurgeries()'in Türkçe-eşlenmiş alan adlarıdır (bkz. Task 2).
// s.doctor/s.surgeon_name/s.date/s.startTime/s.endTime/s.room/s.type/s.title/s.status
// eski/ham backend şekli — adapter bu alanları üretmiyor, geriye dönük uyumluluk
// için fallback olarak bırakıldı.
function dbToTalep(s) {
  const hastaAd = typeof s.hasta === 'string'
    ? (s.hasta || '—')
    : (s.hasta ? `${s.hasta.name || ''} ${s.hasta.surname || ''}`.trim() : '—');
  const drAd    = s.dr || s.doctor?.name || s.surgeon_name || '—';
  const drAv    = drAd.replace(/Dr\.\s*/,'').split(' ').map(w => w[0]||'').join('').slice(0,2).toUpperCase();
  const tarihDt = (s.tarihRaw || s.date) ? new Date(s.tarihRaw || s.date) : null;
  const tarihStr = tarihDt ? tarihDt.toLocaleDateString('tr-TR') : '—';
  const olusturanStr = s.createdAt ? new Date(s.createdAt).toLocaleString('tr-TR') : tarihStr;
  const statusVal = s.durum || s.status;
  // Final review Finding 1: 'Iptal' (CANCELLED'ın yeni okunan TR etiketi) ve
  // 'Hazırlanıyor' (PREPARING'in TR etiketi) case'leri eklendi — aksi halde
  // reddedilen/onaylanan bir talep reload sonrası tanınmayıp varsayılan
  // 'beklemede'ye düşerdi. 'Onaylandi'/'Reddedildi' dead-case'leri (eski
  // backend'in döndürdüğü, artık hiçbir zaman üretilmeyen TR string'leri)
  // geriye dönük uyumluluk için zararsızca bırakıldı.
  const durum = statusVal === 'Bekliyor'    ? 'beklemede'
    : statusVal === 'Iptal'                 ? 'reddedildi'
    : statusVal === 'Onaylandi'             ? 'onaylandi'
    : statusVal === 'Devam Ediyor'          ? 'onaylandi'
    : statusVal === 'Tamamlandi'            ? 'onaylandi'
    : statusVal === 'Hazırlanıyor'          ? 'onaylandi'
    : statusVal === 'Reddedildi'            ? 'reddedildi'
    : 'beklemede';
  const saatVal  = s.saat || s.startTime || '—';
  const bitisVal = s.bitis || s.endTime;
  return {
    id: s.id,
    doktor: drAd, doktorAv: drAv, doktorBg: '#DC2626',
    op: s.op || s.type || s.title || '—',
    hasta: { ad: hastaAd, yas: '—', tc: s.hastaDetay?.tc || s.hasta?.tc || '—' },
    tarih: tarihStr,
    saat: saatVal,
    sure: bitisVal ? `${saatVal} – ${bitisVal}` : '—',
    salon: s.salon || s.room?.name || '—',
    anestezi: '—',
    kartAdi: '',
    malzeme: [], cihaz: [], ilac: [],
    durum,
    olusturanTarih: olusturanStr,
    log: [{ tip:'talep', txt:'Ameliyat talebi oluşturuldu.', zaman: olusturanStr, av: drAv, bg:'#DC2626' }],
    not: s.notes || '',
  };
}

const ONAY_RENK = { beklemede:'#D97706', duzeltme:'#0284C7', onaylandi:'#059669', reddedildi:'#DC2626' };
const ONAY_TAG  = { beklemede:'t-orange', duzeltme:'t-blue',   onaylandi:'t-green',   reddedildi:'t-red' };
const ONAY_TXT  = { beklemede:'Beklemede', duzeltme:'Düzeltme Gerekli', onaylandi:'Onaylandı', reddedildi:'Reddedildi' };

const LOG_BG = { talep:'#059669', onay:'#14B8A6', duzeltme:'#0284C7', red:'#DC2626' };
const LOG_LBL= { talep:'Talep Oluşturuldu', onay:'Onaylandı', duzeltme:'Düzeltme İstendi', red:'Reddedildi' };

// ── COMPONENT ────────────────────────────────────────────────────
export default function OnayBekleyenler() {
  const { curRole }    = useAuthStore();
  const { showToast, bekleyenSayisi, setBekleyenSayisi } = useUIStore();
  const canAct = [0, 1, 7].includes(curRole);

  const [talepler, setTalepler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [aktifTab, setAktifTab] = useState('beklemede');
  const [selId, setSelId]       = useState(null);
  const [notAlan, setNotAlan]   = useState('');

  useEffect(() => {
    const token = localStorage.getItem('operio_access');
    if (!token) { setYukleniyor(false); return; }
    listSurgeries()
      .then(data => {
        const mapped = data.map(dbToTalep);
        setTalepler(mapped);
        setBekleyenSayisi(mapped.filter(t => t.durum === 'beklemede').length);
        const ilkBekleyen = mapped.find(t => t.durum === 'beklemede');
        if (ilkBekleyen) setSelId(ilkBekleyen.id);
        else if (mapped.length > 0) setSelId(mapped[0].id);
      })
      .catch(() => {})
      .finally(() => setYukleniyor(false));
  }, []);

  const tabSayilari = {
    beklemede:  talepler.filter(t => t.durum === 'beklemede').length,
    duzeltme:   talepler.filter(t => t.durum === 'duzeltme').length,
    onaylandi:  talepler.filter(t => t.durum === 'onaylandi').length,
    reddedildi: talepler.filter(t => t.durum === 'reddedildi').length,
  };

  const listedeki = talepler.filter(t => t.durum === aktifTab);
  const selTalep  = talepler.find(t => t.id === selId) || listedeki[0] || null;

  function switchTab(tab) {
    setAktifTab(tab);
    const ilk = talepler.find(t => t.durum === tab);
    setSelId(ilk?.id || null);
    setNotAlan('');
  }

  async function aksiyon(id, tip) {
    const t = talepler.find(x => x.id === id);
    if (!t) return;
    const not = notAlan.trim();
    const rol = ROLES[curRole];
    const zaman = new Date().toLocaleString('tr-TR');
    const av  = rol?.av || 'Y';
    const bg  = rol?.bg || '#14B8A6';

    let newDurum = null;
    let dbStatus = null;
    let logEntry = null;

    if (tip === 'onayla') {
      newDurum = 'onaylandi';
      dbStatus = 'Onaylandi';
      logEntry = { tip:'onay', txt:'Talep onaylandı.' + (not ? ' Not: ' + not : ''), zaman, av, bg };
    } else if (tip === 'duzelt') {
      if (!not) { showToast('Lütfen düzeltme gerekçesini yazın'); return; }
      newDurum = 'duzeltme';
      logEntry = { tip:'duzeltme', txt:'Düzeltme istendi: ' + not, zaman, av, bg };
    } else if (tip === 'reddet') {
      if (!not) { showToast('Lütfen red gerekçesini yazın'); return; }
      newDurum = 'reddedildi';
      dbStatus = 'Reddedildi';
      logEntry = { tip:'red', txt:'Talep reddedildi: ' + not, zaman, av, bg };
    }

    if (!newDurum) return;

    // Rollback için eski durumu sakla (DB çağrısı başarısız olursa geri alınır)
    const eskiDurum          = t.durum;
    const eskiTalepler       = talepler;
    const eskiAktifTab       = aktifTab;
    const eskiSelId          = selId;
    const eskiNotAlan        = notAlan;
    const eskiBekleyenSayisi = bekleyenSayisi;

    // Optimistic local update
    setTalepler(prev => prev.map(x => x.id !== id ? x : {
      ...x, durum: newDurum, not: not || x.not,
      log: [...x.log, logEntry],
    }));
    setAktifTab(newDurum);
    setSelId(id);
    setNotAlan('');

    // Sidebar badge güncelle
    const badgeDegisti = (eskiDurum === 'beklemede' || eskiDurum === 'duzeltme') && newDurum !== 'beklemede' && newDurum !== 'duzeltme';
    if (badgeDegisti) {
      setBekleyenSayisi(Math.max(0, bekleyenSayisi - 1));
    }

    // DB güncelle (sadece onay ve red için — 'duzelt' local-only triyaj durumu,
    // ameliyat durumu değil, bu yüzden DB çağrısı yapılmaz)
    if (dbStatus) {
      const sonuc = await updateSurgeryStatus(id, TALEP_DURUM_TO_BACKEND[dbStatus]);
      if (!sonuc) {
        // DB güncellemesi başarısız oldu — optimistic update'i geri al
        setTalepler(eskiTalepler);
        setAktifTab(eskiAktifTab);
        setSelId(eskiSelId);
        setNotAlan(eskiNotAlan);
        if (badgeDegisti) setBekleyenSayisi(eskiBekleyenSayisi);
        showToast('Hata');
        return;
      }
    }

    showToast(
      tip === 'onayla' ? 'Talep onaylandı ✓'
      : tip === 'duzelt' ? 'Düzeltme bildirimi gönderildi'
      : 'Talep reddedildi'
    );
  }

  return (
    <div>
      {/* Başlık */}
      <div className="page-hd" style={{ marginBottom:14 }}>
        <div>
          <div className="page-hd-title">Onay Bekleyen Randevular</div>
          <div className="page-hd-sub">Ameliyat talebi değerlendirme ekranı</div>
        </div>
        {(tabSayilari.beklemede + tabSayilari.duzeltme) > 0 && (
          <span className="tag t-orange" style={{ fontSize:11, padding:'5px 12px' }}>
            {tabSayilari.beklemede + tabSayilari.duzeltme} Değerlendirme Bekliyor
          </span>
        )}
      </div>

      {/* Tablar */}
      <div className="onay-tabs">
        {[
          { k:'beklemede',  lbl:'Bekleyenler' },
          { k:'duzeltme',   lbl:'Düzeltme İstenilenler' },
          { k:'onaylandi',  lbl:'Onaylananlar' },
          { k:'reddedildi', lbl:'Reddedilenler' },
        ].map(tab => (
          <div
            key={tab.k}
            className={`onay-tab${aktifTab === tab.k ? ' active' : ''}`}
            onClick={() => switchTab(tab.k)}>
            {tab.lbl}
            {tabSayilari[tab.k] > 0 && (
              <span className="onay-badge"
                style={{ background: tab.k === 'beklemede' || tab.k === 'duzeltme' ? 'var(--danger)' : '#94A3B8' }}>
                {tabSayilari[tab.k]}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* 2 kolonlu layout */}
      <div className={`onay-layout${listedeki.length === 0 ? ' tek-kolon' : ''}`}>

        {/* ── Sol: Liste ── */}
        <div>
          {yukleniyor ? (
            <div className="empty" style={{ padding:'40px 20px' }}>
              <div className="empty-text" style={{ color:'var(--slate-light)' }}>Yükleniyor...</div>
            </div>
          ) : listedeki.length === 0 ? (
            <div className="empty" style={{ padding:'40px 20px' }}>
              <div className="empty-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <div className="empty-text">Bu kategoride talep yok</div>
            </div>
          ) : listedeki.map(t => {
            const renkBar  = ONAY_RENK[t.durum] || '#94A3B8';
            const tagCls   = ONAY_TAG[t.durum];
            const tagTxt   = ONAY_TXT[t.durum];
            const isSelected = t.id === selId;
            return (
              <div
                key={t.id}
                className={`onay-card${isSelected ? ' selected' : ''}`}
                onClick={() => { setSelId(t.id); setNotAlan(t.not || ''); }}>
                <div className="onay-card-stripe" style={{ background: renkBar }}/>
                <div className="onay-card-body">
                  <div className="onay-card-top">
                    <div style={{ flex:1, minWidth:0 }}>
                      <div className="onay-card-op">{t.op}</div>
                      <div className="onay-card-doc">{t.doktor}</div>
                    </div>
                    <span className={`tag ${tagCls}`} style={{ fontSize:'9.5px', flexShrink:0 }}>{tagTxt}</span>
                  </div>
                  <div className="onay-card-meta">
                    <div className="onay-meta-chip">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                      </svg>
                      {t.hasta.ad}
                    </div>
                    <div className="onay-meta-chip">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      {t.tarih}
                    </div>
                    <div className="onay-meta-chip">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                      {t.saat} · {t.sure}
                    </div>
                  </div>
                </div>
                <div className="onay-card-footer">
                  <span style={{ fontSize:10, color:'var(--slate-light)' }}>Talep: {t.olusturanTarih}</span>
                  {t.not && <span style={{ fontSize:10, color:'var(--warning)', fontWeight:600 }}>⚠ Not var</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Sağ: Detay ── */}
        {listedeki.length > 0 && <div className="onay-detail">
          {!selTalep ? (
            <div className="empty"><div className="empty-text">Talep seçin</div></div>
          ) : (() => {
            const t       = selTalep;
            const renkBar = ONAY_RENK[t.durum] || '#94A3B8';
            const tagCls  = ONAY_TAG[t.durum];
            const tagTxt  = ONAY_TXT[t.durum];
            const canActNow = canAct && (t.durum === 'beklemede' || t.durum === 'duzeltme');

            return (
              <>
                {/* Detay başlık */}
                <div className="onay-detail-hd">
                  <div style={{ display:'flex', alignItems:'flex-start', gap:11 }}>
                    <div style={{ width:6, height:44, borderRadius:4, background:renkBar, flexShrink:0 }}/>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                        <div style={{ fontSize:14, fontWeight:700, color:'var(--slate)', fontFamily:"'Outfit',sans-serif", letterSpacing:'-0.3px' }}>{t.op}</div>
                        <span className={`tag ${tagCls}`} style={{ fontSize:'9.5px' }}>{tagTxt}</span>
                      </div>
                      <div style={{ fontSize:11, color:'var(--teal)', fontWeight:600 }}>{t.doktor}</div>
                    </div>
                  </div>
                </div>

                {/* Detay body */}
                <div className="onay-detail-body">

                  {/* Hasta Bilgileri */}
                  <div className="onay-section">
                    <div className="onay-section-title">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                      </svg>
                      Hasta Bilgileri
                    </div>
                    {[
                      ['Ad Soyad', t.hasta.ad],
                      ['Yaş / Cinsiyet', t.hasta.yas],
                      ['TC No', t.hasta.tc],
                    ].map(([l, v]) => (
                      <div key={l} className="onay-field-row">
                        <span className="ofl">{l}</span>
                        <span className="ofv">{v}</span>
                      </div>
                    ))}
                  </div>

                  {/* Ameliyat Detayları */}
                  <div className="onay-section">
                    <div className="onay-section-title">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                      </svg>
                      Ameliyat Detayları
                    </div>
                    {[
                      ['Tarih',               t.tarih],
                      ['Saat',                t.saat],
                      ['Tahmini Süre',        t.sure],
                      ['Tercih Edilen Salon', t.salon || 'Belirtilmedi'],
                      ['Anestezi',            t.anestezi],
                      ['Ameliyat Kartı',      t.kartAdi || '—'],
                    ].map(([l, v]) => (
                      <div key={l} className="onay-field-row">
                        <span className="ofl">{l}</span>
                        <span className="ofv">{v}</span>
                      </div>
                    ))}
                  </div>

                  {/* Malzeme & Ekipman */}
                  <div className="onay-section">
                    <div className="onay-section-title">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      </svg>
                      Malzeme & Ekipman
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                      {t.malzeme.map((m, i) => <span key={i} className="ak-chip blue"  style={{ fontSize:10 }}>{m}</span>)}
                      {t.cihaz.map((d, i)   => <span key={i} className="ak-chip orange" style={{ fontSize:10 }}>{d}</span>)}
                      {t.ilac.map((il, i)   => <span key={i} className="ak-chip pink"   style={{ fontSize:10 }}>{il}</span>)}
                    </div>
                  </div>

                  {/* İşlem Geçmişi */}
                  <div className="onay-section" style={{ marginBottom:0 }}>
                    <div className="onay-section-title">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                      İşlem Geçmişi
                    </div>
                    <div className="onay-timeline">
                      {t.log.map((l, i) => (
                        <div key={i} className="ot-item">
                          <div className="ot-dot" style={{ background: LOG_BG[l.tip] || '#94A3B8' }}>
                            {l.av}
                          </div>
                          <div className="ot-body">
                            <div className="ot-title">{LOG_LBL[l.tip] || l.tip}</div>
                            <div className="ot-note">{l.txt}</div>
                            <div className="ot-time">{l.zaman}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* Aksiyon footer — beklemede veya duzeltme */}
                {canActNow && (
                  <div className="onay-detail-ft">
                    <div style={{ fontSize:10, fontWeight:600, color:'var(--slate-light)', textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:4 }}>
                      Not / Gerekçe
                    </div>
                    <textarea
                      className="onay-not-area"
                      rows={2}
                      value={notAlan}
                      onChange={e => setNotAlan(e.target.value)}
                      placeholder="Onay notu, düzeltme gerekçesi veya red sebebi..."
                    />
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7, marginTop:2 }}>
                      <button className="onay-aksiyon-btn oba-onayla" onClick={() => aksiyon(t.id, 'onayla')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width:15, height:15 }}>
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Onayla
                      </button>
                      <button className="onay-aksiyon-btn oba-duzelt" onClick={() => aksiyon(t.id, 'duzelt')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:15, height:15 }}>
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Düzeltme İste
                      </button>
                    </div>
                    <button className="onay-aksiyon-btn oba-reddet" style={{ marginTop:2 }} onClick={() => aksiyon(t.id, 'reddet')}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:15, height:15 }}>
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                      Reddet
                    </button>
                  </div>
                )}

                {/* Onaylandı footer */}
                {canAct && t.durum === 'onaylandi' && (
                  <div className="onay-detail-ft">
                    <div style={{ background:'#ECFDF5', border:'1px solid #BBF7D0', borderRadius:9, padding:'11px 14px', textAlign:'center' }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'#059669', marginBottom:2 }}>✓ Onaylandı</div>
                      <div style={{ fontSize:11, color:'#065F46' }}>Bu talep onaylanmış ve ameliyat listesine eklenmiştir.</div>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>}

      </div>
    </div>
  );
}
