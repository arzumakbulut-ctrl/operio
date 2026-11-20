import { useState, useMemo } from 'react';
import { useUIStore, useDataStore } from '../store';
import Modal from '../components/ui/Modal';

export default function IsEmirleri() {
  const { cihazlar: CIHAZLAR, bakimPlanlari: IS_EMIRLERI, personel } = useDataStore();

  const TEKNISYENLER = useMemo(() =>
    (personel || []).filter(p => p.aktif !== false).map(p => p.ad),
    [personel]
  );
  const { showToast } = useUIStore();
  const [emirler, setEmirler] = useState(IS_EMIRLERI);
  const [notModal, setNotModal]       = useState(null);
  const [detayModal, setDetayModal]   = useState(null);
  const [yeniModal, setYeniModal]     = useState(false);
  const [notText, setNotText]         = useState('');
  const [form, setForm] = useState({ tip:'Korektif Bakım', cihaz:'', teknisyen:'', baslangic:new Date().toISOString().split('T')[0], notlar:'' });

  function notKaydet() {
    if (!notModal) return;
    setEmirler(p => p.map(e => e.id===notModal.id ? {...e,notlar:notText} : e));
    showToast('Not kaydedildi ✓');
    setNotModal(null);
  }

  function yeniKaydet() {
    if (!form.cihaz) { showToast('Cihaz seçimi zorunlu'); return; }
    const yeni = { id:`IE${String(emirler.length+1).padStart(3,'0')}`, ...form, bitis:'—', durum:'Devam Ediyor' };
    setEmirler(p => [...p, yeni]);
    showToast('İş emri oluşturuldu ✓');
    setYeniModal(false);
    setForm({ tip:'Korektif Bakım', cihaz:'', teknisyen:'', baslangic:new Date().toISOString().split('T')[0], notlar:'' });
  }

  function tamamla(id) {
    setEmirler(p=>p.map(x=>x.id===id?{...x,durum:'Tamamlandı',bitis:new Date().toISOString().split('T')[0]}:x));
    showToast('İş emri tamamlandı ✓');
    setDetayModal(null);
  }

  return (
    <div>
      <div className="page-hd" style={{ marginBottom:16 }}>
        <div>
          <div className="page-hd-title">İş Emirleri</div>
          <div className="page-hd-sub">{emirler.length} iş emri — {emirler.filter(e=>e.durum!=='Tamamlandı').length} aktif</div>
        </div>
        <button className="btn btn-primary" onClick={() => setYeniModal(true)}>+ İş Emri Oluştur</button>
      </div>

      <div className="panel">
        <table className="data-table">
          <thead>
            <tr><th>ID</th><th style={{textAlign:'left'}}>Cihaz</th><th>Tip</th><th>Başlangıç</th><th>Bitiş</th><th>Teknisyen</th><th>Durum</th><th>İşlem</th></tr>
          </thead>
          <tbody>
            {emirler.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign:'center', padding:32, color:'var(--slate-light)' }}>İş emri yok</td></tr>
            ) : emirler.map(e => (
              <tr key={e.id} style={{cursor:'pointer'}} onClick={() => setDetayModal(e)}
                onMouseOver={ev=>ev.currentTarget.style.background='var(--table-hover)'}
                onMouseOut={ev=>ev.currentTarget.style.background=''}>
                <td style={{fontFamily:'monospace',fontSize:11,color:'var(--slate-light)'}}>{e.id}</td>
                <td>
                  <div style={{fontWeight:700,fontSize:13,color:'var(--slate)'}}>{e.cihaz}</div>
                  {e.notlar && <div style={{fontSize:10,color:'var(--slate-light)',marginTop:1,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.notlar}</div>}
                </td>
                <td><span className="tag t-purple" style={{fontSize:'9.5px'}}>{e.tip}</span></td>
                <td style={{fontSize:12,color:'var(--slate-mid)'}}>{e.baslangic}</td>
                <td style={{fontSize:12,color:'var(--slate-mid)'}}>{e.bitis}</td>
                <td style={{fontSize:12,color:'var(--slate-mid)'}}>{e.teknisyen}</td>
                <td><span className={`tag ${e.durum==='Tamamlandı'?'t-green':e.durum==='Devam Ediyor'?'t-blue':'t-orange'}`} style={{fontSize:'9.5px'}}>{e.durum}</span></td>
                <td onClick={ev=>ev.stopPropagation()}>
                  <div style={{display:'flex',gap:4}}>
                    <button className="btn btn-secondary btn-sm" style={{fontSize:'10.5px'}} onClick={() => { setNotModal(e); setNotText(e.notlar); }}>✏ Not</button>
                    {e.durum !== 'Tamamlandı' && (
                      <button className="btn btn-primary btn-sm" style={{fontSize:'10.5px'}} onClick={() => tamamla(e.id)}>✓ Tamamla</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Yeni İş Emri Modal */}
      {yeniModal && (
        <Modal title="Yeni İş Emri Oluştur" onClose={() => setYeniModal(false)} width={480}>
          <div style={{background:'linear-gradient(135deg,#7C3AED,#6366F1,#0891b2)',borderRadius:10,padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:10}}>
            <div style={{fontSize:22}}>📋</div>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:'white'}}>İş Emri Detayları</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.75)',marginTop:1}}>Oluşturulan iş emri teknisyene atanacaktır</div>
            </div>
          </div>
          <div className="fg" style={{marginBottom:12}}>
            <label className="fl">Bakım Tipi</label>
            <select className="fi" value={form.tip} onChange={e=>setForm(p=>({...p,tip:e.target.value}))}>
              <option>Korektif Bakım</option>
              <option>Periyodik Bakım</option>
              <option>Kalibrasyon</option>
              <option>Acil Onarım</option>
            </select>
          </div>
          <div className="fg" style={{marginBottom:12}}>
            <label className="fl">Cihaz *</label>
            <select className="fi" value={form.cihaz} onChange={e=>setForm(p=>({...p,cihaz:e.target.value}))}>
              <option value="">Cihaz seçin</option>
              {CIHAZLAR.map(c=><option key={c.id} value={c.ad}>{c.ad} — {c.lok}</option>)}
            </select>
          </div>
          <div className="fr" style={{marginBottom:12}}>
            <div className="fg">
              <label className="fl">Teknisyen</label>
              <select className="fi" value={form.teknisyen} onChange={e=>setForm(p=>({...p,teknisyen:e.target.value}))}>
                <option value="">Seçin</option>
                {TEKNISYENLER.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="fg">
              <label className="fl">Başlangıç Tarihi</label>
              <input className="fi" type="date" value={form.baslangic} onChange={e=>setForm(p=>({...p,baslangic:e.target.value}))}/>
            </div>
          </div>
          <div className="fg" style={{marginBottom:14}}>
            <label className="fl">Notlar</label>
            <textarea className="fi" rows={3} value={form.notlar} onChange={e=>setForm(p=>({...p,notlar:e.target.value}))} placeholder="Yapılacak işlemler, gerekli parçalar veya özel talimatlar…"/>
          </div>
          <div className="mf">
            <button className="btn btn-secondary" onClick={() => setYeniModal(false)}>İptal</button>
            <button className="btn btn-primary" onClick={yeniKaydet}>İş Emri Oluştur</button>
          </div>
        </Modal>
      )}

      {/* Detay Modal */}
      {detayModal && (
        <Modal title={`İş Emri — ${detayModal.id}`} onClose={() => setDetayModal(null)} width={460}>
          <div style={{background:'var(--surface)',borderRadius:10,padding:'12px 14px',marginBottom:14}}>
            <div style={{fontSize:14,fontWeight:700,color:'var(--slate)',marginBottom:4}}>{detayModal.cihaz}</div>
            <div style={{display:'flex',gap:6}}>
              <span className="tag t-purple" style={{fontSize:'9.5px'}}>{detayModal.tip}</span>
              <span className={`tag ${detayModal.durum==='Tamamlandı'?'t-green':'t-blue'}`} style={{fontSize:'9.5px'}}>{detayModal.durum}</span>
            </div>
          </div>
          {[['Teknisyen',detayModal.teknisyen],['Başlangıç',detayModal.baslangic],['Bitiş',detayModal.bitis],['Notlar',detayModal.notlar||'—']].map(([l,v])=>(
            <div key={l} style={{display:'flex',padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
              <span style={{color:'var(--slate-light)',width:120,flexShrink:0}}>{l}</span>
              <span style={{fontWeight:600,color:'var(--slate)',flex:1}}>{v}</span>
            </div>
          ))}
          <div className="mf" style={{marginTop:14}}>
            <button className="btn btn-secondary" onClick={() => setDetayModal(null)}>Kapat</button>
            {detayModal.durum !== 'Tamamlandı' && (
              <button className="btn btn-primary" onClick={() => tamamla(detayModal.id)}>✓ Tamamla</button>
            )}
          </div>
        </Modal>
      )}

      {/* Not Ekle Modal */}
      {notModal && (
        <Modal title={`Not — ${notModal.cihaz}`} onClose={() => setNotModal(null)} width={400}>
          <div className="fg" style={{marginBottom:14}}>
            <label className="fl">İş Emri Notu</label>
            <textarea className="fi" rows={4} value={notText} onChange={e=>setNotText(e.target.value)} placeholder="Not ekleyin…" autoFocus/>
          </div>
          <div className="mf">
            <button className="btn btn-secondary" onClick={() => setNotModal(null)}>İptal</button>
            <button className="btn btn-primary" onClick={notKaydet}>Kaydet</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
