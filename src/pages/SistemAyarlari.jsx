import { useState, useEffect } from 'react';
import { useUIStore } from '../store';
import { SISTEM_AYARLARI } from '../data/mockData';

const BASE = 'http://localhost:4000/api';
const tok = () => localStorage.getItem('operio_access');

export default function SistemAyarlari() {
  const { showToast } = useUIStore();
  const [ayarlar, setAyarlar] = useState(SISTEM_AYARLARI);

  useEffect(() => {
    fetch(`${BASE}/ayarlar`, { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAyarlar(data); })
      .catch(() => {});
  }, []);

  function f(k,v) { setAyarlar(p => ({...p,[k]:v})); }
  async function kaydet() {
    try {
      await fetch(`${BASE}/ayarlar`, { method:'PUT', headers:{'Content-Type':'application/json',Authorization:`Bearer ${tok()}`}, body: JSON.stringify(ayarlar) });
      showToast('Sistem ayarları kaydedildi ✓');
    } catch { showToast('Kayıt hatası'); }
  }

  return (
    <div>
      <div className="page-hd" style={{ marginBottom:16 }}>
        <div>
          <div className="page-hd-title">Sistem Ayarları</div>
          <div className="page-hd-sub">Platform genelindeki yapılandırma ayarları</div>
        </div>
        <button className="btn btn-primary" onClick={kaydet}>💾 Değişiklikleri Kaydet</button>
      </div>

      <div className="panel" style={{ marginBottom:16 }}>
        <div className="panel-hd"><span className="panel-title">🏷 Genel</span></div>
        <div style={{ padding:'16px 18px', display:'flex', flexDirection:'column', gap:14 }}>
          <div className="fr">
            <div className="fg">
              <label className="fl">Platform Adı</label>
              <input className="fi" value={ayarlar.platformAdi} onChange={e=>f('platformAdi',e.target.value)}/>
            </div>
            <div className="fg">
              <label className="fl">Deneme Süresi (gün)</label>
              <input className="fi" type="number" value={ayarlar.denemeSuresiGun} onChange={e=>f('denemeSuresiGun',Number(e.target.value))}/>
            </div>
          </div>
          <div className="fr">
            <div className="fg">
              <label className="fl">Destek E-posta</label>
              <input className="fi" type="email" value={ayarlar.destekEmail} onChange={e=>f('destekEmail',e.target.value)}/>
            </div>
            <div className="fg">
              <label className="fl">Fatura E-posta</label>
              <input className="fi" type="email" value={ayarlar.faturaEmail} onChange={e=>f('faturaEmail',e.target.value)}/>
            </div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom:16 }}>
        <div className="panel-hd"><span className="panel-title">📧 SMTP & Sunucu</span></div>
        <div style={{ padding:'16px 18px', display:'flex', flexDirection:'column', gap:14 }}>
          <div className="fr">
            <div className="fg">
              <label className="fl">SMTP Sunucu</label>
              <input className="fi" value={ayarlar.smtpSunucu} onChange={e=>f('smtpSunucu',e.target.value)}/>
            </div>
            <div className="fg">
              <label className="fl">SMTP Port</label>
              <input className="fi" type="number" value={ayarlar.smtpPort} onChange={e=>f('smtpPort',Number(e.target.value))}/>
            </div>
          </div>
          <div className="fg">
            <label className="fl">Maks. Dosya Boyutu (MB)</label>
            <input className="fi" type="number" value={ayarlar.maxDosyaBoyutuMB} onChange={e=>f('maxDosyaBoyutuMB',Number(e.target.value))} style={{maxWidth:200}}/>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom:16 }}>
        <div className="panel-hd"><span className="panel-title">💾 Yedekleme</span></div>
        <div style={{ padding:'16px 18px', display:'flex', flexDirection:'column', gap:14 }}>
          <div className="fg">
            <label className="fl">Yedekleme Sıklığı</label>
            <select className="fi" value={ayarlar.yedeklemeSikligi} onChange={e=>f('yedeklemeSikligi',e.target.value)} style={{maxWidth:200}}>
              <option>Saatlik</option><option>Günlük</option><option>Haftalık</option>
            </select>
          </div>
          <div style={{ fontSize:12, color:'var(--slate-light)' }}>Son yedekleme: <strong style={{color:'var(--slate)'}}>{ayarlar.sonYedekleme}</strong></div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-hd"><span className="panel-title">⚙️ Sistem Durumu</span></div>
        <div style={{ padding:'16px 18px', display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--slate)' }}>Otomatik Faturalama</div>
              <div style={{ fontSize:11, color:'var(--slate-light)', marginTop:2 }}>Her ay otomatik fatura kesimi</div>
            </div>
            <div onClick={() => f('otomatikFaturalama', !ayarlar.otomatikFaturalama)}
              style={{ width:42, height:24, borderRadius:20, background:ayarlar.otomatikFaturalama?'var(--teal)':'var(--border)', cursor:'pointer', position:'relative', transition:'background 0.2s' }}>
              <div style={{ width:18, height:18, borderRadius:'50%', background:'white', position:'absolute', top:3, left:ayarlar.otomatikFaturalama?21:3, transition:'left 0.2s' }}/>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--slate)' }}>Bakım Modu</div>
              <div style={{ fontSize:11, color:'var(--slate-light)', marginTop:2 }}>Aktifken tüm kurumlar platforma erişemez</div>
            </div>
            <div onClick={() => f('bakimModu', !ayarlar.bakimModu)}
              style={{ width:42, height:24, borderRadius:20, background:ayarlar.bakimModu?'#DC2626':'var(--border)', cursor:'pointer', position:'relative', transition:'background 0.2s' }}>
              <div style={{ width:18, height:18, borderRadius:'50%', background:'white', position:'absolute', top:3, left:ayarlar.bakimModu?21:3, transition:'left 0.2s' }}/>
            </div>
          </div>
          {ayarlar.bakimModu && (
            <div style={{ background:'rgba(220,38,38,0.07)', border:'1px solid rgba(220,38,38,0.2)', borderRadius:9, padding:'10px 14px', fontSize:12, color:'var(--danger)' }}>
              ⚠ Bakım modu aktif olduğunda hiçbir kurum platforma giriş yapamaz.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
