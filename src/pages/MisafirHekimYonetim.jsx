import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useUIStore, useDataStore } from '../store';

const BASE = 'http://localhost:4000/api';
function tok() { return localStorage.getItem('operio_access'); }

function dbToHekim(h, i) {
  return {
    id: h.id,
    ad: [h.ad, h.soyad].filter(Boolean).join(' '),
    uzmanlik: h.uzmanlik || '—',
    email: h.email || '',
    tel: h.tel || '',
    tc: h.tcNo || '',
    diplomaNo: '',
    mezuniyet: '',
    sure: '',
    eklenme: h.baslangic ? new Date(h.baslangic).toISOString().split('T')[0] : '',
    basvuruTarihi: h.createdAt ? new Date(h.createdAt).toISOString().split('T')[0] : '',
    kurum: h.kurum || '',
    durum: (h.durum || 'Bekliyor').toLowerCase() === 'aktif' ? 'aktif' : (h.durum || '').toLowerCase() === 'reddedildi' ? 'reddedildi' : 'bekliyor',
    notlar: h.notlar || '',
    belgeler: [],
    onayTarihi: '',
    onaylayan: '',
    gecmis: [],
  };
}

// ── VERİ (HTML satır 5487'den birebir) ───────────────────────
const MISAFIR_PAKETLER = [
  {id:'starter',   ad:'Starter',   limit:5,   fiyat:990,  renk:'#0284C7'},
  {id:'growth',    ad:'Growth',    limit:15,  fiyat:1790, renk:'#7C3AED'},
  {id:'unlimited', ad:'Unlimited', limit:999, fiyat:2990, renk:'#059669'},
];

const INIT_HEKIMLER = [
  {id:'mh1',ad:'Dr. Zeynep Kara', uzmanlik:'Kardiyoloji',    email:'zkara@klinik.com',    tel:'0532 111 2233',tc:'12345678901',diplomaNo:'MED-2018-4421',mezuniyet:'Hacettepe Üniversitesi',  eklenme:'2026-04-10',basvuruTarihi:'2026-04-08',sure:'3 Ay',  durum:'aktif',     notlar:'Perşembe ve Cuma günleri müsait.',belgeler:['diploma.pdf','sicil.pdf'],    onayTarihi:'2026-04-10',onaylayan:'Dr. Üst Yönetici'},
  {id:'mh2',ad:'Dr. Murat Demir', uzmanlik:'Nöroloji',       email:'mdemir@klinik.com',   tel:'0533 222 3344',tc:'98765432100',diplomaNo:'MED-2015-2218',mezuniyet:'İstanbul Üniversitesi',  eklenme:'2026-05-01',basvuruTarihi:'2026-04-28',sure:'6 Ay',  durum:'aktif',     notlar:'',                                belgeler:['diploma.pdf'],               onayTarihi:'2026-05-01',onaylayan:'Dr. Üst Yönetici'},
  {id:'mh3',ad:'Dr. Selin Aydın', uzmanlik:'Ortopedi',       email:'saydin@ozel.com',     tel:'0542 333 4455',tc:'55566677788',diplomaNo:'MED-2020-6634',mezuniyet:'Ankara Üniversitesi',    eklenme:'',          basvuruTarihi:'2026-05-12',sure:'1 Ay',  durum:'bekliyor',  notlar:'SGK anlaşması hakkında bilgi verilecek.',belgeler:['diploma.pdf','sgk.pdf','kimlik.pdf'],onayTarihi:'',onaylayan:''},
  {id:'mh4',ad:'Dr. Emre Çelik',  uzmanlik:'Genel Cerrahi',  email:'ecelik@hastane.com',  tel:'0544 444 5566',tc:'11122233344',diplomaNo:'MED-2019-5529',mezuniyet:'Ege Üniversitesi',       eklenme:'',          basvuruTarihi:'2026-05-18',sure:'3 Ay',  durum:'bekliyor',  notlar:'',                                belgeler:['diploma.pdf'],               onayTarihi:'',onaylayan:''},
  {id:'mh5',ad:'Dr. Ayşe Yıldız', uzmanlik:'Anesteziyoloji', email:'ayildiz@medcenter.com',tel:'0505 555 6677',tc:'99988877766',diplomaNo:'MED-2016-3312',mezuniyet:'Marmara Üniversitesi',  eklenme:'',          basvuruTarihi:'2026-05-10',sure:'1 Yıl', durum:'reddedildi',notlar:'Eksik belge: Uzmanlık belgesi gönderilmedi.',belgeler:['diploma.pdf'],onayTarihi:'',onaylayan:'Dr. Üst Yönetici'},
];

