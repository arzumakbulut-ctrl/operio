import { useState } from 'react';
import { useUIStore } from '../store';
import Modal from '../components/ui/Modal';

const ONCELIK_CFG = { Yüksek:{tag:'t-red'}, Orta:{tag:'t-orange'}, Düşük:{tag:'t-blue'} };

export default function ArizaBildirimleri() {
  const { cihazlar: CIHAZLAR, arizalar: ARIZA_BILDIRIMLERI } = useDataStore();
  const { showToast } = useUIStore();
  const [ariza, setAriza] = useState(ARIZA_BILDIRIMLERI);
  const [yeniArizaModal, setYeniArizaModal] = useState(false);
  const [arizaForm, setArizaForm] = useState({ cihaz:'', aciklama:'', oncelik:'Orta' });

  function arizaKapat(id) {
    setAriza(p => p.map(a => a.id === id ? {...a, durum:'Kapatıldı'} : a));
    showToast('Arıza kaydı kapatıldı ✓');
  }

  function arizaKaydet() {
    if (!arizaForm.cihaz || !arizaForm.aciklama) { showToast('Cihaz ve açıklama zorunlu'); return; }
    const yeni = { id:'A'+Date.now(), cihaz:arizaForm.cihaz, bildiren:'Biyomedikal', tarih:new Date().toISOString().split('T')[0], aciklama:arizaForm.aciklama, oncelik:arizaForm.oncelik, durum:'Açık' };
    setAriza(p => [yeni, ...p]);
    setYeniArizaModal(false);
    setArizaForm({ cihaz:'', aciklama:'', oncelik:'Orta' });
    showToast('Arıza bildirimi oluşturuldu ✓');
  }

  const acikSayisi = ariza.filter(a => a.durum !== 'Kapatıldı').length;

  return (
    <div>
      <div className="page-hd" style={{ marginBottom:16 }}>
        <div>
          <div className="page-hd-title">Arıza Bildirimleri</div>
          <div className="page-hd-sub">{ariza.length} kayıt — {acikSayisi} açık arıza</div>
        </div>
        <button className="btn btn-primary" onClick={() => setYeniArizaModal(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:13,height:13}}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg>
          Arıza Bildir
        </button>
      </div>

      <div className="panel">
        <table className="data-table">
          <thead>
            <tr><th style={{textAlign:'left'}}>Cihaz</th><th>Bildiren</th><th>Tarih</th><th>Açıklama</th><th>Öncelik</th><th>Durum</th><th>İşlem</th></tr>
          </thead>
          <tbody>
            {ariza.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign:'center', padding:32, color:'var(--slate-light)' }}>Arıza kaydı yok</td></tr>
            ) : ariza.map(a => (
              <tr key={a.id}
                onMouseOver={e=>e.currentTarget.style.background='var(--table-hover)'}
                onMouseOut={e=>e.currentTarget.style.background=''}>
                <td style={{fontWeight:700,fontSize:13,color:'var(--slate)'}}>{a.cihaz}</td>
                <td style={{fontSize:12,color:'var(--slate-mid)'}}>{a.bildiren}</td>
                <td style={{fontSize:12,color:'var(--slate-mid)'}}>{a.tarih}</td>
                <td style={{fontSize:12,color:'var(--slate-mid)',maxWidth:200}}>{a.aciklama}</td>
                <td><span className={`tag ${ONCELIK_CFG[a.oncelik]?.tag||'t-gray'}`} style={{fontSize:'9.5px'}}>{a.oncelik}</span></td>
                <td><span className={`tag ${a.durum==='Kapatıldı'?'t-green':a.durum==='İşlemde'?'t-blue':'t-red'}`} style={{fontSize:'9.5px'}}>{a.durum}</span></td>
                <td>
                  {a.durum !== 'Kapatıldı' && (
                    <button className="btn btn-secondary btn-sm" style={{fontSize:'10.5px'}} onClick={() => arizaKapat(a.id)}>Kapat</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {yeniArizaModal && (
        <Modal title="Arıza Bildirimi Oluştur" onClose={() => setYeniArizaModal(false)} width={440}>
          <div className="fg" style={{marginBottom:12}}>
            <label className="fl">Cihaz *</label>
            <select className="fi" value={arizaForm.cihaz} onChange={e=>setArizaForm(p=>({...p,cihaz:e.target.value}))}>
              <option value="">Cihaz seçin</option>
              {CIHAZLAR.map(c=><option key={c.id} value={c.ad}>{c.ad} — {c.lok}</option>)}
            </select>
          </div>
          <div className="fg" style={{marginBottom:12}}>
            <label className="fl">Açıklama *</label>
            <textarea className="fi" rows={3} value={arizaForm.aciklama} onChange={e=>setArizaForm(p=>({...p,aciklama:e.target.value}))} placeholder="Arıza detaylarını girin…"/>
          </div>
          <div className="fg" style={{marginBottom:14}}>
            <label className="fl">Öncelik</label>
            <select className="fi" value={arizaForm.oncelik} onChange={e=>setArizaForm(p=>({...p,oncelik:e.target.value}))}>
              <option>Yüksek</option><option>Orta</option><option>Düşük</option>
            </select>
          </div>
          <div className="mf">
            <button className="btn btn-secondary" onClick={() => setYeniArizaModal(false)}>İptal</button>
            <button className="btn btn-primary" onClick={arizaKaydet}>Bildir</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
