import { useState } from 'react';
import { useDataStore, useUIStore } from '../store';

const SAYIM_KATEGORILER = [
  {key:'gaz',   lbl:'Gazlı Bez',       ic:'🧻'},
  {key:'alet',  lbl:'Cerrahi Aletler', ic:'🔧'},
  {key:'igne',  lbl:'İğne & Sütür',    ic:'🪡'},
  {key:'kanal', lbl:'Kanül & Tüp',     ic:'🔌'},
  {key:'diger', lbl:'Diğer Malzeme',   ic:'📦'},
];

function initData(s) {
  const aletler = (s.setler||[]).flatMap(setAd => [setAd]);
  return {
    gaz: [
      {ad:'Gazlı Bez 10×10 cm',     baslangic:20, bitis:null, bitis2:null},
      {ad:'Laparotomi Pedi',         baslangic:5,  bitis:null, bitis2:null},
      {ad:'Küçük Gazlı (5×5 cm)',    baslangic:10, bitis:null, bitis2:null},
    ],
    alet: aletler.map(ad => ({ad, baslangic:1, bitis:null, bitis2:null})),
    igne: [
      {ad:'Absorbabl Sütür 2-0', baslangic:2, bitis:null, bitis2:null},
      {ad:'Absorbabl Sütür 3-0', baslangic:2, bitis:null, bitis2:null},
    ],
    kanal: (s.malzeme||[]).filter(m=>/(dren|trokar|kanül)/i.test(m)).map(ad=>({ad,baslangic:1,bitis:null,bitis2:null})),
    diger: [],
    imzalar: {scrub:null, sirkule:null, cerrah:null},
    durum: 'aktif',
    notlar: '',
  };
}

