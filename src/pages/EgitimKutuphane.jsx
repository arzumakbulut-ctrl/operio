import { useState, useEffect } from 'react';
import { useUIStore, useDataStore } from '../store';
import { INIT_EGITIMLER, EGITIM_KATEGORILER, SUNUM_TEMALAR, sunumInitVeri, sunumSlaytHTML } from '../data/egitimData';

const BASE = 'http://localhost:4000/api';
function tok() { return localStorage.getItem('operio_access'); }

const EG_RENKLER = ['#7C3AED','#0284C7','#059669','#DC2626','#D97706','#14B8A6'];
const EG_IKONLAR = ['📚','🏥','💉','🔬','🧬','⚕️'];

function mapEgitim(r, i) {
  const d = r.tarih ? new Date(r.tarih) : null;
  const tarihStr = d ? d.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const durumMap = { 'Planlandı': 'yayinda', 'Aktif': 'yayinda', 'Tamamlandı': 'tamamlandi' };
  return {
    id: r.id,
    baslik: r.baslik,
    aciklama: r.icerik || '',
    kategori: r.kategori || 'Genel',
    sure: r.sure || 60,
    egitmen: r['eğitmen'] || '—',
    tarih: tarihStr,
    saat: '09:00',
    yer: 'Konferans Salonu',
    kapasite: r.kapasite || 20,
    kayitli: r.kayitlilar || 0,
    durum: durumMap[r.durum] || 'yayinda',
    renk: EG_RENKLER[i % EG_RENKLER.length],
    ikon: EG_IKONLAR[i % EG_IKONLAR.length],
    zorunlu: false,
    tamamlayan: '',
    malzeme: [],
  };
}

