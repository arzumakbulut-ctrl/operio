import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDataStore, useUIStore, useAuthStore } from '../store';

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

const INIT_EVENTS = [
  { id:'ae1', t:'08:05', tip:'hasta',  n:'Hasta Alındı',       d:'Hasta ameliyathaneye alındı. Kimlik doğrulama yapıldı.',     vitaller:{ spo2:99,  kb:'124/76', kah:74,  etco2:null, ates:36.5 } },
  { id:'ae2', t:'08:12', tip:'iv',     n:'IV Damar Yolu',      d:'Sağ el sırtına 18G IV branül takıldı.',                      vitaller: null },
  { id:'ae3', t:'08:18', tip:'ilac',   n:'Preoksijenasyon',    d:'%100 O₂ ile 3 dk preoksijenasyon uygulandı.',                vitaller:{ spo2:99,  kb:'126/78', kah:72,  etco2:null, ates:36.5 } },
  { id:'ae4', t:'08:22', tip:'ilac',   n:'İndüksiyon',         d:'Propofol 200mg + Fentanil 100mcg IV bolus',                  vitaller:{ spo2:98,  kb:'128/78', kah:68,  etco2:32,   ates:36.5 } },
  { id:'ae5', t:'08:25', tip:'airway', n:'Entübasyon',         d:'7.5mm ET tüp, C-MAC videolaringoskop ile. Cuff 22 cmH₂O.',  vitaller:{ spo2:99,  kb:'132/82', kah:85,  etco2:35,   ates:36.6 } },
  { id:'ae6', t:'08:30', tip:'idame',  n:'İdame Başladı',      d:'Sevofluran %2 + O₂/hava karışımı. Supin pozisyon.',         vitaller:{ spo2:99,  kb:'118/72', kah:70,  etco2:34,   ates:36.6 } },
  { id:'ae7', t:'09:15', tip:'ilac',   n:'Rocuronium',         d:'Rocuronium 40mg IV bolus — kas gevşemesi',                   vitaller:{ spo2:99,  kb:'115/70', kah:68,  etco2:34,   ates:36.7 } },
  { id:'ae8', t:'09:45', tip:'vital',  n:'Rutin Vital Ölçüm',  d:'Rutin 15 dk vital kontrol.',                                 vitaller:{ spo2:98,  kb:'120/74', kah:72,  etco2:35,   ates:36.8 } },
];

// ── SpO₂ Mini Grafik ─────────────────────────────────────────
function MiniGrafik({ events }) {
  const pts = events.filter(e => e.vitaller?.spo2).slice(-6);
  if (pts.length < 2) return <div style={{textAlign:'center',color:'var(--slate-light)',fontSize:12,padding:10}}>Yeterli veri yok</div>;
  const W=280, H=60;
  const vals = pts.map(p => p.vitaller.spo2);
  const min = Math.min(...vals)-1, max = Math.max(...vals)+1;
  const xStep = W / (pts.length-1);
  const toY = v => H - ((v-min)/(max-min)) * H;
  const path = pts.map((p,i) => `${i===0?'M':'L'}${i*xStep},${toY(p.vitaller.spo2)}`).join('');
  const area = path + `L${(pts.length-1)*xStep},${H}L0,${H}Z`;
  return (
    <svg viewBox={`0 -4 ${W} ${H+20}`} style={{width:'100%',height:'auto',overflow:'visible'}}>
      <defs>
        <linearGradient id="spo2g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#14B8A6" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#14B8A6" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spo2g)"/>
      <path d={path} fill="none" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {pts.map((p,i)=>(
        <circle key={i} cx={i*xStep} cy={toY(p.vitaller.spo2)} r="3" fill="#14B8A6"/>
      ))}
      {pts.map((p,i)=>(
        <text key={i} x={i*xStep} y={H+14} fontSize="9" fill="var(--slate-light)" textAnchor="middle">{p.t}</text>
      ))}
      <text x="0" y="-2" fontSize="8" fill="var(--slate-light)">SpO₂ %</text>
    </svg>
  );
}

