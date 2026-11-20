import { useState, useEffect } from 'react';
import { useUIStore, useDataStore } from '../store';
import Modal from '../components/ui/Modal';

const BASE = 'http://localhost:4000/api';
function tok() { return localStorage.getItem('operio_access'); }

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / 86400000);
}

export default function KalibrasyonKayitlari() {
  const { cihazlar: CIHAZLAR } = useDataStore();
  const { showToast } = useUIStore();
  const [ekleModal, setEkleModal]   = useState(false);
  const [detayModal, setDetayModal] = useState(null);
  const [form, setForm] = useState({ cihaz:'', sonKalibrasyon:'', sonrakiKalibrasyon:'', kurum:'', sertifikano:'', not:'' });
  const [kayitlar, setKayitlar]     = useState([]);

  useEffect(() => {
    fetch(`${BASE}/kalibrasyon`, { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setKayitlar(data.map(k => ({
          id: k.id,
          cihaz: k.cihaz?.name || '',
          cihazId: k.cihazId,
          sonKalibrasyon: k.tarih ? new Date(k.tarih).toLocaleDateString('tr-TR') : '',
          sonrakiKalibrasyon: k.sonrakiTarih ? new Date(k.sonrakiTarih).toLocaleDateString('tr-TR') : '',
          kurum: k.yapan || '',
          sertifikano: k.sertifikaNo || '',
          not: k.notlar || '',
        })));
      })
      .catch(() => {});
  }, []);

  async function ekleKaydet() {
    if (!form.cihaz || !form.sonKalibrasyon) { showToast('Cihaz ve kalibrasyon tarihi zorunlu'); return; }
    const cihazObj = CIHAZLAR.find(c => c.ad === form.cihaz);
    if (!cihazObj?.id) { showToast('Cihaz bulunamadı'); return; }
    try {
      const res = await fetch(`${BASE}/kalibrasyon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
        body: JSON.stringify({
          cihazId: cihazObj.id,
          tarih: form.sonKalibrasyon || null,
          sonrakiTarih: form.sonrakiKalibrasyon || null,
          yapan: form.kurum,
          sertifikaNo: form.sertifikano,
          notlar: form.not,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Hata');
      setKayitlar(p => [...p, { id: data.id, ...form }]);
      showToast('Kalibrasyon kaydı eklendi ✓');
    } catch(e) {
      showToast('Kayıt hatası: ' + e.message);
    }
    setEkleModal(false);
    setForm({ cihaz:'', sonKalibrasyon:'', sonrakiKalibrasyon:'', kurum:'', sertifikano:'', not:'' });
  }

  // Cihazları kalibrasyon verisiyle zenginleştir
  const cihazKalibrasyon = CIHAZLAR.map(c => {
    const ekstraKayit = kayitlar.find(k => k.cihaz === c.ad);
    return {
      ...c,
      kalibrasyon: ekstraKayit?.sonrakiKalibrasyon || c.kalibrasyon,
      sonKalibrasyon: ekstraKayit?.sonKalibrasyon || c.sonBakim,
      kurum: ekstraKayit?.kurum,
      sertifikano: ekstraKayit?.sertifikano,
    };
  });

  return (
    <div>
      <div className="page-hd" style={{ marginBottom:16 }}>
        <div>
          <div className="page-hd-title">Kalibrasyon Kayıtları</div>
          <div className="page-hd-sub">{CIHAZLAR.length} cihaz — kalibrasyon ve garanti takibi</div>
        </div>
        <button className="btn btn-primary" onClick={() => setEkleModal(true)}>+ Kalibrasyon Ekle</button>
      </div>

      <div className="panel">
        <table className="data-table">
          <thead>
            <tr><th style={{textAlign:'left'}}>Cihaz</th><th>Seri No</th><th>Son Kalibrasyon</th><th>Sonraki Kalibrasyon</th><th>Garanti Bitiş</th><th>Durum</th><th>İşlem</th></tr>
          </thead>
          <tbody>
            {cihazKalibrasyon.map(c => {
              const kalan = daysUntil(c.kalibrasyon);
              const gecti = kalan !== null && kalan < 0;
              const yakin = kalan !== null && kalan <= 30 && kalan >= 0;
              return (
                <tr key={c.id} style={{cursor:'pointer'}} onClick={() => setDetayModal(c)}
                  onMouseOver={e=>e.currentTarget.style.background='var(--table-hover)'}
                  onMouseOut={e=>e.currentTarget.style.background=''}>
                  <td style={{fontWeight:700,fontSize:13,color:'var(--slate)'}}>{c.ad}</td>
                  <td style={{fontFamily:'monospace',fontSize:11,color:'var(--slate-mid)'}}>{c.sn}</td>
                  <td style={{fontSize:12,color:'var(--slate-mid)'}}>{c.sonKalibrasyon}</td>
                  <td style={{fontSize:12,fontWeight:600,color:gecti?'#DC2626':yakin?'#D97706':'var(--slate)'}}>{c.kalibrasyon}{kalan!==null&&` (${kalan}g)`}</td>
                  <td style={{fontSize:12,color:'var(--slate-mid)'}}>{c.garantiBitis}</td>
                  <td>
                    <span className={`tag ${gecti?'t-red':yakin?'t-orange':'t-green'}`} style={{fontSize:'9.5px'}}>
                      {gecti?'Süresi Doldu':yakin?'Yaklaşıyor':'Geçerli'}
                    </span>
                  </td>
                  <td onClick={e=>e.stopPropagation()}>
                    <button className="btn btn-secondary btn-sm" style={{fontSize:'10.5px'}} onClick={() => {
                      setForm(f=>({...f,cihaz:c.ad}));
                      setEkleModal(true);
                    }}>Güncelle</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Kalibrasyon Ekle Modal */}
      {ekleModal && (
        <Modal title="Kalibrasyon Kaydı Ekle" onClose={() => setEkleModal(false)} width={480}>
          <div style={{background:'linear-gradient(135deg,#7C3AED,#6366F1,#0891b2)',borderRadius:10,padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:10}}>
            <div style={{fontSize:22}}>📐</div>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:'white'}}>Kalibrasyon Kaydı</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.75)',marginTop:1}}>Gerçekleştirilen kalibrasyon işlemini kayıt altına alın</div>
            </div>
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
              <label className="fl">Kalibrasyon Tarihi *</label>
              <input className="fi" type="date" value={form.sonKalibrasyon} onChange={e=>setForm(p=>({...p,sonKalibrasyon:e.target.value}))}/>
            </div>
            <div className="fg">
              <label className="fl">Sonraki Kalibrasyon</label>
              <input className="fi" type="date" value={form.sonrakiKalibrasyon} onChange={e=>setForm(p=>({...p,sonrakiKalibrasyon:e.target.value}))}/>
            </div>
          </div>
          <div className="fr" style={{marginBottom:12}}>
            <div className="fg">
              <label className="fl">Kalibrasyon Kurumu</label>
              <input className="fi" value={form.kurum} onChange={e=>setForm(p=>({...p,kurum:e.target.value}))} placeholder="Akrediteli kurum adı…"/>
            </div>
            <div className="fg">
              <label className="fl">Sertifika No</label>
              <input className="fi" value={form.sertifikano} onChange={e=>setForm(p=>({...p,sertifikano:e.target.value}))} placeholder="Sertifika numarası…"/>
            </div>
          </div>
          <div className="fg" style={{marginBottom:14}}>
            <label className="fl">Notlar</label>
            <textarea className="fi" rows={2} value={form.not} onChange={e=>setForm(p=>({...p,not:e.target.value}))} placeholder="Kalibrasyon notları veya sapma değerleri…"/>
          </div>
          <div className="mf">
            <button className="btn btn-secondary" onClick={() => setEkleModal(false)}>İptal</button>
            <button className="btn btn-primary" onClick={ekleKaydet}>Kaydet</button>
          </div>
        </Modal>
      )}

      {/* Detay Modal */}
      {detayModal && (
        <Modal title={detayModal.ad} onClose={() => setDetayModal(null)} width={440}>
          <div style={{background:'var(--surface)',borderRadius:10,padding:'12px 14px',marginBottom:14}}>
            <div style={{fontSize:14,fontWeight:700,color:'var(--slate)',marginBottom:4}}>{detayModal.ad}</div>
            <div style={{fontFamily:'monospace',fontSize:11,color:'var(--slate-light)'}}>{detayModal.sn}</div>
          </div>
          {[
            ['Konum', detayModal.lok],
            ['Son Kalibrasyon', detayModal.sonKalibrasyon||detayModal.sonBakim],
            ['Sonraki Kalibrasyon', detayModal.kalibrasyon],
            ['Garanti Bitiş', detayModal.garantiBitis],
            ['Kalibrasyon Kurumu', detayModal.kurum||'—'],
            ['Sertifika No', detayModal.sertifikano||'—'],
          ].map(([l,v])=>(
            <div key={l} style={{display:'flex',padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
              <span style={{color:'var(--slate-light)',width:160,flexShrink:0}}>{l}</span>
              <span style={{fontWeight:600,color:'var(--slate)'}}>{v||'—'}</span>
            </div>
          ))}
          <div className="mf" style={{marginTop:14}}>
            <button className="btn btn-secondary" onClick={() => setDetayModal(null)}>Kapat</button>
            <button className="btn btn-primary" onClick={() => {
              setForm(f=>({...f,cihaz:detayModal.ad}));
              setDetayModal(null);
              setEkleModal(true);
            }}>Kalibrasyon Ekle</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