// ── EĞİTİM KART (HTML egitimKartHTML birebir) ────────────────
function EgitimKart({ e, onDetay, onBaslat }) {
  const dolulukYuzde = Math.round(e.kayitli / e.kapasite * 100);
  const durumCfg = { yayinda:{lbl:'Yayında',renk:'var(--success)',bg:'rgba(5,150,105,0.1)'}, tamamlandi:{lbl:'Tamamlandı',renk:'var(--slate-light)',bg:'var(--border)'} };
  const dc = durumCfg[e.durum] || durumCfg.yayinda;

  return (
    <div className="eg-kutu-kart" onClick={() => onDetay(e)}>
      <div style={{height:80,background:`linear-gradient(135deg,${e.renk}22,${e.renk}08)`,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 16px',borderBottom:`1px solid ${e.renk}20`,position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',right:-20,top:-20,width:100,height:100,borderRadius:'50%',background:`${e.renk}10`}}/>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:44,height:44,borderRadius:12,background:`${e.renk}18`,border:`1.5px solid ${e.renk}30`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>{e.ikon}</div>
          <div>
            <span className="eg-tag" style={{background:dc.bg,color:dc.renk,marginBottom:4}}>{dc.lbl}</span>
            {e.zorunlu && <span className="eg-tag" style={{background:'rgba(220,38,38,0.1)',color:'var(--danger)',marginLeft:4}}>Zorunlu</span>}
          </div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:10,color:'var(--slate-light)'}}>{e.tarih.slice(8)}.{e.tarih.slice(5,7)}.{e.tarih.slice(0,4)}</div>
          <div style={{fontSize:11,fontWeight:700,color:'var(--slate)'}}>{e.saat}</div>
        </div>
      </div>
      <div style={{padding:'14px 16px'}}>
        <div style={{fontSize:'13.5px',fontWeight:800,color:'var(--slate)',fontFamily:"'Outfit',sans-serif",letterSpacing:'-0.2px',marginBottom:6,lineHeight:1.4}}>{e.baslik}</div>
        <div style={{fontSize:11,color:'var(--slate-light)',marginBottom:10,lineHeight:1.5,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{e.aciklama}</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:10}}>
          <span style={{fontSize:10,color:'var(--slate-mid)'}}>👤 {e.egitmen}</span>
          <span style={{fontSize:10,color:'var(--slate-light)'}}>·</span>
          <span style={{fontSize:10,color:'var(--slate-mid)'}}>📍 {e.yer}</span>
          <span style={{fontSize:10,color:'var(--slate-light)'}}>·</span>
          <span style={{fontSize:10,color:'var(--slate-mid)'}}>⏱ {e.sure} dk</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
          <div style={{flex:1,height:5,background:'var(--border)',borderRadius:10,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${dolulukYuzde}%`,background:dolulukYuzde>=90?'var(--danger)':dolulukYuzde>=70?'var(--warning)':'var(--teal)',borderRadius:10}}/>
          </div>
          <span style={{fontSize:'10.5px',fontWeight:700,color:dolulukYuzde>=90?'var(--danger)':'var(--slate-mid)',flexShrink:0}}>{e.kayitli}/{e.kapasite}</span>
        </div>
        <div style={{display:'flex',gap:6}} onClick={ev=>ev.stopPropagation()}>
          <button onClick={()=>onDetay(e)} className="btn btn-secondary" style={{flex:1,fontSize:11}}>Detay</button>
          <button onClick={()=>onBaslat(e.id)} className="btn btn-sm" style={{fontSize:11,background:'rgba(124,58,237,0.1)',color:'#7C3AED',border:'1.5px solid rgba(124,58,237,0.25)',display:'flex',alignItems:'center',gap:4}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:11,height:11}}><polygon points="5 3 19 12 5 21 5 3"/></svg> Başlat
          </button>
          {e.durum==='tamamlandi' && <span style={{fontSize:10,fontWeight:700,color:'var(--success)',display:'flex',alignItems:'center',gap:4,padding:'0 6px'}}>✓ {e.tamamlayan}</span>}
        </div>
      </div>
    </div>
  );
}

// ── ANA COMPONENT ─────────────────────────────────────────────
export default function EgitimKutuphane() {
  const { showToast } = useUIStore();
  const [arama, setArama]       = useState('');
  const [kategori, setKategori] = useState('tumu');
  const [detay, setDetay]       = useState(null);
  const [egitimler, setEgitimler] = useState([]);

  useEffect(() => {
    fetch(`${BASE}/egitim`, { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => setEgitimler(data.map(mapEgitim)))
      .catch(() => {});
  }, []);

  // Sunum modu
  const [sunumVeri]              = useState({});
  const [sunumMod, setSunumMod]  = useState(false);
  const [sunumEgitimId, setSunumEgitimId] = useState(null);
  const [sunumIdx, setSunumIdx]  = useState(0);
  const [sunumBaslangic, setSunumBaslangic] = useState(null);
  const [sunumSure, setSunumSure] = useState('00:00');

  function onBaslat(egitimId) {
    sunumInitVeri(sunumVeri, egitimId, egitimler.length ? egitimler : INIT_EGITIMLER);
    setSunumEgitimId(egitimId); setSunumIdx(0); setSunumBaslangic(Date.now()); setSunumMod(true);
    setDetay(null);
  }
  function sunumKapat() { setSunumMod(false); setSunumEgitimId(null); }

  useEffect(() => {
    if (!sunumMod) return;
    const handler = e => {
      if (e.key==='ArrowRight'||e.key===' ') setSunumIdx(i=>{ const v=sunumVeri[sunumEgitimId]; return v&&i<v.slaytlar.length-1?i+1:i; });
      else if (e.key==='ArrowLeft') setSunumIdx(i=>i>0?i-1:0);
      else if (e.key==='Escape') sunumKapat();
    };
    document.addEventListener('keydown', handler);
    const timer = setInterval(()=>{
      const s=Math.floor((Date.now()-(sunumBaslangic||Date.now()))/1000);
      setSunumSure(String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'));
    },1000);
    return ()=>{ document.removeEventListener('keydown',handler); clearInterval(timer); };
  }, [sunumMod, sunumEgitimId, sunumBaslangic]);

  const hepsi = egitimler.length ? egitimler : INIT_EGITIMLER.filter(e => !e.taslak);
  const filtrelenmis = hepsi.filter(e =>
    (kategori === 'tumu' || e.kategori === kategori) &&
    (e.baslik.toLowerCase().includes(arama.toLowerCase()) || (e.aciklama||'').toLowerCase().includes(arama.toLowerCase()) || (e.kategori||'').toLowerCase().includes(arama.toLowerCase()))
  );

  // ── SUNUM MODU ──
  if (sunumMod && sunumVeri[sunumEgitimId]) {
    const veri = sunumVeri[sunumEgitimId];
    const tema = SUNUM_TEMALAR.find(t=>t.id===veri.tema)||SUNUM_TEMALAR[0];
    const slayt = veri.slaytlar[sunumIdx];
    const total = veri.slaytlar.length;
    const yuzde = Math.round((sunumIdx+1)/total*100);
    return (
      <div className="sunum-mode">
        <div className="sunum-progress"><div className="sunum-progress-bar" style={{width:`${yuzde}%`}}/></div>
        <div className="sunum-slide" style={{background:tema.bg,color:tema.metin}} onClick={()=>setSunumIdx(i=>Math.min(total-1,i+1))}>
          <div style={{width:'85vw',maxWidth:1200,aspectRatio:'16/9',position:'relative',overflow:'hidden'}} dangerouslySetInnerHTML={{__html:sunumSlaytHTML(slayt,tema,true)}}/>
        </div>
        <div className="sunum-nav">
          <button onClick={()=>setSunumIdx(i=>Math.max(0,i-1))} disabled={sunumIdx===0} style={{background:'rgba(255,255,255,0.1)',border:'none',color:'white',width:36,height:36,borderRadius:'50%',cursor:sunumIdx===0?'not-allowed':'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',opacity:sunumIdx===0?0.3:1}}>◀</button>
          <span style={{color:'white',fontSize:12,fontWeight:600,minWidth:70,textAlign:'center'}}>{sunumIdx+1} / {total}</span>
          <button onClick={()=>setSunumIdx(i=>Math.min(total-1,i+1))} disabled={sunumIdx===total-1} style={{background:'rgba(255,255,255,0.1)',border:'none',color:'white',width:36,height:36,borderRadius:'50%',cursor:sunumIdx===total-1?'not-allowed':'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',opacity:sunumIdx===total-1?0.3:1}}>▶</button>
          <div style={{width:1,height:20,background:'rgba(255,255,255,0.2)'}}/>
          <span style={{color:'rgba(255,255,255,0.6)',fontSize:11,fontWeight:600}}>{sunumSure}</span>
          {slayt.not && <button onClick={()=>showToast(`📝 ${slayt.not}`)} style={{background:'rgba(255,255,255,0.1)',border:'none',color:'rgba(255,255,255,0.7)',fontSize:11,padding:'5px 10px',borderRadius:20,cursor:'pointer'}}>📝 Not</button>}
          <button onClick={sunumKapat} style={{background:'rgba(220,38,38,0.3)',border:'none',color:'white',fontSize:11,padding:'5px 12px',borderRadius:20,cursor:'pointer',fontWeight:600}}>✕ Çıkış</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      {/* Başlık */}
      <div style={{padding:'0 0 16px',display:'flex',alignItems:'flex-end',justifyContent:'space-between',flexShrink:0}}>
        <div>
          <div style={{fontSize:22,fontWeight:900,color:'var(--slate)',letterSpacing:'-0.5px',fontFamily:"'Outfit',sans-serif"}}>Eğitim Kütüphanesi</div>
          <div style={{fontSize:12,color:'var(--slate-light)',marginTop:3}}>Tüm eğitimler, materyaller ve arşiv</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <div style={{position:'relative'}}>
            <svg style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',width:13,height:13,stroke:'var(--slate-light)',fill:'none'}} viewBox="0 0 24 24" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input style={{border:'1.5px solid var(--border)',borderRadius:9,padding:'8px 12px 8px 32px',fontSize:12,fontFamily:'var(--font)',outline:'none',background:'var(--input-bg)',color:'var(--slate)',width:220}} placeholder="Eğitim ara…" value={arama} onChange={e=>setArama(e.target.value)} onFocus={e=>e.target.style.borderColor='var(--teal-mid)'} onBlur={e=>e.target.style.borderColor='var(--border)'}/>
          </div>
        </div>
      </div>

      {/* Kategori filtreleri */}
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:14,flexShrink:0}}>
        <div onClick={()=>setKategori('tumu')} style={{padding:'5px 14px',borderRadius:20,cursor:'pointer',fontSize:'11.5px',fontWeight:600,border:`1.5px solid ${kategori==='tumu'?'var(--teal)':'var(--border)'}`,background:kategori==='tumu'?'rgba(20,184,166,0.1)':'var(--surface)',color:kategori==='tumu'?'var(--teal)':'var(--slate-light)'}}>Tümü</div>
        {EGITIM_KATEGORILER.map(k=>(
          <div key={k} onClick={()=>setKategori(k)} style={{padding:'5px 14px',borderRadius:20,cursor:'pointer',fontSize:'11.5px',fontWeight:600,border:`1.5px solid ${kategori===k?'var(--teal)':'var(--border)'}`,background:kategori===k?'rgba(20,184,166,0.1)':'var(--surface)',color:kategori===k?'var(--teal)':'var(--slate-light)',transition:'all 0.12s'}}>{k}</div>
        ))}
      </div>

      {/* Grid */}
      <div style={{flex:1,overflowY:'auto'}}>
        {!filtrelenmis.length ? <div style={{textAlign:'center',padding:60,color:'var(--slate-light)'}}><div style={{fontSize:48,marginBottom:16}}>📭</div><div style={{fontSize:14,fontWeight:600,color:'var(--slate)'}}>Sonuç bulunamadı</div></div>
        : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:14}}>
          {filtrelenmis.map(e=><EgitimKart key={e.id} e={e} onDetay={setDetay} onBaslat={onBaslat}/>)}
        </div>}
      </div>

      {/* Detay modal */}
      {detay && <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)'}} onClick={()=>setDetay(null)}>
        <div style={{width:580,maxWidth:'96vw',maxHeight:'85vh',background:'var(--card-bg)',borderRadius:20,overflow:'hidden',display:'flex',flexDirection:'column',boxShadow:'0 32px 80px rgba(0,0,0,0.25)'}} onClick={ev=>ev.stopPropagation()}>
          <div style={{background:`linear-gradient(135deg,${detay.renk},${detay.renk}99)`,padding:'18px 22px',flexShrink:0,display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:44,height:44,borderRadius:12,background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>{detay.ikon}</div>
            <div style={{flex:1}}><div style={{fontSize:16,fontWeight:800,color:'white',fontFamily:"'Outfit',sans-serif"}}>{detay.baslik}</div><div style={{fontSize:11,color:'rgba(255,255,255,0.7)',marginTop:3}}>{detay.egitmen} · {detay.kategori}</div></div>
            <div onClick={()=>setDetay(null)} style={{color:'rgba(255,255,255,0.7)',cursor:'pointer',fontSize:20}}>✕</div>
          </div>
          <div style={{flex:1,overflowY:'auto',padding:'16px 22px'}}>
            <div style={{fontSize:13,color:'var(--slate-mid)',lineHeight:1.7,marginBottom:14}}>{detay.aciklama}</div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:14}}>
              {[{ic:'📅',v:detay.tarih.split('-').reverse().join('.')},{ic:'⏰',v:detay.saat},{ic:'⏱',v:detay.sure+' dk'},{ic:'📍',v:detay.yer},{ic:'👥',v:detay.kayitli+'/'+detay.kapasite}].map(x=><span key={x.ic} style={{fontSize:11,padding:'4px 10px',borderRadius:20,background:'var(--surface)',border:'1px solid var(--border)',color:'var(--slate-mid)'}}>{x.ic} {x.v}</span>)}
            </div>
            {detay.malzeme?.length>0 && <div className="an-section"><div className="an-section-hd">📎 Materyaller</div><div className="an-section-body" style={{display:'flex',flexDirection:'column',gap:6}}>
              {detay.malzeme.map((m,i)=><div key={i} onClick={()=>showToast(`📥 ${m.ad} indiriliyor…`)} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderRadius:8,background:'var(--surface)',border:'1px solid var(--border)',cursor:'pointer'}}>
                <span style={{fontSize:16}}>{({pdf:'📑',video:'🎥',slayt:'📊'})[m.tip]||'📄'}</span>
                <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:'var(--slate)'}}>{m.ad}</div><div style={{fontSize:10,color:'var(--slate-light)',textTransform:'uppercase'}}>{m.tip}</div></div>
              </div>)}
            </div></div>}
          </div>
          <div style={{padding:'12px 22px',borderTop:'1px solid var(--border)',display:'flex',gap:8,justifyContent:'space-between',background:'var(--surface)',flexShrink:0}}>
            <button onClick={()=>{setDetay(null);onBaslat(detay.id);}} className="btn btn-sm" style={{fontSize:12,background:'rgba(124,58,237,0.1)',color:'#7C3AED',border:'1.5px solid rgba(124,58,237,0.25)'}}>🎬 Sunumu Başlat</button>
            <button onClick={()=>setDetay(null)} className="btn btn-secondary" style={{fontSize:12}}>Kapat</button>
          </div>
        </div>
      </div>}
    </div>
  );
}
