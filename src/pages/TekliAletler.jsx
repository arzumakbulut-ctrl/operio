import { useState } from 'react';
import { useDataStore, useUIStore } from '../store';
import Modal from '../components/ui/Modal';

const KATEGORILER = ['Klempler','Makas','Forsepsler','Retraktörler','Disektörler','Aspiratörler','Diğer'];

export default function TekliAletler() {
  const { tekliAletler, durumSetCfg, addTekliAlet, updateTekliAlet, deleteTekliAlet } = useDataStore();
  const { showToast } = useUIStore();
  const [modal, setModal] = useState(null); // null | 'yeni' | alet obj
  const [form, setForm] = useState({ ad:'', raf:'D-1', kat:'Klempler', durum:'Steril — Hazır', doktor:'' });
  const f = (k,v) => setForm(p=>({...p,[k]:v}));

  function openModal(alet=null) {
    if (alet) {
      setForm({ ad:alet.ad, raf:alet.raf, kat:alet.kat, durum:alet.durum, doktor:alet.doktor||'' });
      setModal(alet);
    } else {
      setForm({ ad:'', raf:'D-1', kat:'Klempler', durum:'Steril — Hazır', doktor:'' });
      setModal('yeni');
    }
  }

  function kaydet() {
    if (!form.ad.trim()) { showToast('Alet adı zorunlu'); return; }
    if (modal === 'yeni') {
      addTekliAlet(form);
      showToast('Alet eklendi ✓');
    } else {
      updateTekliAlet(modal.id, form);
      showToast('Alet güncellendi ✓');
    }
    setModal(null);
  }

  return (
    <div>
      <div className="page-hd" style={{ marginBottom:16 }}>
        <div>
          <div className="page-hd-title">Tekli Aletler</div>
          <div className="page-hd-sub">{tekliAletler.length} alet kayıtlı — set dışı cerrahi aletler</div>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:13,height:13}}>
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Alet Ekle
        </button>
      </div>

      <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ textAlign:'left', minWidth:180 }}>Alet Adı</th>
              <th>Kategori</th>
              <th>Raf Konumu</th>
              <th>Durum</th>
              <th>Doktor</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {tekliAletler.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign:'center', padding:32, color:'var(--slate-light)' }}>Kayıtlı alet yok</td></tr>
            ) : tekliAletler.map(a => {
              const dcfg = durumSetCfg[a.durum] || { color:'#94A3B8', tag:'t-gray' };
              return (
                <tr key={a.id} style={{ cursor:'pointer' }}
                  onClick={() => openModal(a)}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--table-hover)'}
                  onMouseOut={e  => e.currentTarget.style.background = ''}
                >
                  <td style={{ fontSize:'12.5px', fontWeight:700, color:'var(--slate)' }}>{a.ad}</td>
                  <td style={{ fontSize:'11.5px', color:'var(--slate-mid)' }}>{a.kat}</td>
                  <td style={{ fontSize:'11.5px', color:'var(--slate-mid)' }}>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:11,height:11}}>
                        <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H8a2 2 0 00-2 2v2h12V5a2 2 0 00-2-2z"/>
                      </svg>
                      {a.raf}
                    </span>
                  </td>
                  <td style={{ fontSize:'11.5px', fontWeight:600, color:dcfg.color }}>{a.durum}</td>
                  <td style={{ fontSize:'11.5px', color:'var(--teal)', fontWeight:600 }}>{a.doktor || '—'}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <button className="btn btn-secondary btn-sm" style={{ fontSize:'10.5px' }} onClick={() => openModal(a)}>Düzenle</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === 'yeni' ? 'Yeni Tekli Alet Ekle' : 'Aleti Düzenle'} onClose={() => setModal(null)} width={440}>
          <div className="fg" style={{ marginBottom:12 }}>
            <label className="fl">Alet Adı *</label>
            <input className="fi" value={form.ad} onChange={e=>f('ad',e.target.value)} placeholder="Koter Penseti…" autoFocus/>
          </div>
          <div className="fr" style={{ marginBottom:12 }}>
            <div className="fg">
              <label className="fl">Kategori</label>
              <select className="fi" value={form.kat} onChange={e=>f('kat',e.target.value)}>
                {KATEGORILER.map(k=><option key={k}>{k}</option>)}
              </select>
            </div>
            <div className="fg">
              <label className="fl">Raf Konumu</label>
              <input className="fi" value={form.raf} onChange={e=>f('raf',e.target.value)} placeholder="D-1"/>
            </div>
          </div>
          <div className="fr" style={{ marginBottom:12 }}>
            <div className="fg">
              <label className="fl">Durum</label>
              <select className="fi" value={form.durum} onChange={e=>f('durum',e.target.value)}>
                {Object.keys(durumSetCfg).map(d=><option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="fg">
              <label className="fl">Doktor (opsiyonel)</label>
              <input className="fi" value={form.doktor} onChange={e=>f('doktor',e.target.value)} placeholder="Dr. Ahmet Yılmaz"/>
            </div>
          </div>
          {modal !== 'yeni' && (
            <div style={{ marginBottom:12 }}>
              <button className="btn btn-sm" style={{ background:'#FEF2F2', color:'#DC2626', border:'1px solid #FECACA' }}
                onClick={() => { deleteTekliAlet(modal.id); showToast('Alet silindi'); setModal(null); }}>
                Aleti Sil
              </button>
            </div>
          )}
          <div className="mf">
            <button className="btn btn-secondary" onClick={() => setModal(null)}>İptal</button>
            <button className="btn btn-primary" onClick={kaydet}>{modal === 'yeni' ? 'Ekle' : 'Güncelle'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
