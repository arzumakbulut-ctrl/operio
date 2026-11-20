import { useState, useRef, useEffect } from 'react';
import { useUIStore, useAuthStore, useDataStore } from '../store';
import Modal from '../components/ui/Modal';

const BASE = 'http://localhost:4000/api';
function tok() { return localStorage.getItem('operio_access'); }

const S_COLOR = { Aktif:'#059669', Bakımda:'#D97706', Arızalı:'#DC2626', Pasif:'#94A3B8' };
const S_TAG   = { Aktif:'t-green', Bakımda:'t-orange', Arızalı:'t-red', Pasif:'t-gray' };

const MENU_ITEMS = [
  { key:'bakim',    label:'🔧 Bakıma Al',      durum:'Bakımda', color:'#D97706' },
  { key:'arizali',  label:'⚠️ Arızalı İşaretle', durum:'Arızalı', color:'#DC2626' },
  { key:'aktif',    label:'✅ Aktife Al',       durum:'Aktif',   color:'#059669' },
  { key:'teslim',   label:'📦 Teslim Al',       durum:'Aktif',   color:'#059669' },
  { key:'pasif',    label:'⏸ Pasife Al',        durum:'Pasif',   color:'#94A3B8' },
  { key:'servis',   label:'📞 Servis Çağır',    durum:null,      color:'#DC2626' },
  { key:'detay',    label:'🔍 Detay Görüntüle', durum:null,      color:'var(--slate)' },
];

function dbToRow(r) {
  return {
    id: r.id,
    n: r.ad,
    t: r.kategori || 'Cerrahi Alet',
    s: r.durum || 'Aktif',
    sc: S_COLOR[r.durum] || '#059669',
    r: r.raf || '—',
    sn: r.seriNo || '',
    son: r.sonKontrol ? new Date(r.sonKontrol).toLocaleDateString('tr-TR') : '—',
    not: r.notlar || '',
  };
}

