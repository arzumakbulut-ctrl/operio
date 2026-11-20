import { useState } from 'react';
import { useAuthStore, useUIStore } from '../../store';
import { ROLES } from '../../data/roles';

const INIT_ONERILERI = [
  {id:1,kullanici:'Srl. Meral Doğan',rol:'Sterilizasyon Sorumlusu',kategori:'İş Akışı',baslik:'Otoklav süre takibi için sesli uyarı',aciklama:'Sterilizasyon süresi dolduğunda sesli bildirim olsa çok işe yarardı.',tarih:'2025-05-10',durum:'hayata_gecti',begeni:12},
  {id:2,kullanici:'Hem. Fatma Şahin',rol:'Başhemşire',kategori:'Raporlar',baslik:'Aylık set kullanım raporu PDF olarak indirilebilsin',aciklama:'Her ay yöneticiye rapor hazırlamak için manuel çalışıyoruz, otomatik PDF çok zaman kazandırır.',tarih:'2025-05-12',durum:'onaylandi',begeni:8},
  {id:3,kullanici:'Srl. Kerim Çelik',rol:'Sterilizasyon Personeli',kategori:'Arayüz',baslik:'Karanlık mod varsayılan olsun',aciklama:'Gece vardiyasında ekran çok parlak kalıyor.',tarih:'2025-05-14',durum:'beklemede',begeni:5},
];

const KATEGORILER = ['İş Akışı','Arayüz','Raporlar','Bildirimler','Güvenlik','Diğer'];
const TURLER = [{ic:'💡',lbl:'Yeni Özellik'},{ic:'🐛',lbl:'Hata Bildirimi'},{ic:'✨',lbl:'İyileştirme'},{ic:'💬',lbl:'Genel Görüş'}];

function av2(ad){ return ad.split(' ').map(w=>w[0]).join('').substring(0,2); }

