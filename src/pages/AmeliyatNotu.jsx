import { useState } from 'react';
import { useDataStore, useUIStore, useAuthStore } from '../store';
import { ROLES } from '../data/roles';

// Doktor/Misafir Hekim için yapılandırılmış ameliyat notu alanları
const ALANLAR = [
  { k:'taniIslem',    lbl:'Tanı ve İşlem',         icon:'🩺', placeholder:'Preoperatif tanı, planlanan ve gerçekleştirilen işlem…' },
  { k:'cerrahiTeknik',lbl:'Cerrahi Teknik',         icon:'🔪', placeholder:'Kullanılan cerrahi yaklaşım, insizyon, teknik adımlar…' },
  { k:'bulgular',     lbl:'Bulgular',               icon:'🔍', placeholder:'İntraoperatif bulgular, anatomik gözlemler…' },
  { k:'yapilanIslem', lbl:'Yapılan İşlem',          icon:'⚙️', placeholder:'Adım adım uygulanan işlem detayları…' },
  { k:'protezBilgisi',lbl:'Protez / İmplant Bilgisi', icon:'🦴', placeholder:'Kullanılan protez/implant — marka, model, seri no, boyut…' },
  { k:'dokuOrnegi',   lbl:'Alınan Doku Örneği',     icon:'🧫', placeholder:'Patolojiye gönderilen örnek tipi, sayısı, lokalizasyonu…' },
  { k:'komplikasyon', lbl:'Komplikasyonlar',        icon:'⚠️', placeholder:'Varsa intraoperatif/postoperatif komplikasyonlar…' },
  { k:'postopNot',    lbl:'Postoperatif Not',       icon:'📋', placeholder:'Hasta durumu, takip planı, özel talimatlar…' },
];

const BOS_NOT = ALANLAR.reduce((acc, a) => ({ ...acc, [a.k]: '' }), {});

