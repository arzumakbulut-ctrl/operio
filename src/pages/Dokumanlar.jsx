import { useState, useEffect } from 'react';
import { useUIStore } from '../store';
import Modal from '../components/ui/Modal';

const BASE = 'http://localhost:4000/api';
const tok = () => localStorage.getItem('operio_access');

const DOKUMANLAR = [
  { id:1, baslik:'Ameliyathane İç Yönetmeliği',       tip:'PDF',  tarih:'01.01.2025', boyut:'1.2 MB', kategori:'Yönetmelik' },
  { id:2, baslik:'Sterilizasyon Standart Prosedürü',   tip:'DOCX', tarih:'15.03.2025', boyut:'450 KB', kategori:'Prosedür' },
  { id:3, baslik:'Hasta Mahremiyeti Politikası',       tip:'PDF',  tarih:'10.02.2025', boyut:'800 KB', kategori:'Politika' },
  { id:4, baslik:'Anestezi Uygulama Kılavuzu',        tip:'PDF',  tarih:'20.04.2025', boyut:'2.1 MB', kategori:'Kılavuz' },
  { id:5, baslik:'Ekipman Bakım Talimatları',          tip:'PDF',  tarih:'05.05.2025', boyut:'3.4 MB', kategori:'Talimat' },
  { id:6, baslik:'Acil Durum Eylem Planı',             tip:'PDF',  tarih:'12.01.2025', boyut:'560 KB', kategori:'Acil' },
];

const KAT_RENK = { Yönetmelik:'#0284C7', Prosedür:'#7C3AED', Politika:'#059669', Kılavuz:'#14B8A6', Talimat:'#D97706', Acil:'#DC2626' };

export default function Dokumanlar() {
  const { showToast } = useUIStore();
  const [arama, setArama] = useState('');
  const [dokumanlar, setDokumanlar] = useState(DOKUMANLAR);
  const [ekleModal, setEkleModal] = useState(false);
  const [form, setForm] = useState({ baslik: '', tip: 'PDF', kategori: 'Genel', boyut: '' });

  useEffect(() => {
    fetch(`${BASE}/dokumanlar`, { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (data.length > 0) setDokumanlar(data); })
      .catch(() => {});
  }, []);

  async function sil(id) {
    try {
      await fetch(`${BASE}/dokumanlar/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tok()}` } });
      setDokumanlar(p => p.filter(d => d.id !== id));
      showToast('Doküman silindi');
    } catch { showToast('Silme hatası'); }
  }

  async function yukle() {
    if (!form.baslik) return;
    try {
      const res = await fetch(`${BASE}/dokumanlar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
        body: JSON.stringify(form),
      });
      const yeni = await res.json();
      setDokumanlar(p => [yeni, ...p]);
      setEkleModal(false);
      setForm({ baslik: '', tip: 'PDF', kategori: 'Genel', boyut: '' });
      showToast('Doküman eklendi ✓');
    } catch { showToast('Ekleme hatası'); }
  }

  const liste = dokumanlar.filter(d => d.baslik.toLowerCase().includes(arama.toLowerCase()));

  return (
    <div>
      <div className="page-hd">
        <div>
          <div className="page-hd-title">Dokümanlar</div>
          <div className="page-hd-sub">Kurumsal belgeler ve yönetmelikler</div>
        </div>
        <button className="btn btn-primary" onClick={() => setEkleModal(true)}>+ Doküman Yükle</button>
      </div>

      <input className="fi" placeholder="Doküman ara…" value={arama} onChange={e => setArama(e.target.value)} style={{ maxWidth:340, marginBottom:16 }}/>

      <div className="panel">
        <table className="data-table">
          <thead>
            <tr><th>Doküman Adı</th><th>Kategori</th><th>Tür</th><th>Boyut</th><th>Tarih</th><th>İşlem</th></tr>
          </thead>
          <tbody>
            {liste.map(d => {
              const renk = KAT_RENK[d.kategori] || '#64748B';
              return (
                <tr key={d.id}>
                  <td className="td-name">📄 {d.baslik}</td>
                  <td><span className="tag" style={{ background:`${renk}18`, color:renk }}>{d.kategori}</span></td>
                  <td><span className="tag t-gray">{d.tip}</span></td>
                  <td style={{ fontSize:11.5, color:'var(--slate-light)' }}>{d.boyut}</td>
                  <td style={{ fontSize:11.5, color:'var(--slate-light)' }}>{d.tarih}</td>
                  <td>
                    <div style={{ display:'flex', gap:6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => showToast(`${d.baslik} önizleniyor…`)}>👁 Önizle</button>
                      <button className="btn btn-primary btn-sm" onClick={() => showToast(`${d.baslik} indiriliyor…`)}>↓ İndir</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => sil(d.id)} style={{color:'#DC2626'}}>✕ Sil</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {ekleModal && (
        <Modal title="Doküman Yükle" onClose={() => setEkleModal(false)} width={440}>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div className="fg">
              <label className="fl">Doküman Adı</label>
              <input className="fi" value={form.baslik} onChange={e => setForm(p => ({...p, baslik:e.target.value}))} placeholder="Doküman adını girin"/>
            </div>
            <div style={{ display:'flex', gap:12 }}>
              <div className="fg">
                <label className="fl">Tür</label>
                <select className="fi" value={form.tip} onChange={e => setForm(p => ({...p, tip:e.target.value}))}>
                  <option>PDF</option><option>DOCX</option><option>XLSX</option><option>PPT</option>
                </select>
              </div>
              <div className="fg">
                <label className="fl">Kategori</label>
                <select className="fi" value={form.kategori} onChange={e => setForm(p => ({...p, kategori:e.target.value}))}>
                  <option>Genel</option><option>Yönetmelik</option><option>Prosedür</option><option>Politika</option><option>Kılavuz</option><option>Talimat</option><option>Acil</option>
                </select>
              </div>
            </div>
            <div className="fg">
              <label className="fl">Boyut (opsiyonel)</label>
              <input className="fi" value={form.boyut} onChange={e => setForm(p => ({...p, boyut:e.target.value}))} placeholder="ör. 1.2 MB"/>
            </div>
          </div>
          <div className="mf" style={{ marginTop:20 }}>
            <button className="btn btn-secondary" onClick={() => setEkleModal(false)}>İptal</button>
            <button className="btn btn-primary" onClick={yukle} disabled={!form.baslik}>Kaydet</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
