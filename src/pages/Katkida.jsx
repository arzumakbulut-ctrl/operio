import { useState, useEffect } from 'react';
import { useAuthStore, useUIStore } from '../store';
import { ROLES } from '../data/roles';

const BASE = 'http://localhost:4000/api';
const tok = () => localStorage.getItem('operio_access');

function mapOneri(r) {
  return {
    id: r.id,
    kullanici: r.olusturan || 'Bilinmiyor',
    rol: '',
    kategori: r.kategori || '',
    tur: '',
    baslik: r.baslik || '',
    aciklama: r.icerik || '',
    tarih: r.createdAt ? r.createdAt.split('T')[0] : '',
    durum: r.durum || 'beklemede',
    begeni: 0,
  };
}

const KATEGORILER = ['İş Akışı','Arayüz','Raporlar','Bildirimler','Güvenlik','Diğer'];
const TURLER = [{ic:'💡',lbl:'Yeni Özellik'},{ic:'🐛',lbl:'Hata Bildirimi'},{ic:'✨',lbl:'İyileştirme'},{ic:'💬',lbl:'Genel Görüş'}];

const DURUM_CFG = {
  hayata_gecti: {lbl:'Hayata Geçti', bg:'rgba(167,139,250,0.12)', color:'#A78BFA', border:'rgba(167,139,250,0.3)'},
  onaylandi:    {lbl:'Onaylandı',    bg:'rgba(5,150,105,0.1)',    color:'var(--success)', border:'rgba(5,150,105,0.2)'},
  beklemede:    {lbl:'Beklemede',    bg:'rgba(245,158,11,0.1)',   color:'var(--warning)', border:'rgba(245,158,11,0.2)'},
  reddedildi:   {lbl:'Reddedildi',   bg:'rgba(220,38,38,0.1)',    color:'var(--danger)',  border:'rgba(220,38,38,0.2)'},
};

function av2(ad) { return ad.split(' ').map(w=>w[0]).join('').substring(0,2); }