export default function AmeliyatNotu() {
  const { surgeries } = useDataStore();
  const { showToast } = useUIStore();
  const { curRole }   = useAuthStore();

  // Sadece bu doktorun ameliyatlarını göster
  const myFullName = ROLES[curRole]?.full || '';
  const benimAmeliyatlar = surgeries.filter(s =>
    s.dr === myFullName || s.ekip?.cerrah === myFullName
  );

  const [seciliId, setSeciliId] = useState(benimAmeliyatlar[0]?.id || null);
  const [notlar, setNotlar]     = useState({});
  const [acikAlan, setAcikAlan] = useState('taniIslem');
  const secili = benimAmeliyatlar.find(s => s.id === seciliId);
  const not = notlar[seciliId] || BOS_NOT;
  const doluAlanSayisi = Object.values(not).filter(v => v.trim()).length;

  function setAlan(k, v) {
    setNotlar(prev => ({ ...prev, [seciliId]: { ...(prev[seciliId] || BOS_NOT), [k]: v } }));
  }

  function kaydet() {
    showToast('Ameliyat notu kaydedildi ✓');
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'260px 1fr', gap:14, height:'calc(100vh - 120px)' }}>
      {/* Sol: Ameliyat listesi */}
      <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:16, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <div style={{ fontSize:13.5, fontWeight:800, color:'var(--slate)', fontFamily:"'Outfit',sans-serif" }}>Ameliyat Notları</div>
          <div style={{ fontSize:11, color:'var(--slate-light)', marginTop:3 }}>Ameliyat seçerek not girin</div>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'8px' }}>
          {benimAmeliyatlar.length === 0 ? (
            <div style={{ padding:24, textAlign:'center', fontSize:12, color:'var(--slate-light)' }}>
              Bugün ameliyatınız bulunmuyor
            </div>
          ) : benimAmeliyatlar.map(s => {
            const sDolu = Object.values(notlar[s.id] || BOS_NOT).filter(v => v.trim()).length;
            return (
              <div key={s.id} onClick={() => { setSeciliId(s.id); setAcikAlan('taniIslem'); }}
                style={{ background: seciliId===s.id?'rgba(20,184,166,0.08)':'transparent', border:`1.5px solid ${seciliId===s.id?'var(--teal)':'var(--border)'}`, borderRadius:12, padding:'12px', cursor:'pointer', marginBottom:6, transition:'all 0.15s' }}>
                <div style={{ fontSize:14, fontWeight:800, color:'var(--slate)', fontFamily:"'Outfit',sans-serif" }}>{s.saat}</div>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--slate)', marginTop:3 }}>{s.op}</div>
                <div style={{ fontSize:10.5, color:'var(--slate-light)', marginTop:2 }}>{s.salon} · {s.dr}</div>
                {sDolu > 0 && <div style={{ fontSize:10, color:'var(--teal)', marginTop:4, fontWeight:600 }}>● {sDolu}/{ALANLAR.length} alan dolu</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sağ: Yapılandırılmış not editörü */}
      {secili ? (
        <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:16, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', background:'var(--surface)', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:14, fontWeight:800, color:'var(--slate)' }}>{secili.op}</div>
              <div style={{ fontSize:11, color:'var(--slate-light)', marginTop:2 }}>{secili.hasta} · {secili.salon} · {secili.dr}</div>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <span style={{ fontSize:11, color:'var(--slate-light)', marginRight:4 }}>{doluAlanSayisi}/{ALANLAR.length} alan dolu</span>
              <button className="btn btn-secondary btn-sm" onClick={() => showToast('Yazdırılıyor…')}>🖨 Yazdır</button>
              <button className="btn btn-primary btn-sm" onClick={kaydet}>💾 Kaydet</button>
            </div>
          </div>

          <div style={{ flex:1, overflowY:'auto', padding:'16px 20px', display:'flex', flexDirection:'column', gap:8 }}>
            {ALANLAR.map(a => {
              const dolu = not[a.k]?.trim().length > 0;
              const acik = acikAlan === a.k;
              return (
                <div key={a.k} style={{ border:`1.5px solid ${acik?'var(--teal)':'var(--border)'}`, borderRadius:12, overflow:'hidden', transition:'border-color 0.15s' }}>
                  <div onClick={() => setAcikAlan(acik ? '' : a.k)}
                    style={{ display:'flex', alignItems:'center', gap:9, padding:'11px 14px', cursor:'pointer', background: acik ? 'rgba(20,184,166,0.05)' : 'var(--surface)' }}>
                    <span style={{ fontSize:15 }}>{a.icon}</span>
                    <span style={{ fontSize:12.5, fontWeight:700, color:'var(--slate)', flex:1 }}>{a.lbl}</span>
                    {dolu && <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--teal)' }}/>}
                    <span style={{ fontSize:11, color:'var(--slate-light)', transform: acik ? 'rotate(180deg)' : 'none', transition:'transform 0.15s' }}>▼</span>
                  </div>
                  {acik && (
                    <textarea
                      value={not[a.k] || ''}
                      onChange={e => setAlan(a.k, e.target.value)}
                      placeholder={a.placeholder}
                      rows={4}
                      style={{ width:'100%', border:'none', borderTop:'1px solid var(--border)', padding:'12px 14px', fontSize:12.5, lineHeight:1.65, color:'var(--slate)', background:'var(--input-bg)', resize:'vertical', outline:'none', fontFamily:"'Inter',sans-serif", boxSizing:'border-box' }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ padding:'10px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:11, color:'var(--slate-light)', flexShrink:0 }}>
            <span>{doluAlanSayisi}/{ALANLAR.length} alan dolduruldu</span>
            <span>Son kayıt: Kaydedilmedi</span>
          </div>
        </div>
      ) : (
        <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12 }}>
          <div style={{ fontSize:40 }}>📝</div>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--slate)' }}>Ameliyat Seçin</div>
        </div>
      )}
    </div>
  );
}
