import { useState, useMemo, useEffect } from 'react';


const TIP_CFG = {
  kurum:     { ic:'🏥', renk:'#0284C7' },
  kullanici: { ic:'👤', renk:'#059669' },
  fatura:    { ic:'💳', renk:'#D97706' },
  abonelik:  { ic:'📦', renk:'#7C3AED' },
  destek:    { ic:'🎧', renk:'#0891b2' },
  oturum:    { ic:'🔐', renk:'#94A3B8' },
};

export default function AktiviteLoglari() {
  const token = localStorage.getItem('operio_access');
  const [AKTIVITE_LOGLARI, setAKTIVITE_LOGLARI] = useState([]);
  useEffect(() => {
    fetch('http://localhost:4000/api/logs', {
      headers: { 'Authorization': 'Bearer ' + token }
    }).then(r => r.ok ? r.json() : { items: [] })
      .then(data => setAKTIVITE_LOGLARI((data.items||[]).map(function(l){return{id:l.id,tarih:l.createdAt?new Date(l.createdAt).toLocaleString("tr-TR"):"",kullanici:l.user?l.user.name:"Sistem",islem:l.action||"",detay:l.entity?l.entity+(l.entityId?" #"+l.entityId:""):"",tip:l.entity?l.entity.toLowerCase():"sistem"};})))
      .catch(() => {});
  }, []);
  const [filtre, setFiltre] = useState('tumu');
  const [arama, setArama] = useState('');
  const [kullaniciFiltre, setKullaniciFiltre] = useState('tumu');
  const [baslangic, setBaslangic] = useState('');
  const [bitis, setBitis] = useState('');

  const tipler = [...new Set(AKTIVITE_LOGLARI.map(l => l.tip))];
  const kullanicilar = [...new Set(AKTIVITE_LOGLARI.map(l => l.kullanici))];

  const liste = useMemo(() => {
    return AKTIVITE_LOGLARI.filter(l => {
      if (filtre !== 'tumu' && l.tip !== filtre) return false;
      if (kullaniciFiltre !== 'tumu' && l.kullanici !== kullaniciFiltre) return false;
      if (arama) {
        const q = arama.toLowerCase();
        const eslesir = `${l.islem} ${l.detay} ${l.kullanici}`.toLowerCase().includes(q);
        if (!eslesir) return false;
      }
      // l.tarih formatı: 'YYYY-MM-DD HH:mm'
      const logTarih = l.tarih.split(' ')[0];
      if (baslangic && logTarih < baslangic) return false;
      if (bitis && logTarih > bitis) return false;
      return true;
    });
  }, [filtre, arama, kullaniciFiltre, baslangic, bitis]);

  function filtreleriTemizle() {
    setFiltre('tumu'); setArama(''); setKullaniciFiltre('tumu'); setBaslangic(''); setBitis('');
  }

  const aktifFiltreVar = filtre !== 'tumu' || arama || kullaniciFiltre !== 'tumu' || baslangic || bitis;

  return (
    <div>
      <div className="page-hd" style={{ marginBottom:16 }}>
        <div>
          <div className="page-hd-title">Aktivite Logları</div>
          <div className="page-hd-sub">{liste.length} / {AKTIVITE_LOGLARI.length} kayıt gösteriliyor</div>
        </div>
      </div>

      {/* Filtre çubuğu */}
      <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:12, padding:'12px 14px', marginBottom:14, display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>
        <div style={{ flex:'1 1 200px', minWidth:180 }}>
          <label className="fl">Ara</label>
          <input className="fi" placeholder="İşlem, detay veya kullanıcı…" value={arama} onChange={e=>setArama(e.target.value)}/>
        </div>
        <div style={{ flex:'0 1 200px', minWidth:160 }}>
          <label className="fl">Kullanıcı</label>
          <select className="fi" value={kullaniciFiltre} onChange={e=>setKullaniciFiltre(e.target.value)}>
            <option value="tumu">Tüm kullanıcılar</option>
            {kullanicilar.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div style={{ flex:'0 1 150px' }}>
          <label className="fl">Başlangıç</label>
          <input className="fi" type="date" value={baslangic} onChange={e=>setBaslangic(e.target.value)}/>
        </div>
        <div style={{ flex:'0 1 150px' }}>
          <label className="fl">Bitiş</label>
          <input className="fi" type="date" value={bitis} onChange={e=>setBitis(e.target.value)}/>
        </div>
        {aktifFiltreVar && (
          <button className="btn btn-secondary btn-sm" onClick={filtreleriTemizle}>Filtreleri Temizle</button>
        )}
      </div>

      <div className="dash-tabs" style={{ marginBottom:16 }}>
        <div className={`dash-tab${filtre==='tumu'?' active':''}`} onClick={()=>setFiltre('tumu')}>Tümü</div>
        {tipler.map(t => (
          <div key={t} className={`dash-tab${filtre===t?' active':''}`} onClick={()=>setFiltre(t)}>
            {TIP_CFG[t]?.ic} {t.charAt(0).toUpperCase()+t.slice(1)}
          </div>
        ))}
      </div>

      <div className="panel">
        {liste.length === 0 ? (
          <div style={{ padding:32, textAlign:'center', color:'var(--slate-light)' }}>Filtreyle eşleşen kayıt yok</div>
        ) : liste.map(l => {
          const cfg = TIP_CFG[l.tip] || { ic:'📋', renk:'#94A3B8' };
          return (
            <div key={l.id} style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'13px 18px', borderBottom:'1px solid var(--border)' }}>
              <div style={{ width:34, height:34, borderRadius:9, background:`${cfg.renk}15`, border:`1px solid ${cfg.renk}30`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, flexShrink:0 }}>{cfg.ic}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--slate)' }}>{l.islem}</div>
                <div style={{ fontSize:11.5, color:'var(--slate-mid)', marginTop:2 }}>{l.detay}</div>
                <div style={{ fontSize:10.5, color:'var(--slate-light)', marginTop:4 }}>{l.kullanici} · {l.tarih}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