export default function Envanter() {
  const { sterilSetler, cihazlar } = useDataStore();
  const { showToast } = useUIStore();
  const { curRole } = useAuthStore();
  const isAnestezTek = curRole === 3;
  const [ekipman, setEkipman] = useState([]);
  const [modal, setModal]     = useState(false);
  const [detay, setDetay]     = useState(null);
  const [arama, setArama]     = useState('');
  const [filtre, setFiltre]   = useState('Tümü');
  const [form, setForm]       = useState({ n:'', t:'Cerrahi Alet', s:'Aktif', r:'Salon 1', sn:'' });
  const [menu, setMenu]       = useState(null); // { id, x, y }
  const menuRef = useRef(null);

  useEffect(() => {
    fetch(`${BASE}/envanter`, { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => setEkipman(data.map(dbToRow)))
      .catch(() => {});
  }, []);

  const liste = ekipman.filter(e =>
    (filtre === 'Tümü' || e.s === filtre) &&
    e.n.toLowerCase().includes(arama.toLowerCase())
  );

  const aktif   = ekipman.filter(e => e.s === 'Aktif').length;
  const bakim   = ekipman.filter(e => e.s === 'Bakımda').length;
  const arizali = ekipman.filter(e => e.s === 'Arızalı').length;

  // Menü dışına tıklayınca kapat
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(null);
    }
    if (menu) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menu]);

  function openMenu(e, id) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenu({ id, x: rect.left, y: rect.bottom + 4 });
  }

  function handleMenuAction(item) {
    const cihaz = ekipman.find(e => e.id === menu.id);
    if (!cihaz) { setMenu(null); return; }

    if (item.key === 'detay') {
      setDetay(cihaz);
      setMenu(null);
      return;
    }
    if (item.key === 'servis') {
      showToast(`${cihaz.n} için servis talebi oluşturuldu ✓`);
      setMenu(null);
      return;
    }
    if (item.durum && item.durum !== cihaz.s) {
      setEkipman(prev => prev.map(e =>
        e.id === menu.id ? { ...e, s: item.durum, sc: S_COLOR[item.durum] } : e
      ));
      fetch(`${BASE}/envanter/${menu.id}`, { method:'PUT', headers: { 'Content-Type':'application/json', Authorization:`Bearer ${tok()}` }, body: JSON.stringify({ durum: item.durum }) }).catch(() => {});
      const mesajlar = {
        bakim:'Cihaz bakıma alındı ✓', arizali:'Cihaz arızalı olarak işaretlendi',
        aktif:'Cihaz aktife alındı ✓', teslim:'Cihaz teslim alındı ✓', pasif:'Cihaz pasife alındı'
      };
      showToast(mesajlar[item.key] || 'Durum güncellendi');
    }
    setMenu(null);
  }

  async function kaydet() {
    if (!form.n.trim()) { showToast('Cihaz adı zorunludur'); return; }
    try {
      const res = await fetch(`${BASE}/envanter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
        body: JSON.stringify({ ad: form.n, kategori: form.t, durum: form.s, raf: form.r, seriNo: form.sn }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Hata');
      setEkipman(prev => [...prev, dbToRow(data)]);
      showToast('Cihaz eklendi ✓');
    } catch(e) {
      showToast('Kayıt hatası: ' + e.message);
    }
    setModal(false);
    setForm({ n:'', t:'Cerrahi Alet', s:'Aktif', r:'Salon 1', sn:'' });
  }

  // Hangi menü öğeleri gösterilsin
  function getMenuItems(cihaz) {
    const tumMenuItems = MENU_ITEMS.filter(item => {
      if (item.key === 'aktif'   && cihaz.s === 'Aktif')   return false;
      if (item.key === 'bakim'   && cihaz.s === 'Bakımda') return false;
      if (item.key === 'arizali' && cihaz.s === 'Arızalı') return false;
      if (item.key === 'pasif'   && cihaz.s === 'Pasif')   return false;
      if (item.key === 'teslim'  && cihaz.s !== 'Bakımda' && cihaz.s !== 'Arızalı') return false;
      if (item.key === 'servis'  && cihaz.s !== 'Arızalı') return false;
      return true;
    });
    // Anestezi Teknisyeni (rol 3) sadece "Arızalı İşaretle" görebilir
    if (isAnestezTek) return tumMenuItems.filter(item => item.key === 'arizali');
    return tumMenuItems;
  }

  const menuCihaz = menu ? ekipman.find(e => e.id === menu.id) : null;

  return (
    <div>
      <div className="page-hd" style={{ marginBottom:14 }}>
        <div>
          <div className="page-hd-title">Cihaz & Ekipman Envanteri</div>
          <div className="page-hd-sub">{ekipman.length} cihaz kayıtlı — {arizali} arızalı, {bakim} bakımda</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)} style={{display: isAnestezTek ? 'none' : ''}}>+ Cihaz Ekle</button>
      </div>

      {/* Özet */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:14 }}>
        {[['Aktif',aktif,'#059669'],['Bakımda',bakim,'#D97706'],['Arızalı',arizali,'#DC2626']].map(([l,v,c])=>(
          <div key={l} style={{ background:'var(--card-bg)', border:`1.5px solid ${c}33`, borderRadius:12, padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:10, height:10, borderRadius:'50%', background:c }}/>
            <div>
              <div style={{ fontSize:22, fontWeight:800, color:c, fontFamily:"'Outfit',sans-serif" }}>{v}</div>
              <div style={{ fontSize:11, color:'var(--slate-light)' }}>{l}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filtreler */}
      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        <input className="fi" placeholder="Cihaz ara…" value={arama} onChange={e=>setArama(e.target.value)} style={{ maxWidth:220 }}/>
        {['Tümü','Aktif','Bakımda','Arızalı'].map(f=>(
          <button key={f} onClick={()=>setFiltre(f)}
            style={{ padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:600, border:'1px solid var(--border)', cursor:'pointer', background:filtre===f?'var(--teal)':'var(--surface)', color:filtre===f?'white':'var(--slate-mid)' }}>
            {f}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="equip-grid">
        {liste.map(e => (
          <div key={e.id} className="equip-card" onClick={() => setDetay(e)}>
            <div className="eq-top">
              <div>
                <div className="eq-name">{e.n}</div>
                <div className="eq-type">{e.t}</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:e.sc, marginTop:2 }}/>
                {/* ⋮ Menü butonu */}
                <div
                  className="eq-menu"
                  onClick={ev => openMenu(ev, e.id)}
                  title="İşlemler"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width:14, height:14, color:'var(--slate-mid)' }}>
                    <circle cx="12" cy="5"  r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
                  </svg>
                </div>
              </div>
            </div>
            <div className="eq-status">
              <div className="eq-dot" style={{ background:e.sc }}/>
              <span style={{ color:e.sc, fontSize:12, fontWeight:600 }}>{e.s}</span>
            </div>
            <div className="eq-room">📍 {e.r}</div>
            {e.sn && <div style={{ fontSize:10, color:'var(--slate-light)', marginTop:2 }}>S/N: {e.sn}</div>}
          </div>
        ))}
      </div>

      {/* Context Menü */}
      {menu && menuCihaz && (
        <div
          ref={menuRef}
          style={{
            position:'fixed', top:menu.y, left:menu.x,
            background:'var(--card-bg)', border:'1px solid var(--border)',
            borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,0.14)',
            zIndex:900, minWidth:185, overflow:'hidden',
            animation:'slideDown 0.12s ease'
          }}
        >
          <div style={{ padding:'8px 12px', borderBottom:'1px solid var(--border)', fontSize:10, fontWeight:700, color:'var(--slate-light)', textTransform:'uppercase', letterSpacing:'0.5px' }}>
            {menuCihaz.n}
          </div>
          {getMenuItems(menuCihaz).map((item, i) => (
            <div
              key={item.key}
              onClick={() => handleMenuAction(item)}
              style={{
                padding:'9px 14px', fontSize:12, fontWeight:500,
                color: item.key === 'servis' || item.key === 'arizali' ? '#DC2626' : 'var(--slate)',
                cursor:'pointer', transition:'background 0.1s',
                borderBottom: i < getMenuItems(menuCihaz).length-1 ? '1px solid var(--border)' : 'none'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}

      {/* Ekle Modal */}
      {modal && (
        <Modal title="Yeni Cihaz Ekle" onClose={()=>setModal(false)} width={460}>
          <div className="fg" style={{ marginBottom:12 }}>
            <label className="fl">Cihaz Adı *</label>
            <input className="fi" value={form.n} onChange={e=>setForm({...form,n:e.target.value})} placeholder="Laparoskopi Seti A…" autoFocus/>
          </div>
          <div className="fr" style={{ marginBottom:12 }}>
            <div className="fg"><label className="fl">Tür</label>
              <select className="fi" value={form.t} onChange={e=>setForm({...form,t:e.target.value})}>
                {['Cerrahi Alet','Anestezi','Cerrahi','Ortopedi','Görüntüleme','Monitörizasyon'].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="fg"><label className="fl">Durum</label>
              <select className="fi" value={form.s} onChange={e=>setForm({...form,s:e.target.value})}>
                {['Aktif','Bakımda','Arızalı','Pasif'].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="fr">
            <div className="fg"><label className="fl">Konum</label>
              <select className="fi" value={form.r} onChange={e=>setForm({...form,r:e.target.value})}>
                {['Salon 1','Salon 2','Salon 3','Salon 4','Salon 5','Depo'].map(r=><option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="fg"><label className="fl">Seri No</label>
              <input className="fi" value={form.sn} onChange={e=>setForm({...form,sn:e.target.value})} placeholder="LS-A-001"/>
            </div>
          </div>
          <div className="mf">
            <button className="btn btn-secondary" onClick={()=>setModal(false)}>İptal</button>
            <button className="btn btn-primary" onClick={kaydet}>Ekle</button>
          </div>
        </Modal>
      )}

      {/* Detay Modal */}
      {detay && (
        <Modal title={detay.n} onClose={()=>setDetay(null)} width={400}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16, padding:'12px 14px', background:'var(--surface)', borderRadius:10 }}>
            <div style={{ width:44, height:44, borderRadius:12, background:`${detay.sc}15`, border:`1.5px solid ${detay.sc}33`, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ width:16, height:16, borderRadius:'50%', background:detay.sc }}/>
            </div>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--slate)' }}>{detay.n}</div>
              <span className={`tag ${S_TAG[detay.s]}`} style={{ marginTop:4, display:'inline-block' }}>{detay.s}</span>
            </div>
          </div>
          {[['Tür',detay.t],['Konum',detay.r],['Seri No',detay.sn||'—'],['Son Bakım',detay.son]].map(([l,v])=>(
            <div key={l} style={{ display:'flex', padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
              <span style={{ color:'var(--slate-light)', width:100, flexShrink:0 }}>{l}</span>
              <span style={{ fontWeight:600, color:'var(--slate)' }}>{v}</span>
            </div>
          ))}
          {detay.not && (
            <div style={{ marginTop:10, padding:'8px 12px', background:'rgba(220,38,38,0.06)', border:'1px solid rgba(220,38,38,0.2)', borderRadius:8, fontSize:12, color:'#DC2626' }}>
              ⚠ {detay.not}
            </div>
          )}
          <div style={{ marginTop:16, display:'flex', flexWrap:'wrap', gap:7 }}>
            {getMenuItems(detay).filter(i=>i.key!=='detay').map(item => (
              <button key={item.key} className="btn btn-secondary btn-sm"
                style={item.key==='servis'||item.key==='arizali'?{color:'#DC2626',borderColor:'rgba(220,38,38,0.3)',background:'rgba(220,38,38,0.06)'}:{}}
                onClick={() => {
                  if (item.key === 'servis') { showToast(`${detay.n} için servis talebi oluşturuldu ✓`); setDetay(null); return; }
                  if (item.durum) {
                    setEkipman(prev => prev.map(e => e.id===detay.id ? {...e, s:item.durum, sc:S_COLOR[item.durum]} : e));
                    fetch(`${BASE}/envanter/${detay.id}`, { method:'PUT', headers: { 'Content-Type':'application/json', Authorization:`Bearer ${tok()}` }, body: JSON.stringify({ durum: item.durum }) }).catch(() => {});
                    showToast('Durum güncellendi ✓');
                    setDetay(null);
                  }
                }}>
                {item.label}
              </button>
            ))}
            <button className="btn btn-secondary btn-sm" style={{ marginLeft:'auto' }} onClick={()=>setDetay(null)}>Kapat</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
