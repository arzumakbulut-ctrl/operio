import { useState } from 'react';
import { useUIStore } from '../store';
import Modal from '../components/ui/Modal';

const ONCELIK_CFG = { Acil:{tag:'t-red'}, Yüksek:{tag:'t-red'}, Orta:{tag:'t-orange'}, Düşük:{tag:'t-blue'} };

export default function ServisTalepleri() {
  const { arizalar: SERVIS_TALEPLERI } = useDataStore();
  const { showToast } = useUIStore();
  const [talepler, setTalepler] = useState(SERVIS_TALEPLERI);
  const [detayModal, setDetayModal] = useState(null);
  const [yeniTalepModal, setYeniTalepModal] = useState(false);
  const [talepForm, setTalepForm] = useState({ cihaz:'', aciklama:'', oncelik:'Orta' });

  function talepKaydet() {
    if (!talepForm.cihaz || !talepForm.aciklama) { showToast('Cihaz ve açıklama zorunlu'); return; }
    const yeni = { id:'ST'+Date.now(), cihaz:talepForm.cihaz, bildiren:'Teknik Servis', tarih:new Date().toISOString().split('T')[0], aciklama:talepForm.aciklama, oncelik:talepForm.oncelik, durum:'Açık', atanan:'Tek. Burak Yıldız', sure:'—' };
    setTalepler(p => [yeni, ...p]);
    setYeniTalepModal(false);
    setTalepForm({ cihaz:'', aciklama:'', oncelik:'Orta' });
    showToast('Servis talebi oluşturuldu ✓');
  }

  function talepGuncelle(id, durum) {
    setTalepler(p => p.map(t => t.id===id ? {...t,durum} : t));
    showToast(`Talep durumu güncellendi: ${durum}`);
  }

  return (
    <div>
      <div className="page-hd" style={{ marginBottom:16 }}>
        <div>
          <div className="page-hd-title">Açık Servis Talepleri</div>
          <div className="page-hd-sub">{talepler.length} talep kayıtlı</div>
        </div>
        <button className="btn btn-primary" onClick={() => setYeniTalepModal(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:13,height:13}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Yeni Servis Talebi
        </button>
      </div>

      <div className="panel">
        <table className="data-table">
          <thead>
            <tr><th>ID</th><th style={{textAlign:'left'}}>Cihaz</th><th>Bildiren</th><th>Tarih</th><th>Açıklama</th><th>Öncelik</th><th>Atanan</th><th>Durum</th><th>İşlem</th></tr>
          </thead>
          <tbody>
            {talepler.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign:'center', padding:32, color:'var(--slate-light)' }}>Servis talebi yok</td></tr>
            ) : talepler.map(t => (
              <tr key={t.id} style={{cursor:'pointer'}} onClick={() => setDetayModal(t)}
                onMouseOver={e=>e.currentTarget.style.background='var(--table-hover)'}
                onMouseOut={e=>e.currentTarget.style.background=''}>
                <td style={{fontFamily:'monospace',fontSize:11,color:'var(--slate-light)'}}>{t.id}</td>
                <td style={{fontWeight:700,fontSize:13,color:'var(--slate)'}}>{t.cihaz}</td>
                <td style={{fontSize:12,color:'var(--slate-mid)'}}>{t.bildiren}</td>
                <td style={{fontSize:12,color:'var(--slate-mid)'}}>{t.tarih}</td>
                <td style={{fontSize:12,color:'var(--slate-mid)',maxWidth:180}}>{t.aciklama}</td>
                <td><span className={`tag ${ONCELIK_CFG[t.oncelik]?.tag||'t-gray'}`} style={{fontSize:'9.5px'}}>{t.oncelik}</span></td>
                <td style={{fontSize:12,color:'var(--slate-mid)'}}>{t.atanan}</td>
                <td><span className={`tag ${t.durum==='Tamamlandı'?'t-green':t.durum==='İşlemde'?'t-blue':'t-red'}`} style={{fontSize:'9.5px'}}>{t.durum}</span></td>
                <td onClick={e=>e.stopPropagation()}>
                  <div style={{display:'flex',gap:5}}>
                    {t.durum==='Açık' && <button className="btn btn-secondary btn-sm" style={{fontSize:'10.5px'}} onClick={()=>talepGuncelle(t.id,'İşlemde')}>Başlat</button>}
                    {t.durum==='İşlemde' && <button className="btn btn-primary btn-sm" style={{fontSize:'10.5px'}} onClick={()=>talepGuncelle(t.id,'Tamamlandı')}>Tamamla</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detayModal && (
        <Modal title={`${detayModal.id} — ${detayModal.cihaz}`} onClose={() => setDetayModal(null)} width={460}>
          {[['Bildiren',detayModal.bildiren],['Tarih',detayModal.tarih],['Açıklama',detayModal.aciklama],['Öncelik',detayModal.oncelik],['Atanan',detayModal.atanan],['Durum',detayModal.durum],['Tahmini Süre',detayModal.sure]].map(([l,v])=>(
            <div key={l} style={{display:'flex',padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
              <span style={{color:'var(--slate-light)',width:120,flexShrink:0}}>{l}</span>
              <span style={{fontWeight:600,color:'var(--slate)'}}>{v||'—'}</span>
            </div>
          ))}
          <div className="mf" style={{marginTop:14}}>
            <button className="btn btn-secondary" onClick={() => setDetayModal(null)}>Kapat</button>
            {detayModal.durum === 'Açık' && <button className="btn btn-primary" onClick={() => { talepGuncelle(detayModal.id,'İşlemde'); setDetayModal(null); }}>🔧 İşleme Al</button>}
            {detayModal.durum === 'İşlemde' && <button className="btn btn-primary" onClick={() => { talepGuncelle(detayModal.id,'Tamamlandı'); setDetayModal(null); }}>✓ Tamamla</button>}
          </div>
        </Modal>
      )}

      {yeniTalepModal && (
        <Modal title="Yeni Servis Talebi" onClose={() => setYeniTalepModal(false)} width={440}>
          <div className="fg" style={{marginBottom:12}}>
            <label className="fl">Cihaz *</label>
            <input className="fi" value={talepForm.cihaz} onChange={e=>setTalepForm(p=>({...p,cihaz:e.target.value}))} placeholder="Cihaz adı…" autoFocus/>
          </div>
          <div className="fg" style={{marginBottom:12}}>
            <label className="fl">Açıklama *</label>
            <textarea className="fi" rows={3} value={talepForm.aciklama} onChange={e=>setTalepForm(p=>({...p,aciklama:e.target.value}))} placeholder="Sorunun detaylarını girin…"/>
          </div>
          <div className="fg" style={{marginBottom:14}}>
            <label className="fl">Öncelik</label>
            <select className="fi" value={talepForm.oncelik} onChange={e=>setTalepForm(p=>({...p,oncelik:e.target.value}))}>
              <option>Acil</option><option>Yüksek</option><option>Orta</option><option>Düşük</option>
            </select>
          </div>
          <div className="mf">
            <button className="btn btn-secondary" onClick={() => setYeniTalepModal(false)}>İptal</button>
            <button className="btn btn-primary" onClick={talepKaydet}>Oluştur</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
