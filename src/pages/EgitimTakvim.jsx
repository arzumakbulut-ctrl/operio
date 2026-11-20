import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore, useDataStore } from '../store';
import { INIT_EGITIMLER } from '../data/egitimData';

const BASE = 'http://localhost:4000/api';
const tok = () => localStorage.getItem('operio_access');

function mapEgitimFromDB(e) {
  const extra = (() => { try { return JSON.parse(e.icerik || '{}'); } catch { return {}; } })();
  return {
    id: e.id,
    baslik: e.baslik,
    aciklama: extra.aciklama || '',
    kategori: e.kategori || 'Genel',
    durum: (e.durum || '').toLowerCase() === 'tamamlandi' ? 'tamamlandi' : 'yayinda',
    kayitli: e.kayitlilar || 0,
    kapasite: e.kapasite || 20,
    ikon: extra.ikon || '📚',
    tarih: e.tarih ? new Date(e.tarih).toISOString().split('T')[0] : '',
    saat: extra.saat || '09:00',
    sure: e.sure || 60,
    egitmen: e.egitmen || '—',
    yer: extra.yer || 'Online',
    renk: extra.renk || '#14B8A6',
    zorunlu: extra.zorunlu || false,
    malzeme: extra.malzeme || [],
    taslak: false,
    tamamlayan: extra.tamamlayan || '',
  };
}

