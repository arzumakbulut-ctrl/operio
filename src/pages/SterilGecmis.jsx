import { useState } from 'react';
import { useDataStore } from '../store';

export default function SterilGecmis() {
  const { sterilSetlerV2, sterilAkis, surgeries } = useDataStore();
  const [seciliId, setSeciliId] = useState(null);

  const secili = sterilSetlerV2.find(x => x.id === seciliId);

  // Seçili set için statik sterilizasyon geçmişi
  const sterilGecmis = seciliId ? [
    { tarih:'2026-05-18', islem:'Kirli Teslim Alındı',         cihaz:'OT-2', sure:'60 dk',            personel:'Srl. Meral Doğan',  sonuc:'✓' },
    { tarih:'2026-05-18', islem:'Yıkama Tamamlandı',           cihaz:'YK-1', sure:'45 dk',            personel:'Srl. Kerim Çelik',  sonuc:'✓' },
    { tarih:'2026-05-18', islem:'Sterilizasyon (Otoklav)',     cihaz:'OT-1', sure:'134°C / 18 dk',    personel:'Srl. Meral Doğan',  sonuc:'✓' },
    { tarih:'2026-05-19', islem:'Steril Depo Rafına Alındı',   cihaz:'—',    sure:'—',                personel:'Srl. Kerim Çelik',  sonuc:'✓' },
    { tarih:`2026-05-${String(20 + seciliId % 3).padStart(2,'0')}`, islem:'Vakaya Teslim (QR)', cihaz:'—', sure:'—', personel:'Hem. Ayşe Korkmaz', sonuc:'✓' },
  ] : [];

  const vakalar = seciliId ? surgeries.filter((_,i) => i % 2 === seciliId % 3).map(s => ({
    op: s.op, tarih:`2026-05-${String(20+seciliId%3).padStart(2,'0')}`, salon: s.salon, cerrah: s.ekip?.cerrah||'—',
  })) : [];

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      <div style={{ padding:'0 0 14px', flexShrink:0 }}>
        <div style={{ fontSize:22, fontWeight:900, color:'var(--slate)', letterSpacing:'-0.5px', fontFamily:"'Outfit',sans-serif" }}>Sterilizasyon Takip Geçmişi</div>
        <div style={{ fontSize:12, color:'var(--slate-light)', marginTop:3 }}>Set bazlı izlenebilirlik — hangi set hangi vakada kullanıldı</div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'260px 1fr', gap:14, flex:1, overflow:'hidden' }}>

        {/* Sol: Set listesi */}
        <div style={{ overflowY:'auto', display:'flex', flexDirection:'column', gap:8 }}>
          {sterilSetlerV2.map(set => {
            const isSelected = set.id === seciliId;
            return (
              <div key={set.id} onClick={() => setSeciliId(set.id)}
                style={{ background:isSelected?'rgba(20,184,166,0.04)':'var(--card-bg)', border:`1.5px solid ${isSelected?'var(--teal-mid)':'var(--border)'}`, borderRadius:13, padding:13, cursor:'pointer', transition:'all 0.15s' }}
                onMouseOver={e=>{if(!isSelected) e.currentTarget.style.borderColor='var(--teal-mid)';}}
                onMouseOut={e=>{if(!isSelected) e.currentTarget.style.borderColor='var(--border)';}}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                  <div style={{ width:36, height:36, borderRadius:9, background:`${set.color}18`, border:`1.5px solid ${set.color}44`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={set.color} strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'12.5px', fontWeight:700, color:'var(--slate)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{set.name}</div>
                    <div style={{ fontSize:10, color:'var(--slate-light)', marginTop:1 }}>Raf: {set.raf} · {set.aletler.length} alet</div>
                  </div>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:10, color:'var(--slate-light)' }}>{2 + set.id % 3} kullanım</span>
                  <span style={{ fontSize:'9.5px', fontWeight:700, padding:'2px 9px', borderRadius:20,
                    background: set.durum==='Steril — Hazır'?'rgba(5,150,105,0.1)':'rgba(245,158,11,0.1)',
                    color: set.durum==='Steril — Hazır'?'var(--success)':'var(--warning)' }}>
                    {set.durum}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Sağ: Detay */}
        <div style={{ background:'var(--card-bg)', border:'1.5px solid var(--border)', borderRadius:16, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          {!secili ? (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12, color:'var(--slate-light)' }}>
              <div style={{ fontSize:36 }}>🛡️</div>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--slate)' }}>Set Seçin</div>
            </div>
          ) : (
            <>
              {/* Başlık */}
              <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', background:'var(--surface)', flexShrink:0, display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:40, height:40, borderRadius:10, background:`${secili.color}18`, border:`1.5px solid ${secili.color}44`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={secili.color} strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:800, color:'var(--slate)', fontFamily:"'Outfit',sans-serif" }}>{secili.name}</div>
                  <div style={{ fontSize:'10.5px', color:'var(--slate-light)', marginTop:2 }}>Raf: {secili.raf} · {secili.aletler.length} alet · Son sterilizasyon: 2026-05-18</div>
                </div>
                <span style={{ fontSize:10, fontWeight:700, padding:'4px 12px', borderRadius:20,
                  background: secili.durum==='Steril — Hazır'?'rgba(5,150,105,0.1)':'rgba(245,158,11,0.1)',
                  color: secili.durum==='Steril — Hazır'?'var(--success)':'var(--warning)' }}>
                  {secili.durum}
                </span>
              </div>

              {/* İçerik */}
              <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>

                {/* Set içeriği */}
                <div className="an-section">
                  <div className="an-section-hd">🔧 Set İçeriği ({secili.aletler.length} Alet)</div>
                  <div className="an-section-body" style={{ padding:10 }}>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {secili.aletler.map((a,i) => (
                        <span key={i} style={{ fontSize:11, padding:'4px 11px', borderRadius:20, background:'var(--surface)', border:'1px solid var(--border)', color:'var(--slate-mid)' }}>
                          {a.ad} <strong style={{ color:'var(--teal)' }}>×{a.adet}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sterilizasyon geçmişi */}
                <div className="an-section">
                  <div className="an-section-hd">🔄 Sterilizasyon Süreç Geçmişi</div>
                  <table className="sf-table">
                    <thead>
                      <tr><th>Tarih</th><th>İşlem</th><th>Cihaz</th><th>Süre/Koşul</th><th>Personel</th><th style={{textAlign:'center'}}>✓</th></tr>
                    </thead>
                    <tbody>
                      {sterilGecmis.map((g,i) => (
                        <tr key={i}>
                          <td style={{ fontSize:11, color:'var(--slate-light)' }}>{g.tarih}</td>
                          <td style={{ fontWeight:600, fontSize:12 }}>{g.islem}</td>
                          <td style={{ fontSize:11 }}>{g.cihaz}</td>
                          <td style={{ fontSize:11, color:'var(--slate-mid)' }}>{g.sure}</td>
                          <td style={{ fontSize:11 }}>{g.personel}</td>
                          <td style={{ textAlign:'center', color:'var(--success)', fontWeight:800, fontSize:14 }}>{g.sonuc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Vaka kullanım geçmişi */}
                <div className="an-section">
                  <div className="an-section-hd">🏥 Vaka Kullanım Geçmişi</div>
                  {vakalar.length ? (
                    <table className="sf-table">
                      <thead><tr><th>Tarih</th><th>Ameliyat</th><th>Salon</th><th>Cerrah</th></tr></thead>
                      <tbody>
                        {vakalar.map((v,i) => (
                          <tr key={i}>
                            <td style={{ fontSize:11, color:'var(--slate-light)' }}>{v.tarih}</td>
                            <td style={{ fontWeight:600 }}>{v.op}</td>
                            <td style={{ fontSize:11 }}>{v.salon}</td>
                            <td style={{ fontSize:11 }}>{v.cerrah}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ padding:20, textAlign:'center', color:'var(--slate-light)', fontSize:12 }}>Henüz vaka kaydı yok</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
