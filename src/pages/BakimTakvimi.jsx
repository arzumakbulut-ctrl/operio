import { useState } from 'react';
import { useUIStore } from '../store';
import Modal from '../components/ui/Modal';

const RENKLER = ['#0F766E','#1D4ED8','#6D28D9','#B45309','#059669','#DC2626'];

export default function BakimTakvimi() {
  const { cihazlar: CIHAZLAR } = useDataStore();
  const { showToast } = useUIStore();
  const [ekleModal, setEkleModal] = useState(false);
  const [form, setForm] = useState({ cihaz:'', tip:'Periyodik Bakım', tarih:'', sure:'', not:'' });
  const [ekstra, setEkstra] = useState([]);

  const aylar = ['Haziran 2026','Temmuz 2026','Ağustos 2026'];
  const sabitBakimlar = [
    { cihaz:'Anestezi Cihazı 1',    tip:'Periyodik Bakım', tarih:'15',  sure:'2 saat',   ay:'Haziran 2026' },
    { cihaz:'Elektrokoter Unit 3',   tip:'Periyodik Bakım', tarih:'20',  sure:'1.5 saat', ay:'Haziran 2026' },
    { cihaz:'C-Arm Floroskopi',      tip:'Kalibrasyon',     tarih:'25',  sure:'3 saat',   ay:'Temmuz 2026'  },
  ];

  const tumBakimlar = [...sabitBakimlar, ...ekstra];

  function ekleKaydet() {
    if (!form.cihaz || !form.tarih) { showToast('Cihaz ve tarih zorunlu'); return; }
    const d = new Date(form.tarih);
    const ayAdi = d.toLocaleDateString('tr-TR', { month:'long', year:'numeric' });
    const gun   = String(d.getDate());
    setEkstra(p => [...p, { ...form, tarih:gun, ay:ayAdi.charAt(0).toUpperCase()+ayAdi.slice(1) }]);
    showToast('Bakım takvime eklendi ✓');
    setEkleModal(false);
    setForm({ cihaz:'', tip:'Periyodik Bakım', tarih:'', sure:'', not:'' });
  }

  return (
    <div>
      <div className="page-hd" style={{ marginBottom:16 }}>
        <div>
          <div className="page-hd-title">Bakım Takvimi</div>
          <div className="page-hd-sub">Önümüzdeki dönem planlı bakımlar</div>
        </div>
        <button className="btn btn-primary" onClick={() => setEkleModal(true)}>+ Bakım Ekle</button>
      </div>

      <div className="panel">
        <div style={{ padding:'16px 18px' }}>
          {aylar.map((ay, ai) => {
            const ayBakim = tumBakimlar.filter(b => b.ay === ay);
            if (!ayBakim.length) return (
              <div key={ay} style={{ marginBottom:20 }}>
                <div style={{ fontSize:'10.5px', fontWeight:700, color:'var(--slate-light)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:10, paddingBottom:8, borderBottom:'1px solid var(--border)' }}>{ay}</div>
                <div style={{ fontSize:12, color:'var(--slate-light)', padding:'12px 0' }}>Bu ay için planlı bakım yok</div>
              </div>
            );
            return (
              <div key={ay} style={{ marginBottom:20 }}>
                <div style={{ fontSize:'10.5px', fontWeight:700, color:'var(--slate-light)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:10, paddingBottom:8, borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span>{ay}</span>
                  <span className="tag t-teal" style={{fontSize:9}}>{ayBakim.length} bakım</span>
                </div>
                {ayBakim.map((b,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                    <div style={{ width:36, height:36, borderRadius:9, background:`${RENKLER[i%RENKLER.length]}18`, border:`1px solid ${RENKLER[i%RENKLER.length]}30`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <span style={{ fontSize:13, fontWeight:800, color:RENKLER[i%RENKLER.length] }}>{b.tarih}</span>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'var(--slate)' }}>{b.cihaz}</div>
                      <div style={{ fontSize:11, color:'var(--slate-light)', marginTop:1 }}>{b.tip}{b.sure?` · ${b.sure}`:''}</div>
                      {b.not && <div style={{ fontSize:10, color:'var(--slate-light)', marginTop:1, fontStyle:'italic' }}>{b.not}</div>}
                    </div>
                    <span className="tag t-teal" style={{fontSize:'9.5px'}}>{b.tip}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bakım Ekle Modal */}
      {ekleModal && (
        <Modal title="Takvime Bakım Ekle" onClose={() => setEkleModal(false)} width={460}>
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
            <label className="fl">Not</label>
            <textarea className="fi" rows={2} value={form.not} onChange={e=>setForm(p=>({...p,not:e.target.value}))} placeholder="Bakım notları veya özel talimatlar…"/>
          </div>
          <div className="mf">
            <button className="btn btn-secondary" onClick={() => setEkleModal(false)}>İptal</button>
            <button className="btn btn-primary" onClick={ekleKaydet}>Takvime Ekle</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