// ── Vital Panel ───────────────────────────────────────────────
function VitalPanel({ events }) {
  const son = [...events].reverse().find(e => e.vitaller);
  const v = son?.vitaller;
  if (!v) return <div style={{textAlign:'center',color:'var(--slate-light)',padding:20,fontSize:12}}>Vital kayıt yok</div>;
  const items = [
    { lbl:'SpO₂',        val:`${v.spo2||'—'}%`,          renk: v.spo2&&v.spo2>=95?'#059669':'#DC2626', ic:'💧' },
    { lbl:'Kan Basıncı', val: v.kb||'—',                  renk:'#0284C7',  ic:'❤️' },
    { lbl:'KAH',         val:`${v.kah||'—'} /dk`,         renk:'#DC2626',  ic:'💓' },
    { lbl:'EtCO₂',       val: v.etco2?`${v.etco2} mmHg`:'—', renk:'#7C3AED', ic:'🫁' },
    { lbl:'Ateş',        val: v.ates?`${v.ates}°C`:'—',   renk: v.ates&&v.ates>37.5?'#D97706':'#059669', ic:'🌡️' },
    { lbl:'Son Kayıt',   val: son.t,                       renk:'var(--slate-light)', ic:'🕐' },
  ];
  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
      {items.map(x => (
        <div key={x.lbl} style={{background:`${x.renk}12`,border:`1px solid ${x.renk}22`,borderRadius:9,padding:'8px 10px'}}>
          <div style={{fontSize:13,marginBottom:2}}>{x.ic}</div>
          <div style={{fontSize:15,fontWeight:800,color:x.renk,fontFamily:"'Outfit',sans-serif",letterSpacing:'-0.5px',lineHeight:1}}>{x.val}</div>
          <div style={{fontSize:9,color:'var(--slate-light)',marginTop:2,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.3px'}}>{x.lbl}</div>
        </div>
      ))}
    </div>
  );
}

// ── Olay Ekle Modal ──────────────────────────────────────────
function OlayModal({ onSave, onClose }) {
  const [f, setF] = useState({ t:new Date().toTimeString().slice(0,5), tip:'ilac', n:'', d:'', spo2:'', kb:'', kah:'' });
  const u = (k,v) => setF(p=>({...p,[k]:v}));
  function save() {
    if (!f.n.trim()) { return; }
    const vitaller = (f.spo2||f.kb||f.kah) ? {spo2:f.spo2?parseInt(f.spo2):null,kb:f.kb||null,kah:f.kah?parseInt(f.kah):null,etco2:null,ates:null} : null;
    onSave({ id:'ae'+Date.now(), t:f.t, tip:f.tip, n:f.n, d:f.d, vitaller });
    onClose();
  }
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.6)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)'}} onClick={onClose}>
      <div style={{background:'var(--card-bg)',border:'1px solid var(--border)',borderRadius:18,width:480,maxWidth:'95vw',padding:28,boxShadow:'0 24px 64px rgba(0,0,0,0.25)'}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:16,fontWeight:700,color:'var(--slate)',marginBottom:20,fontFamily:"'Outfit',sans-serif"}}>Anestezi Olayı Ekle</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
          <div><label className="fl">Saat</label><input className="fi" type="time" value={f.t} onChange={e=>u('t',e.target.value)}/></div>
          <div><label className="fl">Olay Tipi</label>
            <select className="fi" value={f.tip} onChange={e=>u('tip',e.target.value)}>
              <option value="hasta">🧑 Hasta</option>
              <option value="ilac">💊 İlaç</option>
              <option value="airway">🫁 Hava Yolu</option>
              <option value="iv">💉 IV İşlem</option>
              <option value="idame">🔄 İdame</option>
              <option value="vital">📊 Vital</option>
              <option value="not">📝 Not</option>
            </select>
          </div>
        </div>
        <div style={{marginBottom:12}}><label className="fl">Olay Adı</label><input className="fi" value={f.n} onChange={e=>u('n',e.target.value)} placeholder="Propofol 200mg IV bolus" autoFocus/></div>
        <div style={{marginBottom:12}}><label className="fl">Detay</label><textarea className="fi" rows={2} value={f.d} onChange={e=>u('d',e.target.value)} placeholder="Açıklama…" style={{resize:'none'}}/></div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:20}}>
          <div><label className="fl">SpO₂ (%)</label><input className="fi" type="number" value={f.spo2} onChange={e=>u('spo2',e.target.value)} placeholder="99"/></div>
          <div><label className="fl">KB</label><input className="fi" value={f.kb} onChange={e=>u('kb',e.target.value)} placeholder="120/80"/></div>
          <div><label className="fl">KAH (/dk)</label><input className="fi" type="number" value={f.kah} onChange={e=>u('kah',e.target.value)} placeholder="72"/></div>
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <button className="btn btn-secondary" onClick={onClose}>İptal</button>
          <button className="btn btn-primary" onClick={save}>Kaydet ✓</button>
        </div>
      </div>
    </div>
  );
}

