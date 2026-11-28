import { useState, useEffect } from 'react';
import { useDataStore, useAuthStore, useUIStore } from '../store';
import { useWidgetDragDrop } from '../hooks/useWidgetDragDrop';
import AmeliyatDrawer from '../components/ui/AmeliyatDrawer';
import HastaDrawer from '../components/ui/HastaDrawer';
import { useNavigate } from 'react-router-dom';
import { ROLES } from '../data/roles';
import { createSurgery } from '../services/surgeriesAdapter';
import { listPatients, createPatient } from '../services/patientsAdapter';

// Orijinal HTML'deki AVCOLORS ve sabitler
const ST_RENK  = { 'dot-active':'#059669', 'dot-wait':'#D97706', 'dot-done':'#94A3B8', 'dot-prep':'#0284C7' };
const ST_LBL   = { 'dot-active':'Devam Ediyor', 'dot-wait':'Bekliyor', 'dot-done':'Tamamlandı', 'dot-prep':'Hazırlanıyor' };
const AV_RENK  = ['#DC2626','#0284C7','#7C3AED','#059669','#D97706','#EA580C'];

function bildirimStil(tip) {
  if (tip === 'hata'   || tip === 'error')   return { ic:'⚠️', bg:'rgba(220,38,38,0.1)',   brd:'rgba(220,38,38,0.2)',   dot:'#DC2626' };
  if (tip === 'uyari'  || tip === 'warning')  return { ic:'🔔', bg:'rgba(217,119,6,0.08)',  brd:'rgba(217,119,6,0.2)',   dot:'#D97706' };
  if (tip === 'basari' || tip === 'success')  return { ic:'✅', bg:'rgba(5,150,105,0.06)',  brd:'rgba(5,150,105,0.15)',  dot:'#059669' };
  return                                             { ic:'🔵', bg:'rgba(2,132,199,0.08)',  brd:'rgba(2,132,199,0.2)',   dot:'#0284C7' };
}

function avHarf(ad) {
  if (!ad) return '';
  const parts = ad.replace(/Dr\. |Hem\. |Uzm\. |Tek\. /g, '').split(' ');
  return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
}