// ── SAYIM MODAL ───────────────────────────────────────────────
function SayimModal({ s, data, onClose, onUpdate }) {
  const { showToast } = useUIStore();
  const [d, setD] = useState(JSON.parse(JSON.stringify(data)));

  function guncelle(kat, idx, alan, val) {
    setD(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      if (next[kat]?.[idx] !== undefined) {
        next[kat][idx][alan] = val === '' ? null : Number(val);
      }
      return next;
    });
  }

  function ekleItem(kat) {
    const ad = window.prompt('Malzeme adı:');
    if (!ad?.trim()) return;
    const mik = Number(window.prompt('Başlangıç adedi:', '1')) || 1;
    setD(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next[kat].push({ad:ad.trim(), baslangic:mik, bitis:null, bitis2:null});
      return next;
    });
  }

  function imzala(key, ad) {
    setD(prev => ({
      ...prev,
      imzalar: { ...prev.imzalar, [key]: prev.imzalar[key] ? null : ad }
    }));
  }

  function kaydet() {
    const tumImza = Object.values(d.imzalar).every(v=>v!==null);
    const uyusmazlik = SAYIM_KATEGORILER.some(({key:k}) =>
      (d[k]||[]).some(item => item.bitis !== null && item.bitis !== item.baslangic)
    );
    onUpdate({ ...d, durum: tumImza ? (uyusmazlik ? 'uyusmazlik' : 'tamamlandi') : 'aktif' });
    showToast(tumImza ? '✅ Sayım formu kaydedildi' : 'Sayım güncellendi');
    onClose();
  }

  const imzaRoller = [
    {key:'scrub',   lbl:'Scrub Hemşire',  ad:s.ekip?.scrub   ||'—'},
    {key:'sirkule', lbl:'Sirkule Hemşire',ad:s.ekip?.sirkule ||'—'},
    {key:'cerrah',  lbl:'Cerrah',         ad:s.ekip?.cerrah  ||'—'},
  ];

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)'}}
      onClick={onClose}>
      <div style={{width:820,maxWidth:'96vw',maxHeight:'90vh',background:'var(--card-bg)',borderRadius:20,overflow:'hidden',display:'flex',flexDirection:'column',boxShadow:'0 32px 80px rgba(0,0,0,0.25)'}}
        onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{padding:'16px 22px',background:'linear-gradient(135deg,#1e3a5f,#0F766E)',display:'flex',alignItems:'center',gap:14,flexShrink:0}}>
          <div style={{flex:1}}>
            <div style={{fontSize:15,fontWeight:800,color:'white',fontFamily:"'Outfit',sans-serif"}}>📋 Sayım Formu — {s.op}</div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.65)',marginTop:3}}>{s.hasta} · {s.saat}–{s.bitis} · {s.salon}</div>
          </div>
          <span style={{fontSize:10,fontWeight:700,padding:'4px 12px',borderRadius:20,background:'rgba(255,255,255,0.15)',color:'white'}}>🏥 Yasal Belge</span>
          <div onClick={onClose} style={{width:30,height:30,borderRadius:8,background:'rgba(255,255,255,0.15)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'white',fontSize:18,flexShrink:0}}>✕</div>
        </div>

        {/* Ekip şeridi */}
        <div style={{padding:'10px 22px',background:'var(--surface)',borderBottom:'1px solid var(--border)',display:'flex',gap:20,flexShrink:0,flexWrap:'wrap'}}>
          {[{lbl:'Cerrah',val:s.ekip?.cerrah},{lbl:'Scrub',val:s.ekip?.scrub},{lbl:'Sirkule',val:s.ekip?.sirkule},{lbl:'Tarih',val:new Date().toLocaleDateString('tr-TR')}].map(x=>(
            <div key={x.lbl}>
              <div style={{fontSize:9,fontWeight:700,color:'var(--slate-light)',textTransform:'uppercase',letterSpacing:'0.4px'}}>{x.lbl}</div>
              <div style={{fontSize:12,fontWeight:600,color:'var(--slate)',marginTop:1}}>{x.val||'—'}</div>
            </div>
          ))}
        </div>

        {/* İçerik */}
        <div style={{flex:1,overflowY:'auto',padding:'16px 22px'}}>
          {/* Bilgi notu */}
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,padding:'10px 14px',background:'rgba(20,184,166,0.06)',border:'1px solid rgba(20,184,166,0.15)',borderRadius:10}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span style={{fontSize:11,color:'var(--teal)'}}>Başlangıç sayımı ameliyat öncesi · 1. Bitiş kapama öncesi · 2. Bitiş kapama sonrası yapılır. Uyuşmazlık varsa cerrah bilgilendirilmeli, X-ray gerekebilir.</span>
          </div>

          {/* Kategoriler */}
          {SAYIM_KATEGORILER.filter(k => (d[k.key]||[]).length > 0).map(kat => (
            <div key={kat.key} style={{marginBottom:18}}>
              <div style={{fontSize:'10.5px',fontWeight:700,color:'var(--slate-light)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span>{kat.ic} {kat.lbl}</span>
                <button onClick={() => ekleItem(kat.key)} style={{fontSize:10,padding:'3px 10px',borderRadius:20,border:'1.5px solid var(--border)',background:'var(--surface)',color:'var(--slate-mid)',cursor:'pointer',fontFamily:'inherit'}}>+ Ekle</button>
              </div>
              <div style={{border:'1px solid var(--border)',borderRadius:11,overflow:'hidden'}}>
                <table className="sf-table">
                  <thead><tr>
                    <th>Malzeme Adı</th>
                    <th style={{textAlign:'center',width:90}}>Başlangıç</th>
                    <th style={{textAlign:'center',width:90}}>1. Bitiş</th>
                    <th style={{textAlign:'center',width:90}}>2. Bitiş</th>
                    <th style={{textAlign:'center',width:60}}>Durum</th>
                  </tr></thead>
                  <tbody>
                    {(d[kat.key]||[]).map((item,i) => {
                      const ok1  = item.bitis  !== null && item.bitis  === item.baslangic;
                      const bad1 = item.bitis  !== null && item.bitis  !== item.baslangic;
                      const ok2  = item.bitis2 !== null && item.bitis2 === item.baslangic;
                      const bad2 = item.bitis2 !== null && item.bitis2 !== item.baslangic;
                      const status = item.bitis === null
                        ? <span style={{color:'var(--slate-light)',fontSize:11}}>—</span>
                        : (ok1 && (item.bitis2===null||ok2))
                          ? <span style={{color:'var(--success)',fontWeight:800,fontSize:13}}>✓</span>
                          : <span style={{color:'var(--danger)',fontWeight:800,fontSize:13}}>⚠</span>;
                      return (
                        <tr key={i}>
                          <td style={{fontWeight:500}}>{item.ad}</td>
                          <td style={{textAlign:'center'}}><input type="number" className="sf-count-input" defaultValue={item.baslangic} min="0" onChange={e=>guncelle(kat.key,i,'baslangic',e.target.value)}/></td>
                          <td style={{textAlign:'center'}}><input type="number" className={`sf-count-input${item.bitis===null?'':ok1?' eslesme':' uyusmazlik'}`} defaultValue={item.bitis??''} placeholder="—" min="0" onChange={e=>guncelle(kat.key,i,'bitis',e.target.value)}/></td>
                          <td style={{textAlign:'center'}}><input type="number" className={`sf-count-input${item.bitis2===null?'':ok2?' eslesme':' uyusmazlik'}`} defaultValue={item.bitis2??''} placeholder="—" min="0" onChange={e=>guncelle(kat.key,i,'bitis2',e.target.value)}/></td>
                          <td style={{textAlign:'center'}}>{status}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Notlar */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:'10.5px',fontWeight:700,color:'var(--slate-light)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8}}>📝 Notlar</div>
            <textarea className="fi" rows={2} placeholder="Uyuşmazlık açıklaması, cerrah bilgilendirmesi…" style={{fontSize:12,width:'100%'}}
              value={d.notlar} onChange={e=>setD(prev=>({...prev,notlar:e.target.value}))}/>
          </div>

          {/* İmzalar */}
          <div style={{marginBottom:6}}>
            <div style={{fontSize:'10.5px',fontWeight:700,color:'var(--slate-light)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:10}}>✍️ İmzalar</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
              {imzaRoller.map(im => {
                const signed = d.imzalar[im.key];
                return (
                  <div key={im.key} className={`an-imza${signed?' signed':''}`} onClick={()=>imzala(im.key,im.ad)}>
                    <div style={{fontSize:'9.5px',fontWeight:700,color:'var(--slate-light)',textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:8}}>{im.lbl}</div>
                    <div style={{fontSize:12,fontWeight:600,color:'var(--slate)',marginBottom:8}}>{im.ad}</div>
                    {signed ? (
                      <div style={{fontSize:11,color:'var(--success)',fontWeight:700}}>✓ İmzalandı</div>
                    ) : (
                      <div style={{fontSize:10,color:'var(--slate-light)',fontStyle:'italic'}}>İmzalamak için tıklayın</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{padding:'12px 22px',borderTop:'1px solid var(--border)',display:'flex',gap:8,justifyContent:'flex-end',flexShrink:0}}>
          <button className="btn btn-secondary" onClick={onClose}>İptal</button>
          <button className="btn btn-secondary btn-sm" onClick={()=>showToast('Yazdırılıyor…')}>🖨 Yazdır</button>
          <button className="btn btn-primary" onClick={kaydet}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:13,height:13}}><polyline points="20 6 9 17 4 12"/></svg>
            Kaydet & Onayla
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ANA COMPONENT ─────────────────────────────────────────────
export default function SayimFormu() {
  const { surgeries } = useDataStore();
  const [sayimData, setSayimData] = useState({});
  const [acikModal, setAcikModal] = useState(null); // surgId

  function getData(s) {
    if (!sayimData[s.id]) {
      const d = initData(s);
      setSayimData(prev => ({...prev, [s.id]: d}));
      return d;
    }
    return sayimData[s.id];
  }

  function acVaka(s) {
    getData(s);
    setAcikModal(s.id);
  }

  const modalSurgery = acikModal !== null ? surgeries.find(s=>s.id===acikModal) : null;

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      <div style={{padding:'0 0 14px',flexShrink:0}}>
        <div style={{fontSize:22,fontWeight:900,color:'var(--slate)',letterSpacing:'-0.5px',fontFamily:"'Outfit',sans-serif"}}>Sayım Formu</div>
        <div style={{fontSize:12,color:'var(--slate-light)',marginTop:3}}>İntraoperatif alet & gazlı bez sayımı · Yasal zorunluluk</div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:10,overflowY:'auto'}}>
        {surgeries.map(s => {
          const d = sayimData[s.id] || { durum: 'aktif' };
          const tamam     = d.durum === 'tamamlandi';
          const uyusmazlik = d.durum === 'uyusmazlik';
          const borderColor = tamam ? 'rgba(5,150,105,0.35)' : uyusmazlik ? 'rgba(220,38,38,0.35)' : 'var(--border)';
          const statusBg    = tamam ? 'rgba(5,150,105,0.1)'  : uyusmazlik ? 'rgba(220,38,38,0.1)'  : 'rgba(245,158,11,0.08)';
          const statusColor = tamam ? 'var(--success)'       : uyusmazlik ? 'var(--danger)'         : 'var(--warning)';
          const statusLbl   = tamam ? '✓ Tamamlandı'         : uyusmazlik ? '⚠ Uyuşmazlık'          : 'Bekliyor';
          return (
            <div key={s.id} onClick={() => acVaka(s)}
              style={{background:'var(--card-bg)',border:`1.5px solid ${borderColor}`,borderRadius:13,padding:14,cursor:'pointer',transition:'all 0.15s'}}
              onMouseEnter={e=>e.currentTarget.style.borderColor='var(--teal-mid)'}
              onMouseLeave={e=>e.currentTarget.style.borderColor=borderColor}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                <div style={{width:36,height:36,borderRadius:9,background:'rgba(20,184,166,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10.5px',fontWeight:800,color:'var(--teal)'}}>{s.saat}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:'var(--slate)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.op}</div>
                  <div style={{fontSize:'10.5px',color:'var(--slate-light)',marginTop:1}}>{s.hasta} · {s.salon}</div>
                </div>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:'10.5px',color:'var(--slate-light)'}}>{s.ekip?.scrub||'—'}</span>
                <span style={{fontSize:'9.5px',fontWeight:700,padding:'3px 9px',borderRadius:20,background:statusBg,color:statusColor}}>{statusLbl}</span>
              </div>
            </div>
          );
        })}
      </div>

      {modalSurgery && (
        <SayimModal
          s={modalSurgery}
          data={sayimData[modalSurgery.id] || initData(modalSurgery)}
          onClose={() => setAcikModal(null)}
          onUpdate={d => setSayimData(prev=>({...prev,[modalSurgery.id]:d}))}
        />
      )}
    </div>
  );
}
