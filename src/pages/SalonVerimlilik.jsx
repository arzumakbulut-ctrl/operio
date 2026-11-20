import { useDataStore } from '../store';

function sureDk(saat, bitis) {
  if (!saat || !bitis) return 0;
  const [sh, sm] = saat.split(':').map(Number);
  const [bh, bm] = bitis.split(':').map(Number);
  return Math.max(0, (bh * 60 + bm) - (sh * 60 + sm));
}

export default function SalonVerimlilik() {
  const { rooms, surgeries, personel } = useDataStore();

  const salonlar = (rooms || []).map((r, i) => {
    const roomSurgeries = (surgeries || []).filter(s => s.salon === r.ad);
    const gercek  = roomSurgeries.filter(s => s.durum === 'Tamamlandi' || s.st === 'dot-done').length;
    const iptal   = roomSurgeries.filter(s => s.durum === 'İptal').length;
    const planli  = roomSurgeries.length;
    const sureler = roomSurgeries.map(s => sureDk(s.saat, s.bitis)).filter(d => d > 0);
    const ortSure = sureler.length ? Math.round(sureler.reduce((a, v) => a + v, 0) / sureler.length) : 0;
    const doluluk = planli > 0 ? Math.round((gercek / planli) * 100) : 0;
    return { n: r.ad, planli, gercek, iptal, ortSure, doluluk };
  });

  const cerrahlar = (() => {
    const drMap = {};
    (surgeries || []).forEach(s => {
      const dr = s.dr || s.ekip?.cerrah;
      if (!dr) return;
      if (!drMap[dr]) drMap[dr] = { ad: dr, vaka: 0, iptal: 0, sureler: [] };
      drMap[dr].vaka++;
      if (s.durum === 'İptal') drMap[dr].iptal++;
      const dk = sureDk(s.saat, s.bitis);
      if (dk > 0) drMap[dr].sureler.push(dk);
    });
    return Object.values(drMap).map(d => ({
      ...d,
      uzmanlik: (personel || []).find(p => p.ad === d.ad)?.uzmanlik || '',
      ortSure: d.sureler.length ? Math.round(d.sureler.reduce((a, v) => a + v, 0) / d.sureler.length) : 0,
    })).sort((a, b) => b.vaka - a.vaka).slice(0, 10);
  })();

  const toplamVaka   = salonlar.reduce((a, s) => a + s.gercek, 0);
  const toplamIptal  = salonlar.reduce((a, s) => a + s.iptal, 0);
  const toplamPlanli = salonlar.reduce((a, s) => a + s.planli, 0) || 1;
  const ortSure      = salonlar.filter(s => s.ortSure > 0).length
    ? Math.round(salonlar.filter(s => s.ortSure > 0).reduce((a, s) => a + s.ortSure, 0) / salonlar.filter(s => s.ortSure > 0).length)
    : 0;
  const ortDoluluk   = salonlar.length
    ? Math.round(salonlar.reduce((a, s) => a + s.doluluk, 0) / salonlar.length)
    : 0;

  const ay = new Date().toLocaleString('tr-TR', { month: 'long', year: 'numeric' });

  return (
    <div>
      <div className="page-hd">
        <div>
          <div className="page-hd-title">Salon Verimliliği & İstatistikler</div>
          <div className="page-hd-sub">Mevcut verilere göre performans metrikleri · {ay}</div>
        </div>
      </div>

      {/* KPI kartlar */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:18 }}>
        {[
          { ic:'🏥', lbl:'Toplam Vaka',     val: toplamVaka || (surgeries||[]).length,                   renk:'var(--teal)', alt:'Tüm ameliyatlar' },
          { ic:'❌', lbl:'İptal Oranı',      val: '%' + Math.round(toplamIptal / toplamPlanli * 100),    renk:'#DC2626',     alt: toplamIptal + ' iptal' },
          { ic:'⏱',  lbl:'Ort. Vaka Süresi', val: ortSure ? ortSure + ' dk' : '—',                       renk:'#7C3AED',     alt:'Salon ortalaması' },
          { ic:'📊', lbl:'Ort. Doluluk',     val: '%' + ortDoluluk,                                       renk:'#D97706',     alt:'Haftalık ort.' },
        ].map((k, i) => (
          <div key={i} style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:13, padding:16 }}>
            <div style={{ fontSize:24, marginBottom:6 }}>{k.ic}</div>
            <div style={{ fontSize:26, fontWeight:900, color:k.renk, fontFamily:"'Outfit',sans-serif", letterSpacing:'-0.5px' }}>{k.val}</div>
            <div style={{ fontSize:12, fontWeight:600, color:'var(--slate)', marginTop:3 }}>{k.lbl}</div>
            <div style={{ fontSize:10.5, color:'var(--slate-light)', marginTop:2 }}>{k.alt}</div>
          </div>
        ))}
      </div>

      {/* Salon tablosu */}
      <div className="panel" style={{ marginBottom:14 }}>
        <div className="panel-hd"><div className="panel-title">🏥 Salon Bazlı Performans</div></div>
        {salonlar.length === 0 ? (
          <div style={{ padding:32, textAlign:'center', color:'var(--slate-light)' }}>Salon verisi yok</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Salon</th>
                <th style={{ textAlign:'center' }}>Planlanan</th>
                <th style={{ textAlign:'center' }}>Gerçekleşen</th>
                <th style={{ textAlign:'center' }}>İptal</th>
                <th style={{ textAlign:'center' }}>Ort. Süre</th>
                <th>Doluluk</th>
              </tr>
            </thead>
            <tbody>
              {salonlar.map((s, i) => (
                <tr key={i}>
                  <td style={{ fontWeight:700 }}>{s.n}</td>
                  <td style={{ textAlign:'center' }}>{s.planli}</td>
                  <td style={{ textAlign:'center', color:'#059669', fontWeight:700 }}>{s.gercek}</td>
                  <td style={{ textAlign:'center', fontWeight:700, color: s.iptal > 0 ? '#DC2626' : '#059669' }}>{s.iptal}</td>
                  <td style={{ textAlign:'center' }}>{s.ortSure ? s.ortSure + ' dk' : '—'}</td>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ flex:1, height:8, background:'var(--border)', borderRadius:10, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${s.doluluk}%`, borderRadius:10,
                          background: s.doluluk >= 80 ? '#059669' : s.doluluk >= 60 ? '#D97706' : '#DC2626' }}/>
                      </div>
                      <span style={{ fontSize:11, fontWeight:700, minWidth:32 }}>%{s.doluluk}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Cerrah tablosu */}
      <div className="panel" style={{ marginBottom:14 }}>
        <div className="panel-hd"><div className="panel-title">👨‍⚕️ Cerrah Performans İstatistikleri</div></div>
        {cerrahlar.length === 0 ? (
          <div style={{ padding:32, textAlign:'center', color:'var(--slate-light)' }}>Ameliyat verisi yok</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Cerrah</th><th>Uzmanlık</th>
                <th style={{ textAlign:'center' }}>Vaka</th>
                <th style={{ textAlign:'center' }}>İptal</th>
                <th style={{ textAlign:'center' }}>Ort. Süre</th>
              </tr>
            </thead>
            <tbody>
              {cerrahlar.map((cr, i) => {
                const initials = cr.ad.split(' ').filter(w => w).map(w => w[0]).join('');
                return (
                  <tr key={i}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:30, height:30, borderRadius:'50%', background:'var(--teal)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, color:'white', flexShrink:0 }}>{initials}</div>
                        <span style={{ fontWeight:600, fontSize:12.5 }}>{cr.ad}</span>
                      </div>
                    </td>
                    <td style={{ fontSize:11, color:'var(--slate-light)' }}>{cr.uzmanlik}</td>
                    <td style={{ textAlign:'center', fontWeight:700, color:'var(--teal)' }}>{cr.vaka}</td>
                    <td style={{ textAlign:'center', fontWeight:700, color: cr.iptal > 0 ? '#DC2626' : '#059669' }}>{cr.iptal}</td>
                    <td style={{ textAlign:'center' }}>{cr.ortSure ? cr.ortSure + ' dk' : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