const DURUM_CFG = {
  aktif:     {renk:'var(--success)', bg:'rgba(5,150,105,0.1)',    lbl:'✅ Aktif',     lbl2:'Aktif'},
  bekliyor:  {renk:'#D97706',        bg:'rgba(217,119,6,0.1)',    lbl:'⏳ Bekliyor',   lbl2:'Bekliyor'},
  reddedildi:{renk:'var(--danger)',  bg:'rgba(220,38,38,0.1)',    lbl:'❌ Reddedildi', lbl2:'Reddedildi'},
};

function mkInitials(ad){ return ad.split(' ').filter(w=>w).map(w=>w[0]).join('').slice(0,2); }

// ── DAVET MODAL ───────────────────────────────────────────────
function DavetModal({ onClose, onEkle, aktifSayi, limit }) {
  const { showToast } = useUIStore();
  const [form, setForm] = useState({ ad:'', uzmanlik:'', email:'', tel:'', tc:'', diplomaNo:'', mezuniyet:'', sure:'3 Ay' });
  const f = (k,v) => setForm(prev=>({...prev,[k]:v}));
  const limitDoldu = limit!==999 && aktifSayi>=limit;

  function kaydet() {
    if (!form.ad.trim() || !form.uzmanlik.trim()) { showToast('Ad ve uzmanlık zorunludur'); return; }
    if (!form.email.trim()) { showToast('E-posta zorunludur'); return; }
    onEkle({
      id: 'mh' + Date.now(),
      ...form,
      eklenme: '', basvuruTarihi: new Date().toISOString().split('T')[0],
      durum: 'bekliyor', notlar: '', belgeler: [], onayTarihi: '', onaylayan: '',
    });
    showToast('📧 Davet e-postası gönderildi');
    onClose();
  }

  return createPortal(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:9999,display:'flex',alignItems:'flex-start',justifyContent:'center',overflowY:'auto',padding:'32px 16px',backdropFilter:'blur(4px)'}}
      onClick={onClose}>
      <div style={{width:560,maxWidth:'100%',background:'var(--card-bg)',borderRadius:20,overflow:'hidden',boxShadow:'0 32px 80px rgba(0,0,0,0.25)',margin:'auto'}}
        onClick={e=>e.stopPropagation()}>
        <div style={{padding:'18px 22px',background:'linear-gradient(135deg,#0284C7,#0891b2)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div style={{fontSize:15,fontWeight:800,color:'white'}}>👨‍⚕️ Misafir Hekim Davet Et</div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.7)',marginTop:2}}>Slot: {aktifSayi}/{limit===999?'∞':limit} kullanımda</div>
          </div>
          <div onClick={onClose} style={{color:'rgba(255,255,255,0.7)',cursor:'pointer',fontSize:20}}>✕</div>
        </div>

        <div style={{padding:'20px 22px',display:'flex',flexDirection:'column',gap:12}}>
          {limitDoldu && <div style={{padding:'10px 14px',borderRadius:10,background:'rgba(220,38,38,0.08)',border:'1px solid rgba(220,38,38,0.2)',fontSize:12,fontWeight:600,color:'var(--danger)'}}>⚠ Paket limiti doldu ({limit} hekim). Yeni hekim eklemek için paketi yükseltin.</div>}

          <div style={{fontSize:'10.5px',fontWeight:700,color:'var(--slate-light)',textTransform:'uppercase',letterSpacing:'0.5px'}}>👤 Kişisel Bilgiler</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div><label className="fl">Ad Soyad *</label><input className="fi" value={form.ad} onChange={e=>f('ad',e.target.value)} placeholder="Dr. Adı Soyadı"/></div>
            <div><label className="fl">Uzmanlık Alanı *</label><input className="fi" value={form.uzmanlik} onChange={e=>f('uzmanlik',e.target.value)} placeholder="Genel Cerrahi"/></div>
            <div><label className="fl">E-posta *</label><input className="fi" type="email" value={form.email} onChange={e=>f('email',e.target.value)} placeholder="hekim@email.com"/></div>
            <div><label className="fl">Telefon</label><input className="fi" value={form.tel} onChange={e=>f('tel',e.target.value)} placeholder="0532 000 0000"/></div>
          </div>

          <div style={{fontSize:'10.5px',fontWeight:700,color:'var(--slate-light)',textTransform:'uppercase',letterSpacing:'0.5px'}}>🎓 Mesleki Bilgiler</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div><label className="fl">T.C. Kimlik No</label><input className="fi" value={form.tc} onChange={e=>f('tc',e.target.value)} placeholder="12345678901"/></div>
            <div><label className="fl">Diploma No</label><input className="fi" value={form.diplomaNo} onChange={e=>f('diplomaNo',e.target.value)} placeholder="MED-2020-0000"/></div>
            <div><label className="fl">Mezun Olunan Kurum</label><input className="fi" value={form.mezuniyet} onChange={e=>f('mezuniyet',e.target.value)} placeholder="Hacettepe Üniversitesi"/></div>
            <div>
              <label className="fl">Talep Edilen Süre</label>
              <select className="fi" value={form.sure} onChange={e=>f('sure',e.target.value)}>
                {['1 Ay','3 Ay','6 Ay','1 Yıl','Belirsiz'].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={{padding:'14px 22px',borderTop:'1px solid var(--border)',display:'flex',gap:8,justifyContent:'flex-end',background:'var(--surface)'}}>
          <button className="btn btn-secondary" onClick={onClose}>İptal</button>
          <button className="btn btn-primary" onClick={kaydet} disabled={limitDoldu} style={limitDoldu?{opacity:0.5}:{}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:13,height:13}}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            Davet Gönder
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── RED FORMU MODAL ───────────────────────────────────────────
function RedModal({ hekim, onClose, onRed }) {
  const [neden, setNeden] = useState('');
  const [acik,  setAcik]  = useState('');
  const { showToast } = useUIStore();

  function kaydet() {
    if (!neden) { showToast('Red nedeni seçin'); return; }
    onRed(hekim.id, neden + (acik ? ' — ' + acik : ''));
    onClose();
  }

  return createPortal(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)'}}
      onClick={onClose}>
      <div style={{width:420,background:'var(--card-bg)',borderRadius:16,overflow:'hidden',boxShadow:'0 24px 60px rgba(0,0,0,0.2)'}}
        onClick={e=>e.stopPropagation()}>
        <div style={{padding:'16px 20px',background:'linear-gradient(135deg,#7f1d1d,#DC2626)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{fontSize:14,fontWeight:700,color:'white'}}>❌ Başvuruyu Reddet — {hekim.ad}</div>
          <div onClick={onClose} style={{color:'rgba(255,255,255,0.7)',cursor:'pointer',fontSize:20}}>✕</div>
        </div>
        <div style={{padding:20}}>
          <div style={{fontSize:12,color:'var(--slate-mid)',marginBottom:14,lineHeight:1.6}}>Hekim başvurusu reddedilecek ve bildirim e-postası gönderilecek. Red nedeni hekime iletilir.</div>
          <div className="fg" style={{marginBottom:12}}>
            <label className="fl">Red Nedeni *</label>
            <select className="fi" value={neden} onChange={e=>setNeden(e.target.value)} style={{appearance:'none'}}>
              <option value="">Seçin…</option>
              <option>Eksik belge</option>
              <option>Uzmanlık uyumsuzluğu</option>
              <option>Diploma doğrulanamadı</option>
              <option>Paket kapasitesi dolu</option>
              <option>SGK anlaşması yok</option>
              <option>Diğer</option>
            </select>
          </div>
          <div className="fg">
            <label className="fl">Ek Açıklama</label>
            <textarea className="fi" rows={3} value={acik} onChange={e=>setAcik(e.target.value)} placeholder="Hekime iletilecek detaylı açıklama…" style={{resize:'vertical'}}/>
          </div>
        </div>
        <div style={{padding:'12px 20px',borderTop:'1px solid var(--border)',display:'flex',gap:8,justifyContent:'flex-end',background:'var(--surface)'}}>
          <button className="btn btn-secondary" onClick={onClose}>İptal</button>
          <button className="btn" style={{background:'rgba(220,38,38,0.1)',color:'var(--danger)',border:'1.5px solid rgba(220,38,38,0.3)'}} onClick={kaydet}>Reddet & Bildir</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── ANA COMPONENT ─────────────────────────────────────────────
export default function MisafirHekimYonetim() {
  const { personel } = useDataStore();
  const { showToast } = useUIStore();
  const [hekimler,   setHekimler]   = useState([]);
  const [aktifTab,   setAktifTab]   = useState('bekliyor');
  const [seciliId,   setSeciliId]   = useState(null);
  const [davetOpen,  setDavetOpen]  = useState(false);
  const [redHekim,   setRedHekim]   = useState(null);
  const misafirPaket = MISAFIR_PAKETLER.find(p=>p.id==='starter');

  useEffect(() => {
    fetch(`${BASE}/misafirhekim`, { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => setHekimler(data.map(dbToHekim)))
      .catch(() => {});
  }, []);

  const bekliyor    = hekimler.filter(h=>h.durum==='bekliyor');
  const aktif       = hekimler.filter(h=>h.durum==='aktif');
  const reddedildi  = hekimler.filter(h=>h.durum==='reddedildi');
  const limit       = misafirPaket?.limit || 5;

  const secili = hekimler.find(h=>h.id===seciliId);

  const liste = aktifTab==='tumu' ? hekimler : hekimler.filter(h=>h.durum===aktifTab);

  async function durumGuncelle(id, durum, notlar='') {
    setHekimler(prev => prev.map(h => h.id===id ? {
      ...h, durum,
      ...(notlar ? {notlar} : {}),
      ...(durum==='aktif' ? {onayTarihi:new Date().toISOString().split('T')[0],onaylayan:'Dr. Üst Yönetici',eklenme:new Date().toISOString().split('T')[0]} : {}),
    } : h));
    const dbDurum = durum === 'aktif' ? 'Aktif' : durum === 'reddedildi' ? 'Reddedildi' : 'Bekliyor';
    try {
      await fetch(`${BASE}/misafirhekim/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${tok()}` },
        body: JSON.stringify({ durum: dbDurum, ...(notlar ? { notlar } : {}) }),
      });
    } catch(e) { /* optimistic — fail silently */ }
  }

  function onayla(id) {
    const h = hekimler.find(x=>x.id===id);
    if (aktif.length >= limit && misafirPaket?.id!=='unlimited') {
      showToast(`⚠ Paket limiti doldu (${limit} hekim). Paketinizi yükseltin.`);
      return;
    }
    durumGuncelle(id, 'aktif');
    showToast(`✅ ${h.ad} onaylandı — Giriş bilgileri e-posta ile gönderildi`);
    setSeciliId(id);
  }

  function reddet(id, notlar) {
    const h = hekimler.find(x=>x.id===id);
    durumGuncelle(id, 'reddedildi', notlar);
    showToast(`❌ ${h.ad} başvurusu reddedildi — Bildirim gönderildi`);
    setSeciliId(id);
  }

  function askiyaAl(id) {
    const h = hekimler.find(x=>x.id===id);
    durumGuncelle(id, 'bekliyor');
    showToast(`⏸ ${h.ad} askıya alındı`);
    setSeciliId(id);
  }

  async function kaldir(id) {
    const h = hekimler.find(x=>x.id===id);
    if (!window.confirm(`${h.ad} sistemden kalıcı olarak kaldırılsın mı?`)) return;
    try {
      await fetch(`${BASE}/misafirhekim/${id}`, { method:'DELETE', headers: { Authorization:`Bearer ${tok()}` } });
    } catch(e) { /* fail silently */ }
    setHekimler(prev => prev.filter(x=>x.id!==id));
    setSeciliId(null);
    showToast(`${h.ad} kaldırıldı`);
  }

  function yenidenGonder(id) {
    const h = hekimler.find(x=>x.id===id);
    durumGuncelle(id, 'bekliyor', '');
    showToast(`🔄 ${h.ad} başvurusu tekrar değerlendirmeye alındı`);
    setSeciliId(id);
  }

  const TABS = [
    {id:'bekliyor',   lbl:`⏳ Bekleyen (${bekliyor.length})`},
    {id:'aktif',      lbl:`✅ Aktif (${aktif.length})`},
    {id:'reddedildi', lbl:`❌ Reddedilen (${reddedildi.length})`},
    {id:'tumu',       lbl:`📋 Tümü (${hekimler.length})`},
  ];

  return (
    <div style={{display:'flex',flexDirection:'column',overflow:'auto',padding:'0 2px'}}>

      {/* Başlık */}
      <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',padding:'0 0 16px',flexShrink:0}}>
        <div>
          <div style={{fontSize:22,fontWeight:900,color:'var(--slate)',letterSpacing:'-0.5px',fontFamily:"'Outfit',sans-serif"}}>Misafir Hekim Yönetimi</div>
          <div style={{fontSize:12,color:'var(--slate-light)',marginTop:3}}>{aktif.length}/{limit} aktif slot · {bekliyor.length} başvuru bekliyor</div>
        </div>
        <button className="btn btn-primary" onClick={() => setDavetOpen(true)} style={{fontSize:12,display:'flex',alignItems:'center',gap:6}}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:13,height:13}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Hekim Davet Et
        </button>
      </div>

      {/* Özet kartlar */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:12,flexShrink:0}}>
        {[
          {ic:'⏳',lbl:'Bekleyen Başvuru',val:bekliyor.length,  renk:'#D97706',     bg:'rgba(217,119,6,0.1)',  tab:'bekliyor'},
          {ic:'✅',lbl:'Aktif Hekim',      val:aktif.length,     renk:'var(--success)',bg:'rgba(5,150,105,0.1)',tab:'aktif'},
          {ic:'❌',lbl:'Reddedilen',        val:reddedildi.length,renk:'var(--danger)', bg:'rgba(220,38,38,0.1)', tab:'reddedildi'},
          {ic:'👥',lbl:'Slot Doluluk',      val:`${aktif.length}/${limit}`,renk:'#0284C7',bg:'rgba(2,132,199,0.1)',tab:'aktif'},
        ].map(k=>(
          <div key={k.lbl} onClick={() => setAktifTab(k.tab)}
            style={{background:'var(--card-bg)',border:'1px solid var(--border)',borderRadius:12,padding:'10px 14px',cursor:'pointer',transition:'all 0.15s'}}
            onMouseEnter={e=>e.currentTarget.style.borderColor='var(--teal-mid)'}
            onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:32,height:32,borderRadius:8,background:k.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>{k.ic}</div>
              <div>
                <div style={{fontSize:18,fontWeight:900,color:k.renk,fontFamily:"'Outfit',sans-serif"}}>{k.val}</div>
                <div style={{fontSize:'10px',color:'var(--slate-light)',marginTop:1}}>{k.lbl}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Sekmeler */}
      <div style={{display:'flex',borderBottom:'1px solid var(--border)',flexShrink:0,marginBottom:12}}>
        {TABS.map(t=>(
          <div key={t.id} onClick={() => setAktifTab(t.id)}
            style={{padding:'8px 16px',fontSize:12,fontWeight:600,cursor:'pointer',transition:'all 0.15s',whiteSpace:'nowrap',
              borderBottom:`2px solid ${aktifTab===t.id?'var(--teal)':'transparent'}`,
              color:aktifTab===t.id?'var(--teal)':'var(--slate-light)'}}>
            {t.lbl}
          </div>
        ))}
      </div>

      {/* Ana içerik: liste + detay */}
      <div style={{display:'grid',gridTemplateColumns:'340px 1fr',gap:14,height:720}}>

        {/* Sol: Liste */}
        <div style={{overflowY:'auto',display:'flex',flexDirection:'column',gap:8}}>
          {!liste.length ? (
            <div style={{textAlign:'center',padding:40,color:'var(--slate-light)'}}>
              <div style={{fontSize:36,marginBottom:12}}>📭</div>
              <div style={{fontSize:13,fontWeight:600,color:'var(--slate)'}}>Bu kategoride kayıt yok</div>
            </div>
          ) : liste.map(h => {
            const dc = DURUM_CFG[h.durum] || DURUM_CFG.bekliyor;
            const isSelected = seciliId === h.id;
            return (
              <div key={h.id} onClick={() => setSeciliId(h.id)}
                style={{background:isSelected?'rgba(20,184,166,0.04)':'var(--card-bg)',border:`1.5px solid ${isSelected?'var(--teal-mid)':'var(--border)'}`,borderRadius:13,padding:14,cursor:'pointer',transition:'all 0.15s'}}
                onMouseEnter={e=>{ if(!isSelected) e.currentTarget.style.borderColor='var(--teal-mid)'; }}
                onMouseLeave={e=>{ if(!isSelected) e.currentTarget.style.borderColor='var(--border)'; }}>
                <div style={{display:'flex',alignItems:'center',gap:11,marginBottom:10}}>
                  <div style={{width:42,height:42,borderRadius:'50%',background:'linear-gradient(135deg,#0284C7,#0891b2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,color:'white',flexShrink:0}}>{mkInitials(h.ad)}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:'var(--slate)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{h.ad}</div>
                    <div style={{fontSize:11,color:'var(--slate-light)',marginTop:1}}>{h.uzmanlik}</div>
                  </div>
                  <span style={{fontSize:'9.5px',fontWeight:700,padding:'3px 10px',borderRadius:20,background:dc.bg,color:dc.renk,flexShrink:0}}>{dc.lbl2}</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:'10.5px',color:'var(--slate-light)'}}>
                  <span>📅 Başvuru: {h.basvuruTarihi}</span>
                  <span>📎 {h.belgeler.length} belge</span>
                </div>
                {h.durum==='bekliyor' && (
                  <div style={{display:'flex',gap:6,marginTop:10}}>
                    <button onClick={e=>{e.stopPropagation();onayla(h.id);}} style={{flex:1,padding:6,borderRadius:8,border:'1.5px solid rgba(5,150,105,0.3)',background:'rgba(5,150,105,0.08)',color:'var(--success)',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>✓ Onayla</button>
                    <button onClick={e=>{e.stopPropagation();setRedHekim(h);}} style={{flex:1,padding:6,borderRadius:8,border:'1.5px solid rgba(220,38,38,0.3)',background:'rgba(220,38,38,0.06)',color:'var(--danger)',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>✕ Reddet</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sağ: Detay */}
        <div style={{background:'var(--card-bg)',border:'1.5px solid var(--border)',borderRadius:16,overflow:'hidden',display:'flex',flexDirection:'column'}}>
          {!secili ? (
            <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12,color:'var(--slate-light)'}}>
              <div style={{fontSize:48}}>👨‍⚕️</div>
              <div style={{fontSize:14,fontWeight:700,color:'var(--slate)'}}>Hekim Seçin</div>
              <div style={{fontSize:12}}>Detay ve onay işlemleri için bir başvuru seçin</div>
            </div>
          ) : (() => {
            const h = secili;
            const d = DURUM_CFG[h.durum] || DURUM_CFG.bekliyor;
            return (
              <>
                {/* Header */}
                <div style={{padding:'18px 22px',borderBottom:'1px solid var(--border)',background:'var(--surface)',flexShrink:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:14}}>
                    <div style={{width:52,height:52,borderRadius:'50%',background:'linear-gradient(135deg,#0284C7,#0891b2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:800,color:'white',flexShrink:0}}>{mkInitials(h.ad)}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:16,fontWeight:800,color:'var(--slate)',fontFamily:"'Outfit',sans-serif"}}>{h.ad}</div>
                      <div style={{fontSize:11,color:'var(--slate-light)',marginTop:2}}>{h.uzmanlik} · {h.email}</div>
                    </div>
                    <span style={{fontSize:11,fontWeight:700,padding:'5px 14px',borderRadius:20,background:d.bg,color:d.renk}}>{d.lbl}</span>
                  </div>
                </div>

                {/* Detay içerik */}
                <div style={{flex:1,overflowY:'auto',padding:'18px 22px'}}>

                  {/* Kişisel bilgiler */}
                  <div className="an-section" style={{marginBottom:14}}>
                    <div className="an-section-hd">👤 Kişisel & Mesleki Bilgiler</div>
                    <div className="an-section-body">
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                        {[
                          {lbl:'Ad Soyad',val:h.ad},{lbl:'Uzmanlık',val:h.uzmanlik},
                          {lbl:'E-posta',val:h.email},{lbl:'Telefon',val:h.tel||'—'},
                          {lbl:'T.C. Kimlik No',val:h.tc?h.tc.replace(/(\d{3})\d{5}(\d{3})/,'$1*****$2'):'—'},{lbl:'Diploma No',val:h.diplomaNo||'—'},
                          {lbl:'Mezun Olunan Kurum',val:h.mezuniyet||'—'},{lbl:'Talep Edilen Süre',val:h.sure||'—'},
                        ].map(x=>(
                          <div key={x.lbl} style={{padding:'9px 12px',background:'var(--surface)',borderRadius:9,border:'1px solid var(--border)'}}>
                            <div style={{fontSize:'9.5px',fontWeight:700,color:'var(--slate-light)',textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:3}}>{x.lbl}</div>
                            <div style={{fontSize:'12.5px',fontWeight:600,color:'var(--slate)'}}>{x.val}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Başvuru süreci */}
                  <div className="an-section" style={{marginBottom:14}}>
                    <div className="an-section-hd">📅 Başvuru Süreci</div>
                    <div className="an-section-body">
                      <div style={{position:'relative',paddingLeft:24}}>
                        <div style={{position:'absolute',left:7,width:2,background:'var(--border)',top:0,bottom:0}}/>
                        {[
                          {ic:'📋',lbl:'Başvuru Yapıldı',     tarih:h.basvuruTarihi, renk:'#0284C7',         tamam:true},
                          {ic:'📎',lbl:'Belgeler Yüklendi',   tarih:h.basvuruTarihi, renk:'#7C3AED',         tamam:h.belgeler.length>0},
                          {ic:'👁',lbl:'İnceleme Aşaması',    tarih:h.durum!=='bekliyor'?h.onayTarihi:'—', renk:'#D97706', tamam:h.durum!=='bekliyor'},
                          {ic:h.durum==='aktif'?'✅':'❌',lbl:h.durum==='aktif'?'Onaylandı':h.durum==='reddedildi'?'Reddedildi':'Karar Bekleniyor',tarih:h.onayTarihi||'—',renk:h.durum==='aktif'?'var(--success)':h.durum==='reddedildi'?'var(--danger)':'var(--slate-light)',tamam:h.durum!=='bekliyor'},
                        ].map((adim,i,arr)=>(
                          <div key={i} style={{display:'flex',alignItems:'flex-start',gap:12,marginBottom:i<arr.length-1?16:0}}>
                            <div style={{width:18,height:18,borderRadius:'50%',background:adim.tamam?adim.renk:'var(--border)',flexShrink:0,zIndex:1,position:'relative',marginTop:2}}/>
                            <div>
                              <div style={{fontSize:12,fontWeight:700,color:adim.tamam?'var(--slate)':'var(--slate-light)'}}>{adim.ic} {adim.lbl}</div>
                              <div style={{fontSize:'10.5px',color:'var(--slate-light)',marginTop:1}}>{adim.tarih}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Belgeler */}
                  <div className="an-section" style={{marginBottom:14}}>
                    <div className="an-section-hd" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span>📎 Yüklenen Belgeler</span>
                      <span style={{fontSize:10,fontWeight:700,color:'var(--teal)'}}>{h.belgeler.length} belge</span>
                    </div>
                    <div className="an-section-body" style={{display:'flex',flexDirection:'column',gap:7}}>
                      {h.belgeler.length ? h.belgeler.map(b=>(
                        <div key={b} onClick={()=>showToast(`📥 ${b} indiriliyor…`)}
                          style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:9,background:'var(--surface)',border:'1px solid var(--border)',cursor:'pointer',transition:'all 0.12s'}}
                          onMouseEnter={e=>e.currentTarget.style.borderColor='var(--teal-mid)'}
                          onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
                          <span style={{fontSize:18}}>📑</span>
                          <div style={{flex:1}}>
                            <div style={{fontSize:12,fontWeight:600,color:'var(--slate)'}}>{b}</div>
                            <div style={{fontSize:10,color:'var(--slate-light)'}}>PDF Döküman</div>
                          </div>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        </div>
                      )) : <div style={{textAlign:'center',padding:14,color:'var(--slate-light)',fontSize:12}}>Belge yüklenmemiş</div>}
                      <button onClick={()=>showToast('📎 Belge yükleme özelliği yakında')}
                        style={{display:'flex',alignItems:'center',gap:6,padding:'8px 12px',borderRadius:9,border:'1.5px dashed var(--border)',background:'transparent',color:'var(--slate-light)',fontSize:'11.5px',fontWeight:600,cursor:'pointer',fontFamily:'inherit',transition:'all 0.12s',justifyContent:'center'}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--teal-mid)';e.currentTarget.style.color='var(--teal)';}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--slate-light)';}}>
                        + Belge Ekle
                      </button>
                    </div>
                  </div>

                  {/* Notlar */}
                  <div className="an-section" style={{marginBottom:14}}>
                    <div className="an-section-hd">📝 Notlar</div>
                    <div className="an-section-body">
                      <textarea className="fi" rows={3} defaultValue={h.notlar||''} placeholder="Bu hekim hakkında not ekleyin…" style={{resize:'vertical',fontSize:12}}
                        onBlur={e=>setHekimler(prev=>prev.map(x=>x.id===h.id?{...x,notlar:e.target.value}:x))}/>
                    </div>
                  </div>

                  {h.onaylayan && (
                    <div style={{padding:'10px 14px',borderRadius:10,background:'var(--surface)',border:'1px solid var(--border)',fontSize:11,color:'var(--slate-light)',display:'flex',alignItems:'center',gap:8}}>
                      <span>👤</span> {h.durum==='aktif'?'Onaylayan':'İşlem yapan'}: <strong style={{color:'var(--slate)'}}>{h.onaylayan}</strong> · {h.onayTarihi}
                    </div>
                  )}
                </div>

                {/* Footer aksiyonlar */}
                <div style={{padding:'14px 22px',borderTop:'1px solid var(--border)',display:'flex',gap:8,background:'var(--surface)',flexShrink:0}}>
                  {h.durum==='bekliyor' && <>
                    <button className="btn btn-primary" style={{flex:1,fontSize:13,background:'linear-gradient(135deg,var(--success),#059669)'}} onClick={()=>onayla(h.id)}>✅ Başvuruyu Onayla</button>
                    <button className="btn btn-secondary" style={{flex:1,fontSize:13,color:'var(--danger)',borderColor:'rgba(220,38,38,0.3)'}} onClick={()=>setRedHekim(h)}>❌ Reddet</button>
                  </>}
                  {h.durum==='aktif' && <>
                    <button className="btn btn-secondary" style={{fontSize:12,color:'var(--warning)',borderColor:'rgba(217,119,6,0.3)'}} onClick={()=>askiyaAl(h.id)}>⏸ Askıya Al</button>
                    <button className="btn btn-secondary" style={{fontSize:12,color:'var(--danger)',borderColor:'rgba(220,38,38,0.3)'}} onClick={()=>kaldir(h.id)}>🗑 Kaldır</button>
                    <div style={{flex:1}}/>
                    <button className="btn btn-secondary" style={{fontSize:12}} onClick={()=>showToast('📧 Hekim bildirim e-postası gönderildi')}>📧 E-posta Gönder</button>
                  </>}
                  {h.durum==='reddedildi' && <>
                    <button className="btn btn-secondary" style={{flex:1,fontSize:12}} onClick={()=>yenidenGonder(h.id)}>🔄 Tekrar Değerlendir</button>
                    <button className="btn btn-secondary" style={{fontSize:12,color:'var(--danger)',borderColor:'rgba(220,38,38,0.3)'}} onClick={()=>kaldir(h.id)}>🗑 Kaldır</button>
                  </>}
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Modaller */}
      {davetOpen && <DavetModal onClose={()=>setDavetOpen(false)} onEkle={async h=>{
        try {
          const parts = h.ad.trim().split(' ');
          const soyad = parts.length > 1 ? parts.pop() : '';
          const ad = parts.join(' ');
          const res = await fetch(`${BASE}/misafirhekim`, { method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${tok()}`}, body: JSON.stringify({ ad, soyad, uzmanlik:h.uzmanlik, email:h.email, tel:h.tel, tcNo:h.tc, durum:'Bekliyor' }) });
          const data = await res.json();
          const newH = { ...h, id: data.id || h.id };
          setHekimler(prev=>[...prev,newH]);
          setSeciliId(newH.id);
        } catch(e) {
          setHekimler(prev=>[...prev,h]);
          setSeciliId(h.id);
        }
        setAktifTab('bekliyor');
      }} aktifSayi={aktif.length} limit={limit}/>}
      {redHekim && <RedModal hekim={redHekim} onClose={()=>setRedHekim(null)} onRed={reddet}/>}
    </div>
  );
}