export default function EgitimTakvim() {
  const { personel } = useDataStore();
  const { showToast } = useUIStore();
  const navigate = useNavigate();
  const [detay, setDetay] = useState(null);
  const [egitimler, setEgitimler] = useState(INIT_EGITIMLER);

  useEffect(() => {
    fetch(`${BASE}/egitim`, { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (data.length > 0) setEgitimler(data.map(mapEgitimFromDB)); })
      .catch(() => {});
  }, []);

  const aktifEgitimler = egitimler.filter(e=>!e.taslak&&e.durum!=='tamamlandi').sort((a,b)=>a.tarih.localeCompare(b.tarih));
  const yakinda = aktifEgitimler.filter(e=>e.tarih >= new Date().toISOString().split('T')[0]);
  const gecmis  = egitimler.filter(e=>e.durum==='tamamlandi').sort((a,b)=>b.tarih.localeCompare(a.tarih));
  const ayAdlari = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];

  function renderItem(e, gecmisMi) {
    const gun = parseInt(e.tarih.split('-')[2]);
    const ayAd = ayAdlari[parseInt(e.tarih.split('-')[1])-1];
    return (
      <div key={e.id} className="eg-takvim-item" style={{borderLeftColor:gecmisMi?'#94A3B8':e.renk, opacity:gecmisMi?0.8:1, cursor:'pointer'}} onClick={()=>setDetay(e)}>
        <div style={{width:52,textAlign:'center',flexShrink:0}}>
          <div style={{fontSize:22,fontWeight:900,color:gecmisMi?'var(--slate-light)':e.renk,fontFamily:"'Outfit',sans-serif",lineHeight:1}}>{gun}</div>
          <div style={{fontSize:10,fontWeight:600,color:'var(--slate-light)'}}>{ayAd}</div>
        </div>
        <div style={{width:42,height:42,borderRadius:11,background:gecmisMi?'var(--surface)':`${e.renk}15`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0,filter:gecmisMi?'grayscale(0.5)':'none'}}>{e.ikon}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,color:gecmisMi?'var(--slate-mid)':'var(--slate)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{e.baslik}</div>
          <div style={{fontSize:11,color:'var(--slate-light)',marginTop:2}}>{gecmisMi ? `${e.egitmen} · ${e.sure} dk` : `${e.saat} · ${e.sure} dk · ${e.yer}`}</div>
          {!gecmisMi && <div style={{display:'flex',gap:5,marginTop:4,flexWrap:'wrap'}}>
            {e.zorunlu && <span className="eg-badge-durum" style={{background:'rgba(220,38,38,0.1)',color:'var(--danger)'}}>Zorunlu</span>}
            <span className="eg-badge-durum" style={{background:`${e.renk}15`,color:e.renk}}>{e.kategori}</span>
          </div>}
        </div>
        {gecmisMi
          ? <span className="eg-badge-durum" style={{background:'rgba(5,150,105,0.1)',color:'var(--success)',flexShrink:0}}>✓ {e.tamamlayan} katıldı</span>
          : <div style={{textAlign:'right',flexShrink:0}}>
              <div style={{fontSize:11,fontWeight:700,color:'var(--slate)'}}>{e.kayitli}/{e.kapasite}</div>
              <div style={{fontSize:'9.5px',color:'var(--slate-light)'}}>Kayıtlı</div>
              <div style={{marginTop:6}}><span className="eg-badge-durum" style={{background:'rgba(5,150,105,0.1)',color:'var(--success)',cursor:'pointer'}} onClick={ev=>{ev.stopPropagation();showToast('Kayıt formu açılıyor…');}}>Kayıt Aç</span></div>
            </div>
        }
      </div>
    );
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      <div style={{padding:'0 0 16px',flexShrink:0,display:'flex',alignItems:'flex-end',justifyContent:'space-between'}}>
        <div>
          <div style={{fontSize:22,fontWeight:900,color:'var(--slate)',letterSpacing:'-0.5px',fontFamily:"'Outfit',sans-serif"}}>Eğitim Takvimi</div>
          <div style={{fontSize:12,color:'var(--slate-light)',marginTop:3}}>{yakinda.length} yaklaşan eğitim · {gecmis.length} tamamlanan</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-secondary" onClick={()=>navigate('/egitim-yonetim')} style={{fontSize:12,display:'flex',alignItems:'center',gap:6}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:13,height:13}}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Eğitim Yükle
          </button>
          <button className="btn btn-primary" onClick={()=>navigate('/egitim-yonetim')} style={{fontSize:12,display:'flex',alignItems:'center',gap:6}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:13,height:13}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Eğitim Oluştur
          </button>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:16,flex:1,overflow:'hidden'}}>
        {/* Sol */}
        <div style={{overflowY:'auto'}}>
          <div style={{fontSize:'10.5px',fontWeight:700,color:'var(--slate-light)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:10}}>📅 Yaklaşan Eğitimler</div>
          {yakinda.length ? yakinda.map(e=>renderItem(e,false)) : <div style={{textAlign:'center',padding:40,color:'var(--slate-light)'}}><div style={{fontSize:40,marginBottom:12}}>📭</div><div style={{fontSize:14,fontWeight:600,color:'var(--slate)'}}>Yaklaşan eğitim yok</div></div>}
          {gecmis.length > 0 && <>
            <div style={{fontSize:'10.5px',fontWeight:700,color:'var(--slate-light)',textTransform:'uppercase',letterSpacing:'0.5px',margin:'18px 0 10px'}}>✅ Tamamlanan Eğitimler</div>
            {gecmis.slice(0,5).map(e=>renderItem(e,true))}
          </>}
        </div>

        {/* Sağ */}
        <div style={{overflowY:'auto',display:'flex',flexDirection:'column',gap:12}}>
          <div className="an-section"><div className="an-section-hd">⚠️ Zorunlu Eğitimler</div><div>
            {aktifEgitimler.filter(e=>e.zorunlu).map(e=>(
              <div key={e.id} onClick={()=>setDetay(e)} style={{display:'flex',alignItems:'center',gap:9,padding:'9px 13px',borderBottom:'1px solid var(--border)',cursor:'pointer'}}>
                <span style={{fontSize:18}}>{e.ikon}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:'11.5px',fontWeight:600,color:'var(--slate)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{e.baslik}</div>
                  <div style={{fontSize:10,color:'var(--slate-light)'}}>{e.tarih.split('-').reverse().join('.')}</div>
                </div>
                <span style={{fontSize:9,fontWeight:700,padding:'2px 8px',borderRadius:20,background:'rgba(220,38,38,0.1)',color:'var(--danger)',flexShrink:0}}>Zorunlu</span>
              </div>
            ))}
            {!aktifEgitimler.filter(e=>e.zorunlu).length && <div style={{padding:14,textAlign:'center',fontSize:12,color:'var(--slate-light)'}}>Zorunlu eğitim yok</div>}
          </div></div>

          <div className="an-section"><div className="an-section-hd">📊 Bu Ayki Özet</div><div className="an-section-body">
            {[{ic:'📚',lbl:'Planlanan',val:aktifEgitimler.filter(e=>e.tarih.startsWith('2026-06')).length},{ic:'👥',lbl:'Toplam Kontenjan',val:aktifEgitimler.filter(e=>e.tarih.startsWith('2026-06')).reduce((a,e)=>a+e.kapasite,0)},{ic:'✅',lbl:'Kayıt Sayısı',val:aktifEgitimler.filter(e=>e.tarih.startsWith('2026-06')).reduce((a,e)=>a+e.kayitli,0)}].map(x=>(
              <div key={x.lbl} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid var(--border)'}}>
                <span style={{fontSize:'11.5px',color:'var(--slate-mid)'}}>{x.ic} {x.lbl}</span>
                <span style={{fontSize:13,fontWeight:800,color:'var(--teal)',fontFamily:"'Outfit',sans-serif"}}>{x.val}</span>
              </div>
            ))}
          </div></div>

          <div className="an-section"><div className="an-section-hd">📎 Tüm Materyaller</div><div className="an-section-body" style={{display:'flex',flexDirection:'column',gap:6}}>
            {egitimler.flatMap(e=>(e.malzeme||[]).map(m=>({...m,egitim:e.baslik.slice(0,25),ic:e.ikon}))).slice(0,6).map((m,i)=>{
              const tipIc = {pdf:'📑',video:'🎥',slayt:'📊'}[m.tip]||'📄';
              return <div key={i} onClick={()=>showToast(`📥 ${m.ad} indiriliyor…`)} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:8,background:'var(--surface)',border:'1px solid var(--border)',cursor:'pointer'}}>
                <span style={{fontSize:16}}>{tipIc}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11,fontWeight:600,color:'var(--slate)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{m.ad}</div>
                  <div style={{fontSize:'9.5px',color:'var(--slate-light)'}}>{m.egitim}…</div>
                </div>
              </div>;
            })}
          </div></div>
        </div>
      </div>

      {/* Detay modal — basit */}
      {detay && <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)'}} onClick={()=>setDetay(null)}>
        <div style={{width:500,maxWidth:'96vw',background:'var(--card-bg)',borderRadius:20,overflow:'hidden',boxShadow:'0 32px 80px rgba(0,0,0,0.25)'}} onClick={ev=>ev.stopPropagation()}>
          <div style={{background:`linear-gradient(135deg,${detay.renk},${detay.renk}99)`,padding:'18px 22px',display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:44,height:44,borderRadius:12,background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>{detay.ikon}</div>
            <div style={{flex:1}}><div style={{fontSize:16,fontWeight:800,color:'white',fontFamily:"'Outfit',sans-serif"}}>{detay.baslik}</div><div style={{fontSize:11,color:'rgba(255,255,255,0.7)',marginTop:3}}>{detay.egitmen} · {detay.kategori}</div></div>
            <div onClick={()=>setDetay(null)} style={{color:'rgba(255,255,255,0.7)',cursor:'pointer',fontSize:20}}>✕</div>
          </div>
          <div style={{padding:'16px 22px',fontSize:13,color:'var(--slate-mid)',lineHeight:1.7}}>{detay.aciklama}</div>
          <div style={{padding:'0 22px 16px',display:'flex',gap:8}}>
            {[{ic:'📅',v:detay.tarih.split('-').reverse().join('.')},{ic:'⏰',v:detay.saat},{ic:'⏱',v:detay.sure+' dk'},{ic:'📍',v:detay.yer}].map(x=><span key={x.ic} style={{fontSize:11,color:'var(--slate-light)'}}>{x.ic} {x.v}</span>)}
          </div>
          <div style={{padding:'12px 22px',borderTop:'1px solid var(--border)',display:'flex',justifyContent:'flex-end',background:'var(--surface)'}}>
            <button onClick={()=>setDetay(null)} className="btn btn-secondary" style={{fontSize:12}}>Kapat</button>
          </div>
        </div>
      </div>}
    </div>
  );
}
