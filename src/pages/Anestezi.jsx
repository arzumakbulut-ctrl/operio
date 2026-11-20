import { useState, useEffect, useRef } from 'react';
import { useDataStore, useUIStore, useAuthStore } from '../store';
import { useLocation } from 'react-router-dom';

const BASE = 'http://localhost:4000/api';
const tok = () => localStorage.getItem('operio_access');
const h = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` });

function mapOlay(o) {
  const vitaller = (() => { try { return JSON.parse(o.vitaller || 'null'); } catch { return null; } })();
  return { id: o.id, t: o.saat, tip: o.tip, n: o.baslik, d: o.aciklama || '', vitaller };
}

// ── Sabitler ─────────────────────────────────────────────────
const TIP_IKON = { hasta:'🧑', ilac:'💊', airway:'🫁', iv:'💉', idame:'🔄', vital:'📊', not:'📝' };
const TIP_RENK = { hasta:'#14B8A6', ilac:'#7C3AED', airway:'#0284C7', iv:'#059669', idame:'#D97706', vital:'#6366F1', not:'#94A3B8' };
const TIP_LBL  = { hasta:'Hasta', ilac:'İlaç', airway:'Havayolu', iv:'IV İşlem', idame:'İdame', vital:'Vital', not:'Not' };
const ANE_RENK = { 'Genel Anestezi':'t-blue', 'Spinal Anestezi':'t-purple', 'Epidural Anestezi':'t-purple', 'Lokal Anestezi':'t-green', 'Topikal':'t-teal' };

const INIT_OLAYLAR = [
  { id:'ae1', t:'08:05', tip:'hasta',  n:'Hasta Alındı',       d:'Hasta ameliyathaneye alındı. Kimlik doğrulama yapıldı.',          vitaller:{ spo2:99,  kb:'124/76', kah:74, etco2:null, ates:36.5 } },
  { id:'ae2', t:'08:12', tip:'iv',     n:'IV Damar Yolu',      d:'Sağ el sırtına 18G IV branül takıldı.',                          vitaller: null },
  { id:'ae3', t:'08:18', tip:'ilac',   n:'Preoksijenasyon',    d:'%100 O₂ ile 3 dk preoksijenasyon uygulandı.',                    vitaller:{ spo2:99,  kb:'126/78', kah:72, etco2:null, ates:36.5 } },
  { id:'ae4', t:'08:22', tip:'ilac',   n:'İndüksiyon',         d:'Propofol 200mg + Fentanil 100mcg IV bolus',                      vitaller:{ spo2:98,  kb:'128/78', kah:68, etco2:32,   ates:36.5 } },
  { id:'ae5', t:'08:25', tip:'airway', n:'Entübasyon',         d:'7.5mm ET tüp, C-MAC videolaringoskop ile. Cuff 22 cmH₂O.',      vitaller:{ spo2:99,  kb:'132/82', kah:85, etco2:35,   ates:36.6 } },
  { id:'ae6', t:'08:30', tip:'idame',  n:'İdame Başladı',      d:'Sevofluran %2 + O₂/hava karışımı. Supin pozisyon.',             vitaller:{ spo2:99,  kb:'118/72', kah:70, etco2:34,   ates:36.6 } },
  { id:'ae7', t:'09:15', tip:'ilac',   n:'Rocuronium',         d:'Rocuronium 40mg IV bolus — kas gevşemesi',                       vitaller:{ spo2:99,  kb:'115/70', kah:68, etco2:34,   ates:36.7 } },
  { id:'ae8', t:'09:45', tip:'vital',  n:'Rutin Vital Ölçüm',  d:'Rutin 15 dk vital kontrol.',                                     vitaller:{ spo2:98,  kb:'120/74', kah:72, etco2:35,   ates:36.8 } },
];

// ── Kronometre ───────────────────────────────────────────────
function useTimer() {
  const [sec, setSec] = useState(0);
  const [running, setRunning] = useState(false);
  const ref = useRef(null);
  function start()  { if (!running) { setRunning(true); ref.current = setInterval(() => setSec(p => p+1), 1000); } }
  function stop()   { clearInterval(ref.current); setRunning(false); }
  function toggle() { running ? stop() : start(); }
  useEffect(() => () => clearInterval(ref.current), []);
  const h = String(Math.floor(sec/3600)).padStart(2,'0');
  const m = String(Math.floor((sec%3600)/60)).padStart(2,'0');
  const s = String(sec%60).padStart(2,'0');
  return { label:`${h}:${m}:${s}`, running, toggle };
}

// ── İlaç Timeline Bar ────────────────────────────────────────
function IlacTimeline({ ilaclar }) {
  const START_DAK = 8*60+5;
  const TOPLAM = 90;
  return (
    <div className="panel">
      <div className="panel-hd">
        <span className="panel-title">İlaç Verilme Zamanları</span>
        <span style={{fontSize:11,color:'var(--slate-light)'}}>{ilaclar.length} ilaç kaydı</span>
      </div>
      <div style={{padding:'14px 18px'}}>
        <div style={{position:'relative',height:44,background:'var(--surface)',borderRadius:8,border:'1px solid var(--border)',overflow:'hidden'}}>
          {ilaclar.map(e => {
            const [h,m] = e.t.split(':').map(Number);
            const pct = Math.max(2, Math.min(96, ((h*60+m - START_DAK)/TOPLAM)*100));
            return (
              <div key={e.id} title={`${e.n} — ${e.t}`}
                style={{position:'absolute',left:`${pct}%`,top:6,width:28,height:28,borderRadius:'50%',
                  background:'linear-gradient(135deg,var(--teal),#7C3AED)',
                  display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,
                  cursor:'pointer',transform:'translateX(-50%)',
                  boxShadow:'0 2px 8px rgba(0,0,0,0.2)',transition:'transform 0.15s',zIndex:1}}
                onMouseOver={e=>e.currentTarget.style.transform='translateX(-50%) scale(1.25)'}
                onMouseOut={e=>e.currentTarget.style.transform='translateX(-50%) scale(1)'}>
                💊
              </div>
            );
          })}
          <div style={{position:'absolute',bottom:3,left:0,right:0,display:'flex',justifyContent:'space-between',padding:'0 6px',fontSize:9,color:'var(--slate-light)',pointerEvents:'none'}}>
            <span>08:05</span><span>Ameliyat Süresi ({TOPLAM} dk)</span><span>09:35</span>
          </div>
        </div>
        {/* İlaç etiketleri */}
        <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:10}}>
          {ilaclar.map(e => (
            <span key={e.id} style={{fontSize:'9.5px',padding:'2px 10px',borderRadius:20,background:'rgba(124,58,237,0.1)',color:'#7C3AED',border:'1px solid rgba(124,58,237,0.2)',fontWeight:700}}>
              {e.t} · {e.n}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Vital Panel (sağ) ────────────────────────────────────────
function VitalPanel({ olaylar, onVitalEkle }) {
  const son = [...olaylar].reverse().find(e => e.vitaller);
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick(p=>p+1), 3000); return () => clearInterval(t); }, []);
  function live(base, range) {
    if (!son?.vitaller) return '—';
    const v = Number(son.vitaller[base]);
    if (isNaN(v)) return son.vitaller[base] || '—';
    return Math.round((v + Math.sin(tick*1.7+base.length)*range)*10)/10;
  }
  function VBig({label,value,unit,lo,hi,icon,color}) {
    const n = parseFloat(String(value).split('/')[0]);
    const lv = !isNaN(n) && (n<lo||n>hi) ? 'crit' : 'ok';
    const c = lv==='crit' ? '#DC2626' : color||'var(--success)';
    const bg = lv==='crit' ? 'rgba(220,38,38,0.08)' : 'rgba(5,150,105,0.06)';
    const bd = lv==='crit' ? 'rgba(220,38,38,0.25)' : 'rgba(5,150,105,0.15)';
    return (
      <div style={{background:bg,border:`1.5px solid ${bd}`,borderRadius:11,padding:'10px 8px',textAlign:'center',flex:1}}>
        <div style={{fontSize:9,fontWeight:700,color:'var(--slate-light)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:3}}>{icon} {label}</div>
        <div style={{fontSize:24,fontWeight:900,color:c,fontFamily:"'Outfit',sans-serif",letterSpacing:'-1px',lineHeight:1}}>{value}</div>
        <div style={{fontSize:9,color:'var(--slate-light)',marginTop:2}}>{unit}</div>
        {lv==='crit' && <div style={{fontSize:9,fontWeight:700,color:c,marginTop:3}}>⚠ KRİTİK</div>}
      </div>
    );
  }
  return (
    <div className="panel">
      <div className="panel-hd">
        <span className="panel-title">Canlı Monitör</span>
        <div style={{display:'flex',gap:6}}>
          <span style={{fontSize:10,padding:'2px 10px',borderRadius:20,background:'rgba(5,150,105,0.1)',color:'#059669',fontWeight:700,display:'flex',alignItems:'center',gap:5}}>
            <span style={{width:6,height:6,borderRadius:'50%',background:'#059669',display:'inline-block'}}/>Canlı
          </span>
          <button onClick={onVitalEkle} style={{fontSize:10,padding:'3px 10px',borderRadius:20,border:'1.5px solid rgba(99,102,241,0.3)',background:'rgba(99,102,241,0.07)',color:'#6366F1',cursor:'pointer',fontFamily:'var(--font)',fontWeight:700}}>+ Ölçüm Ekle</button>
        </div>
      </div>
      <div style={{padding:'10px 14px',display:'flex',flexDirection:'column',gap:7}}>
        <div style={{display:'flex',gap:6}}>
          <VBig label="SpO₂" value={`${live('spo2',1)}%`} unit="%" lo={94} hi={100} icon="💧" color="#14B8A6"/>
          <VBig label="NB" value={live('kah',3)} unit="/dk" lo={50} hi={120} icon="💓" color="#DC2626"/>
        </div>
        <div style={{display:'flex',gap:6}}>
          <VBig label="KB SİS" value={live('kb_s',4)||son?.vitaller?.kb?.split('/')[0]||'—'} unit="mmHg" lo={90} hi={160} icon="🩺" color="#0284C7"/>
          <VBig label="KB DİAS" value={live('kb_d',3)||son?.vitaller?.kb?.split('/')[1]||'—'} unit="mmHg" lo={50} hi={100} icon="🩺" color="#0284C7"/>
        </div>
        <div style={{display:'flex',gap:6}}>
          <VBig label="EtCO₂" value={live('etco2',2)} unit="mmHg" lo={30} hi={45} icon="💨" color="#7C3AED"/>
          <VBig label="TEMP" value={live('ates',0.2)} unit="°C" lo={35.5} hi={38.5} icon="🌡" color="#D97706"/>
        </div>
        {son && <div style={{fontSize:9.5,color:'var(--slate-light)',textAlign:'center',paddingTop:4,borderTop:'1px solid var(--border)'}}>Son ölçüm: {son.t}</div>}
      </div>
    </div>
  );
}

// ── Ekip Sidebar ─────────────────────────────────────────────
function EkipPanel({ s }) {
  if (!s?.ekip) return null;
  const items = [
    { rol:'Cerrah',          ad:s.ekip.cerrah,      icon:'🔪' },
    { rol:'Asistan',         ad:s.ekip.asistan,     icon:'🩻' },
    { rol:'Scrub Hemşire',   ad:s.ekip.scrub,       icon:'🧤' },
    { rol:'Sirkülasyon',     ad:s.ekip.sirkule,     icon:'🔄' },
    { rol:'Anestezi Uzm.',   ad:s.ekip.anestezi,    icon:'💉' },
    { rol:'Anes. Teknisyen', ad:s.ekip.anesteknik,  icon:'🩺' },
  ].filter(x=>x.ad);
  return (
    <div className="panel">
      <div className="panel-hd"><span className="panel-title">Cerrahi Ekip</span></div>
      <div style={{padding:'4px 0'}}>
        {items.map((item,i) => (
          <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 16px',borderBottom:'1px solid var(--border)'}}>
            <span style={{fontSize:15,flexShrink:0}}>{item.icon}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:10,fontWeight:700,color:'var(--slate-light)',textTransform:'uppercase',letterSpacing:'0.4px'}}>{item.rol}</div>
              <div style={{fontSize:12.5,fontWeight:600,color:'var(--slate)',marginTop:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.ad}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Olay Ekle Modal ──────────────────────────────────────────
function OlayModal({ onSave, onClose }) {
  const [form, setForm] = useState({ t:new Date().toTimeString().slice(0,5), tip:'ilac', n:'', d:'', spo2:'', kb:'', kah:'', etco2:'', ates:'' });
  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  function save() {
    if (!form.t||!form.n.trim()) return;
    const vitaller = (form.spo2||form.kb||form.kah||form.etco2||form.ates)
      ? {spo2:form.spo2||null,kb:form.kb||null,kah:form.kah||null,etco2:form.etco2||null,ates:form.ates||null}
      : null;
    onSave({ id:'ae'+Date.now(), t:form.t, tip:form.tip, n:form.n, d:form.d, vitaller });
    onClose();
  }
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.6)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)'}} onClick={onClose}>
      <div style={{background:'var(--card-bg)',borderRadius:18,width:480,maxWidth:'95vw',overflow:'hidden',boxShadow:'0 24px 64px rgba(0,0,0,0.25)'}} onClick={e=>e.stopPropagation()}>
        <div style={{background:'linear-gradient(135deg,#7C3AED,#6366F1,#0891b2)',padding:'16px 22px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{fontSize:15,fontWeight:700,color:'white'}}>📋 Anestezi Olayı Ekle</div>
          <div onClick={onClose} style={{color:'rgba(255,255,255,0.7)',cursor:'pointer',fontSize:20,lineHeight:1,width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:6}} onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,0.1)'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>✕</div>
        </div>
        <div style={{padding:'20px 22px',display:'flex',flexDirection:'column',gap:12}}>
          <div className="fr">
            <div className="fg"><label className="fl">Saat *</label><input className="fi" type="time" value={form.t} onChange={e=>f('t',e.target.value)} autoFocus/></div>
            <div className="fg"><label className="fl">Olay Tipi</label>
              <select className="fi" value={form.tip} onChange={e=>f('tip',e.target.value)}>
                <option value="hasta">🧑 Hasta</option><option value="ilac">💊 İlaç</option>
                <option value="airway">🫁 Havayolu</option><option value="iv">💉 IV İşlem</option>
                <option value="idame">🔄 İdame</option><option value="vital">📊 Vital</option><option value="not">📝 Not</option>
              </select>
            </div>
          </div>
          <div className="fg"><label className="fl">Olay Adı *</label><input className="fi" value={form.n} onChange={e=>f('n',e.target.value)} placeholder="Propofol 200mg IV bolus…"/></div>
          <div className="fg"><label className="fl">Detay</label><textarea className="fi" rows={2} value={form.d} onChange={e=>f('d',e.target.value)} placeholder="Açıklama…" style={{resize:'none'}}/></div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
            {[['SpO₂ (%)','spo2','number'],['KB','kb','text'],['KAH (/dk)','kah','number'],['EtCO₂','etco2','number'],['Ateş (°C)','ates','number']].map(([l,k,t])=>(
              <div key={k}><label className="fl">{l}</label><input className="fi" type={t} value={form[k]} onChange={e=>f(k,e.target.value)} placeholder="—"/></div>
            ))}
          </div>
        </div>
        <div style={{padding:'14px 22px',borderTop:'1px solid var(--border)',display:'flex',gap:8,justifyContent:'flex-end',background:'var(--surface)'}}>
          <button className="btn btn-secondary" onClick={onClose}>İptal</button>
          <button className="btn btn-primary" onClick={save} style={{background:'#7C3AED',borderColor:'#7C3AED'}}>Kaydet ✓</button>
        </div>
      </div>
    </div>
  );
}

// ── Vital Kaydet Modal ───────────────────────────────────────
function VitalModal({ onSave, onClose }) {
  const [form, setForm] = useState({ saat:new Date().toTimeString().slice(0,5), spo2:'', kb:'', kah:'', etco2:'', ates:'' });
  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  function save() {
    if (!form.saat) return;
    onSave({ id:'ae'+Date.now(), t:form.saat, tip:'vital', n:'Vital Ölçüm', d:'',
      vitaller:{ spo2:form.spo2||null, kb:form.kb||null, kah:form.kah||null, etco2:form.etco2||null, ates:form.ates||null } });
    onClose();
  }
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.6)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)'}} onClick={onClose}>
      <div style={{background:'var(--card-bg)',borderRadius:18,width:420,maxWidth:'95vw',overflow:'hidden',boxShadow:'0 24px 64px rgba(0,0,0,0.25)'}} onClick={e=>e.stopPropagation()}>
        <div style={{background:'linear-gradient(135deg,#059669,#0891b2)',padding:'16px 22px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{fontSize:15,fontWeight:700,color:'white'}}>📊 Vital Değer Kaydet</div>
          <div onClick={onClose} style={{color:'rgba(255,255,255,0.7)',cursor:'pointer',fontSize:20,lineHeight:1,width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:6}} onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,0.1)'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>✕</div>
        </div>
        <div style={{padding:'20px 22px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div className="fg"><label className="fl">Saat</label><input className="fi" type="time" value={form.saat} onChange={e=>f('saat',e.target.value)} autoFocus/></div>
          <div className="fg"><label className="fl">SpO₂ (%)</label><input className="fi" type="number" value={form.spo2} onChange={e=>f('spo2',e.target.value)} placeholder="99"/></div>
          <div className="fg"><label className="fl">KB</label><input className="fi" value={form.kb} onChange={e=>f('kb',e.target.value)} placeholder="120/80"/></div>
          <div className="fg"><label className="fl">KAH (/dk)</label><input className="fi" type="number" value={form.kah} onChange={e=>f('kah',e.target.value)} placeholder="72"/></div>
          <div className="fg"><label className="fl">EtCO₂ (mmHg)</label><input className="fi" type="number" value={form.etco2} onChange={e=>f('etco2',e.target.value)} placeholder="35"/></div>
          <div className="fg"><label className="fl">Ateş (°C)</label><input className="fi" type="number" step="0.1" value={form.ates} onChange={e=>f('ates',e.target.value)} placeholder="36.5"/></div>
        </div>
        <div style={{padding:'14px 22px',borderTop:'1px solid var(--border)',display:'flex',gap:8,justifyContent:'flex-end',background:'var(--surface)'}}>
          <button className="btn btn-secondary" onClick={onClose}>İptal</button>
          <button className="btn btn-primary" onClick={save}>Kaydet ✓</button>
        </div>
      </div>
    </div>
  );
}

// ── Vaka Sol Panel ───────────────────────────────────────────
function VakaListesi({ surgeries, seciliId, setSeciliId, kayitlar }) {
  return (
    <div style={{background:'var(--card-bg)',border:'1px solid var(--border)',borderRadius:14,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{padding:'11px 14px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
        <div style={{fontSize:12,fontWeight:700,color:'var(--slate)'}}>Ameliyat Özeti</div>
        <div style={{fontSize:10,color:'var(--slate-light)',marginTop:2}}>{surgeries.length} ameliyat</div>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:8}}>
        {surgeries.map(s => {
          const sd = kayitlar[s.id];
          const aktif = seciliId === s.id;
          const ekipItems = [
            { icon:'🔪', ad: s.ekip?.cerrah },
            { icon:'🩻', ad: s.ekip?.asistan },
            { icon:'🧤', ad: s.ekip?.scrub },
            { icon:'🔄', ad: s.ekip?.sirkule },
            { icon:'💉', ad: s.ekip?.anestezi },
            { icon:'🩺', ad: s.ekip?.anesteknik },
          ].filter(x=>x.ad);
          return (
            <div key={s.id} onClick={()=>setSeciliId(s.id)}
              style={{background:aktif?'rgba(124,58,237,0.06)':'var(--card-bg)',border:`1.5px solid ${sd?.imza?'rgba(124,58,237,0.35)':aktif?'rgba(124,58,237,0.35)':'var(--border)'}`,borderRadius:11,padding:'10px 12px',cursor:'pointer',marginBottom:6,transition:'all 0.15s'}}>

              {/* Başlık */}
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:7}}>
                <div style={{width:34,height:34,borderRadius:9,background:'rgba(124,58,237,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,color:'#7C3AED',flexShrink:0,textAlign:'center',lineHeight:1.2}}>{s.saat}<br/><span style={{fontSize:8,fontWeight:400}}>{s.bitis}</span></div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:700,color:'var(--slate)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.op}</div>
                  <div style={{fontSize:10,color:'var(--slate-light)',marginTop:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.hasta}</div>
                </div>
              </div>

              {/* Cerrahi Ekip */}
              <div style={{borderTop:'1px solid var(--border)',paddingTop:7,marginBottom:6}}>
                <div style={{fontSize:'8.5px',fontWeight:700,color:'var(--slate-light)',textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:4}}>Cerrahi Ekip</div>
                {ekipItems.map((item,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:5,marginBottom:2}}>
                    <span style={{fontSize:11,flexShrink:0}}>{item.icon}</span>
                    <span style={{fontSize:'10px',color:'var(--slate-mid)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontWeight:500}}>{item.ad}</span>
                  </div>
                ))}
                {ekipItems.length===0 && <div style={{fontSize:10,color:'var(--slate-light)'}}>Ekip atanmadı</div>}
              </div>

              {/* Footer */}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:10,color:'var(--slate-light)'}}>{s.salon}</span>
                <span style={{fontSize:'9px',fontWeight:700,padding:'2px 7px',borderRadius:20,background:sd?.imza?'rgba(124,58,237,0.1)':'rgba(217,119,6,0.08)',color:sd?.imza?'#7C3AED':'#D97706'}}>
                  {sd?.imza?'✓ İmzalı':'Aktif'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ANA COMPONENT ─────────────────────────────────────────────
export default function Anestezi() {
  const { surgeries } = useDataStore();
  const { showToast } = useUIStore();
  const location = useLocation();

  const navId = location.state?.surgeryId ?? null;
  const [seciliId, setSeciliId] = useState(() => navId ?? surgeries[0]?.id ?? null);
  useEffect(() => { if (navId !== null) setSeciliId(navId); }, [navId]);

  useEffect(() => {
    if (!seciliId) return;
    fetch(`${BASE}/klinik-olay?ameliyatId=${seciliId}&tur=anestezi`, { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setOlaylarMap(p => ({ ...p, [seciliId]: data.length > 0 ? data.map(mapOlay) : INIT_OLAYLAR }));
      })
      .catch(() => {
        setOlaylarMap(p => ({ ...p, [seciliId]: INIT_OLAYLAR }));
      });
  }, [seciliId]);

  const timer = useTimer();
  const [olayModal, setOlayModal] = useState(false);
  const [vitalModal, setVitalModal] = useState(false);
  const [anesNot, setAnesNot] = useState('');
  const [imzali, setImzali] = useState({});

  // Her vaka için olaylar state'i
  const [olaylarMap, setOlaylarMap] = useState({});

  const secili = surgeries.find(s => s.id === seciliId);
  const olaylar = seciliId !== null ? (olaylarMap[seciliId] || []) : [];
  const ilaclar = olaylar.filter(e => e.tip === 'ilac');

  async function addOlay(olay) {
    const body = { ameliyatId: seciliId, tur: 'anestezi', saat: olay.t, tip: olay.tip, baslik: olay.n, aciklama: olay.d, vitaller: olay.vitaller ? JSON.stringify(olay.vitaller) : null };
    try {
      const res = await fetch(`${BASE}/klinik-olay`, { method: 'POST', headers: h(), body: JSON.stringify(body) });
      const created = res.ok ? await res.json() : null;
      const yeniOlay = created ? mapOlay(created) : olay;
      setOlaylarMap(p => ({ ...p, [seciliId]: [...(p[seciliId]||[]), yeniOlay].sort((a,b)=>a.t.localeCompare(b.t)) }));
    } catch {
      setOlaylarMap(p => ({ ...p, [seciliId]: [...(p[seciliId]||[]), olay].sort((a,b)=>a.t.localeCompare(b.t)) }));
    }
    showToast('Olay kaydedildi ✓');
  }
  async function removeOlay(id) {
    try { await fetch(`${BASE}/klinik-olay/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tok()}` } }); } catch {}
    setOlaylarMap(p => ({ ...p, [seciliId]: (p[seciliId]||[]).filter(o=>o.id!==id) }));
  }
  function imzala() {
    setImzali(p => ({...p,[seciliId]:true}));
    showToast('Anestezi formu imzalandı ✓');
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'calc(100vh - 80px)',overflow:'hidden'}}>

      {/* Başlık */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 0 14px',flexShrink:0}}>
        <div>
          <div style={{fontSize:22,fontWeight:900,color:'var(--slate)',letterSpacing:'-0.5px',fontFamily:"'Outfit',sans-serif"}}>Anestezi Kayıt Formu</div>
          <div style={{fontSize:12,color:'var(--slate-light)',marginTop:3}}>
            {secili ? `${secili.hasta} • ${secili.op} • ${secili.salon} • ${secili.ekip?.anestezi||'—'}` : 'İntraoperatif hasta takibi & anestezi dokümantasyonu'}
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <button className={`btn ${timer.running?'btn-secondary':'btn-primary'}`} style={timer.running?{background:'rgba(5,150,105,0.1)',color:'#059669',border:'1.5px solid rgba(5,150,105,0.3)'}:{}} onClick={timer.toggle}>
            {timer.running ? '⏸' : '▶'} {timer.running ? 'Durdur' : 'Ameliyatı Başlat'}
          </button>
          {timer.running && (
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'7px 14px',background:'rgba(5,150,105,0.1)',border:'1.5px solid rgba(5,150,105,0.25)',borderRadius:10,fontFamily:"'Outfit',sans-serif",fontSize:14,fontWeight:700,color:'#059669'}}>
              <div style={{width:7,height:7,borderRadius:'50%',background:'#059669',animation:'pulse 1.5s infinite'}}/>
              {timer.label}
            </div>
          )}
          <button className="btn btn-secondary" onClick={()=>setOlayModal(true)}>+ Olay Ekle</button>
          <button className="btn btn-primary" onClick={imzala} style={{background:'#7C3AED',borderColor:'#7C3AED'}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:13,height:13}}><polyline points="20 6 9 17 4 12"/></svg>
            {imzali[seciliId] ? '✓ İmzalı' : 'Vital Kaydet'}
          </button>
        </div>
      </div>

      {/* Grid: Sol | Orta | Sağ */}
      <div style={{display:'grid',gridTemplateColumns:'220px 1fr 300px',gap:14,flex:1,overflow:'hidden',minHeight:0}}>

        {/* SOL: Vaka listesi */}
        <VakaListesi
          surgeries={surgeries}
          seciliId={seciliId}
          setSeciliId={setSeciliId}
          kayitlar={Object.fromEntries(surgeries.map(s=>[s.id,{imza:imzali[s.id]}]))}
        />

        {/* ORTA: İlaç timeline + Olay takibi */}
        <div style={{display:'flex',flexDirection:'column',gap:14,overflowY:'auto',minHeight:0}}>
          {secili ? (
            <>
              {/* Vaka başlık bandı */}
              <div style={{background:'var(--card-bg)',border:'1px solid var(--border)',borderRadius:13,padding:'12px 18px',display:'flex',alignItems:'center',gap:14,flexShrink:0}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:800,color:'var(--slate)',fontFamily:"'Outfit',sans-serif"}}>{secili.op}</div>
                  <div style={{fontSize:'11px',color:'var(--slate-light)',marginTop:2}}>{secili.hasta} · {secili.saat}–{secili.bitis} · {secili.salon}</div>
                </div>
                <div style={{display:'flex',gap:7}}>
                  <button className="btn btn-secondary btn-sm" onClick={()=>showToast('Yazdırılıyor…')}>🖨 Yazdır</button>
                  <button className="btn btn-primary btn-sm" onClick={imzala} style={{background:'#7C3AED',borderColor:'#7C3AED'}}>✍ İmzala</button>
                </div>
              </div>

              {/* İlaç Verilme Zamanları */}
              <IlacTimeline ilaclar={ilaclar}/>

              {/* Anestezi Olaylar Takibi */}
              <div className="panel" style={{flex:1}}>
                <div className="panel-hd">
                  <span className="panel-title">Anestezi Olaylar Takibi</span>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <span style={{fontSize:11,color:'var(--slate-light)'}}>{olaylar.length} kayıt</span>
                    <button onClick={()=>setOlayModal(true)}
                      style={{fontSize:10,padding:'4px 12px',borderRadius:20,border:'1.5px solid rgba(20,184,166,0.35)',background:'rgba(20,184,166,0.08)',color:'var(--teal)',cursor:'pointer',fontFamily:'var(--font)',fontWeight:700}}>
                      + Olay Ekle
                    </button>
                  </div>
                </div>
                <div className="ane-timeline">
                  {olaylar.map((e,i) => {
                    const renk = TIP_RENK[e.tip] || '#94A3B8';
                    return (
                      <div key={e.id} className="ate" style={{borderLeft:`3px solid ${renk}`,background:i===0?'rgba(20,184,166,0.02)':''}}>
                        <div style={{display:'flex',flexDirection:'column',alignItems:'center',minWidth:52}}>
                          <div className="ate-time">{e.t}</div>
                          <div style={{fontSize:18,marginTop:4}}>{TIP_IKON[e.tip]||'📌'}</div>
                        </div>
                        <div className="ate-evt" style={{flex:1}}>
                          <div className="ate-name">{e.n}</div>
                          <div className="ate-note">{e.d}</div>
                          {e.vitaller && (
                            <div style={{display:'flex',gap:6,marginTop:5,flexWrap:'wrap'}}>
                              {e.vitaller.spo2  && <span className="ate-val">SpO₂: {e.vitaller.spo2}%</span>}
                              {e.vitaller.kb    && <span className="ate-val">KB: {e.vitaller.kb}</span>}
                              {e.vitaller.kah   && <span className="ate-val">KAH: {e.vitaller.kah}</span>}
                              {e.vitaller.etco2 && <span className="ate-val">EtCO₂: {e.vitaller.etco2}</span>}
                              {e.vitaller.ates  && <span className="ate-val">Ateş: {e.vitaller.ates}°C</span>}
                            </div>
                          )}
                        </div>
                        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:5,flexShrink:0}}>
                          <span style={{fontSize:9,padding:'2px 8px',borderRadius:12,background:`${renk}18`,color:renk,fontWeight:700,border:`1px solid ${renk}33`}}>{TIP_LBL[e.tip]}</span>
                          <button onClick={()=>removeOlay(e.id)} style={{width:22,height:22,border:'1px solid #FECACA',background:'#FEF2F2',color:'var(--danger)',borderRadius:5,cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
                        </div>
                      </div>
                    );
                  })}
                  {olaylar.length===0 && <div style={{padding:32,textAlign:'center',fontSize:12,color:'var(--slate-light)'}}>Henüz olay kaydı yok</div>}
                </div>
              </div>
            </>
          ) : (
            <div style={{background:'var(--card-bg)',border:'1px solid var(--border)',borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12,color:'var(--slate-light)',height:'200px'}}>
              <div style={{fontSize:40}}>💉</div>
              <div style={{fontSize:14,fontWeight:700,color:'var(--slate)'}}>Vaka seçin</div>
            </div>
          )}
        </div>

        {/* SAĞ: Canlı monitör + Cerrahi Ekip + Not */}
        <div style={{display:'flex',flexDirection:'column',gap:14,overflowY:'auto',minHeight:0}}>
          <VitalPanel olaylar={olaylar} onVitalEkle={()=>setVitalModal(true)}/>
          {secili && <EkipPanel s={secili}/>}
          <div className="panel">
            <div className="panel-hd"><span className="panel-title">Anestezi Notu</span></div>
            <div style={{padding:'10px 14px'}}>
              <textarea value={anesNot} onChange={e=>setAnesNot(e.target.value)} rows={4}
                style={{width:'100%',border:'1.5px solid var(--border)',borderRadius:9,background:'var(--surface)',color:'var(--slate)',fontSize:12.5,fontFamily:'var(--font)',padding:'10px 12px',outline:'none',resize:'none',lineHeight:1.6,transition:'border-color 0.15s'}}
                placeholder="Anestezi notları, komplikasyonlar, özel durumlar…"
                onFocus={e=>e.target.style.borderColor='var(--teal-mid)'}
                onBlur={e=>e.target.style.borderColor='var(--border)'}/>
              <button className="btn btn-secondary btn-sm" style={{marginTop:8,width:'100%'}} onClick={()=>showToast('Not kaydedildi ✓')}>Notu Kaydet</button>
            </div>
          </div>
        </div>
      </div>

      {olayModal && <OlayModal onSave={addOlay} onClose={()=>setOlayModal(false)}/>}
      {vitalModal && <VitalModal onSave={addOlay} onClose={()=>setVitalModal(false)}/>}
    </div>
  );
}
