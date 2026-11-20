import { useState } from 'react';
import { useDataStore, useUIStore, useAuthStore } from '../store';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWidgetDragDrop } from '../hooks/useWidgetDragDrop';
import AmeliyatDrawer from '../components/ui/AmeliyatDrawer';
import { ROLES } from '../data/roles';

const ST_RENK = { 'dot-active':'#059669', 'dot-wait':'#D97706', 'dot-done':'#94A3B8', 'dot-prep':'#0284C7' };
const ST_LBL  = { 'dot-active':'Devam Ediyor', 'dot-wait':'Bekliyor', 'dot-done':'Tamamlandı', 'dot-prep':'Hazırlanıyor' };
const AV_RENKLER = ['#DC2626','#0284C7','#7C3AED','#059669','#D97706','#EA580C'];

function av(ad) {
  if (!ad) return '';
  const p = ad.replace(/Dr\. |Hem\. |Uzm\. |Tek\. /g,'').split(' ');
  return (p[0]?.[0]||'') + (p[1]?.[0]||'');
}

// ── Ameliyat Satır Bileşeni ──────────────────────────────────
function AmeliyatRow({ s, curRole, myFullName, onClick }) {
  const renk   = ST_RENK[s.st] || '#94A3B8';
  const isAktif = s.st === 'dot-active';
  const isDone  = s.st === 'dot-done';
  const ekipUyeler = s.ekip ? [
    { ad:s.ekip.cerrah,  rol:'Cerrah'   },
    { ad:s.ekip.scrub,   rol:'Scrub'    },
    { ad:s.ekip.anestezi,rol:'Anestezi' },
  ].filter(e => e.ad && e.ad !== '—') : [];

  // Doktor (6) / Misafir Hekim (10) sadece kendi ameliyatına tıklayabilir.
  const isDrRole = curRole === 6 || curRole === 10;
  const benimAmeliyatim = s.dr === myFullName || s.ekip?.cerrah === myFullName;
  const tiklanabilir = !isDrRole || benimAmeliyatim;

  return (
    <div style={{ display:'flex', cursor:tiklanabilir?'pointer':'default', transition:'background 0.15s', borderBottom:'1px solid var(--border)', opacity:isDone?0.65:1 }}
      onClick={onClick}
      onMouseOver={e=>{ if (tiklanabilir) e.currentTarget.style.background='var(--surface)'; }}
      onMouseOut={e=>{ if (tiklanabilir) e.currentTarget.style.background=''; }}>

      {/* Durum çubuğu */}
      <div style={{ width:4, flexShrink:0, background:renk, boxShadow:isAktif?`0 0 12px ${renk}60`:'' }}/>

      {/* Saat */}
      <div style={{ width:64, flexShrink:0, padding:'18px 0 18px 14px', display:'flex', flexDirection:'column', gap:3 }}>
        <div style={{ fontSize:16, fontWeight:900, color:'var(--slate)', letterSpacing:'-0.5px', fontFamily:"'Outfit',sans-serif", lineHeight:1 }}>{s.saat}</div>
        <div style={{ fontSize:10, color:'var(--slate-light)', fontWeight:500 }}>{s.bitis}</div>
        {s.sure && <div style={{ marginTop:4, fontSize:'9.5px', fontWeight:700, color:renk, background:`${renk}12`, padding:'2px 6px', borderRadius:4 }}>{s.sure} dk</div>}
      </div>

      <div style={{ width:1, background:'var(--border)', margin:'14px 0', flexShrink:0 }}/>

      {/* Ana içerik */}
      <div style={{ flex:1, padding:'16px 18px', minWidth:0, display:'flex', flexDirection:'column', gap:8 }}>

        {/* Satır 1 */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
          <div style={{ fontSize:14, fontWeight:800, color:'var(--slate)', letterSpacing:'-0.4px', fontFamily:"'Outfit',sans-serif", lineHeight:1.2 }}>{s.op}</div>
          <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 12px', borderRadius:20, fontSize:10, fontWeight:700, background:`${renk}12`, color:renk, border:`1px solid ${renk}25`, whiteSpace:'nowrap', flexShrink:0 }}>
            {isAktif && <span style={{ width:6, height:6, borderRadius:'50%', background:renk, flexShrink:0 }}/>}
            {ST_LBL[s.st]}
          </span>
        </div>

        {/* Satır 2 */}
        <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{ width:18, height:18, borderRadius:'50%', background:'var(--surface)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--slate-light)" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <span style={{ fontSize:'12.5px', fontWeight:600, color:'var(--slate)' }}>{s.hasta}</span>
          </div>
          {s.dr && (
            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--slate-light)" strokeWidth="2"><path d="M9 12h6M9 16h6M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
              <span style={{ fontSize:'11.5px', fontWeight:600, color:'var(--slate-mid)' }}>{s.dr}</span>
            </div>
          )}
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
            <span style={{ fontSize:12, fontWeight:600, color:'var(--teal)' }}>{s.salon}</span>
          </div>
          {s.anestezi && <span style={{ fontSize:'11.5px', color:'var(--slate-mid)' }}>{s.anestezi}</span>}
          <div style={{ marginLeft:'auto', display:'flex', gap:5 }}>
            {(s.tags||[]).map((t,j) => <span key={j} className={`tag ${t}`} style={{ fontSize:10 }}>{s.tlbl?.[j]}</span>)}
          </div>
        </div>

        {/* Satır 3: Ekip */}
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {ekipUyeler.length ? (
            <>
              <div style={{ display:'flex', alignItems:'center' }}>
                {ekipUyeler.map((e,i) => (
                  <div key={i} title={`${e.ad} — ${e.rol}`}
                    style={{ width:26, height:26, borderRadius:'50%', background:AV_RENKLER[i%6], color:'white', fontSize:9, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid var(--card-bg)', marginLeft:i>0?'-6px':0 }}>
                    {av(e.ad)}
                  </div>
                ))}
              </div>
              <span style={{ fontSize:11, color:'var(--slate-light)' }}>{ekipUyeler.length} kişi</span>
            </>
          ) : <span style={{ fontSize:11, color:'var(--slate-light)' }}>Ekip atanmadı</span>}

          {isAktif && s.setler && (
            <div style={{ marginLeft:'auto', display:'flex', gap:10 }}>
              <span style={{ fontSize:11, color:'#059669', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/></svg>
                {s.setler.length} Set
              </span>
              {s.ilac && <span style={{ fontSize:11, color:'#059669', fontWeight:600 }}>✚ {s.ilac.length} İlaç</span>}
            </div>
          )}
        </div>

        {isAktif && <div style={{ height:2, background:`linear-gradient(90deg,${renk},${renk}40,transparent)`, borderRadius:2, marginTop:2 }}/>}
      </div>
    </div>
  );
}

// ── STERİL DASHBOARD ─────────────────────────────────────────
function SterilDashboard({ sterilSetler, tekliAletler, sterilPersonel, durumSetCfg, surgeries, navigate }) {
  const [drawerSurgery, setDrawerSurgery] = useState(null);
  const hazir        = sterilSetler.filter(s => s.durum === 'Steril — Hazır').length;
  const kullanimda   = sterilSetler.filter(s => s.durum === 'Kullanımda').length;
  const sterilizasyon= sterilSetler.filter(s => s.durum === 'Sterilizasyonda').length;
  const toplamAlet   = tekliAletler.length;
  const raflar = ['A','B','C','D','E'];

  return (
    <div>
      {/* Başlık */}
      <div className="page-hd" style={{ marginBottom:16 }}>
        <div>
          <div className="page-hd-title">Sterilizasyon Kontrol Paneli</div>
          <div className="page-hd-sub">Steril depo durumu ve günlük operasyon özeti</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/steril-setler')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:13,height:13}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Yeni Set Oluştur
        </button>
      </div>

      {/* KPI */}
      <div className="steril-kpi">
        <div className="stat-card stat-card-1">
          <div className="stat-card-glow"/><div className="stat-card-glow2"/>
          <div className="stat-icon si-teal">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
          </div>
          <div className="stat-val">{hazir}</div>
          <div className="stat-lbl">Steril & Hazır Set</div>
          <div className="stat-trend">✓ Kullanıma hazır</div>
        </div>
        <div className="stat-card stat-card-2">
          <div className="stat-card-glow"/><div className="stat-card-glow2"/>
          <div className="stat-icon si-blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div className="stat-val">{kullanimda}</div>
          <div className="stat-lbl">Kullanımda</div>
          <div className="stat-trend">⚡ Ameliyatta aktif</div>
        </div>
        <div className="stat-card stat-card-4">
          <div className="stat-card-glow"/><div className="stat-card-glow2"/>
          <div className="stat-icon si-orange">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div className="stat-val">{sterilizasyon}</div>
          <div className="stat-lbl">Sterilizasyonda</div>
          <div className="stat-trend">{sterilizasyon > 0 ? '🔄 İşlemde' : '— Boş'}</div>
        </div>
        <div className="stat-card stat-card-3">
          <div className="stat-card-glow"/><div className="stat-card-glow2"/>
          <div className="stat-icon si-purple">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H8a2 2 0 00-2 2v2h12V5a2 2 0 00-2-2z"/></svg>
          </div>
          <div className="stat-val">{toplamAlet}</div>
          <div className="stat-lbl">Tekli Alet</div>
          <div className="stat-trend">📦 Kayıtlı</div>
        </div>
      </div>

      {/* Body grid */}
      <div className="steril-body-grid">

        {/* Sol */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* Bugünkü ameliyatlar — set durumu */}
          <div className="panel">
            <div className="panel-hd">
              <span className="panel-title">Bugünkü Ameliyatlar — Set Durumu</span>
              <span style={{ fontSize:11, color:'var(--slate-light)' }}>{surgeries.length} ameliyat</span>
            </div>
            <div style={{ padding:0 }}>
              {surgeries.map(s => {
                const setAd  = sterilSetler.find(ss => ss.doktor === s.dr);
                const stRenk = setAd ? (durumSetCfg[setAd.durum] || {color:'#94A3B8',tag:'t-gray'}) : {color:'#94A3B8',tag:'t-gray'};
                const setRenk = setAd ? setAd.color : '#94A3B8';
                return (
                  <div key={s.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 18px', borderBottom:'1px solid var(--border)', transition:'background 0.12s', cursor:'pointer' }}
                    onClick={() => setDrawerSurgery(s)}
                    onMouseOver={e=>e.currentTarget.style.background='var(--surface)'}
                    onMouseOut={e=>e.currentTarget.style.background=''}>
                    <div style={{ width:3, alignSelf:'stretch', borderRadius:2, background:setRenk, flexShrink:0 }}/>
                    <div style={{ minWidth:44 }}>
                      <div style={{ fontSize:13, fontWeight:800, color:'var(--slate)' }}>{s.saat}</div>
                      <div style={{ fontSize:'10.5px', color:'var(--slate-light)' }}>{s.bitis}</div>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--slate)', marginBottom:2 }}>{s.op}</div>
                      <div style={{ fontSize:11, color:'var(--slate-light)' }}>{s.dr} · {s.salon}</div>
                    </div>
                    {setAd ? (
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:11, fontWeight:600, color:'var(--slate)', marginBottom:3 }}>{setAd.name}</div>
                        <span className={`tag ${stRenk.tag}`} style={{ fontSize:'9.5px' }}>{setAd.durum}</span>
                      </div>
                    ) : (
                      <span className="tag t-gray" style={{ fontSize:'9.5px' }}>Set Atanmadı</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sterilizasyondaki setler */}
          <div className="panel">
            <div className="panel-hd"><span className="panel-title">Sterilizasyondaki Setler</span></div>
            <div style={{ padding:0 }}>
              {sterilSetler.filter(s => s.durum === 'Sterilizasyonda').length === 0 ? (
                <div style={{ textAlign:'center', padding:28, fontSize:13, color:'var(--slate-light)' }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>✅</div>
                  Sterilizasyonda bekleyen set yok
                </div>
              ) : sterilSetler.filter(s => s.durum === 'Sterilizasyonda').map(s => (
                <div key={s.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 18px', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ width:38, height:38, borderRadius:10, background:`${s.color}18`, border:`1px solid ${s.color}33`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--slate)' }}>{s.name}</div>
                    <div style={{ fontSize:11, color:'var(--slate-light)', marginTop:2 }}>{s.doktor} · Raf {s.raf}</div>
                  </div>
                  <span className="tag t-orange">Sterilizasyonda</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sağ */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* Depo raf özeti */}
          <div className="panel">
            <div className="panel-hd">
              <span className="panel-title">Depo Raf Özeti</span>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/steril-depo')}>Depoyu Gör</button>
            </div>
            <div style={{ padding:'8px 16px' }}>
              {raflar.map(raf => {
                const setSayisi  = sterilSetler.filter(s => s.raf.startsWith(raf)).length;
                const aletSayisi = tekliAletler.filter(a => a.raf.startsWith(raf)).length;
                const dolu = setSayisi + aletSayisi;
                const pct  = Math.min(100, Math.round(dolu / 10 * 100));
                const renk = pct>80?'#DC2626':pct>50?'#D97706':'#059669';
                return (
                  <div key={raf} style={{ padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:26, height:26, borderRadius:7, background:'var(--surface)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:'var(--slate)' }}>{raf}</div>
                        <span style={{ fontSize:'12.5px', fontWeight:600, color:'var(--slate)' }}>{raf} Rafı</span>
                      </div>
                      <span style={{ fontSize:'11.5px', color:'var(--slate-mid)' }}>{setSayisi} set · {aletSayisi} alet</span>
                    </div>
                    <div style={{ height:5, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:renk, borderRadius:3, transition:'width 0.4s' }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Nöbetteki personel */}
          <div className="panel">
            <div className="panel-hd">
              <span className="panel-title">Nöbetteki Personel</span>
              <span className="tag t-green" style={{ fontSize:10 }}>{sterilPersonel.filter(p=>p.durum==='Aktif').length} Aktif</span>
            </div>
            <div style={{ padding:0 }}>
              {sterilPersonel.filter(p=>p.durum==='Aktif').map(p => (
                <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 16px', borderBottom:'1px solid var(--border)' }}>
                  <div className="avatar" style={{ background:p.bg, color:'white', width:32, height:32, fontSize:10, flexShrink:0 }}>{p.av}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--slate)' }}>{p.ad}</div>
                    <div style={{ fontSize:11, color:'var(--slate-light)', marginTop:1 }}>{p.gorev}</div>
                  </div>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:'#059669', boxShadow:'0 0 0 3px rgba(5,150,105,0.2)' }}/>
                </div>
              ))}
            </div>
          </div>

          {/* Hızlı işlemler */}
          <div className="panel">
            <div className="panel-hd"><span className="panel-title">Hızlı İşlemler</span></div>
            <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:8 }}>
              <button className="btn btn-secondary" style={{ width:'100%', justifyContent:'flex-start', gap:10 }} onClick={()=>navigate('/steril-setler')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Yeni Set Oluştur
              </button>
              <button className="btn btn-secondary" style={{ width:'100%', justifyContent:'flex-start', gap:10 }} onClick={()=>navigate('/tekli-aletler')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2"><path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/><path d="M20.5 10H19V8.5c0-.83-.67-1.5-1.5-1.5S16 7.67 16 8.5V10h-1.5c-.83 0-1.5.67-1.5 1.5S13.67 13 14.5 13H16v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V13h1.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5z"/><path d="M5.5 13c1.38 0 2.5-1.12 2.5-2.5S6.88 8 5.5 8 3 9.12 3 10.5 4.12 13 5.5 13z"/><path d="M5.5 13v6M5.5 8v-2"/></svg>
                Tekli Alet Ekle
              </button>
              <button className="btn btn-secondary" style={{ width:'100%', justifyContent:'flex-start', gap:10 }} onClick={()=>navigate('/steril-depo')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H8a2 2 0 00-2 2v2h12V5a2 2 0 00-2-2z"/></svg>
                Steril Depo
              </button>
            </div>
          </div>
        </div>
      </div>

      {drawerSurgery && (
        <AmeliyatDrawer surgery={drawerSurgery} onClose={() => setDrawerSurgery(null)}/>
      )}
    </div>
  );
}

// ── GENEL DASHBOARD (Ameliyat Listesi) ───────────────────────
function bildirimStil(tip) {
  if (tip === 'hata'   || tip === 'error')   return { ic:'⚠️', bg:'rgba(220,38,38,0.1)',   brd:'rgba(220,38,38,0.2)',   dot:'#DC2626' };
  if (tip === 'uyari'  || tip === 'warning')  return { ic:'🔔', bg:'rgba(217,119,6,0.08)',  brd:'rgba(217,119,6,0.2)',   dot:'#D97706' };
  if (tip === 'basari' || tip === 'success')  return { ic:'✅', bg:'rgba(5,150,105,0.06)',  brd:'rgba(5,150,105,0.15)',  dot:'#059669' };
  return                                             { ic:'🔵', bg:'rgba(2,132,199,0.08)',  brd:'rgba(2,132,199,0.2)',   dot:'#0284C7' };
}

function GenelDashboard({ surgeries, rooms, curRole, navigate }) {
  const { personel, bildirimler } = useDataStore();
  const [dashTab, setDashTab] = useState('tumAmeliyatlar');
  const [drawerSurgery, setDrawerSurgery] = useState(null);
  useWidgetDragDrop();
  const kisiselTabRoller = [3, 4, 5, 6, 10];
  const showKisiselTab = kisiselTabRoller.includes(curRole);
  const aktif    = surgeries.filter(s => s.st === 'dot-active').length;
  const bekleyen = surgeries.filter(s => s.st === 'dot-wait').length;

  // Salonları gerçek ameliyat verisiyle zenginleştir
  const enrichedRooms = rooms.map(r => {
    const devamEden = surgeries.find(s => s.salon === r.ad && s.st === 'dot-active');
    const ekipArr   = devamEden ? [
      devamEden.dr          ? av(devamEden.dr)                : null,
      devamEden.ekip?.scrub ? av(devamEden.ekip.scrub)        : null,
      devamEden.ekip?.anestezi ? av(devamEden.ekip.anestezi)  : null,
    ].filter(Boolean) : [];
    return {
      ...r,
      active: !!devamEden,
      op:     devamEden ? devamEden.op : '',
      ekip:   ekipArr,
      time:   devamEden ? `${devamEden.saat}–${devamEden.bitis}` : '',
    };
  });

  // Ameliyat Panosu'ndaki (Ameliyatlar.jsx) handleRowClick ile birebir aynı mantık.
  const myFullName = ROLES[curRole]?.full || '';
  function handleRowClick(s) {
    const benimAmeliyatim = s.dr === myFullName || s.ekip?.cerrah === myFullName;
    if (curRole === 3 || curRole === 2) {
      navigate('/hasta-takibi', { state: { surgeryId: s.id } });
    } else if (curRole === 6 || curRole === 10) {
      if (benimAmeliyatim) navigate('/ameliyat-detay', { state: { surgeryId: s.id } });
    } else if (curRole === 1) {
      navigate('/ameliyat-detay', { state: { surgeryId: s.id } });
    } else {
      setDrawerSurgery(s);
    }
  }

  return (
    <div>
      {/* Stat row — orijinal ICONS birebir */}
      <div className="stat-row">
        {[
          { val:surgeries.length, lbl:'Bugünkü Ameliyat',    trend:`🟢 ${aktif} Aktif · ⏳ ${bekleyen} Bekliyor`, cls:'stat-card-1', si:'si-teal',
            icon:<svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg> },
          { val:enrichedRooms.length, lbl:'Toplam Salon', trend:`🟢 ${aktif} Ameliyatta · ${enrichedRooms.filter(r=>!r.active).length} Boşta`, cls:'stat-card-2', si:'si-blue',
            icon:<svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M3 3h18v18H3zM3 9h18M9 21V9"/></svg> },
          { val:personel.filter(p=>p.durum==='Aktif').length||personel.length, lbl:'Kayıtlı Personel', trend:'DB kayitli', cls:'stat-card-3', si:'si-purple',
            icon:<svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg> },
          { val:surgeries.length, lbl:'Toplam Ameliyat', trend:'↑ +3 Geçen Haftaya Göre', cls:'stat-card-4', si:'si-orange',
            icon:<svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
        ].map((item,i) => (
          <div key={i} className={`stat-card ${item.cls}`}>
            <div className="stat-card-glow"/><div className="stat-card-glow2"/>
            <div className={`stat-icon ${item.si}`}>{item.icon}</div>
            <div className="stat-val">{item.val}</div>
            <div className="stat-lbl">{item.lbl}</div>
            <div className="stat-trend">{item.trend}</div>
          </div>
        ))}
      </div>

      <div className="cg">
        {/* Sol: Ameliyat listesi */}
        <div style={{ display:'flex', flexDirection:'column' }}>
          <div className="panel" style={{ flex:1, display:'flex', flexDirection:'column' }}>
            <div className="panel-hd">
              <div>
                <div className="panel-title">Günlük Ameliyat Programı</div>
                <div style={{ fontSize:10, color:'var(--slate-light)', marginTop:2, fontWeight:500 }}>
                  {new Date().toLocaleDateString('tr-TR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                {showKisiselTab && (
                  <div className="dash-tabs" style={{ marginBottom:0 }}>
                    <div className={`dash-tab${dashTab==='tumAmeliyatlar'?' active':''}`} onClick={()=>setDashTab('tumAmeliyatlar')}>
                      Tümü <span className="dash-tab-badge">{surgeries.length}</span>
                    </div>
                    <div className={`dash-tab${dashTab==='benimAmeliyatlarim'?' active':''}`} onClick={()=>setDashTab('benimAmeliyatlarim')}>
                      Benim <span className="dash-tab-badge" style={{ background:'var(--teal)' }}>0</span>
                    </div>
                  </div>
                )}
                {(curRole===0||curRole===1) && <button className="btn btn-primary btn-sm">+ Ekle</button>}
              </div>
            </div>
            <div className="slist" style={{ flex:1, overflowY:'auto' }}>
              {surgeries.length === 0 ? (
                <div style={{ padding:48, textAlign:'center', color:'var(--slate-light)' }}>
                  <div style={{ fontSize:36, marginBottom:10 }}>🏥</div>
                  <div style={{ fontSize:14, fontWeight:600, color:'var(--slate-mid)' }}>Bu listede ameliyat bulunmuyor</div>
                </div>
              ) : surgeries.map(s => <AmeliyatRow key={s.id} s={s} curRole={curRole} myFullName={myFullName} onClick={() => handleRowClick(s)}/>)}
            </div>
          </div>
        </div>

        {/* Sağ: Salon + Bildirimler */}
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
                {enrichedRooms.map((r, ri) => (
                  <div key={ri} className={`room-card${r.active?' active':''}`} style={{ cursor:'pointer' }}>
                    <div className="room-card-bar" style={{ background:r.active?'#059669':'#94A3B8' }}/>
                    <div className="room-hd">
                      <span className="room-name">{r.ad}</span>
                      <div className="room-dot" style={{ background:r.active?'#059669':'#94A3B8', boxShadow:r.active?'0 0 0 3px rgba(5,150,105,0.2)':'' }}/>
                    </div>
                    <div className="room-op">{r.op || 'Boş'}</div>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6 }}>
                      <div className="mini-avs">
                        {(r.ekip||[]).slice(0,3).map((s,i)=>(
                          <div key={i} className="mav" style={{ background:AV_RENKLER[i%6] }}>{s}</div>
                        ))}
                      </div>
                      <span className={`tag ${r.active?'t-green':'t-gray'}`} style={{ fontSize:9, padding:'2px 7px' }}>{r.active?'Aktif':'Bekleniyor'}</span>
                    </div>
                    {r.active && r.time && (
                      <div className="room-time" style={{ marginTop:6 }}>
                        <svg viewBox="0 0 24 24" strokeWidth="2" fill="none" width="10" height="10"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        {r.time}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bildirimler */}
          <div className="panel" style={{ flex:1 }}>
            <div className="panel-hd">
              <div className="panel-title">Son Bildirimler</div>
              <span style={{ fontSize:11, color:'var(--teal)', fontWeight:600, cursor:'pointer' }} onClick={() => navigate('/bildirimler')}>Tümü →</span>
            </div>
            {bildirimler.length === 0 ? (
              <div style={{ padding:'32px 18px', textAlign:'center', color:'var(--slate-light)', fontSize:12 }}>
                Henüz bildirim yok
              </div>
            ) : bildirimler.slice(0, 4).map(n => {
              const stil = bildirimStil(n.tip);
              return (
                <div key={n.id} style={{ display:'flex', gap:11, padding:'12px 18px', borderBottom:'1px solid var(--border)', alignItems:'flex-start' }}>
                  <div style={{ width:32, height:32, borderRadius:10, background:stil.bg, border:`1px solid ${stil.brd}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>{stil.ic}</div>
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

      {drawerSurgery && (
        <AmeliyatDrawer surgery={drawerSurgery} onClose={() => setDrawerSurgery(null)}/>
      )}
    </div>
  );
}

// ── EXPORT ───────────────────────────────────────────────────
export default function Dashboard() {
  const { surgeries, rooms, sterilSetlerV2, tekliAletler, sterilPersonel, durumSetCfg } = useDataStore();
  const { curRole } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  // /ameliyatlar path'inde her rol için ameliyat listesi göster
  const isAmeliyatlarPath = location.pathname === '/ameliyatlar';

  if (isAmeliyatlarPath) {
    return <GenelDashboard surgeries={surgeries} rooms={rooms || []} curRole={curRole} navigate={navigate}/>;
  }

  if (curRole === 8) {
    return <SterilDashboard
      sterilSetler={sterilSetlerV2}
      tekliAletler={tekliAletler}
      sterilPersonel={sterilPersonel}
      durumSetCfg={durumSetCfg}
      surgeries={surgeries}
      navigate={navigate}
    />;
  }
  return <GenelDashboard surgeries={surgeries} rooms={rooms || []} curRole={curRole} navigate={navigate}/>;
}
