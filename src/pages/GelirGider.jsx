import { useDataStore } from '../store';

export default function GelirGider() {
  const { gelirGider: GELIR_GIDER } = useDataStore();
  const rawItems = GELIR_GIDER?.items || [];
  const toplamGelir = rawItems.filter(x=>x.type==='gelir').reduce((t,x)=>t+x.amount,0);
  const toplamGider = rawItems.filter(x=>x.type==='gider').reduce((t,x)=>t+x.amount,0);
  const ozet = GELIR_GIDER?.ozet || { aylikGelir:toplamGelir, aylikGider:toplamGider, netKar:toplamGelir-toplamGider, buyumeOrani:12 };
  const aylikGelirTrend = GELIR_GIDER?.aylikGelirTrend || [];
  const giderKategorileri = GELIR_GIDER?.giderKategorileri || [];
  const gelirKaynagi = GELIR_GIDER?.gelirKaynagi || [];
  const maxDeger = Math.max(...aylikGelirTrend.map(a => a.gelir));
//   const toplamGider = giderKategorileri.reduce((t,g) => t+g.tutar, 0);

  return (
    <div>
      <div className="page-hd" style={{ marginBottom:16 }}>
        <div>
          <div className="page-hd-title">Gelir Gider</div>
          <div className="page-hd-sub">Platform geneli finansal özet</div>
        </div>
      </div>

      <div className="stat-row" style={{ marginBottom:16 }}>
        {[
          { val:`₺${(ozet.aylikGelir/1000).toFixed(0)}K`, lbl:'Aylık Gelir', trend:`↑ %${ozet.buyumeOrani} büyüme`, cls:'stat-card-1', si:'si-teal' },
          { val:`₺${(ozet.aylikGider/1000).toFixed(1)}K`, lbl:'Aylık Gider', trend:'Sunucu, personel, pazarlama', cls:'stat-card-4', si:'si-orange' },
          { val:`₺${(ozet.netKar/1000).toFixed(1)}K`, lbl:'Net Kâr', trend:'Bu ay', cls:'stat-card-2', si:'si-blue' },
          { val:`%${Math.round(ozet.netKar/ozet.aylikGelir*100)}`, lbl:'Kâr Marjı', trend:'Gelirin yüzdesi', cls:'stat-card-3', si:'si-purple' },
        ].map((item,i) => (
          <div key={i} className={`stat-card ${item.cls}`}>
            <div className="stat-card-glow"/><div className="stat-card-glow2"/>
            <div className="stat-val">{item.val}</div>
            <div className="stat-lbl">{item.lbl}</div>
            <div className="stat-trend">{item.trend}</div>
          </div>
        ))}
      </div>

      <div className="cg">
        <div className="panel">
          <div className="panel-hd"><span className="panel-title">📈 Gelir / Gider Trendi (Son 6 Ay)</span></div>
          <div style={{ padding:'18px', display:'flex', alignItems:'flex-end', gap:14, height:200 }}>
            {aylikGelirTrend.map((a,i) => (
              <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6, height:'100%', justifyContent:'flex-end' }}>
                <div style={{ display:'flex', gap:3, alignItems:'flex-end', width:'100%', justifyContent:'center', flex:1 }}>
                  <div style={{ width:14, height:`${(a.gelir/maxDeger)*100}%`, background:'var(--teal)', borderRadius:'4px 4px 0 0' }} title={`Gelir: ₺${a.gelir.toLocaleString('tr-TR')}`}/>
                  <div style={{ width:14, height:`${(a.gider/maxDeger)*100}%`, background:'#D97706', borderRadius:'4px 4px 0 0' }} title={`Gider: ₺${a.gider.toLocaleString('tr-TR')}`}/>
                </div>
                <span style={{ fontSize:10, color:'var(--slate-light)', fontWeight:600 }}>{a.ay.slice(0,3)}</span>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:16, justifyContent:'center', paddingBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:5 }}><div style={{width:9,height:9,borderRadius:3,background:'var(--teal)'}}/><span style={{fontSize:11,color:'var(--slate-mid)'}}>Gelir</span></div>
            <div style={{ display:'flex', alignItems:'center', gap:5 }}><div style={{width:9,height:9,borderRadius:3,background:'#D97706'}}/><span style={{fontSize:11,color:'var(--slate-mid)'}}>Gider</span></div>
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="panel">
            <div className="panel-hd"><span className="panel-title">💸 Gider Kategorileri</span></div>
            <div style={{ padding:'14px 18px' }}>
              {giderKategorileri.map(g => {
                const pct = Math.round(g.tutar/toplamGider*100);
                return (
                  <div key={g.kategori} style={{ marginBottom:12 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                      <span style={{ fontSize:12, fontWeight:600, color:'var(--slate)' }}>{g.kategori}</span>
                      <span style={{ fontSize:11.5, color:'var(--slate-mid)', fontWeight:700 }}>₺{g.tutar.toLocaleString('tr-TR')}</span>
                    </div>
                    <div style={{ height:6, background:'var(--border)', borderRadius:4, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:g.renk, borderRadius:4 }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop:16 }}>
        <div className="panel-hd"><span className="panel-title">🏥 Kurum Bazlı Gelir Dağılımı</span></div>
        <table className="data-table">
          <thead><tr><th style={{textAlign:'left'}}>Kurum</th><th>Aylık Ücret</th><th>Pay</th></tr></thead>
          <tbody>
            {gelirKaynagi.map(g => (
              <tr key={g.kurum}>
                <td style={{fontWeight:700,fontSize:13,color:'var(--slate)'}}>{g.kurum}</td>
                <td style={{fontSize:12,fontWeight:700,color:'var(--teal)',textAlign:'center'}}>₺{g.tutar.toLocaleString('tr-TR')}</td>
                <td style={{fontSize:12,color:'var(--slate-mid)',textAlign:'center'}}>%{Math.round(g.tutar/ozet.aylikGelir*100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
