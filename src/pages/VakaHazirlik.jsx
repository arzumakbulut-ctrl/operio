import { useState, useCallback } from 'react';
import { useDataStore, useUIStore } from '../store';

const KATEGORILER = {
  setler:  { lbl: 'Steril Setler & Bohçalar', ic: '🛡️' },
  malzeme: { lbl: 'Sarf Malzemeleri',         ic: '📦' },
  cihaz:   { lbl: 'Cihaz & Ekipman',          ic: '🔌' },
};

function initHazirlik(s) {
  return {
    setler:  { ...KATEGORILER.setler,  items: (s.setler  ||[]).map(n=>({lbl:n,checked:false,qr:false})) },
    malzeme: { ...KATEGORILER.malzeme, items: (s.malzeme ||[]).map(n=>({lbl:n,checked:false})) },
    cihaz:   { ...KATEGORILER.cihaz,   items: (s.cihaz   ||[]).map(n=>({lbl:n,checked:false})) },
  };
}

// ── "Vakaya Ekle" MODAL — HTML'den birebir ────────────────────
function VhEkleModal({ surgId, onEkle, onClose }) {
  const { showToast } = useUIStore();
  const [kat,   setKat]   = useState('setler');
  const [ad,    setAd]    = useState('');
  const [adet,  setAdet]  = useState(1);
  const [not,   setNot]   = useState('');
  const [qr,    setQr]    = useState(false);

  function kaydet() {
    if (!ad.trim()) { showToast('Ad giriniz'); return; }
    const lbl = adet > 1
      ? `${ad.trim()} ×${adet}` + (not ? ` (${not})` : '')
      : ad.trim() + (not ? ` (${not})` : '');
    onEkle(kat, lbl, qr && kat === 'setler');
    showToast(`✓ "${ad.trim()}" vakaya eklendi`);
    onClose();
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)'}}
      onClick={onClose}>
      <div style={{width:480,background:'var(--card-bg)',borderRadius:18,overflow:'hidden',boxShadow:'0 24px 60px rgba(0,0,0,0.25)'}}
        onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{padding:'16px 20px',background:'linear-gradient(135deg,var(--teal),#0891b2)',display:'flex',alignItems:'center',gap:10}}>
          <div style={{fontSize:15,fontWeight:700,color:'white',flex:1}}>Vakaya Ekle</div>
          <div onClick={onClose} style={{color:'rgba(255,255,255,0.7)',cursor:'pointer',fontSize:20}}>✕</div>
        </div>

        {/* Form */}
        <div style={{padding:'18px 20px'}}>
          <div className="fr" style={{marginBottom:12}}>
            <div className="fg">
              <label className="fl">Kategori</label>
              <select className="fi" value={kat} onChange={e=>setKat(e.target.value)} style={{appearance:'none'}}>
                <option value="setler">🛡️ Steril Set / Bohça</option>
                <option value="malzeme">📦 Sarf Malzeme</option>
                <option value="cihaz">🔌 Cihaz / Ekipman</option>
              </select>
            </div>
            <div className="fg">
              <label className="fl">Adet</label>
              <input className="fi" type="number" value={adet} min={1} max={99} onChange={e=>setAdet(Number(e.target.value))} style={{width:80}}/>
            </div>
          </div>

          <div className="fg" style={{marginBottom:12}}>
            <label className="fl">Ad / Tanım</label>
            <input className="fi" autoFocus value={ad} onChange={e=>setAd(e.target.value)} placeholder="örn: Laparoskopi Seti C, Hemovak Dren ×2…"
              onKeyDown={e=>e.key==='Enter'&&kaydet()}/>
          </div>

          <div className="fg" style={{marginBottom:4}}>
            <label className="fl">Not (isteğe bağlı)</label>
            <input className="fi" value={not} onChange={e=>setNot(e.target.value)} placeholder="Özel not, boyut, renk vb."/>
          </div>

          {/* QR — sadece set seçiliyse */}
          {kat === 'setler' && (
            <div style={{marginTop:10,padding:'10px 13px',borderRadius:10,border:'1.5px dashed var(--teal-mid)',background:'rgba(20,184,166,0.04)',display:'flex',alignItems:'center',gap:10}}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                <path d="M14 14h3v3M17 17h3M14 20h3"/>
              </svg>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:600,color:'var(--teal)'}}>QR ile Teslim Al</div>
                <div style={{fontSize:'10.5px',color:'var(--slate-light)',marginTop:1}}>Seti ekledikten sonra QR okutarak teslim alabilirsiniz</div>
              </div>
              <input type="checkbox" checked={qr} onChange={e=>setQr(e.target.checked)} style={{width:16,height:16,accentColor:'var(--teal)'}}/>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{padding:'12px 20px',borderTop:'1px solid var(--border)',display:'flex',gap:8,justifyContent:'flex-end',background:'var(--surface)'}}>
          <button className="btn btn-secondary" onClick={onClose}>İptal</button>
          <button className="btn btn-primary" onClick={kaydet}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:13,height:13}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Ekle
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VakaHazirlik() {
  const { surgeries } = useDataStore();
  const { showToast } = useUIStore();
  const [selId,    setSelId]    = useState(null);
  const [hazirlik, setHazirlik] = useState({});
  const [tamamdi,  setTamamdi]  = useState({});
  const [qrDurum,  setQrDurum]  = useState({});
  const [notlar,   setNotlar]   = useState({});
  const [ekleModal, setEkleModal] = useState(false); // vakaya ekle modal

  const today = new Date().toLocaleDateString('tr-TR', { weekday:'long', day:'numeric', month:'long' });

  // Hazırlık state'ini başlat (yoksa)
  function getHz(s) {
    if (!hazirlik[s.id]) {
      const hz = initHazirlik(s);
      setHazirlik(prev => ({ ...prev, [s.id]: hz }));
      return hz;
    }
    return hazirlik[s.id];
  }

  function getStats(s) {
    const hz = hazirlik[s.id] || initHazirlik(s);
    const toplam = Object.values(hz).reduce((a,g) => a + g.items.length, 0);
    const tamam  = Object.values(hz).reduce((a,g) => a + g.items.filter(x=>x.checked).length, 0);
    const yuzde  = toplam ? Math.round(tamam/toplam*100) : 0;
    return { toplam, tamam, yuzde };
  }

  function toggle(surgId, grup, idx) {
    if (tamamdi[surgId]) return;
    setHazirlik(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      if (next[surgId]?.[grup]?.items[idx]) {
        next[surgId][grup].items[idx].checked = !next[surgId][grup].items[idx].checked;
      }
      return next;
    });
  }

  function tumunuIsaretle(surgId) {
    setHazirlik(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      if (next[surgId]) Object.values(next[surgId]).forEach(g => g.items.forEach(i => { i.checked = true; }));
      return next;
    });
  }

  function tamamla(surgId, s) {
    const hz = hazirlik[surgId] || initHazirlik(s);
    const toplam = Object.values(hz).reduce((a,g) => a+g.items.length, 0);
    const tamam  = Object.values(hz).reduce((a,g) => a+g.items.filter(x=>x.checked).length, 0);
    if (tamam < toplam) { showToast(`⚠ ${toplam-tamam} madde eksik — önce tamamlayın`); return; }
    setTamamdi(prev => ({ ...prev, [surgId]: true }));
    showToast('✅ Vaka hazırlığı onaylandı ve kaydedildi!');
  }

  function ekleKaydet(surgId, kat, lbl, withQr) {
    setHazirlik(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next[surgId]) return prev;
      if (!next[surgId][kat]) next[surgId][kat] = { ...KATEGORILER[kat], items: [] };
      next[surgId][kat].items.push({ lbl, checked: false, ekEklendi: true });
      return next;
    });
    // QR simülasyonu (set ise)
    if (withQr) {
      showToast('QR tarayıcı aktif…');
      setTimeout(() => {
        setHazirlik(prev => {
          const next = JSON.parse(JSON.stringify(prev));
          const items = next[surgId]?.setler?.items;
          if (items) items[items.length-1].checked = true;
          return next;
        });
        const idx = (hazirlik[surgId]?.setler?.items?.length || 0);
        setQrDurum(prev => ({...prev, [`${surgId}-${idx}`]: 'teslim_alindi'}));
        showToast(`✅ "${lbl}" QR ile teslim alındı`);
      }, 1800);
    }
  }

  const secili = surgeries.find(s => s.id === selId);

  return (
    <div style={{display:'flex',flexDirection:'column',gap:0,height:'100%',overflow:'hidden'}}>

      {/* Başlık */}
      <div style={{padding:'0 0 14px'}}>
        <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between'}}>
          <div>
            <div style={{fontSize:22,fontWeight:900,color:'var(--slate)',letterSpacing:'-0.5px',fontFamily:"'Outfit',sans-serif"}}>Vaka Hazırlığı</div>
            <div style={{fontSize:12,color:'var(--slate-light)',marginTop:3}}>
              Bugün {surgeries.length} vaka · {surgeries.filter(s=>s.durum==='Devam Ediyor').length} aktif
            </div>
          </div>
          <div style={{padding:'7px 14px',borderRadius:9,background:'var(--surface)',border:'1.5px solid var(--border)',fontSize:11,fontWeight:600,color:'var(--slate-mid)',display:'flex',alignItems:'center',gap:6}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            {today}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div style={{display:'grid',gridTemplateColumns:'320px 1fr',gap:14,flex:1,overflow:'hidden'}}>

        {/* Sol: Vaka listesi */}
        <div style={{overflowY:'auto',display:'flex',flexDirection:'column',gap:8,paddingRight:4}}>
          {surgeries.map(s => {
            const { toplam, tamam, yuzde } = getStats(s);
            const durumRenk = s.durum==='Devam Ediyor' ? 'var(--success)' : s.durum==='Tamamlandı' ? 'var(--teal)' : 'var(--warning)';
            const durumBg   = s.durum==='Devam Ediyor' ? 'rgba(5,150,105,0.1)' : s.durum==='Tamamlandı' ? 'rgba(20,184,166,0.1)' : 'rgba(245,158,11,0.1)';
            const isSelected = selId === s.id;
            return (
              <div key={s.id}
                onClick={() => { setSelId(s.id); getHz(s); }}
                style={{background:'var(--card-bg)',border:`1.5px solid ${isSelected?'var(--teal-mid)':'var(--border)'}`,borderRadius:13,padding:14,cursor:'pointer',transition:'all 0.15s',background:isSelected?'rgba(20,184,166,0.04)':'var(--card-bg)'}}
                onMouseEnter={e => { if(!isSelected) e.currentTarget.style.borderColor='var(--teal-mid)'; }}
                onMouseLeave={e => { if(!isSelected) e.currentTarget.style.borderColor='var(--border)'; }}>
                <div style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:10}}>
                  <div style={{width:38,height:38,borderRadius:10,background:'rgba(20,184,166,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:11,fontWeight:800,color:'var(--teal)'}}>{s.saat}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:'var(--slate)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.op}</div>
                    <div style={{fontSize:11,color:'var(--slate-light)',marginTop:2}}>{s.dr} · {s.salon}</div>
                  </div>
                  <span style={{fontSize:'9.5px',fontWeight:700,padding:'3px 9px',borderRadius:20,background:durumBg,color:durumRenk,flexShrink:0}}>{s.durum}</span>
                </div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:5}}>
                  <span style={{fontSize:'10.5px',color:'var(--slate-light)'}}>{tamam}/{toplam} hazır</span>
                  <span style={{fontSize:11,fontWeight:700,color:yuzde===100?'var(--success)':yuzde>50?'var(--warning)':'var(--danger)'}}>{yuzde}%</span>
                </div>
                <div className="vh-progress">
                  <div className="vh-progress-bar" style={{width:`${yuzde}%`,background:yuzde===100?'var(--success)':yuzde>50?'var(--warning)':'var(--teal)'}}/>
                </div>
              </div>
            );
          })}
        </div>

        {/* Sağ: Detay */}
        <div style={{overflowY:'auto',background:'var(--card-bg)',borderRadius:16,border:'1.5px solid var(--border)'}}>
          {!secili ? (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:14,color:'var(--slate-light)',padding:40}}>
              <div style={{width:60,height:60,borderRadius:16,background:'rgba(20,184,166,0.1)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="2"/><path d="M9 12h6M9 16h4"/></svg>
              </div>
              <div style={{fontSize:14,fontWeight:700,color:'var(--slate)'}}>Vaka Seçin</div>
              <div style={{fontSize:12,textAlign:'center'}}>Soldan bir vaka seçerek hazırlık listesini görüntüleyin</div>
            </div>
          ) : (() => {
            const s = secili;
            const hz = hazirlik[s.id] || initHazirlik(s);
            const toplam = Object.values(hz).reduce((a,g) => a+g.items.length, 0);
            const tamam  = Object.values(hz).reduce((a,g) => a+g.items.filter(x=>x.checked).length, 0);
            const yuzde  = toplam ? Math.round(tamam/toplam*100) : 0;
            const tamam_ = !!tamamdi[s.id];

            return (
              <div style={{padding:'18px 20px',display:'flex',flexDirection:'column',gap:16}}>

                {/* Header */}
                <div style={{paddingBottom:14,borderBottom:'1px solid var(--border)',background:'var(--surface)',margin:'-18px -20px 0',padding:'18px 20px'}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:14}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:16,fontWeight:800,color:'var(--slate)',letterSpacing:'-0.3px',fontFamily:"'Outfit',sans-serif"}}>{s.op}</div>
                      <div style={{display:'flex',gap:14,marginTop:6,fontSize:11,color:'var(--slate-light)',flexWrap:'wrap'}}>
                        <span>⏰ {s.saat} – {s.bitis}</span>
                        <span>👨‍⚕️ {s.dr}</span>
                        <span>📍 {s.salon}</span>
                        <span>👤 {s.hasta}</span>
                      </div>
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <div style={{fontSize:24,fontWeight:900,color:yuzde===100?'var(--success)':'var(--teal)',fontFamily:"'Outfit',sans-serif"}}>{yuzde}%</div>
                      <div style={{fontSize:10,color:'var(--slate-light)',marginTop:1}}>{tamam}/{toplam} tamamlandı</div>
                    </div>
                  </div>
                  <div className="vh-progress" style={{marginTop:12}}>
                    <div className="vh-progress-bar" style={{width:`${yuzde}%`}}/>
                  </div>
                </div>

                {/* Setler — QR */}
                <div>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                    <div style={{fontSize:'10.5px',fontWeight:700,color:'var(--slate-light)',textTransform:'uppercase',letterSpacing:'0.6px'}}>🛡️ Steril Setler & Bohçalar</div>
                    {!tamam_ && (
                      <button
                        className="vh-qr-btn"
                        onClick={() => setEkleModal(true)}
                        style={{padding:'5px 11px',fontSize:11,borderRadius:8}}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Set / Malzeme Ekle
                      </button>
                    )}
                  </div>
                  {hz.setler.items.map((item, i) => {
                    const qr = qrDurum[`${s.id}-${i}`];
                    const teslim = qr === 'teslim_alindi';
                    return (
                      <div key={i} className={`vh-set-card${teslim?' teslim':''}`}>
                        <div style={{width:38,height:38,borderRadius:10,background:teslim?'rgba(5,150,105,0.12)':'rgba(20,184,166,0.08)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,flexShrink:0}}>{teslim?'✅':'🛡️'}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:'12.5px',fontWeight:700,color:'var(--slate)'}}>{item.lbl}</div>
                          <div style={{fontSize:'10.5px',marginTop:2,color:teslim?'var(--success)':'var(--slate-light)'}}>{teslim?'✓ QR ile teslim alındı':'Steril depoya QR doğrulama bekliyor'}</div>
                        </div>
                        {teslim || tamam_ ? (
                          <span style={{fontSize:10,fontWeight:700,padding:'4px 10px',borderRadius:20,background:'rgba(5,150,105,0.1)',color:'var(--success)',border:'1px solid rgba(5,150,105,0.2)'}}>{teslim?'Teslim Alındı':'✓'}</span>
                        ) : (
                          <button onClick={() => qrSim(s.id, i, item.lbl)} style={{fontSize:'10.5px',background:'rgba(20,184,166,0.1)',color:'var(--teal)',border:'1.5px solid rgba(20,184,166,0.25)',borderRadius:8,padding:'5px 10px',cursor:'pointer',display:'flex',alignItems:'center',gap:5}}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3M17 17h3M14 20h3"/></svg>
                            QR Oku
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Diğer kategoriler */}
                {Object.entries(hz).filter(([k]) => k !== 'setler').map(([key, grup]) => {
                  const gTamam  = grup.items.filter(x=>x.checked).length;
                  const gToplam = grup.items.length;
                  const gYuzde  = gToplam ? Math.round(gTamam/gToplam*100) : 0;
                  return (
                    <div key={key} style={{marginBottom:14}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                        <div style={{fontSize:'10.5px',fontWeight:700,color:'var(--slate-light)',textTransform:'uppercase',letterSpacing:'0.6px'}}>{grup.ic} {grup.lbl}</div>
                        <span style={{fontSize:10,fontWeight:700,color:gYuzde===100?'var(--success)':'var(--slate-light)'}}>{gTamam}/{gToplam}</span>
                      </div>
                      <div className="vh-checklist">
                        {grup.items.map((item, i) => (
                          <div key={i} className={`vh-check-item${item.checked?' checked':''}${tamam_?' disabled':''}`}
                            onClick={() => toggle(s.id, key, i)}
                            style={tamam_ ? {cursor:'default',opacity:0.7} : {}}>
                            <div className="vh-check-box">
                              {item.checked && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                            </div>
                            <span className="vh-check-lbl">{item.lbl}</span>
                            {item.checked && <span style={{fontSize:9,color:'var(--success)',fontWeight:600,flexShrink:0}}>✓</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Lokal Anestezik */}
                {s.lokalProtokol && (
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:'10.5px',fontWeight:700,color:'var(--slate-light)',textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:10}}>💉 Lokal Anestezik Hazırlanış Protokolü</div>
                    <div style={{background:'rgba(124,58,237,0.05)',border:'1.5px solid rgba(124,58,237,0.18)',borderRadius:12,overflow:'hidden'}}>
                      <div style={{padding:'12px 16px',borderBottom:'1px solid rgba(124,58,237,0.12)',display:'flex',alignItems:'center',gap:10,background:'rgba(124,58,237,0.07)'}}>
                        <div style={{width:34,height:34,borderRadius:9,background:'rgba(124,58,237,0.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>💉</div>
                        <div>
                          <div style={{fontSize:'12.5px',fontWeight:700,color:'var(--slate)'}}>{s.anestezi}</div>
                          <div style={{fontSize:'10.5px',color:'var(--slate-light)',marginTop:1}}>Lokal protokol tanımlı · {s.sure} dk beklenen süre</div>
                        </div>
                        <span style={{marginLeft:'auto',fontSize:'9.5px',fontWeight:700,padding:'3px 10px',borderRadius:20,background:'rgba(124,58,237,0.1)',color:'#7C3AED',border:'1px solid rgba(124,58,237,0.2)'}}>Protokol Aktif</span>
                      </div>
                      <div style={{padding:'14px 16px'}}>
                        {s.lokalProtokol.split('\n').filter(l=>l.trim()).map((satir,i) => {
                          const isBaslik = satir.includes(':') && satir.split(':')[0].length < 30;
                          if (isBaslik) {
                            const [anahtar, ...deger] = satir.split(':');
                            return <div key={i} style={{display:'flex',gap:10,padding:'7px 0',borderBottom:'1px solid rgba(124,58,237,0.08)'}}>
                              <span style={{fontSize:11,fontWeight:700,color:'#7C3AED',minWidth:120,flexShrink:0}}>{anahtar}</span>
                              <span style={{fontSize:'11.5px',color:'var(--slate-mid)'}}>{deger.join(':').trim()}</span>
                            </div>;
                          }
                          return <div key={i} style={{fontSize:'11.5px',color:'var(--slate-mid)',padding:'5px 0',borderBottom:'1px solid rgba(124,58,237,0.06)'}}>{satir}</div>;
                        })}
                      </div>
                      <div style={{padding:'10px 16px',background:'rgba(220,38,38,0.04)',borderTop:'1px solid rgba(220,38,38,0.1)',display:'flex',gap:8,alignItems:'flex-start'}}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" style={{flexShrink:0,marginTop:1}}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        <span style={{fontSize:'10.5px',color:'var(--danger)',fontWeight:500}}>Lokal anestezik hazırlamadan önce hasta alerjilerini kontrol edin. Maksimum doza dikkat.</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Notlar */}
                <div>
                  <div style={{fontSize:'10.5px',fontWeight:700,color:'var(--slate-light)',textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:8}}>📝 Hazırlık Notu</div>
                  <textarea className="fi" rows={2} placeholder="Vaka ile ilgili özel notlar, dikkat edilecek hususlar…" style={{fontSize:12,width:'100%'}}
                    value={notlar[s.id]||''}
                    onChange={e => setNotlar(prev=>({...prev,[s.id]:e.target.value}))}/>
                </div>

                {/* Tamamla */}
                <div style={{display:'flex',gap:8}}>
                  {tamam_ ? (
                    <div style={{flex:1,padding:10,borderRadius:10,background:'rgba(5,150,105,0.08)',border:'1px solid rgba(5,150,105,0.2)',textAlign:'center',fontSize:12,fontWeight:700,color:'var(--success)'}}>
                      ✓ Hazırlık onaylandı ve kaydedildi
                    </div>
                  ) : (
                    <>
                      <button className="btn btn-secondary" style={{flex:1,fontSize:12}} onClick={() => tumunuIsaretle(s.id)}>Tümünü İşaretle</button>
                      <button className="btn btn-primary" style={{flex:1,fontSize:12}} onClick={() => tamamla(s.id, s)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:13,height:13}}><polyline points="20 6 9 17 4 12"/></svg>
                        Hazırlık Tamamlandı
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Vakaya Ekle Modal */}
      {ekleModal && selId !== null && (
        <VhEkleModal
          surgId={selId}
          onEkle={(kat, lbl, withQr) => ekleKaydet(selId, kat, lbl, withQr)}
          onClose={() => setEkleModal(false)}
        />
      )}
    </div>
  );
}
