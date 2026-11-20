import { useDataStore } from '../store';

const DURUM_CFG = { Aktif:{tag:'t-green',c:'#059669'}, Arızalı:{tag:'t-red',c:'#DC2626'}, Bakımda:{tag:'t-orange',c:'#D97706'}, Pasif:{tag:'t-gray',c:'#94A3B8'} };

export default function CihazRaporlari() {
  const { cihazlar: CIHAZLAR, bakimPlanlari: BAKIM_PLANLARI, arizalar: ARIZA_BILDIRIMLERI } = useDataStore();
  const aktif   = CIHAZLAR.filter(c => c.durum === 'Aktif').length;
  const arizali = CIHAZLAR.filter(c => c.durum === 'Arızalı').length;
  const bakimda = CIHAZLAR.filter(c => c.durum === 'Bakımda').length;

  const kategoriler = [...new Set(CIHAZLAR.map(c => c.kat))];
  const kategoriDagilim = kategoriler.map(kat => ({
    kat, sayi: CIHAZLAR.filter(c => c.kat === kat).length,
  }));

  const acikAriza = ARIZA_BILDIRIMLERI.filter(a => a.durum !== 'Kapatıldı').length;
  const tamamlananBakim = BAKIM_PLANLARI.filter(b => b.durum === 'Tamamlandı').length;

  return (
    <div>
      <div className="page-hd" style={{ marginBottom:16 }}>
        <div>
          <div className="page-hd-title">Cihaz Raporları</div>
          <div className="page-hd-sub">Cihaz durumu, kategori dağılımı ve bakım özeti</div>
        </div>
      </div>

      <div className="stat-row" style={{ marginBottom:16 }}>
        {[
          { val:CIHAZLAR.length, lbl:'Toplam Cihaz', cls:'stat-card-1', si:'si-teal' },
          { val:aktif,           lbl:'Aktif',         cls:'stat-card-2', si:'si-blue' },
          { val:arizali+bakimda, lbl:'Bakım/Arızalı', cls:'stat-card-4', si:'si-orange' },
          { val:acikAriza,       lbl:'Açık Arıza',     cls:'stat-card-3', si:'si-purple' },
        ].map((item,i) => (
          <div key={i} className={`stat-card ${item.cls}`}>
            <div className="stat-card-glow"/><div className="stat-card-glow2"/>
            <div className="stat-val">{item.val}</div>
            <div className="stat-lbl">{item.lbl}</div>
          </div>
        ))}
      </div>

      <div className="cg">
        <div className="panel">
          <div className="panel-hd"><span className="panel-title">📊 Kategoriye Göre Cihaz Dağılımı</span></div>
          <div style={{ padding:'14px 18px' }}>
            {kategoriDagilim.map(({ kat, sayi }) => {
              const pct = Math.round(sayi / CIHAZLAR.length * 100);
              return (
                <div key={kat} style={{ marginBottom:14 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                    <span style={{ fontSize:12.5, fontWeight:600, color:'var(--slate)' }}>{kat}</span>
                    <span style={{ fontSize:12, color:'var(--slate-mid)', fontWeight:700 }}>{sayi} cihaz ({pct}%)</span>
                  </div>
                  <div style={{ height:6, background:'var(--border)', borderRadius:4, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, background:'var(--teal)', borderRadius:4 }}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <div className="panel-hd"><span className="panel-title">📋 Bakım & Arıza Özeti</span></div>
          <div style={{ padding:'14px 18px', display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontSize:12.5, color:'var(--slate-mid)' }}>Toplam Bakım Planı</span>
              <span style={{ fontSize:13, fontWeight:700, color:'var(--slate)' }}>{BAKIM_PLANLARI.length}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontSize:12.5, color:'var(--slate-mid)' }}>Tamamlanan Bakım</span>
              <span style={{ fontSize:13, fontWeight:700, color:'var(--success)' }}>{tamamlananBakim}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontSize:12.5, color:'var(--slate-mid)' }}>Toplam Arıza Bildirimi</span>
              <span style={{ fontSize:13, fontWeight:700, color:'var(--slate)' }}>{ARIZA_BILDIRIMLERI.length}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0' }}>
              <span style={{ fontSize:12.5, color:'var(--slate-mid)' }}>Açık Arıza</span>
              <span style={{ fontSize:13, fontWeight:700, color:'var(--danger)' }}>{acikAriza}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop:16 }}>
        <div className="panel-hd"><span className="panel-title">🖥 Cihaz Durum Listesi</span></div>
        <table className="data-table">
          <thead>
            <tr><th style={{textAlign:'left'}}>Cihaz</th><th>Kategori</th><th>Konum</th><th>Durum</th></tr>
          </thead>
          <tbody>
            {CIHAZLAR.map(c => {
              const dcfg = DURUM_CFG[c.durum] || DURUM_CFG.Pasif;
              return (
                <tr key={c.id}
                  onMouseOver={e=>e.currentTarget.style.background='var(--table-hover)'}
                  onMouseOut={e=>e.currentTarget.style.background=''}>
                  <td style={{fontWeight:700,fontSize:13,color:'var(--slate)'}}>{c.ad}</td>
                  <td style={{fontSize:12,color:'var(--slate-mid)'}}>{c.kat}</td>
                  <td style={{fontSize:12,color:'var(--slate-mid)'}}>{c.lok}</td>
                  <td><span className={`tag ${dcfg.tag}`} style={{fontSize:'9.5px'}}>{c.durum}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
