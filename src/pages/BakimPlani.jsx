import { useState } from 'react';
import { useUIStore } from '../store';
import Modal from '../components/ui/Modal';

export default function BakimPlani() {
  const { cihazlar: CIHAZLAR, bakimPlanlari: BAKIM_PLANLARI } = useDataStore();
  const { showToast } = useUIStore();
  const [bakim, setBakim] = useState([]);
  const bakimVeri = BAKIM_PLANLARI.length > 0 ? BAKIM_PLANLARI : bakim;
  const [planModal, setPlanModal] = useState(false);
  const [detayModal, setDetayModal] = useState(null);
  const [form, setForm] = useState({ cihaz:'', tip:'Periyodik Bakım', tarih:'', sure:'', teknisyen:'' });

  function planKaydet() {
    if (!form.cihaz || !form.tarih) { showToast('Cihaz ve tarih zorunlu'); return; }
    const yeni = { id:`B${String(bakim.length+1).padStart(2,'0')}`, ...form, durum:'Planlandı' };
    setBakim(p => [...p, yeni]);
    showToast('Bakım planı oluşturuldu ✓');
    setPlanModal(false);
    setForm({ cihaz:'', tip:'Periyodik Bakım', tarih:'', sure:'', teknisyen:'' });
  }

  function tamamla(id) {
    setBakim(p => p.map(x => x.id===id ? {...x,durum:'Tamamlandı'} : x));
    showToast('Bakım tamamlandı ✓');
    setDetayModal(null);
  }

  return (
    <div>
      <div className="page-hd" style={{ marginBottom:16 }}>
        <div>
          <div className="page-hd-title">Bakım Planı</div>
          <div className="page-hd-sub">{bakim.length} bakım kaydı — planlanmış ve devam eden bakımlar</div>
        </div>
        <button className="btn btn-primary" onClick={() => setPlanModal(true)}>+ Bakım Planla</button>
      </div>

      <div className="panel">
        <table className="data-table">
          <thead>
            <tr><th style={{textAlign:'left'}}>Cihaz</th><th>Bakım Tipi</th><th>Tarih</th><th>Süre</th><th>Teknisyen</th><th>Durum</th><th>İşlem</th></tr>
          </thead>
          <tbody>
            {bakim.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign:'center', padding:32, color:'var(--slate-light)' }}>Bakım kaydı yok</td></tr>
            ) : bakim.map(b => {
              const dtag = b.durum==='Tamamlandı'?'t-green':b.durum==='Devam Ediyor'?'t-blue':b.durum==='Bekliyor'?'t-orange':'t-gray';
              return (
                <tr key={b.id} style={{cursor:'pointer'}} onClick={() => setDetayModal(b)}
                  onMouseOver={e=>e.currentTarget.style.background='var(--table-hover)'}
                  onMouseOut={e=>e.currentTarget.style.background=''}>
                  <td style={{fontWeight:700,fontSize:13,color:'var(--slate)'}}>{b.cihaz}</td>
                  <td><span className="tag t-teal" style={{fontSize:'9.5px'}}>{b.tip}</span></td>
                  <td style={{fontSize:12,fontWeight:600,color:'var(--teal)'}}>{b.tarih}</td>
                  <td style={{fontSize:12,color:'var(--slate-mid)'}}>{b.sure||'—'}</td>
                  <td style={{fontSize:12,color:'var(--slate-mid)'}}>{b.teknisyen||'—'}</td>
                  <td><span className={`tag ${dtag}`} style={{fontSize:'9.5px'}}>{b.durum}</span></td>
                  <td onClick={e=>e.stopPropagation()}>
                    {b.durum !== 'Tamamlandı' && (
                      <button className="btn btn-primary btn-sm" style={{fontSize:'10.5px'}} onClick={() => tamamla(b.id)}>✓ Tamamlandı</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bakım Planla Modal */}
      {planModal && (
        <Modal title="Yeni Bakım Planı" onClose={() => setPlanModal(false)} width={480}>
          <div style={{background:'linear-gradient(135deg,#7C3AED,#6366F1,#0891b2)',borderRadius:10,padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:10}}>
            <div style={{fontSize:22}}>📅</div>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:'white'}}>Bakım Planı Oluştur</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.75)',marginTop:1}}>Planlanan bakım göreve atanacak ve takvime eklenecektir</div>
            </div>
          </div>
          <div className="fg" style={{marginBottom:12}}>
            <label className="fl">Cihaz *</label>
            <select className="fi" value={form.cihaz} onChange={e=>setForm(p=>({...p,cihaz:e.target.value}))}>
              <option value="">Cihaz seçin</option>
              {CIHAZLAR.map(c=><option key={c.id} value={c.ad}>{c.ad} — {c.lok}</option>)}
            </select>
          </div>
          <div className="fg" style={{marginBottom:12}}>
            <label className="fl">Bakım Tipi</label>
            <select className="fi" value={form.tip} onChange={e=>setForm(p=>({...p,tip:e.target.value}))}>
              <option>Periyodik Bakım</option>
              <option>Korektif Bakım</option>
              <option>Kalibrasyon</option>
              <option>Elektriksel Güvenlik Testi</option>
              <option>Yazılım Güncellemesi</option>
            </select>
          </div>
          <div className="fr" style={{marginBottom:12}}>
            <div className="fg">
              <label className="fl">Tarih *</label>
              <input className="fi" type="date" value={form.tarih} onChange={e=>setForm(p=>({...p,tarih:e.target.value}))}/>
            </div>
            <div className="fg">
              <label className="fl">Tahmini Süre</label>
              <input className="fi" value={form.sure} onChange={e=>setForm(p=>({...p,sure:e.target.value}))} placeholder="örn. 2 saat"/>
            </div>
          </div>
          <div className="fg" style={{marginBottom:14}}>
            <label className="fl">Sorumlu Teknisyen</label>
            <input className="fi" value={form.teknisyen} onChange={e=>setForm(p=>({...p,teknisyen:e.target.value}))} placeholder="Teknisyen adı…"/>
          </div>
          <div className="mf">
            <button className="btn btn-secondary" onClick={() => setPlanModal(false)}>İptal</button>
            <button className="btn btn-primary" onClick={planKaydet}>Planla</button>
          </div>
        </Modal>
      )}

      {/* Detay Modal */}
      {detayModal && (
        <Modal title={`Bakım Detayı — ${detayModal.id}`} onClose={() => setDetayModal(null)} width={440}>
          <div style={{background:'var(--surface)',borderRadius:10,padding:'12px 14px',marginBottom:14}}>
            <div style={{fontSize:14,fontWeight:700,color:'var(--slate)',marginBottom:4}}>{detayModal.cihaz}</div>
            <span className="tag t-teal" style={{fontSize:'9.5px'}}>{detayModal.tip}</span>
          </div>
          {[['Tarih',detayModal.tarih],['Süre',detayModal.sure||'—'],['Teknisyen',detayModal.teknisyen||'—'],['Durum',detayModal.durum]].map(([l,v])=>(
            <div key={l} style={{display:'flex',padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
              <span style={{color:'var(--slate-light)',width:130,flexShrink:0}}>{l}</span>
              <span style={{fontWeight:600,color:'var(--slate)'}}>{v}</span>
            </div>
          ))}
          <div className="mf" style={{marginTop:14}}>
            <button className="btn btn-secondary" onClick={() => setDetayModal(null)}>Kapat</button>
            {detayModal.durum !== 'Tamamlandı' && (
              <button className="btn btn-primary" onClick={() => tamamla(detayModal.id)}>✓ Tamamlandı</button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