export default function KatkiModal({ onClose }) {
  const { curRole } = useAuthStore();
  const { showToast } = useUIStore();
  const rol = ROLES[curRole] || ROLES[0];
  const isAdmin = curRole === 0;

  const [aktifTab,  setAktifTab]  = useState('oneri');
  const [onerileri, setOnerileri] = useState(INIT_ONERILERI);
  const [kategori,  setKategori]  = useState('');
  const [tur,       setTur]       = useState('');
  const [baslik,    setBaslik]    = useState('');
  const [aciklama,  setAciklama]  = useState('');

  function switchTab(tab){ setAktifTab(tab); }

  function gonder(){
    if(!baslik.trim()){ showToast('Başlık zorunlu'); return; }
    if(!aciklama.trim()){ showToast('Açıklama zorunlu'); return; }
    setOnerileri(prev=>[...prev,{
      id:Date.now(), kullanici:rol.full, rol:rol.name,
      kategori:kategori||'Genel', tur:tur||'',
      baslik:baslik.trim(), aciklama:aciklama.trim(),
      tarih:new Date().toISOString().split('T')[0],
      durum:'beklemede', begeni:0,
    }]);
    setBaslik(''); setAciklama(''); setKategori(''); setTur('');
    showToast('Öneriniz iletildi — teşekkürler! 🌟');
    switchTab('katkida');
  }

  function durumGuncelle(id, durum){
    if(durum==='reddedildi'){
      setOnerileri(prev=>prev.filter(x=>x.id!==id));
    } else {
      setOnerileri(prev=>prev.map(x=>x.id===id?{...x,durum}:x));
    }
    showToast(durum==='hayata_gecti'?'🚀 Hayata geçti':durum==='onaylandi'?'✓ Onaylandı':'Öneri kaldırıldı');
  }

  const gecenler     = onerileri.filter(o=>o.durum==='hayata_gecti');
  const onaylananlar = onerileri.filter(o=>o.durum==='onaylandi');

  return (
    <div className="modal-bg open" onClick={onClose}>
      <div className="modal" style={{width:620,padding:0,overflow:'hidden',display:'flex',flexDirection:'column',maxHeight:'88vh'}}
        onClick={e=>e.stopPropagation()}>

        {/* ── HEADER ── */}
        <div style={{padding:'18px 22px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:12,background:'var(--surface)',flexShrink:0}}>
          <div style={{width:40,height:40,borderRadius:10,background:'rgba(167,139,250,0.12)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:15,fontWeight:700,color:'var(--slate)',fontFamily:"'Outfit',sans-serif"}}>Geliştirmeye Katkıda Bulun</div>
            <div style={{fontSize:11,color:'var(--slate-light)',marginTop:2}}>Fikirleriniz sistemi şekillendirir</div>
          </div>
          <button className="drawer-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* ── TABS ── */}
        <div style={{display:'flex',gap:0,borderBottom:'1px solid var(--border)',flexShrink:0,background:'var(--surface)'}}>
          {[
            {id:'oneri',   lbl:'💡 Öneri Gönder'},
            {id:'katkida', lbl:'🏆 Katkıda Bulunanlar'},
            ...(isAdmin?[{id:'oneriml',lbl:'⚙ Öneri Yönetimi'}]:[]),
          ].map(t=>(
            <div key={t.id} onClick={()=>switchTab(t.id)}
              style={{padding:'11px 20px',fontSize:12,fontWeight:600,cursor:'pointer',transition:'all 0.15s',
                borderBottom:`2px solid ${aktifTab===t.id?'#A78BFA':'transparent'}`,
                color:aktifTab===t.id?'#A78BFA':'var(--slate-light)'}}>
              {t.lbl}
            </div>
          ))}
        </div>

        {/* ── BODY ── */}
        <div style={{flex:1,overflowY:'auto'}}>

          {/* ── ÖNERİ GÖNDER ── */}
          {aktifTab==='oneri' && (
            <div style={{padding:'20px 22px'}}>
              <div className="modal-section">
                <div className="modal-stitle">Öneri Kategorisi</div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}} >
                  {KATEGORILER.map(k=>(
                    <div key={k} onClick={()=>setKategori(k===kategori?'':k)}
                      style={{padding:'6px 14px',borderRadius:20,border:`1.5px solid ${kategori===k?'#A78BFA':'var(--border)'}`,cursor:'pointer',fontSize:'11.5px',fontWeight:600,color:kategori===k?'#A78BFA':'var(--slate-light)',transition:'all 0.15s',background:kategori===k?'rgba(167,139,250,0.08)':'var(--surface)'}}>
                      {k}
                    </div>
                  ))}
                </div>
              </div>
              <div className="modal-section">
                <div className="modal-stitle">Öneri Türü</div>
                <div style={{display:'flex',gap:8}}>
                  {TURLER.map(t=>(
                    <div key={t.lbl} onClick={()=>setTur(t.lbl===tur?'':t.lbl)}
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
            </div>
          )}

          {/* ── KATKIDA BULUNANLAR ── */}
          {aktifTab==='katkida' && (
            <div style={{padding:'20px 22px'}}>
              {gecenler.length>0 && (
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:10,fontWeight:700,color:'var(--slate-light)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:10}}>🚀 Hayata Geçen Öneriler</div>
                  {gecenler.map(o=>(
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
              {onaylananlar.length>0 && (
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:'var(--slate-light)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:10}}>⏳ Geliştirme Sürecinde</div>
                  {onaylananlar.map(o=>(
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
              {!gecenler.length&&!onaylananlar.length&&(
                <div style={{textAlign:'center',padding:40,color:'var(--slate-light)'}}>
                  <div style={{fontSize:36,marginBottom:12}}>🏆</div>
                  <div style={{fontWeight:600,color:'var(--slate-mid)'}}>Henüz onaylanan öneri yok</div>
                </div>
              )}
            </div>
          )}

          {/* ── ÖNERİ YÖNETİMİ (Admin) ── */}
          {aktifTab==='oneriml' && isAdmin && (
            <div style={{padding:'20px 22px'}}>
              <div style={{fontSize:10,fontWeight:700,color:'var(--slate-light)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:12}}>Tüm Öneriler</div>
              {onerileri.length===0 && <div style={{textAlign:'center',padding:30,color:'var(--slate-light)'}}>Öneri yok</div>}
              {onerileri.map(o=>{
                const dc = o.durum==='hayata_gecti'
                  ?{bg:'rgba(167,139,250,0.12)',color:'#A78BFA',lbl:'Hayata Geçti'}
                  :o.durum==='onaylandi'
                    ?{bg:'rgba(5,150,105,0.1)',color:'var(--success)',lbl:'Onaylandı'}
                    :{bg:'rgba(245,158,11,0.1)',color:'var(--warning)',lbl:'Beklemede'};
                return(
                  <div key={o.id} style={{border:'1px solid var(--border)',borderRadius:10,padding:'14px 16px',marginBottom:8,background:'var(--card-bg)'}}>
                    <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
                      <div style={{flex:1}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                          <span style={{fontSize:12,fontWeight:700,color:'var(--slate)'}}>{o.baslik}</span>
                          <span style={{fontSize:9,padding:'2px 8px',borderRadius:20,fontWeight:700,background:dc.bg,color:dc.color}}>{dc.lbl}</span>
                        </div>
                        <div style={{fontSize:11,color:'var(--slate-mid)',marginBottom:6}}>{o.aciklama}</div>
                        <div style={{fontSize:10,color:'var(--slate-light)'}}>{o.kullanici} · {o.rol} · {o.tarih}</div>
                      </div>
                    </div>
                    {o.durum==='beklemede'&&(
                      <div style={{display:'flex',gap:6,marginTop:10,paddingTop:10,borderTop:'1px solid var(--border)'}}>
                        <button className="btn btn-sm" style={{fontSize:10,background:'rgba(5,150,105,0.1)',color:'var(--success)',border:'1px solid rgba(5,150,105,0.2)'}} onClick={()=>durumGuncelle(o.id,'onaylandi')}>✓ Onayla</button>
                        <button className="btn btn-sm" style={{fontSize:10,background:'rgba(167,139,250,0.1)',color:'#A78BFA',border:'1px solid rgba(167,139,250,0.2)'}} onClick={()=>durumGuncelle(o.id,'hayata_gecti')}>🚀 Hayata Geçti</button>
                        <button className="btn btn-sm" style={{fontSize:10,background:'rgba(220,38,38,0.1)',color:'var(--danger)',border:'1px solid rgba(220,38,38,0.2)'}} onClick={()=>durumGuncelle(o.id,'reddedildi')}>✕ Reddet</button>
                      </div>
                    )}
                    {o.durum==='onaylandi'&&(
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

        {/* ── FOOTER ── */}
        <div style={{padding:'14px 22px',borderTop:'1px solid var(--border)',display:'flex',justifyContent:'flex-end',gap:8,background:'var(--surface)',flexShrink:0}}>
          <button className="btn btn-secondary" onClick={onClose}>Kapat</button>
          {aktifTab==='oneri' && (
            <button className="btn btn-primary" onClick={gonder}
              style={{background:'linear-gradient(135deg,#7C3AED,#A78BFA)',border:'none'}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:13,height:13}}>
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
              Öneriyi Gönder
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
