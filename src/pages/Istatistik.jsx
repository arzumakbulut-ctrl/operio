import { useState, useEffect } from 'react';
import { useAuthStore, useUIStore } from '../store';
import { listSurgeries } from '../services/surgeriesAdapter.js';

export default function Istatistik() {
  const { curRole } = useAuthStore();
  const { showToast } = useUIStore();
  const [stats, setStats] = useState({ total: 0, active: 0, bekliyor: 0, tamamlandi: 0 });
  const [ameliyatlar, setAmeliyatlar] = useState([]);

  useEffect(() => {
    listSurgeries()
      .then(data => {
        setAmeliyatlar(data);
        setStats({
          total: data.length,
          active: data.filter(a => a.durum === 'Devam Ediyor').length,
          bekliyor: data.filter(a => a.durum === 'Bekliyor').length,
          tamamlandi: data.filter(a => a.durum === 'Tamamlandi').length,
        });
      }).catch(() => {});
  }, []);
  const isAne = curRole === 2;
  const [period, setPeriod] = useState('ay');
  const months = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
  const COLORS = ['#14B8A6','#0284C7','#7C3AED','#EA580C','#DC2626','#94A3B8'];

  // Aylık ameliyat sayısı (DB'den)
  const opData = (() => {
    const counts = Array(12).fill(0);
    ameliyatlar.forEach(s => {
      if (s.tarihRaw) counts[new Date(s.tarihRaw).getMonth()]++;
    });
    if (counts.every(v => v === 0)) {
      counts[new Date().getMonth()] = ameliyatlar.length;
    }
    return counts;
  })();
  const maxVal = Math.max(...opData.filter(Boolean), 1);

  // Tür dağılımı (DB'den)
  const dist = (() => {
    if (isAne) return [
      { lbl:'Genel Anestezi', pct:62, color:'#14B8A6' },
      { lbl:'Spinal', pct:18, color:'#0284C7' },
      { lbl:'Epidural', pct:11, color:'#7C3AED' },
      { lbl:'Lokal / Sedasyon', pct:9, color:'#EA580C' },
    ];
    const typeMap = {};
    ameliyatlar.forEach(s => {
      const t = s.op || 'Diğer';
      typeMap[t] = (typeMap[t] || 0) + 1;
    });
    const total = ameliyatlar.length || 1;
    return Object.entries(typeMap)
      .sort((a,b) => b[1]-a[1])
      .slice(0, 6)
      .map(([lbl,cnt],i) => ({ lbl, pct: Math.round(cnt/total*100), color: COLORS[i] }));
  })();

  let cumAngle = 0;
  const conicParts = dist.map(d => {
    const deg = d.pct * 3.6;
    const part = `${d.color} ${cumAngle}deg ${cumAngle+deg}deg`;
    cumAngle += deg;
    return part;
  }).join(', ');

  // Salon kullanım tablosu (DB'den)
  const salonRows = (() => {
    if (isAne) return [
      ['Tek. Mehmet Arslan','22 gün','48 vaka','3.2s ort.','▲ +8%','trend-up'],
      ['Tek. Fatma Çelik',  '20 gün','41 vaka','3.5s ort.','▲ +4%','trend-up'],
    ];
    const salonMap = {};
    const total = ameliyatlar.length || 1;
    ameliyatlar.forEach(s => {
      const ad = s.salon || '—';
      if (!salonMap[ad]) salonMap[ad] = { count:0, types:[] };
      salonMap[ad].count++;
      if (s.op) salonMap[ad].types.push(s.op);
    });
    return Object.entries(salonMap)
      .sort((a,b) => {
        const na = parseInt(a[0].match(/\d+/)?.[0]||'999');
        const nb = parseInt(b[0].match(/\d+/)?.[0]||'999');
        return na - nb;
      })
      .map(([ad,{count,types}]) => {
        const pct = Math.round(count/total*100);
        const brans = types[0] || '—';
        return [ad, `%${pct}`, `${count} ameliyat`, brans, '—', 'trend-eq'];
      });
  })();

  const tableHeaders = isAne
    ? ['Teknisyen','Çalışma Günü','Toplam Vaka','Ort. Süre','Değişim']
    : ['Salon','Kullanım Oranı','Ameliyat Sayısı','Branş','Değişim'];

  const kpilar = isAne ? [
    { ic:'si-teal',   val:'141',  lbl:'Bu Ay Anestezi',          trend:'▲ %11 geçen aya göre', tc:'trend-up' },
    { ic:'si-blue',   val:'3.2s', lbl:'Ortalama Anestezi Süresi', trend:'▲ Verimlilik arttı',  tc:'trend-up' },
    { ic:'si-purple', val:'4',    lbl:'Aktif Teknisyen',          trend:'→ Sabit',              tc:'trend-eq' },
  ] : [
    { ic:'si-teal',   val:stats.total,      lbl:'Toplam Ameliyat',    trend:`${stats.active} aktif`, tc:'trend-up' },
    { ic:'si-blue',   val:stats.bekliyor,   lbl:'Bekleyen Ameliyat',  trend:'Planli',        tc:'trend-eq' },
    { ic:'si-purple', val:stats.tamamlandi, lbl:'Tamamlanan',         trend:'Basarili',      tc:'trend-up' },
  ];

  return (
    <div>
      {/* Başlık */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
        <div>
          <div className="page-hd-title">İstatistikler</div>
          <div className="page-hd-sub">{isAne?'Anestezi operasyonları ve kadro performansı':'Ameliyathane operasyonel istatistikleri'} — Mayıs 2025</div>
        </div>
        <div className="period-sel">
          {[['hafta','Bu Hafta'],['ay','Bu Ay'],['yil','Bu Yıl']].map(([k,l]) => (
            <div key={k} className={`period-opt${period===k?' active':''}`} onClick={() => { setPeriod(k); showToast(`${l} verileri yüklendi`); }}>{l}</div>
          ))}
        </div>
      </div>

      {/* KPI */}
      <div className="kpi-row">
        {kpilar.map((k,i) => (
          <div key={i} className="kpi-card">
            <div className={`kpi-icon ${k.ic}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {i===0 && <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>}
                {i===1 && <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>}
                {i===2 && <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/></>}
              </svg>
            </div>
            <div>
              <div className="kpi-val">{k.val}</div>
              <div className="kpi-lbl">{k.lbl}</div>
              <div className={`kpi-trend ${k.tc}`}>{k.trend}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Grafikler */}
      <div className="istat-full" style={{ marginBottom:16 }}>
        {/* Bar chart */}
        <div className="istat-block">
          <div className="istat-block-title">{isAne?'Aylık Anestezi Trendi':'Aylık Ameliyat Trendi'}<span>2025</span></div>
          <div className="bar-chart">
            {opData.map((v,i) => {
              const h = v ? Math.max(12, Math.round((v/maxVal)*110)) : 6;
              return (
                <div key={i} className="bar-col">
                  <div className="bar-fill" style={{ height:h, background: v===0?'var(--border)':i===4?'var(--teal-mid)':'rgba(20,184,166,0.35)' }}
                    title={v||'—'}/>
                  <span className="bar-lbl">{months[i]}</span>
                </div>
              );
            })}
          </div>
          <div style={{ display:'flex', gap:12, marginTop:10, paddingTop:10, borderTop:'1px solid var(--border)' }}>
            <div style={{ fontSize:11, color:'var(--slate-light)' }}>YTD Toplam: <strong style={{ color:'var(--slate)' }}>{opData.reduce((a,b)=>a+b,0)}</strong></div>
            <div style={{ fontSize:11, color:'var(--slate-light)' }}>Aylık Ort: <strong style={{ color:'var(--slate)' }}>{Math.round(opData.filter(Boolean).reduce((a,b)=>a+b,0)/opData.filter(Boolean).length)}</strong></div>
          </div>
        </div>

        {/* Donut */}
        <div className="istat-block">
          <div className="istat-block-title">{isAne?'Anestezi Tipi Dağılımı':'Branşa Göre Dağılım'}<span>Bu ay</span></div>
          <div className="donut-wrap">
            <div className="donut" style={{ background:`conic-gradient(${conicParts})` }}>
              <div className="donut-center">
                <div className="donut-val">{opData.filter(Boolean).reduce((a,b)=>a+b,0)}</div>
                <div className="donut-sub">toplam</div>
              </div>
            </div>
            <div className="donut-legend">
              {dist.map((d,i) => (
                <div key={i} className="dl-item">
                  <div className="dl-dot" style={{ background:d.color }}/>
                  <span className="dl-name">{d.lbl}</span>
                  <span className="dl-pct">%{d.pct}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Detay tablo */}
      <div className="istat-block">
        <div className="istat-block-title">{isAne?'Teknisyen Performansı':'Salon Kullanım Detayı'}<span>Mayıs 2025</span></div>
        <div style={{ overflowX:'auto' }}>
          <table className="report-table">
            <thead>
              <tr>{tableHeaders.map(h=><th key={h}>{h}</th>)}<th>Durum</th></tr>
            </thead>
            <tbody>
              {salonRows.map((r,i) => (
                <tr key={i}>
                  <td className="rt-name">{r[0]}</td>
                  <td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td>
                  <td><span className={`kpi-trend ${r[5]}`}>{r[4]}</span></td>
                  <td>
                    <span className={`tag ${r[5]==='trend-up'?'t-green':r[5]==='trend-dn'?'t-red':'t-gray'}`} style={{ fontSize:9 }}>
                      {r[5]==='trend-up'?'İyi':r[5]==='trend-dn'?'Dikkat':'Normal'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
