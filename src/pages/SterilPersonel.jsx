import { useState } from 'react';
import { useDataStore, useUIStore } from '../store';
import Modal from '../components/ui/Modal';

const GOREVLER = ['Sterilizasyon Sorumlusu','Sterilizasyon Teknisyeni','Sterilizasyon Yardımcısı'];

export default function SterilPersonel() {
  const { sterilPersonel, addSterilPersonel, updateSterilPersonel, deleteSterilPersonel } = useDataStore();
  const { showToast } = useUIStore();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ ad:'', sicil:'', gorev:'Sterilizasyon Teknisyeni', tel:'', notlar:'' });
  const f = (k,v) => setForm(p=>({...p,[k]:v}));

  function openModal(p=null) {
    if (p) {
      setForm({ ad:p.ad, sicil:p.sicil, gorev:p.gorev, tel:p.tel, notlar:p.notlar||'' });
      setModal(p);
    } else {
      setForm({ ad:'', sicil:'', gorev:'Sterilizasyon Teknisyeni', tel:'', notlar:'' });
      setModal('yeni');
    }
  }

  function kaydet() {
    if (!form.ad.trim()) { showToast('Ad Soyad zorunlu'); return; }
    const av = form.ad.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
    if (modal === 'yeni') {
      addSterilPersonel({ ...form, av, bg:'#0891b2' });
      showToast('Personel eklendi ✓');
    } else {
      updateSterilPersonel(modal.id, { ...form, av });
      showToast('Personel güncellendi ✓');
    }
    setModal(null);
  }

  function toggleDurum(p) {
    updateSterilPersonel(p.id, { durum: p.durum === 'Aktif' ? 'Pasif' : 'Aktif' });
    showToast(`${p.ad} — ${p.durum === 'Aktif' ? 'Pasif' : 'Aktif'}`);
  }

  return (
    <div>
      <div className="page-hd" style={{ marginBottom:16 }}>
        <div>
          <div className="page-hd-title">Sterilizasyon Personeli</div>
          <div className="page-hd-sub">{sterilPersonel.length} personel kayıtlı</div>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:13,height:13}}>
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Personel Ekle
        </button>
      </div>

      <div className="steril-personel-table">
        <table className="data-table">
          <thead>
            <tr>
              <th>Ad Soyad</th><th>Sicil No</th><th>Görevi</th>
              <th>Telefon</th><th>Durum</th><th>Not</th><th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {sterilPersonel.map(p => (
              <tr key={p.id}>
                <td>
                  <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                    <div className="avatar" style={{ background:p.bg, color:'white', width:30, height:30, fontSize:10, flexShrink:0, opacity:p.durum==='Pasif'?0.5:1 }}>{p.av}</div>
                    <span className="td-name" style={{ opacity:p.durum==='Pasif'?0.6:1 }}>{p.ad}</span>
                  </div>
                </td>
                <td>{p.sicil}</td>
                <td>{p.gorev}</td>
                <td>{p.tel}</td>
                <td><span className={`tag ${p.durum==='Aktif'?'t-green':'t-gray'}`}>{p.durum}</span></td>
                <td style={{ fontSize:'10.5px', color:'var(--slate-light)' }}>{p.notlar||'—'}</td>
                <td>
                  <div style={{ display:'flex', gap:5 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => openModal(p)}>Düzenle</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => toggleDurum(p)}>
                      {p.durum==='Aktif'?'Pasife Al':'Aktif Et'}
                    </button>
                    <button className="btn btn-sm" style={{ background:'#FEF2F2', color:'#DC2626', border:'1px solid #FECACA' }}
                      onClick={() => { deleteSterilPersonel(p.id); showToast('Personel silindi'); }}>Sil</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal==='yeni'?'Sterilizasyon Personeli Ekle':'Personeli Düzenle'} onClose={()=>setModal(null)} width={480}>
          <div className="fg" style={{ marginBottom:12 }}>
            <label className="fl">Ad Soyad *</label>
            <input className="fi" value={form.ad} onChange={e=>f('ad',e.target.value)} placeholder="Meral Doğan" autoFocus/>
          </div>
          <div className="fr" style={{ marginBottom:12 }}>
            <div className="fg"><label className="fl">Sicil No</label><input className="fi" value={form.sicil} onChange={e=>f('sicil',e.target.value)} placeholder="SRL-001"/></div>
            <div className="fg"><label className="fl">Telefon</label><input className="fi" value={form.tel} onChange={e=>f('tel',e.target.value)} placeholder="0532 111 2233"/></div>
          </div>
          <div className="fg" style={{ marginBottom:12 }}>
            <label className="fl">Görevi</label>
            <select className="fi" value={form.gorev} onChange={e=>f('gorev',e.target.value)}>
              {GOREVLER.map(g=><option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="fg" style={{ marginBottom:12 }}>
            <label className="fl">Not</label>
            <input className="fi" value={form.notlar} onChange={e=>f('notlar',e.target.value)} placeholder="Ek notlar…"/>
          </div>
          <div className="mf">
            <button className="btn btn-secondary" onClick={()=>setModal(null)}>İptal</button>
            <button className="btn btn-primary" onClick={kaydet}>{modal==='yeni'?'Ekle':'Güncelle'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