// Orijinal buildAmeliyatListesi — birebir çeviri
function AmeliyatSatir({ s, curRole, myFullName, onClick }) {
  const renk    = ST_RENK[s.st]  || '#94A3B8';
  const stLbl   = ST_LBL[s.st]   || s.st;
  const isAktif = s.st === 'dot-active';
  const isDone  = s.st === 'dot-done';

  // Doktor erişim kontrolü (orijinalde curRole===6||curRole===10)
  const isDrRole = curRole === 6 || curRole === 10;
  const benimAmeliyatim = s.dr === myFullName || s.ekip?.cerrah === myFullName;
  // Doktor/Misafir Hekim sadece kendi ameliyatına tıklayabilir, başkasınınki tıklanamaz.
  const tiklanabilir = !isDrRole || benimAmeliyatim;
  const isKilitli = false; // React'ta drawer yok, kilitli göstermiyoruz

  // Ekip avatarları
  const ekipUyeler = s.ekip ? [
    { ad: s.ekip.cerrah,   rol: 'Cerrah'   },
    { ad: s.ekip.scrub,    rol: 'Scrub'    },
    { ad: s.ekip.anestezi, rol: 'Anestezi' },
  ].filter(e => e.ad && e.ad !== '—') : [];

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        cursor: tiklanabilir ? 'pointer' : 'default',
        transition: 'background 0.15s',
        borderBottom: '1px solid var(--border)',
        position: 'relative',
        opacity: isDone ? 0.65 : 1,
      }}
      onMouseOver={e => { if (tiklanabilir) e.currentTarget.style.background = 'var(--surface)'; }}
      onMouseOut={e  => { if (tiklanabilir) e.currentTarget.style.background = ''; }}
    >
      {/* Durum çubuğu */}
      <div style={{
        width: 4, flexShrink: 0,
        background: renk,
        boxShadow: isAktif ? `0 0 12px ${renk}60` : '',
      }}/>

      {/* Saat kolonu — orijinalde s.t / s.e / s.sure */}
      <div style={{ width:64, flexShrink:0, padding:'18px 0 18px 14px', display:'flex', flexDirection:'column', alignItems:'flex-start', gap:3 }}>
        <div style={{ fontSize:16, fontWeight:900, color:'var(--slate)', letterSpacing:'-0.5px', fontFamily:"'Outfit',sans-serif", lineHeight:1 }}>
          {s.saat}
        </div>
        <div style={{ fontSize:10, color:'var(--slate-light)', fontWeight:500 }}>{s.bitis}</div>
        {s.sure && (
          <div style={{ marginTop:4, fontSize:'9.5px', fontWeight:700, color:renk, background:`${renk}12`, padding:'2px 6px', borderRadius:4 }}>
            {s.sure} dk
          </div>
        )}
      </div>

      {/* Dikey ayraç */}
      <div style={{ width:1, background:'var(--border)', margin:'14px 0', flexShrink:0 }}/>

      {/* Ana içerik */}
      <div style={{ flex:1, padding:'16px 18px', minWidth:0, display:'flex', flexDirection:'column', gap:8 }}>

        {/* Satır 1: Ameliyat adı + durum rozeti */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
          <div style={{ fontSize:14, fontWeight:800, color:'var(--slate)', letterSpacing:'-0.4px', fontFamily:"'Outfit',sans-serif", lineHeight:1.2 }}>
            {s.op}
          </div>
          <span style={{
            display:'inline-flex', alignItems:'center', gap:5,
            padding:'4px 12px', borderRadius:20, fontSize:10, fontWeight:700,
            background:`${renk}12`, color:renk, border:`1px solid ${renk}25`,
            whiteSpace:'nowrap', flexShrink:0,
          }}>
            {isAktif && <span style={{ width:6, height:6, borderRadius:'50%', background:renk, flexShrink:0 }}/>}
            {stLbl}
          </span>
        </div>

        {/* Satır 2: Hasta + Salon + Anestezi + Taglar — orijinalde s.pt / s.sal */}
        <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{ width:18, height:18, borderRadius:'50%', background:'var(--surface)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--slate-light)" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <span style={{ fontSize:'12.5px', fontWeight:600, color:'var(--slate)' }}>{s.hasta}</span>
          </div>
          {s.dr && (
            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--slate-light)" strokeWidth="2">
                <path d="M9 12h6M9 16h6M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/>
              </svg>
              <span style={{ fontSize:'11.5px', fontWeight:600, color:'var(--slate-mid)' }}>{s.dr}</span>
            </div>
          )}
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            </svg>
            <span style={{ fontSize:12, fontWeight:600, color:'var(--teal)' }}>{s.salon}</span>
          </div>
          {s.anestezi && (
            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--slate-light)" strokeWidth="2">
                <path d="M12 2a2 2 0 012 2v5a2 2 0 01-2 2 2 2 0 01-2-2V4a2 2 0 012-2z"/>
              </svg>
              <span style={{ fontSize:'11.5px', color:'var(--slate-mid)' }}>{s.anestezi}</span>
            </div>
          )}
          {/* Taglar sağa */}
          <div style={{ marginLeft:'auto', display:'flex', gap:5, flexWrap:'wrap' }}>
            {(s.tags || []).map((t, j) => (
              <span key={j} className={`tag ${t}`} style={{ fontSize:10 }}>{s.tlbl?.[j]}</span>
            ))}
          </div>
        </div>

        {/* Satır 3: Ekip avatarları */}
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {ekipUyeler.length ? (
            <>
              <div style={{ display:'flex', alignItems:'center' }}>
                {ekipUyeler.map((e, i) => (
                  <div key={i} title={`${e.ad} — ${e.rol}`} style={{
                    width:26, height:26, borderRadius:'50%',
                    background: AV_RENK[i % 6], color:'white',
                    fontSize:9, fontWeight:700,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    border:'2px solid var(--card-bg)',
                    marginLeft: i > 0 ? '-6px' : '0',
                    cursor:'default',
                  }}>
                    {avHarf(e.ad)}
                  </div>
                ))}
              </div>
              <span style={{ fontSize:11, color:'var(--slate-light)' }}>{ekipUyeler.length} kişi</span>
            </>
          ) : (
            <span style={{ fontSize:11, color:'var(--slate-light)' }}>Ekip atanmadı</span>
          )}

          {/* Aktif ameliyat mini özet */}
          {isAktif && s.setler && (
            <div style={{ marginLeft:'auto', display:'flex', gap:10 }}>
              <span style={{ fontSize:11, color:'#059669', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2"/>
                </svg>
                {s.setler.length} Set
              </span>
              <span style={{ fontSize:11, color:'#059669', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 002 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                </svg>
                {s.ilac?.length || 0} İlaç
              </span>
            </div>
          )}
        </div>

        {/* Aktif ameliyat yeşil bar */}
        {isAktif && (
          <div style={{ height:2, background:`linear-gradient(90deg,${renk},${renk}40,transparent)`, borderRadius:2, marginTop:2 }}/>
        )}
      </div>
    </div>
  );
}

// ── Ana component ─────────────────────────────────────────────
export default function Ameliyatlar() {
  const { surgeries, rooms, hastalar, addSurgery, bildirimler } = useDataStore();
  const { curRole } = useAuthStore();
  const { showToast } = useUIStore();
  const [dashTab, setDashTab] = useState('tumAmeliyatlar');
  const [ekleModal, setEkleModal] = useState(false);
  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
  const [ekleForm, setEkleForm] = useState({tip:'',hastaAd:'',tarih:today,saat:'08:00',bitis:'10:00',salon:'',notlar:''});
  const [ekleLoading, setEkleLoading] = useState(false);
  const [aramaMetni, setAramaMetni] = useState('');
  const [durumFiltre, setDurumFiltre] = useState('Tumu');
  const [drawerSurgery, setDrawerSurgery] = useState(null);
  const [drawerHasta, setDrawerHasta] = useState(null);
  const navigate = useNavigate();

  // Salonları aktif ameliyat verisiyle zenginleştir
  const enrichedRooms = (rooms || []).map(r => {
    const devamEden = surgeries.find(s => s.salon === r.ad && s.st === 'dot-active');
    const ekipArr   = devamEden ? [
      devamEden.dr             ? avHarf(devamEden.dr)             : null,
      devamEden.ekip?.scrub    ? avHarf(devamEden.ekip.scrub)     : null,
      devamEden.ekip?.anestezi ? avHarf(devamEden.ekip.anestezi)  : null,
    ].filter(Boolean) : [];
    return {
      ...r,
      active: !!devamEden,
      op:     devamEden ? devamEden.op : '',
      ekip:   ekipArr,
      time:   devamEden ? `${devamEden.saat}–${devamEden.bitis}` : '',
    };
  });

  // Ameliyat satırındaki "Ad Soyad (yaş C)" formatından hasta adını çıkarıp
  // HASTALAR listesinde eşleşen kaydı bulur (Hastalar.jsx'teki Detay ile aynı kayıt).
  function hastaBul(s) {
    const ad = (s.hasta || '').replace(/\s*\(.*\)\s*$/, '').trim();
    return hastalar.find(h => h.ad === ad) || null;
  }

  useWidgetDragDrop();

  async function ekleAmeliyat() {
    if (!ekleForm.tip || !ekleForm.hastaAd) { showToast('Ameliyat tipi ve hasta zorunlu'); return; }
    setEkleLoading(true);
    try {
      const token = localStorage.getItem('operio_access');
      // Once hasta bul veya olustur
      const hastalarData = await listPatients();
      let hasta = hastalarData.find(h => (h.ad + ' ' + (h.soyad||'')).trim().toLowerCase() === ekleForm.hastaAd.toLowerCase());

      if (!hasta) {
        const adParts = ekleForm.hastaAd.trim().split(/\s+/);
        const ilkAd = adParts[0] || ekleForm.hastaAd;
        // Backend lastName icin min 2 karakter zorunlu tutuyor (schemas.js:
        // patientCreateSchema) - soyad girilmemisse adi tekrar kullaniyoruz,
        // bos string gondermek 400 ile reddedilirdi.
        const soyAd = adParts.slice(1).join(' ') || ilkAd;
        hasta = await createPatient({ firstName: ilkAd, lastName: soyAd });
        if (!hasta) throw new Error('Hasta olusturulamadi');
      }

      // Personel bul (doktor)
      const personelRes = await fetch('http://localhost:4000/api/personel', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const personelData = await personelRes.json();
      const doktor = personelData[0];

      const yeni = await createSurgery({
        title: ekleForm.tip,
        patientId: hasta.id,
        roomId: ekleForm.salon || null,
        surgeonName: doktor?.name || undefined,
        scheduledStart: new Date(ekleForm.tarih + 'T' + ekleForm.saat).toISOString(),
        scheduledEnd: new Date(ekleForm.tarih + 'T' + ekleForm.bitis).toISOString(),
        notes: ekleForm.notlar,
      });
      if (!yeni) throw new Error('Kayit hatasi');
      // Minor Finding B (final review): bare POST .../surgeries yanıtı
      // (RETURNING *, join yok) hasta/salon adını İÇERMEZ — mapSurgery bu
      // yüzden hasta/salon'u boş string döner, yeni satır reload'a kadar
      // boş görünürdü. Formda zaten elimizde olan hasta/salon bilgisiyle
      // dolduruyoruz (adapter'a dokunulmadı, sadece bu fonksiyona lokal
      // bir yama).
      const salonAdi = (rooms || []).find(r => r.id === ekleForm.salon);
      addSurgery({
        ...yeni,
        hasta: yeni.hasta || `${hasta.ad || ''} ${hasta.soyad || ''}`.trim(),
        salon: yeni.salon || (salonAdi ? (salonAdi.ad || salonAdi.name || '') : ''),
      });
      showToast('Ameliyat eklendi');
      setEkleModal(false);
      setEkleForm({tip:'',hastaAd:'',tarih:today,saat:'08:00',bitis:'10:00',salon:'',notlar:''});
    } catch(e) { showToast('Hata: ' + e.message); }
    setEkleLoading(false);
  }

  function exportCSV() {
    const headers = ['Ameliyat','Hasta','Doktor','Salon','Saat','Durum'];
    const rows = tumListe.map(s => [s.op||'',s.hasta||'',s.dr||'',s.salon||'',s.saat||'',s.durum||'']);
    const csv = [headers, ...rows].map(r => r.map(x => '"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'ameliyatlar.csv'; a.click();
    URL.revokeObjectURL(url);
    showToast('CSV indirildi');
  }

  const kisiselTabRoller = [2, 3, 4, 5, 6, 10];
  const showKisiselTab = kisiselTabRoller.includes(curRole);
  const tumListe = surgeries.filter(s => {
    const aramaUygun = !aramaMetni || 
      (s.op||'').toLowerCase().includes(aramaMetni.toLowerCase()) ||
      (s.hasta||'').toLowerCase().includes(aramaMetni.toLowerCase()) ||
      (s.dr||'').toLowerCase().includes(aramaMetni.toLowerCase()) ||
      (s.salon||'').toLowerCase().includes(aramaMetni.toLowerCase());
    const durumUygun = durumFiltre === 'Tumu' || s.durum === durumFiltre;
    return aramaUygun && durumUygun;
  });

  // Kişisel ameliyat listesi — role göre filtrele
  const myFullName = ROLES[curRole]?.full || '';
  const benimListe = surgeries.filter(s => {
    if (curRole === 2) return s.ekip?.anestezi === myFullName;
    if (curRole === 3) return s.ekip?.anesteknik === myFullName;
    if (curRole === 4 || curRole === 5) return s.ekip?.scrub === myFullName || s.ekip?.sirkule === myFullName;
    if (curRole === 6 || curRole === 10) return s.dr === myFullName || s.ekip?.cerrah === myFullName;
    return false;
  });

  const aktivListe = (dashTab === 'benimAmeliyatlarim' && showKisiselTab) ? benimListe : tumListe;
  const aktifAmeliyat    = tumListe.filter(s => s.st === 'dot-active').length;
  const bekleyenAmeliyat = tumListe.filter(s => s.st === 'dot-wait').length;

  // Satıra tıklama — Anestezi Teknisyeni doğrudan forma gider
  function handleRowClick(s) {
    const benimAmeliyatim = s.dr === myFullName || s.ekip?.cerrah === myFullName;
    if (curRole === 3 || curRole === 2) {
      navigate('/hasta-takibi', { state: { surgeryId: s.id } });
    } else if (curRole === 6 || curRole === 10) {
      if (benimAmeliyatim) navigate('/ameliyat-detay', { state: { surgeryId: s.id } });
      // Kendi ameliyatı değilse tıklama bir şeye yol açmaz.
    } else if (curRole === 7) {
      setDrawerHasta(hastaBul(s));
    } else if (curRole === 1) {
      navigate('/ameliyat-detay', { state: { surgeryId: s.id } });
    } else {
      setDrawerSurgery(s);
    }
  }

  return (
    <div>
      {/* KPI Kartları — orijinal ICONS.ane / ICONS.room / ICONS.users / ICONS.cal */}
      <div className="stat-row">
        <div className="stat-card stat-card-1">
          <div className="stat-card-glow"/><div className="stat-card-glow2"/>
          <div className="stat-icon si-teal">
            {/* ICONS.ane */}
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <div className="stat-val">{tumListe.length}</div>
          <div className="stat-lbl">Bugünkü Ameliyat</div>
          <div className="stat-trend">🟢 {aktifAmeliyat} Aktif · ⏳ {bekleyenAmeliyat} Bekliyor</div>
        </div>
        <div className="stat-card stat-card-2">
          <div className="stat-card-glow"/><div className="stat-card-glow2"/>
          <div className="stat-icon si-blue">
            {/* ICONS.room */}
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M3 3h18v18H3zM3 9h18M9 21V9"/>
            </svg>
          </div>
          <div className="stat-val">4</div>
          <div className="stat-lbl">Aktif Ameliyat Salonu</div>
          <div className="stat-trend">⚠ 1 Ekipman Uyarısı</div>
        </div>
        <div className="stat-card stat-card-3">
          <div className="stat-card-glow"/><div className="stat-card-glow2"/>
          <div className="stat-icon si-purple">
            {/* ICONS.users */}
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </div>
          <div className="stat-val">24</div>
          <div className="stat-lbl">Nöbetteki Personel</div>
          <div className="stat-trend">👩‍⚕️ 3 Hemşire · 🔬 4 Teknisyen</div>
        </div>
        <div className="stat-card stat-card-4">
          <div className="stat-card-glow"/><div className="stat-card-glow2"/>
          <div className="stat-icon si-orange">
            {/* ICONS.cal */}
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div className="stat-val">12</div>
          <div className="stat-lbl">Bu Hafta Toplam</div>
          <div className="stat-trend">↑ +3 Geçen Haftaya Göre</div>
        </div>
      </div>

      {/* Ana içerik — cg grid */}
      <div className="cg">

        {/* Sol: Ameliyat listesi */}
        <div style={{ display:'flex', flexDirection:'column' }}>
          <div className="panel" style={{ flex:1, display:'flex', flexDirection:'column' }}>
            <div className="panel-hd">
              <div>
                <div className="panel-title">Günlük Ameliyat Programı</div>
              <div style={{display:'flex',gap:6,marginTop:6,alignItems:'center'}}>
                <input value={aramaMetni} onChange={e=>setAramaMetni(e.target.value)} placeholder="Ara..." className="fi" style={{fontSize:11,padding:'5px 8px',width:160}}/>
                <select value={durumFiltre} onChange={e=>setDurumFiltre(e.target.value)} className="fi" style={{fontSize:11,padding:'5px 8px',width:120}}>
                  <option value="Tumu">Tüm Durumlar</option>
                  <option value="Bekliyor">Bekliyor</option>
                  <option value="Devam Ediyor">Devam Ediyor</option>
                  <option value="Tamamlandi">Tamamlandı</option>
                </select>
              </div>
                <div style={{ fontSize:10, color:'var(--slate-light)', marginTop:2, fontWeight:500 }}>
                  {new Date().toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric', weekday:'long' })}
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                {showKisiselTab && (
                  <div className="dash-tabs" style={{ marginBottom:0 }}>
                    <div className={`dash-tab${dashTab === 'tumAmeliyatlar' ? ' active' : ''}`}
                      onClick={() => setDashTab('tumAmeliyatlar')}>
                      Tümü <span className="dash-tab-badge">{tumListe.length}</span>
                    </div>
                    <div className={`dash-tab${dashTab === 'benimAmeliyatlarim' ? ' active' : ''}`}
                      onClick={() => setDashTab('benimAmeliyatlarim')}>
                      Benim <span className="dash-tab-badge" style={{ background: benimListe.length ? 'var(--teal)' : '#94A3B8' }}>
                        {benimListe.length}
                      </span>
                    </div>
                  </div>
                )}
                <button className="btn btn-secondary btn-sm" onClick={exportCSV}>⬇ CSV</button>
                {(curRole === 0 || curRole === 1) && (
                  <button className="btn btn-primary btn-sm" onClick={()=>setEkleModal(true)}>+ Ekle</button>
                )}
              </div>
            </div>

            {/* slist */}
            <div className="slist" style={{ flex:1, overflowY:'auto' }}>
              {aktivListe.length === 0 ? (
                <div style={{ padding:48, textAlign:'center', color:'var(--slate-light)' }}>
                  <div style={{ fontSize:36, marginBottom:10 }}>🏥</div>
                  <div style={{ fontSize:14, fontWeight:600, color:'var(--slate-mid)' }}>Bu listede ameliyat bulunmuyor</div>
                </div>
              ) : aktivListe.map(s => (
                <AmeliyatSatir key={s.id} s={s} curRole={curRole} myFullName={myFullName} onClick={() => handleRowClick(s)}/>
              ))}
            </div>
          </div>
        </div>

        {/* Sağ: Salon Durumu + Bildirimler */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Salon durumu */}
          <div className="panel">
            <div className="panel-hd">
              <div>
                <div className="panel-title">Salon Durumu</div>
                <div style={{ fontSize:10, color:'var(--slate-light)', marginTop:2 }}>Anlık güncelleme</div>
              </div>
              <button className="btn btn-secondary btn-sm" style={{ fontSize:'10.5px' }}>Takvim</button>
            </div>
            <div style={{ padding:'14px 16px' }}>
              <div className="rooms-grid">
                {enrichedRooms.map((r, ri) => {
                  const barRenk = r.active ? '#059669' : '#94A3B8';
                  return (
                    <div key={ri} className={`room-card${r.active ? ' active' : ''}`} style={{ cursor:'pointer' }}>
                      <div className="room-card-bar" style={{ background:barRenk }}/>
                      <div className="room-hd">
                        <span className="room-name">{r.ad}</span>
                        <div className="room-dot" style={{
                          background: barRenk,
                          boxShadow: r.active ? '0 0 0 3px rgba(5,150,105,0.2)' : '',
                        }}/>
                      </div>
                      <div className="room-op">{r.op || 'Boş'}</div>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6 }}>
                        <div className="mini-avs">
                          {(r.ekip || []).slice(0, 3).map((s, i) => (
                            <div key={i} className="mav" style={{ background:AV_RENK[i % 6] }}>{s}</div>
                          ))}
                        </div>
                        <span className={`tag ${r.active ? 't-green' : 't-gray'}`} style={{ fontSize:9, padding:'2px 7px' }}>
                          {r.active ? 'Aktif' : 'Bekleniyor'}
                        </span>
                      </div>
                      {r.active && r.time && (
                        <div className="room-time" style={{ marginTop:6 }}>
                          <svg viewBox="0 0 24 24" strokeWidth="2" fill="none" width="10" height="10">
                            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                          </svg>
                          {r.time}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Anlık Bildirimler */}
          <div className="panel" style={{ flex:1 }}>
            <div className="panel-hd">
              <div className="panel-title">Son Bildirimler</div>
              <span style={{ fontSize:11, color:'var(--teal)', fontWeight:600, cursor:'pointer' }} onClick={() => navigate('/bildirimler')}>Tümü →</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
              {bildirimler.length === 0 ? (
                <div style={{ padding:'32px 18px', textAlign:'center', color:'var(--slate-light)', fontSize:12 }}>
                  Henüz bildirim yok
                </div>
              ) : bildirimler.slice(0, 4).map(n => {
                const stil = bildirimStil(n.tip);
                return (
                  <div key={n.id} style={{ display:'flex', gap:11, padding:'12px 18px', borderBottom:'1px solid var(--border)', alignItems:'flex-start' }}>
                    <div style={{ width:32, height:32, borderRadius:10, background:stil.bg, border:`1px solid ${stil.brd}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>
                      {stil.ic}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, color:'var(--slate)', lineHeight:1.5, fontWeight: n.okundu ? 400 : 600 }}>
                        {n.baslik ? <><strong>{n.baslik}</strong>{n.mesaj ? ': ' + n.mesaj : ''}</> : n.mesaj}
                      </div>
                      <div style={{ fontSize:10, color:'var(--slate-light)', marginTop:3 }}>{n.zaman}</div>
                    </div>
                    <div style={{ width:7, height:7, borderRadius:'50%', background: n.okundu ? 'var(--border)' : stil.dot, flexShrink:0, marginTop:6 }}/>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {ekleModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}}>
          <div style={{background:'var(--card-bg)',borderRadius:16,padding:0,width:480,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}>
            <div style={{padding:'20px 24px',background:'linear-gradient(135deg,#7C3AED,#6366F1,#0891b2)',borderRadius:'16px 16px 0 0',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{fontSize:16,fontWeight:800,color:'white'}}>Yeni Ameliyat Ekle</div>
              <button onClick={()=>setEkleModal(false)} style={{background:'rgba(255,255,255,0.2)',border:'none',borderRadius:8,width:28,height:28,cursor:'pointer',color:'white',fontSize:16}}>✕</button>
            </div>
            <div style={{padding:24}}>
              <div className="fg" style={{marginBottom:12}}>
                <label className="fl">AMELİYAT TİPİ *</label>
                <input className="fi" value={ekleForm.tip} onChange={e=>setEkleForm(p=>({...p,tip:e.target.value}))} placeholder="Laparoskopik Kolesistektomi..."/>
              </div>
              <div className="fg" style={{marginBottom:12}}>
                <label className="fl">HASTA ADI *</label>
                <input className="fi" value={ekleForm.hastaAd} onChange={e=>setEkleForm(p=>({...p,hastaAd:e.target.value}))} placeholder="Ad Soyad"/>
              </div>
              <div className="fg" style={{marginBottom:12}}>
                <label className="fl">TARİH *</label>
                <input className="fi" type="date" value={ekleForm.tarih} onChange={e=>setEkleForm(p=>({...p,tarih:e.target.value}))}/>
              </div>
              <div className="fr" style={{marginBottom:12}}>
                <div className="fg">
                  <label className="fl">BAŞLANGIC</label>
                  <input className="fi" type="time" value={ekleForm.saat} onChange={e=>setEkleForm(p=>({...p,saat:e.target.value}))}/>
                </div>
                <div className="fg">
                  <label className="fl">BİTİŞ</label>
                  <input className="fi" type="time" value={ekleForm.bitis} onChange={e=>setEkleForm(p=>({...p,bitis:e.target.value}))}/>
                </div>
              </div>
              <div className="fg" style={{marginBottom:12}}>
                <label className="fl">SALON</label>
                <select className="fi" value={ekleForm.salon} onChange={e=>setEkleForm(p=>({...p,salon:e.target.value}))}>
                  <option value="">Salon seçin (opsiyonel)</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.ad||r.name}</option>)}
                </select>
              </div>
              <div className="fg" style={{marginBottom:20}}>
                <label className="fl">NOTLAR</label>
                <textarea className="fi" rows={2} value={ekleForm.notlar} onChange={e=>setEkleForm(p=>({...p,notlar:e.target.value}))} style={{resize:'none'}}/>
              </div>
              <div className="mf">
                <button className="btn btn-secondary" onClick={()=>setEkleModal(false)}>İptal</button>
                <button className="btn btn-primary" onClick={ekleAmeliyat} disabled={ekleLoading}>
                  {ekleLoading ? 'Kaydediliyor...' : 'Ameliyat Ekle'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {drawerSurgery && (
        <AmeliyatDrawer surgery={drawerSurgery} onClose={() => setDrawerSurgery(null)}/>
      )}
      {drawerHasta && (
        <HastaDrawer hasta={drawerHasta} onClose={() => setDrawerHasta(null)}/>
      )}
    </div>
  );
}