// ── Vital Kaydet Modal ───────────────────────────────────────
function VitalModal({ onSave, onClose }) {
  const [f, setF] = useState({ saat:new Date().toTimeString().slice(0,5), spo2:'', kb:'', kah:'', etco2:'', ates:'' });
  const u = (k,v) => setF(p=>({...p,[k]:v}));
  function save() {
    onSave({ id:'av'+Date.now(), t:f.saat, tip:'vital', n:'Rutin Vital Ölçüm', d:'Periyodik vital kontrol kaydı.',
      vitaller:{spo2:f.spo2?parseInt(f.spo2):null,kb:f.kb||null,kah:f.kah?parseInt(f.kah):null,etco2:f.etco2?parseInt(f.etco2):null,ates:f.ates?parseFloat(f.ates):null} });
    onClose();
  }
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.6)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)'}} onClick={onClose}>
      <div style={{background:'var(--card-bg)',border:'1px solid var(--border)',borderRadius:18,width:420,maxWidth:'95vw',padding:28,boxShadow:'0 24px 64px rgba(0,0,0,0.25)'}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:16,fontWeight:700,color:'var(--slate)',marginBottom:20,fontFamily:"'Outfit',sans-serif"}}>📊 Vital Değer Kaydet</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div><label className="fl">Saat</label><input className="fi" type="time" value={f.saat} onChange={e=>u('saat',e.target.value)} autoFocus/></div>
          <div><label className="fl">SpO₂ (%)</label><input className="fi" type="number" value={f.spo2} onChange={e=>u('spo2',e.target.value)} placeholder="99"/></div>
          <div><label className="fl">KB</label><input className="fi" value={f.kb} onChange={e=>u('kb',e.target.value)} placeholder="120/80"/></div>
          <div><label className="fl">KAH (/dk)</label><input className="fi" type="number" value={f.kah} onChange={e=>u('kah',e.target.value)} placeholder="72"/></div>
          <div><label className="fl">EtCO₂ (mmHg)</label><input className="fi" type="number" value={f.etco2} onChange={e=>u('etco2',e.target.value)} placeholder="35"/></div>
          <div><label className="fl">Ateş (°C)</label><input className="fi" type="number" step="0.1" value={f.ates} onChange={e=>u('ates',e.target.value)} placeholder="36.5"/></div>
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:20}}>
          <button className="btn btn-secondary" onClick={onClose}>İptal</button>
          <button className="btn btn-primary" onClick={save}>Kaydet ✓</button>
        </div>
      </div>
    </div>
  );
}

