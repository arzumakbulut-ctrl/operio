import { useState, useEffect } from 'react';
import { useUIStore } from '../store';
import Modal from '../components/ui/Modal';

const BASE = 'http://localhost:4000/api';
const tok = () => localStorage.getItem('operio_access');

function dbToRow(r) {
  return {
    id: r.id,
    ad: r.parcaAd,
    kat: r.kategori || '',
    stok: r.miktar ?? 0,
    kritikStok: r.minMiktar ?? 0,
    birim: r.birim || 'Adet',
    tedarikci: r.tedarikci || '',
    siparisDurum: r.durum || '',
  };
}

export default function ParcaTakip() {
  const { showToast } = useUIStore();
  const [parca, setParca] = useState([]);

  useEffect(() => {
    fetch(`${BASE}/parca`, { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => setParca(data.map(dbToRow)))
      .catch(() => {});
  }, []);
  const [siparisModal, setSiparisModal] = useState(false);
  const [detayModal, setDetayModal]     = useState(null);
  const [siparisForm, setSiparisForm]   = useState({ parca:'', miktar:'', tedarikci:'', aciklama:'' });

  const kritikSayisi = parca.filter(p => p.stok <= p.kritikStok).length;

  function siparisKaydet() {
    if (!siparisForm.parca || !siparisForm.miktar) { showToast('Parça adı ve miktar zorunlu'); return; }
    showToast(`Sipariş verildi: ${siparisForm.parca} × ${siparisForm.miktar} adet ✓`);
    setSiparisModal(false);
    setSiparisForm({ parca:'', miktar:'', tedarikci:'', aciklama:'' });
  }

  return (
    <div>
      <div className="page-hd" style={{ marginBottom:16 }}>
        <div>
          <div className="page-hd-title">Parça & Sarf Malzeme Takibi</div>
          <div className="page-hd-sub">{parca.length} kalem — {kritikSayisi} kritik stok seviyesinde</div>
        </div>
        <button className="btn btn-primary" onClick={() => setSiparisModal(true)}>+ Sipariş Ver</button>
      </div>

      <div className="panel">
        <table className="data-table">
          <thead>
            <tr><th style={{textAlign:'left'}}>Parça Adı</th><th>Kategori</th><th>Mevcut Stok</th><th>Min. Stok</th><th>Birim</th><th>Tedarikçi</th><th>Durum</th><th>İşlem</th></tr>
          </thead>
          <tbody>
            {parca.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign:'center', padding:32, color:'var(--slate-light)' }}>Kayıtlı parça yok</td></tr>
            ) : parca.map(p => {
              const kritik = p.stok <= p.kritikStok;
              return (
                <tr key={p.id}
                  style={{cursor:'pointer'}}
                  onClick={() => setDetayModal(p)}
                  onMouseOver={e=>e.currentTarget.style.background='var(--table-hover)'}
                  onMouseOut={e=>e.currentTarget.style.background=''}>
                  <td style={{fontWeight:700,fontSize:13,color:'var(--slate)'}}>{p.ad}</td>
                  <td style={{fontSize:12,color:'var(--slate-mid)'}}>{p.kat}</td>
                  <td style={{textAlign:'center'}}>
                    <span style={{ fontSize:14, fontWeight:800, color:p.stok===0?'#DC2626':kritik?'#D97706':'var(--slate)' }}>{p.stok}</span>
                  </td>
                  <td style={{textAlign:'center',fontSize:12,color:'var(--slate-light)'}}>{p.kritikStok}</td>
                  <td style={{fontSize:12,color:'var(--slate-mid)'}}>{p.birim}</td>
                  <td style={{fontSize:12,color:'var(--slate-mid)'}}>{p.tedarikci}</td>
                  <td>
                    <span className={`tag ${p.stok===0?'t-red':kritik?'t-orange':'t-green'}`} style={{fontSize:'9.5px'}}>
                      {p.stok===0?'Tükendi':kritik?'Kritik':'Stokta'}
                    </span>
                  </td>
                  <td onClick={e=>e.stopPropagation()}>
                    <div style={{display:'flex',gap:4}}>
                      <button className="btn btn-secondary btn-sm" style={{fontSize:'10.5px'}} onClick={async () => {
                        const yeniStok = p.stok + 5;
                        setParca(prev => prev.map(x => x.id===p.id ? {...x,stok:yeniStok} : x));
                        try {
                          await fetch(`${BASE}/parca/${p.id}`, {
                            method:'PUT',
                            headers:{'Content-Type':'application/json',Authorization:`Bearer ${tok()}`},
                            body: JSON.stringify({ miktar: yeniStok }),
                          });
                          showToast(`${p.ad} stok güncellendi ✓`);
                        } catch { showToast('Stok güncelleme hatası'); }
                      }}>+5 Stok</button>
                      <button className="btn btn-primary btn-sm" style={{fontSize:'10.5px'}} onClick={() => {
                        setSiparisForm(f=>({...f,parca:p.ad,tedarikci:p.tedarikci}));
                        setSiparisModal(true);
                      }}>Sipariş</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Sipariş Modal */}
      {siparisModal && (
        <Modal title="Parça Sipariş Ver" onClose={() => setSiparisModal(false)} width={460}>
          <div style={{background:'rgba(220,38,38,0.04)',border:'1px solid rgba(220,38,38,0.15)',borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:12,color:'#DC2626',display:kritikSayisi>0?'block':'none'}}>
            ⚠ {kritikSayisi} parça kritik stok seviyesinde — acil sipariş gerekebilir
          </div>
          <div className="fg" style={{marginBottom:12}}>
            <label className="fl">Parça Adı *</label>
            <input className="fi" value={siparisForm.parca} onChange={e=>setSiparisForm(p=>({...p,parca:e.target.value}))} placeholder="Parça adı veya kodu…" autoFocus/>
          </div>
          <div className="fr" style={{marginBottom:12}}>
            <div className="fg">
              <label className="fl">Miktar *</label>
              <input className="fi" type="number" min="1" value={siparisForm.miktar} onChange={e=>setSiparisForm(p=>({...p,miktar:e.target.value}))} placeholder="Adet"/>
            </div>
            <div className="fg">
              <label className="fl">Tedarikçi</label>
              <input className="fi" value={siparisForm.tedarikci} onChange={e=>setSiparisForm(p=>({...p,tedarikci:e.target.value}))} placeholder="Tedarikçi firma…"/>
            </div>
          </div>
          <div className="fg" style={{marginBottom:14}}>
            <label className="fl">Açıklama / Not</label>
            <textarea className="fi" rows={2} value={siparisForm.aciklama} onChange={e=>setSiparisForm(p=>({...p,aciklama:e.target.value}))} placeholder="Sipariş notu veya özel talepler…"/>
          </div>
          <div className="mf">
            <button className="btn btn-secondary" onClick={() => setSiparisModal(false)}>İptal</button>
            <button className="btn btn-primary" onClick={siparisKaydet}>Sipariş Ver</button>
          </div>
        </Modal>
      )}

      {/* Parça Detay Modal */}
      {detayModal && (
        <Modal title={detayModal.ad} onClose={() => setDetayModal(null)} width={440}>
          <div style={{background:'var(--surface)',borderRadius:10,padding:'12px 14px',marginBottom:14}}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:44,height:44,borderRadius:12,background:'rgba(20,184,166,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>📦</div>
              <div>
                <div style={{fontSize:14,fontWeight:700,color:'var(--slate)'}}>{detayModal.ad}</div>
                <span className={`tag ${detayModal.stok===0?'t-red':detayModal.stok<=detayModal.kritikStok?'t-orange':'t-green'}`} style={{fontSize:'9.5px',marginTop:4,display:'inline-block'}}>
                  {detayModal.stok===0?'Tükendi':detayModal.stok<=detayModal.kritikStok?'Kritik Stok':'Stokta'}
                </span>
              </div>
            </div>
          </div>
          {[['Kategori',detayModal.kat],['Mevcut Stok',`${detayModal.stok} ${detayModal.birim}`],['Min. Stok',`${detayModal.kritikStok} ${detayModal.birim}`],['Tedarikçi',detayModal.tedarikci],['Sipariş Durumu',detayModal.siparisDurum]].map(([l,v])=>(
            <div key={l} style={{display:'flex',padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
              <span style={{color:'var(--slate-light)',width:130,flexShrink:0}}>{l}</span>
              <span style={{fontWeight:600,color:'var(--slate)'}}>{v||'—'}</span>
            </div>
          ))}
          <div className="mf" style={{marginTop:14}}>
            <button className="btn btn-secondary" onClick={() => setDetayModal(null)}>Kapat</button>
            <button className="btn btn-primary" onClick={() => {
              setSiparisForm(f=>({...f,parca:detayModal.ad,tedarikci:detayModal.tedarikci}));
              setDetayModal(null);
              setSiparisModal(true);
            }}>Sipariş Ver</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
