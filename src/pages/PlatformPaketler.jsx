import { useState } from 'react';
import { useUIStore } from '../store';
import Modal from '../components/ui/Modal';
import { PLATFORM_PAKETLERI } from '../data/mockData';

export default function PlatformPaketler() {
  const { kurumlar: KURUMLAR } = useDataStore();
  const { showToast } = useUIStore();
  const [paketler, setPaketler] = useState(PLATFORM_PAKETLERI);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ ad:'', aylikUcret:'', maxSalon:'', maxKullanici:'', ozellikler:'' });

  function openModal(paket) {
    setForm({ ad:paket.ad, aylikUcret:String(paket.aylikUcret), maxSalon:String(paket.maxSalon), maxKullanici:String(paket.maxKullanici), ozellikler:paket.ozellikler.join(', ') });
    setModal(paket);
  }

  function kaydet() {
    if (!form.ad.trim()) { showToast('Paket adı zorunlu'); return; }
    setPaketler(prev => prev.map(p => p.id === modal.id
      ? { ...p, ad:form.ad, aylikUcret:Number(form.aylikUcret)||0, maxSalon:Number(form.maxSalon)||0, maxKullanici:Number(form.maxKullanici)||0, ozellikler:form.ozellikler.split(',').map(x=>x.trim()).filter(Boolean) }
      : p));
    showToast('Paket güncellendi ✓');
    setModal(null);
  }

  function kullaniciSayisi(paketAd) {
    return KURUMLAR.filter(k => k.paket === paketAd).length;
  }

  return (
    <div>
      <div className="page-hd" style={{ marginBottom:16 }}>
        <div>
          <div className="page-hd-title">Paket & Fiyatlandırma</div>
          <div className="page-hd-sub">Platform genelindeki abonelik paketleri ve fiyatlandırma</div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:16, marginBottom:24 }}>
        {paketler.map(p => (
          <div key={p.id} style={{ background:'var(--card-bg)', border:'1.5px solid var(--border)', borderRadius:16, overflow:'hidden' }}>
            <div style={{ padding:'18px 20px', background:'linear-gradient(135deg, #7C3AED, #6366F1, #0891b2)', color:'white' }}>
              <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', opacity:0.85 }}>{kullaniciSayisi(p.ad)} hastane kullanıyor</div>
              <div style={{ fontSize:20, fontWeight:800, marginTop:4, fontFamily:"'Outfit',sans-serif" }}>{p.ad}</div>
              <div style={{ fontSize:24, fontWeight:900, marginTop:8 }}>₺{p.aylikUcret.toLocaleString('tr-TR')}<span style={{fontSize:13,fontWeight:500,opacity:0.85}}>/ay</span></div>
            </div>
            <div style={{ padding:'16px 20px' }}>
              <div style={{ display:'flex', gap:16, marginBottom:14, paddingBottom:14, borderBottom:'1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize:10, color:'var(--slate-light)', fontWeight:700, textTransform:'uppercase' }}>Maks. Salon</div>
                  <div style={{ fontSize:15, fontWeight:800, color:'var(--slate)', marginTop:2 }}>{p.maxSalon >= 999 ? 'Sınırsız' : p.maxSalon}</div>
                </div>
                <div>
                  <div style={{ fontSize:10, color:'var(--slate-light)', fontWeight:700, textTransform:'uppercase' }}>Maks. Kullanıcı</div>
                  <div style={{ fontSize:15, fontWeight:800, color:'var(--slate)', marginTop:2 }}>{p.maxKullanici >= 9999 ? 'Sınırsız' : p.maxKullanici}</div>
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                {p.ozellikler.map((o,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12.5, color:'var(--slate-mid)' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.5" style={{width:13,height:13,flexShrink:0}}><polyline points="20 6 9 17 4 12"/></svg>
                    {o}
                  </div>
                ))}
              </div>
              <button className="btn btn-secondary" style={{ width:'100%' }} onClick={() => openModal(p)}>Paketi Düzenle</button>
            </div>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel-hd"><span className="panel-title">📊 Paket Dağılımı</span></div>
        <div style={{ padding:'14px 18px' }}>
          {paketler.map(p => {
            const sayi = kullaniciSayisi(p.ad);
            const pct = KURUMLAR.length ? Math.round(sayi / KURUMLAR.length * 100) : 0;
            return (
              <div key={p.id} style={{ marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <span style={{ fontSize:12.5, fontWeight:600, color:'var(--slate)' }}>{p.ad}</span>
                  <span style={{ fontSize:12, color:'var(--slate-mid)', fontWeight:700 }}>{sayi} hastane ({pct}%)</span>
                </div>
                <div style={{ height:6, background:'var(--border)', borderRadius:4, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${pct}%`, background:'var(--teal)', borderRadius:4 }}/>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {modal && (
        <Modal title={`${modal.ad} Paketini Düzenle`} onClose={() => setModal(null)} width={480}>
          <div className="fg" style={{ marginBottom:12 }}>
            <label className="fl">Paket Adı *</label>
            <input className="fi" value={form.ad} onChange={e=>setForm({...form,ad:e.target.value})}/>
          </div>
          <div className="fg" style={{ marginBottom:12 }}>
            <label className="fl">Aylık Ücret (₺)</label>
            <input className="fi" type="number" min="0" value={form.aylikUcret} onChange={e=>setForm({...form,aylikUcret:e.target.value})}/>
          </div>
          <div className="fr" style={{ marginBottom:12 }}>
            <div className="fg">
              <label className="fl">Maks. Salon</label>
              <input className="fi" type="number" min="0" value={form.maxSalon} onChange={e=>setForm({...form,maxSalon:e.target.value})}/>
            </div>
            <div className="fg">
              <label className="fl">Maks. Kullanıcı</label>
              <input className="fi" type="number" min="0" value={form.maxKullanici} onChange={e=>setForm({...form,maxKullanici:e.target.value})}/>
            </div>
          </div>
          <div className="fg" style={{ marginBottom:14 }}>
            <label className="fl">Özellikler <span style={{ color:'var(--slate-light)', fontWeight:400 }}>(virgülle ayır)</span></label>
            <textarea className="fi" rows={3} value={form.ozellikler} onChange={e=>setForm({...form,ozellikler:e.target.value})}/>
          </div>
          <div className="mf">
            <button className="btn btn-secondary" onClick={() => setModal(null)}>İptal</button>
            <button className="btn btn-primary" onClick={kaydet}>Güncelle</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
