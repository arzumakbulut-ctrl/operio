import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useDataStore } from '../../store';
import { getPatient } from '../../services/patientsAdapter.js';

export default function HastaDrawer({ hasta, onClose }) {
  const { surgeries } = useDataStore();
  const [dbHasta, setDbHasta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('genel');

  useEffect(() => {
    if (!hasta?.id) { setLoading(false); return; }
    getPatient(hasta.id)
      .then(data => { if(data) setDbHasta(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [hasta?.id]);

  const h = dbHasta || hasta || {};
  const ad = h.name || h.ad || '';
  const soyad = h.surname || h.soyad || '';
  const fullAd = (ad + ' ' + soyad).trim();
  const initials = fullAd.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() || '?';
  
  // Bu hastanin ameliyatlari
  const hastaAmeliyatlar = surgeries.filter(s => 
    s.hastaId === h.id || s.hasta === fullAd || s.hasta === ad
  );

  const drawer = (
    <div style={{position:'fixed',inset:0,zIndex:9998,display:'flex'}}>
      <div style={{flex:1,background:'rgba(0,0,0,0.4)'}} onClick={onClose}/>
      <div style={{width:480,background:'var(--card-bg)',height:'100%',overflowY:'auto',boxShadow:'-4px 0 24px rgba(0,0,0,0.15)',display:'flex',flexDirection:'column'}}>
        
        {/* Header */}
        <div style={{padding:'20px 24px',background:'linear-gradient(135deg,#7C3AED,#6366F1,#0891b2)',position:'sticky',top:0,zIndex:1}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:700,color:'rgba(255,255,255,0.8)',textTransform:'uppercase',letterSpacing:'0.5px'}}>Hasta Kartı</div>
            <button onClick={onClose} style={{background:'rgba(255,255,255,0.2)',border:'none',borderRadius:8,width:28,height:28,cursor:'pointer',color:'white',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <div style={{width:52,height:52,borderRadius:'50%',background:'rgba(255,255,255,0.2)',color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:800,border:'2px solid rgba(255,255,255,0.3)'}}>
              {initials}
            </div>
            <div>
              <div style={{fontSize:18,fontWeight:800,color:'white'}}>{fullAd || 'Hasta'}</div>
              <div style={{fontSize:12,color:'rgba(255,255,255,0.7)',marginTop:2}}>
                {h.tc || h.kan || h.bloodType ? [h.tc, (h.kan||h.bloodType)].filter(Boolean).join(' · ') : 'Bilgi yükleniyor...'}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:'flex',gap:2,padding:'8px 16px',borderBottom:'1px solid var(--border)',background:'var(--surface)'}}>
          {[['genel','Genel'],['ameliyatlar','Ameliyatlar'],['saglik','Sağlık']].map(([k,l]) => (
            <button key={k} onClick={()=>setTab(k)} style={{padding:'6px 14px',borderRadius:8,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,background:tab===k?'var(--card-bg)':'transparent',color:tab===k?'var(--teal)':'var(--slate-mid)',transition:'all 0.15s'}}>
              {l}
              {k==='ameliyatlar'&&hastaAmeliyatlar.length>0&&<span style={{marginLeft:4,fontSize:10,padding:'1px 5px',borderRadius:10,background:'var(--teal)',color:'white'}}>{hastaAmeliyatlar.length}</span>}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{flex:1,padding:20}}>
          {loading && <div style={{textAlign:'center',padding:40,color:'var(--slate-light)'}}>Yükleniyor...</div>}
          
          {/* Genel Tab */}
          {!loading && tab==='genel' && (
            <div style={{display:'flex',flexDirection:'column',gap:0}}>
              {[
                ['TC Kimlik', h.tc],
                ['Doğum Tarihi', h.birthDate ? new Date(h.birthDate).toLocaleDateString('tr-TR') : h.dogum],
                ['Cinsiyet', h.gender || h.cinsiyet],
                ['Kan Grubu', h.bloodType || h.kan],
                ['Telefon', h.phone || h.tel],
                ['Adres', h.address || h.adres],
              ].map(([label, value]) => value ? (
                <div key={label} style={{display:'flex',padding:'10px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
                  <span style={{color:'var(--slate-light)',width:120,flexShrink:0,fontWeight:500}}>{label}</span>
                  <span style={{fontWeight:600,color:'var(--slate)'}}>{value}</span>
                </div>
              ) : null)}
              {/* patientsAdapter.getPatient 'alerjiler' alanı için backend'de
                  karşılığı olmadığından sabit 'Yok' döner (bkz. patientsAdapter.js
                  mapPatient yorumu) — bu placeholder'ı gerçek bir alerji uyarısı
                  gibi kırmızı kutuda göstermemek için hariç tutuyoruz. */}
              {((h.alerjiler && h.alerjiler !== 'Yok') || h.allergies) && (
                <div style={{marginTop:12,padding:'12px 14px',background:'rgba(220,38,38,0.06)',border:'1px solid rgba(220,38,38,0.2)',borderRadius:10}}>
                  <div style={{fontSize:11,fontWeight:700,color:'#DC2626',marginBottom:4}}>⚠ ALERJİLER</div>
                  <div style={{fontSize:13,color:'var(--slate)'}}>{h.alerjiler || h.allergies}</div>
                </div>
              )}
              {(h.notlar || h.notes) && (
                <div style={{marginTop:12,padding:'12px 14px',background:'var(--surface)',borderRadius:10}}>
                  <div style={{fontSize:11,fontWeight:700,color:'var(--slate-light)',marginBottom:4}}>NOTLAR</div>
                  <div style={{fontSize:13,color:'var(--slate)',lineHeight:1.6}}>{h.notlar || h.notes}</div>
                </div>
              )}
            </div>
          )}

          {/* Ameliyatlar Tab */}
          {!loading && tab==='ameliyatlar' && (
            <div>
              {hastaAmeliyatlar.length === 0 ? (
                <div style={{textAlign:'center',padding:40,color:'var(--slate-light)'}}>
                  <div style={{fontSize:32,marginBottom:8}}>🏥</div>
                  <div>Kayıtlı ameliyat bulunamadı</div>
                </div>
              ) : hastaAmeliyatlar.map((s,i) => (
                <div key={i} style={{padding:'14px 0',borderBottom:'1px solid var(--border)'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                    <div style={{fontSize:13,fontWeight:700,color:'var(--slate)'}}>{s.op || s.type}</div>
                    <span style={{fontSize:10,padding:'3px 8px',borderRadius:20,background:s.st==='dot-active'?'rgba(5,150,105,0.1)':s.st==='dot-done'?'rgba(148,163,184,0.1)':'rgba(217,119,6,0.1)',color:s.st==='dot-active'?'#059669':s.st==='dot-done'?'#94A3B8':'#D97706',fontWeight:700}}>{s.durum||s.status||'Bekliyor'}</span>
                  </div>
                  <div style={{fontSize:11,color:'var(--slate-light)',display:'flex',gap:12}}>
                    {s.dr && <span>👨‍⚕️ {s.dr}</span>}
                    {s.salon && <span>🏠 {s.salon}</span>}
                    {s.saat && <span>🕐 {s.saat}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Saglik Tab */}
          {!loading && tab==='saglik' && (
            <div>
              <div style={{padding:'12px 14px',background:'var(--surface)',borderRadius:10,marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:700,color:'var(--slate-light)',marginBottom:8}}>KRONİK HASTALIKLAR</div>
                <div style={{fontSize:13,color:'var(--slate)'}}>{h.kronik || 'Kayıt yok'}</div>
              </div>
              <div style={{padding:'12px 14px',background:'var(--surface)',borderRadius:10,marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:700,color:'var(--slate-light)',marginBottom:8}}>KULLANILAН İLAÇLAR</div>
                <div style={{fontSize:13,color:'var(--slate)'}}>{h.ilaclar || 'Kayıt yok'}</div>
              </div>
              <div style={{padding:'12px 14px',background:'var(--surface)',borderRadius:10}}>
                <div style={{fontSize:11,fontWeight:700,color:'var(--slate-light)',marginBottom:8}}>SİGORTA</div>
                <div style={{fontSize:13,color:'var(--slate)'}}>{h.sigortaTip || 'SGK'}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(drawer, document.body);
}