export default function Katkida() {
  const { curRole } = useAuthStore();
  const { showToast } = useUIStore();
  const rol = ROLES[curRole] || ROLES[0];
  const isAdmin = curRole === 0;

  const [aktifTab,  setAktifTab]  = useState('oneri');
  const [onerileri, setOnerileri] = useState([]);
  const [kategori,  setKategori]  = useState('');

  useEffect(() => {
    fetch(`${BASE}/oneri`, { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => setOnerileri(data.map(mapOneri)))
      .catch(() => {});
  }, []);
  const [tur,       setTur]       = useState('');
  const [baslik,    setBaslik]    = useState('');
  const [aciklama,  setAciklama]  = useState('');

  async function gonder() {
    if (!baslik.trim()) { showToast('Başlık zorunlu'); return; }
    if (!aciklama.trim()) { showToast('Açıklama zorunlu'); return; }
    try {
      const res = await fetch(`${BASE}/oneri`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
        body: JSON.stringify({
          baslik: baslik.trim(),
          icerik: aciklama.trim(),
          kategori: kategori || 'Genel',
          durum: 'beklemede',
          olusturan: rol.full,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Hata');
      setOnerileri(prev => [...prev, mapOneri(data)]);
      setBaslik(''); setAciklama(''); setKategori(''); setTur('');
      showToast('Öneriniz iletildi — teşekkürler! 🌟');
      setAktifTab('katkida');
    } catch(e) {
      showToast('Gönderme hatası: ' + e.message);
    }
  }

  async function durumGuncelle(id, durum) {
    try {
      await fetch(`${BASE}/oneri/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
        body: JSON.stringify({ durum }),
      });
    } catch { /* optimistic update devam eder */ }
    if (durum === 'reddedildi') {
      setOnerileri(prev => prev.filter(x => x.id !== id));
    } else {
      setOnerileri(prev => prev.map(x => x.id===id ? {...x,durum} : x));
    }
    showToast(durum==='hayata_gecti'?'🚀 Hayata geçti olarak işaretlendi':durum==='onaylandi'?'✓ Onaylandı':'Öneri kaldırıldı');
  }

  const tabs = [
    {id:'oneri',    lbl:'💡 Öneri Gönder'},
    {id:'katkida',  lbl:'🏆 Katkıda Bulunanlar'},
    ...(isAdmin ? [{id:'oneriml',lbl:'⚙️ Öneri Yönetimi'}] : []),
  ];

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      {/* Başlık */}
      <div style={{padding:'0 0 16px',flexShrink:0}}>
        <div style={{fontSize:22,fontWeight:900,color:'var(--slate)',letterSpacing:'-0.5px',fontFamily:"'Outfit',sans-serif"}}>Katkıda Bulun</div>
        <div style={{fontSize:12,color:'var(--slate-light)',marginTop:3}}>Operio'yu birlikte geliştirelim · Öneri & geri bildirim</div>
      </div>

      {/* Tab bar */}
      <div style={{display:'flex',gap:0,borderBottom:'1px solid var(--border)',marginBottom:0,flexShrink:0}}>
        {tabs.map(t => (
          <div key={t.id} onClick={() => setAktifTab(t.id)}
            style={{padding:'10px 18px',cursor:'pointer',fontSize:13,fontWeight:600,transition:'all 0.15s',borderBottom:`2px solid ${aktifTab===t.id?'#A78BFA':'transparent'}`,color:aktifTab===t.id?'#A78BFA':'var(--slate-light)'}}>
            {t.lbl}
          </div>
        ))}
      </div>

      {/* İçerik */}
      <div style={{flex:1,overflowY:'auto',padding:'20px 0'}}>

        {/* ── ÖNERİ GÖNDER ── */}
        {aktifTab==='oneri' && (
          <div style={{maxWidth:680}}>
            <div className="modal-section">
              <div className="modal-stitle">Öneri Kategorisi</div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {KATEGORILER.map(k => (
                  <div key={k} onClick={() => setKategori(k===kategori?'':k)}
                    style={{padding:'6px 14px',borderRadius:20,border:`1.5px solid ${kategori===k?'#A78BFA':'var(--border)'}`,cursor:'pointer',fontSize:'11.5px',fontWeight:600,color:kategori===k?'#A78BFA':'var(--slate-light)',transition:'all 0.15s',background:kategori===k?'rgba(167,139,250,0.08)':'var(--surface)'}}>
                    {k}
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-section">
              <div className="modal-stitle">Öneri Türü</div>
              <div style={{display:'flex',gap:8}}>
                {TURLER.map(t => (
                  <div key={t.lbl} onClick={() => setTur(t.lbl===tur?'':t.lbl)}
                    style={{flex:1,textAlign:'center',padding:'10px 6px',borderRadius:9,border:`1.5px solid ${tur===t.lbl?'#A78BFA':'var(--border)'}`,cursor:'pointer',fontSize:11,fontWeight:600,color:tur===t.lbl?'#A78BFA':'var(--slate-light)',transition:'all 0.15s',background:tur===t.lbl?'rgba(167,139,250,0.08)':'var(--surface)'}}>
                    <div style={{fontSize:18,marginBottom:4}}>{t.ic}</div>{t.lbl}
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-section">
              <div className="modal-stitle">Başlık</div>
              <input className="fi" value={baslik} onChange={e=>setBaslik(e.target.value)} placeholder="Önerinizi kısaca özetleyin…" maxLength={80}/>
            </div>

            <div className="modal-section">
              <div className="modal-stitle">Detaylı Açıklama</div>
              <textarea className="fi" rows={4} value={aciklama} onChange={e=>setAciklama(e.target.value)} placeholder="Neden bu özelliğe ihtiyaç duyduğunuzu, nasıl çalışmasını istediğinizi açıklayın…"/>
            </div>

            <div className="modal-section" style={{borderBottom:'none',paddingBottom:0,marginBottom:0}}>
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 13px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:9}}>
                <div style={{width:32,height:32,borderRadius:'50%',background:'linear-gradient(135deg,#7C3AED,#A78BFA)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800,color:'white',flexShrink:0}}>{rol.av}</div>
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:'var(--slate)'}}>{rol.full}</div>
                  <div style={{fontSize:'10.5px',color:'var(--slate-light)'}}>{rol.name}</div>
                </div>
                <div style={{marginLeft:'auto',fontSize:10,color:'var(--slate-light)'}}>{new Date().toLocaleDateString('tr-TR')}</div>
              </div>
            </div>

            <div style={{marginTop:16,display:'flex',justifyContent:'flex-end'}}>
              <button className="btn btn-primary" onClick={gonder} style={{background:'linear-gradient(135deg,#7C3AED,#A78BFA)',border:'none'}}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:13,height:13}}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                Öneri Gönder
              </button>
            </div>
          </div>
        )}

        {/* ── KATKIDA BULUNANLAR ── */}
        {aktifTab==='katkida' && (() => {
          const gecenler    = onerileri.filter(o => o.durum==='hayata_gecti');
          const onaylananlar = onerileri.filter(o => o.durum==='onaylandi');
          return (
            <div style={{maxWidth:680}}>
              {gecenler.length > 0 && (
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:10,fontWeight:700,color:'var(--slate-light)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:10}}>🚀 Hayata Geçen Öneriler</div>
                  {gecenler.map(o => (
                    <div key={o.id} style={{border:'1px solid rgba(167,139,250,0.3)',borderRadius:10,padding:'14px 16px',marginBottom:8,background:'rgba(167,139,250,0.04)'}}>
                      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10}}>
                        <div>
                          <div style={{fontSize:13,fontWeight:700,color:'var(--slate)'}}>{o.baslik}</div>
                          <div style={{fontSize:11,color:'var(--slate-mid)',marginTop:4}}>{o.aciklama}</div>
                        </div>
                        <span style={{background:'rgba(167,139,250,0.12)',color:'#A78BFA',border:'1px solid rgba(167,139,250,0.3)',borderRadius:20,padding:'3px 10px',fontSize:'9.5px',fontWeight:700,whiteSpace:'nowrap',flexShrink:0}}>✓ Hayata Geçti</span>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginTop:10,paddingTop:10,borderTop:'1px solid var(--border)'}}>
                        <div style={{width:24,height:24,borderRadius:'50%',background:'linear-gradient(135deg,#7C3AED,#A78BFA)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:800,color:'white'}}>{av2(o.kullanici)}</div>
                        <span style={{fontSize:11,fontWeight:600,color:'var(--slate-mid)'}}>{o.kullanici}</span>
                        <span style={{fontSize:10,color:'var(--slate-light)'}}>{o.rol}</span>
                        <span style={{marginLeft:'auto',fontSize:'10.5px',color:'#A78BFA',fontWeight:700}}>👍 {o.begeni}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {onaylananlar.length > 0 && (
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:'var(--slate-light)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:10}}>⏳ Geliştirme Sürecinde</div>
                  {onaylananlar.map(o => (
                    <div key={o.id} style={{border:'1px solid rgba(5,150,105,0.25)',borderRadius:10,padding:'14px 16px',marginBottom:8,background:'rgba(5,150,105,0.03)'}}>
                      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10}}>
                        <div>
                          <div style={{fontSize:13,fontWeight:700,color:'var(--slate)'}}>{o.baslik}</div>
                          <div style={{fontSize:11,color:'var(--slate-mid)',marginTop:4}}>{o.aciklama}</div>
                        </div>
                        <span style={{background:'rgba(5,150,105,0.1)',color:'var(--success)',border:'1px solid rgba(5,150,105,0.2)',borderRadius:20,padding:'3px 10px',fontSize:'9.5px',fontWeight:700,whiteSpace:'nowrap',flexShrink:0}}>Onaylandı</span>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginTop:10,paddingTop:10,borderTop:'1px solid var(--border)'}}>
                        <div style={{width:24,height:24,borderRadius:'50%',background:'linear-gradient(135deg,#059669,#14B8A6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:800,color:'white'}}>{av2(o.kullanici)}</div>
                        <span style={{fontSize:11,fontWeight:600,color:'var(--slate-mid)'}}>{o.kullanici}</span>
                        <span style={{fontSize:10,color:'var(--slate-light)'}}>{o.rol}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!gecenler.length && !onaylananlar.length && (
                <div style={{textAlign:'center',padding:40,color:'var(--slate-light)'}}>
                  <div style={{fontSize:36,marginBottom:12}}>🏆</div>
                  <div style={{fontWeight:600,color:'var(--slate-mid)'}}>Henüz onaylanan öneri yok</div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── ÖNERİ YÖNETİMİ (Admin) ── */}
        {aktifTab==='oneriml' && isAdmin && (
          <div style={{maxWidth:680}}>
            <div style={{fontSize:10,fontWeight:700,color:'var(--slate-light)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:12}}>Tüm Öneriler</div>
            {onerileri.length === 0 && <div style={{textAlign:'center',padding:30,color:'var(--slate-light)'}}>Öneri yok</div>}
            {onerileri.map(o => {
              const dc = DURUM_CFG[o.durum] || DURUM_CFG.beklemede;
              return (
                <div key={o.id} style={{border:'1px solid var(--border)',borderRadius:10,padding:'14px 16px',marginBottom:8,background:'var(--card-bg)'}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                        <span style={{fontSize:12,fontWeight:700,color:'var(--slate)'}}>{o.baslik}</span>
                        <span style={{fontSize:9,padding:'2px 8px',borderRadius:20,fontWeight:700,background:dc.bg,color:dc.color,border:`1px solid ${dc.border}`}}>{dc.lbl}</span>
                      </div>
                      <div style={{fontSize:11,color:'var(--slate-mid)',marginBottom:6}}>{o.aciklama}</div>
                      <div style={{fontSize:10,color:'var(--slate-light)'}}>{o.kullanici} · {o.rol} · {o.tarih}</div>
                    </div>
                  </div>
                  {o.durum==='beklemede' && (
                    <div style={{display:'flex',gap:6,marginTop:10,paddingTop:10,borderTop:'1px solid var(--border)'}}>
                      <button className="btn btn-sm" style={{fontSize:10,background:'rgba(5,150,105,0.1)',color:'var(--success)',border:'1px solid rgba(5,150,105,0.2)'}} onClick={()=>durumGuncelle(o.id,'onaylandi')}>✓ Onayla</button>
                      <button className="btn btn-sm" style={{fontSize:10,background:'rgba(167,139,250,0.1)',color:'#A78BFA',border:'1px solid rgba(167,139,250,0.2)'}} onClick={()=>durumGuncelle(o.id,'hayata_gecti')}>🚀 Hayata Geçti</button>
                      <button className="btn btn-sm" style={{fontSize:10,background:'rgba(220,38,38,0.1)',color:'var(--danger)',border:'1px solid rgba(220,38,38,0.2)'}} onClick={()=>durumGuncelle(o.id,'reddedildi')}>✕ Reddet</button>
                    </div>
                  )}
                  {o.durum==='onaylandi' && (
                    <div style={{display:'flex',gap:6,marginTop:10,paddingTop:10,borderTop:'1px solid var(--border)'}}>
                      <button className="btn btn-sm" style={{fontSize:10,background:'rgba(167,139,250,0.1)',color:'#A78BFA',border:'1px solid rgba(167,139,250,0.2)'}} onClick={()=>durumGuncelle(o.id,'hayata_gecti')}>🚀 Hayata Geçti İşaretle</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