// ── Ana Sayfa ─────────────────────────────────────────────────
export default function HastaTakibi() {
  const { surgeries } = useDataStore();
  const { showToast } = useUIStore();
  const { curRole }   = useAuthStore();
  // Sadece Anestezi Teknisyeni (3) düzenleyebilir; Anestezi Sorumlusu (2) salt okunur
  const canEdit = curRole === 3;
  const location  = useLocation();
  const navigate  = useNavigate();

  // navigate('/hasta-takibi', { state: { surgeryId } }) ile gelir
  const surgeryId = location.state?.surgeryId ?? null;
  const s = surgeries.find(x => x.id === surgeryId) || surgeries[0];

  // Kronometre
  const [sec, setSec]         = useState(0);
  const [running, setRunning] = useState(false);
  const [ameliyatBasladi, setAmeliyatBasladi] = useState(false);
  const timerRef = useRef(null);

  function getNow() {
    return new Date().toTimeString().slice(0,5);
  }

  function toggleTimer() {
    const saat = getNow();
    if (running) {
      // Ameliyatı Bitir
      clearInterval(timerRef.current);
      setRunning(false);
      addEvent({ id:'timer_end_'+Date.now(), t:saat, tip:'hasta', n:'Ameliyat Sona Erdi', d:`Ameliyat tamamlandı. Toplam süre: ${timerLabel}`, vitaller:null });
    } else {
      // Ameliyatı Başlat
      timerRef.current = setInterval(() => setSec(p => p+1), 1000);
      setRunning(true);
      setAmeliyatBasladi(true);
      if (!ameliyatBasladi) {
        addEventDirect({ id:'timer_start_'+Date.now(), t:saat, tip:'hasta', n:'Ameliyat Başladı', d:`${s?.op} — ${s?.salon} — Anestezi: ${s?.anestezi||'Genel Anestezi'}`, vitaller:null });
      }
    }
  }
  useEffect(() => () => clearInterval(timerRef.current), []);

  useEffect(() => {
    const ameliyatId = s?.id;
    if (!ameliyatId) return;
    fetch(`${BASE}/klinik-olay?ameliyatId=${ameliyatId}&tur=takip`, { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => { setEvents(data.length > 0 ? data.map(mapOlay) : INIT_EVENTS); })
      .catch(() => setEvents(INIT_EVENTS));
  }, [s?.id]);
  const timerLabel = [Math.floor(sec/3600), Math.floor((sec%3600)/60), sec%60].map(n=>String(n).padStart(2,'0')).join(':');

  // Olaylar
  const [events, setEvents] = useState([]);
  const [olayModal, setOlayModal] = useState(false);
  const [vitalModal, setVitalModal] = useState(false);
  const [not, setNot] = useState('');

  function addEventDirect(ev) {
    setEvents(p => [...p, ev].sort((a,b) => a.t.localeCompare(b.t)));
  }
  async function addEvent(ev) {
    const body = { ameliyatId: s?.id, tur: 'takip', saat: ev.t, tip: ev.tip, baslik: ev.n, aciklama: ev.d, vitaller: ev.vitaller ? JSON.stringify(ev.vitaller) : null };
    try {
      const res = await fetch(`${BASE}/klinik-olay`, { method: 'POST', headers: h(), body: JSON.stringify(body) });
      const created = res.ok ? await res.json() : null;
      const yeniEv = created ? mapOlay(created) : ev;
      setEvents(p => [...p, yeniEv].sort((a,b) => a.t.localeCompare(b.t)));
    } catch {
      addEventDirect(ev);
    }
    showToast('Olay eklendi ✓');
  }

  const ilaclar = events.filter(e => e.tip === 'ilac');
  const START_DAK = 8*60+5, TOPLAM = 90;
  const anesEkip = s?.ekip?.anestezi || '—';
  const anesTek  = s?.ekip?.anesteknik || '—';

  if (!s) return <div style={{padding:40,textAlign:'center',color:'var(--slate-light)'}}>Ameliyat bulunamadı</div>;

  return (
    <div style={{display:'flex',flexDirection:'column'}}>

      {/* ── Başlık ── */}
      <div className="page-hd" style={{marginBottom:16,flexShrink:0}}>
        <div>
          <div className="page-hd-title">Hasta Takibi — Anestezi Formu</div>
          <div className="page-hd-sub">{s.hasta} • {s.op} • {s.salon} • {anesEkip}</div>
        </div>
        {canEdit && (
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <button onClick={toggleTimer} className="btn"
              style={running
                ? {background:'rgba(220,38,38,0.08)',color:'#DC2626',border:'1.5px solid rgba(220,38,38,0.3)',fontFamily:'var(--font)',fontWeight:600,fontSize:12,padding:'7px 14px',borderRadius:8,cursor:'pointer'}
                : {background:'#059669',color:'white',border:'none',fontFamily:'var(--font)',fontWeight:600,fontSize:12,padding:'7px 14px',borderRadius:8,cursor:'pointer'}}>
              {running ? '⏹ Ameliyatı Bitir' : '▶ Ameliyatı Başlat'}
            </button>
            {(running || sec > 0) && (
              <div style={{display:'flex',alignItems:'center',gap:7,padding:'7px 13px',background:'rgba(5,150,105,0.1)',border:'1.5px solid rgba(5,150,105,0.25)',borderRadius:10,fontSize:13,fontWeight:700,color:'#059669',fontFamily:"'Outfit',sans-serif"}}>
                <div style={{width:7,height:7,borderRadius:'50%',background:'#059669',boxShadow:running?'0 0 0 3px rgba(5,150,105,0.2)':'',opacity:running?1:0.5}}/>
                {timerLabel}
              </div>
            )}
            <button className="btn btn-secondary btn-sm" onClick={()=>setOlayModal(true)}>+ Olay Ekle</button>
            <button className="btn btn-primary btn-sm" onClick={()=>setVitalModal(true)}>📊 Vital Kaydet</button>
          </div>
        )}
        {!canEdit && (
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-secondary btn-sm" onClick={()=>window.print()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:13,height:13}}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Yazdır
            </button>
            <button className="btn btn-primary btn-sm" onClick={()=>showToast('Form e-posta ile gönderildi ✓')} style={{background:'#7C3AED',borderColor:'#7C3AED'}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:13,height:13}}><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              Gönder
            </button>
          </div>
        )}
      </div>

      {/* ── Grid: Sol | Sağ ── */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 340px',gap:16}}>

        {/* SOL: Timeline */}
        <div style={{display:'flex',flexDirection:'column',gap:14}}>

          {/* İlaç Verilme Zamanları */}
          <div className="panel" style={{flexShrink:0}}>
            <div className="panel-hd">
              <span className="panel-title">İlaç Verilme Zamanları</span>
              <span style={{fontSize:11,color:'var(--slate-light)'}}>{ilaclar.length} ilaç kaydı</span>
            </div>
            <div style={{padding:'14px 18px'}}>
              <div style={{position:'relative',height:40,background:'var(--surface)',borderRadius:8,border:'1px solid var(--border)',overflow:'hidden'}}>
                {ilaclar.map(e => {
                  const [h,m] = e.t.split(':').map(Number);
                  const pct = Math.max(0, Math.min(100, ((h*60+m - START_DAK)/TOPLAM)*100));
                  return (
                    <div key={e.id} title={`${e.n} — ${e.t}`}
                      style={{position:'absolute',left:`${pct}%`,top:8,width:24,height:24,borderRadius:'50%',
                        background:'linear-gradient(135deg,var(--teal),#7C3AED)',
                        display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,
                        cursor:'pointer',transform:'translateX(-50%)',boxShadow:'0 2px 8px rgba(0,0,0,0.2)',
                        transition:'transform 0.15s'}}
                      onClick={() => showToast(`${e.n} — ${e.t}`)}
                      onMouseOver={ev => ev.currentTarget.style.transform='translateX(-50%) scale(1.25)'}
                      onMouseOut={ev  => ev.currentTarget.style.transform='translateX(-50%) scale(1)'}>
                      💊
                    </div>
                  );
                })}
                <div style={{position:'absolute',bottom:4,left:0,right:0,display:'flex',justifyContent:'space-between',padding:'0 4px',fontSize:9,color:'var(--slate-light)',pointerEvents:'none'}}>
                  <span>08:05</span><span>Ameliyat Süresi ({TOPLAM} dk)</span><span>09:35</span>
                </div>
              </div>
            </div>
          </div>

          {/* Anestezi Olaylar Takibi */}
          <div className="panel">
            <div className="panel-hd" style={{flexShrink:0}}>
              <span className="panel-title">Anestezi Olaylar Takibi</span>
              <span style={{fontSize:11,color:'var(--slate-light)'}}>{events.length} kayıt</span>
            </div>
            <div className="ane-timeline" style={{padding:'10px 10px'}}>
              {events.map((e,i) => {
                const renk = TIP_RENK[e.tip] || '#94A3B8';
                return (
                  <div key={e.id} className="ate"
                    style={{cursor:'default',borderLeft:`3px solid ${renk}`,borderRadius:'0 10px 10px 0',
                      borderTop:'1px solid var(--border)',borderRight:'1px solid var(--border)',borderBottom:'1px solid var(--border)',
                      background:i===0?'rgba(20,184,166,0.03)':''}}>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'center',minWidth:50}}>
                      <div className="ate-time">{e.t}</div>
                      <div style={{fontSize:16,marginTop:4}}>{TIP_IKON[e.tip]||'📌'}</div>
                    </div>
                    <div className="ate-evt" style={{flex:1}}>
                      <div className="ate-name">{e.n}</div>
                      <div className="ate-note">{e.d}</div>
                      {e.vitaller && (
                        <div style={{display:'flex',flexWrap:'wrap',gap:5,marginTop:6}}>
                          {e.vitaller.spo2  && <span style={{fontSize:10,padding:'2px 8px',borderRadius:20,background:'rgba(20,184,166,0.1)',color:'var(--teal)',fontWeight:700}}>SpO₂ {e.vitaller.spo2}%</span>}
                          {e.vitaller.kb    && <span style={{fontSize:10,padding:'2px 8px',borderRadius:20,background:'rgba(2,132,199,0.1)',color:'#0284C7',fontWeight:700}}>KB {e.vitaller.kb}</span>}
                          {e.vitaller.kah   && <span style={{fontSize:10,padding:'2px 8px',borderRadius:20,background:'rgba(220,38,38,0.08)',color:'#DC2626',fontWeight:700}}>KAH {e.vitaller.kah}</span>}
                          {e.vitaller.etco2 && <span style={{fontSize:10,padding:'2px 8px',borderRadius:20,background:'rgba(124,58,237,0.1)',color:'#7C3AED',fontWeight:700}}>EtCO₂ {e.vitaller.etco2}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* SAĞ: Cerrahi Ekip + Vital + SpO₂ Trend + Not */}
        <div style={{display:'flex',flexDirection:'column',gap:14}}>

          {/* Cerrahi Ekip */}
          {s?.ekip && (
            <div className="panel">
              <div className="panel-hd"><span className="panel-title">👥 Cerrahi Ekip</span></div>
              <div style={{padding:'4px 0'}}>
                {[
                  {icon:'🔪', rol:'Cerrah',           ad:s.ekip.cerrah     },
                  {icon:'🩻', rol:'Asistan',           ad:s.ekip.asistan    },
                  {icon:'🧤', rol:'Scrub Hemşire',     ad:s.ekip.scrub      },
                  {icon:'🔄', rol:'Sirkülasyon',       ad:s.ekip.sirkule    },
                  {icon:'💉', rol:'Anestezi Uzm.',     ad:s.ekip.anestezi   },
                  {icon:'🩺', rol:'Anes. Teknisyen',   ad:s.ekip.anesteknik },
                ].filter(x=>x.ad).map((item,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:9,padding:'7px 14px',borderBottom:'1px solid var(--border)'}}>
                    <span style={{fontSize:13,flexShrink:0}}>{item.icon}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:9,fontWeight:700,color:'var(--slate-light)',textTransform:'uppercase',letterSpacing:'0.4px'}}>{item.rol}</div>
                      <div style={{fontSize:12,fontWeight:600,color:'var(--slate)',marginTop:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.ad}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Anlık Vital Değerler */}
          <div className="panel">
            <div className="panel-hd">
              <span className="panel-title">Anlık Vital Değerler</span>
              <span style={{fontSize:10,padding:'2px 8px',borderRadius:20,background:'rgba(5,150,105,0.1)',color:'#059669',fontWeight:700}}>● Canlı</span>
            </div>
            <div style={{padding:'10px 14px'}}>
              <VitalPanel events={events}/>
            </div>
          </div>

          {/* SpO₂ Trend */}
          <div className="panel">
            <div className="panel-hd"><span className="panel-title">SpO₂ Trend</span></div>
            <div style={{padding:'8px 14px'}}>
              <MiniGrafik events={events}/>
            </div>
          </div>

          {/* Anestezi Notu */}
          <div className="panel">
            <div className="panel-hd"><span className="panel-title">Anestezi Notu</span></div>
            <div style={{padding:'10px 14px'}}>
              <textarea value={not} onChange={e=>setNot(e.target.value)} rows={3}
                style={{width:'100%',border:'1px solid var(--border)',borderRadius:9,background:'var(--surface)',color:'var(--slate)',fontSize:12,fontFamily:'var(--font)',padding:'8px 11px',outline:'none',resize:'none',lineHeight:1.5,transition:'border-color 0.15s'}}
                placeholder="Anestezi notları, komplikasyonlar, özel durumlar…"
                onFocus={e=>e.target.style.borderColor='var(--teal)'}
                onBlur={e=>e.target.style.borderColor='var(--border)'}/>
              <button className="btn btn-secondary btn-sm" style={{marginTop:6,width:'100%'}} onClick={()=>showToast('Anestezi notu kaydedildi ✓')}>Notu Kaydet</button>
            </div>
          </div>
        </div>
      </div>

      {olayModal  && <OlayModal  onSave={addEvent} onClose={()=>setOlayModal(false)}/>}
      {vitalModal && <VitalModal onSave={addEvent} onClose={()=>setVitalModal(false)}/>}
    </div>
  );
}
