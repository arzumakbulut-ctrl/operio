import { useState, useEffect } from 'react';
import { useUIStore } from '../store';
import { WEBSITE_ICERIK } from '../data/mockData';

const BASE = 'http://localhost:4000/api';
const tok = () => localStorage.getItem('operio_access');

const DURUM_TAG = { 'Yayında':'t-green', 'Taslak':'t-gray' };

export default function WebsiteYonetimi() {
  const { showToast } = useUIStore();
  const [icerik, setIcerik] = useState(WEBSITE_ICERIK);

  useEffect(() => {
    fetch(`${BASE}/website`, { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setIcerik(data); })
      .catch(() => {});
  }, []);

  function f(k,v) { setIcerik(p => ({...p,[k]:v})); }
  async function kaydet() {
    try {
      await fetch(`${BASE}/website`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
        body: JSON.stringify(icerik),
      });
      showToast('Website içeriği kaydedildi ✓');
    } catch { showToast('Kayıt hatası'); }
  }

  return (
    <div>
      <div className="page-hd" style={{ marginBottom:16 }}>
        <div>
          <div className="page-hd-title">Website Yönetimi</div>
          <div className="page-hd-sub">Pazarlama sitesi içerikleri ve blog yazıları</div>
        </div>
        <button className="btn btn-primary" onClick={kaydet}>💾 Değişiklikleri Kaydet</button>
      </div>

      <div className="stat-row" style={{ marginBottom:16 }}>
        {[
          { val:icerik.demoTalepSayisi, lbl:'Bu Ay Demo Talebi', cls:'stat-card-1', si:'si-teal' },
          { val:icerik.blogYazilari.filter(b=>b.durum==='Yayında').length, lbl:'Yayındaki Yazı', cls:'stat-card-2', si:'si-blue' },
          { val:icerik.blogYazilari.reduce((t,b)=>t+b.goruntulenme,0), lbl:'Toplam Görüntülenme', cls:'stat-card-3', si:'si-purple' },
        ].map((item,i) => (
          <div key={i} className={`stat-card ${item.cls}`}>
            <div className="stat-card-glow"/><div className="stat-card-glow2"/>
            <div className="stat-val">{item.val}</div>
            <div className="stat-lbl">{item.lbl}</div>
          </div>
        ))}
      </div>

      <div className="panel" style={{ marginBottom:16 }}>
        <div className="panel-hd"><span className="panel-title">🏠 Ana Sayfa İçeriği</span></div>
        <div style={{ padding:'16px 18px', display:'flex', flexDirection:'column', gap:14 }}>
          <div className="fg">
            <label className="fl">Ana Başlık</label>
            <input className="fi" value={icerik.anaSayfaBaslik} onChange={e=>f('anaSayfaBaslik',e.target.value)}/>
          </div>
          <div className="fg">
            <label className="fl">Alt Başlık</label>
            <textarea className="fi" rows={2} value={icerik.anaSayfaAltBaslik} onChange={e=>f('anaSayfaAltBaslik',e.target.value)}/>
          </div>
          <div className="fr">
            <div className="fg">
              <label className="fl">İletişim E-posta</label>
              <input className="fi" type="email" value={icerik.iletisimEmail} onChange={e=>f('iletisimEmail',e.target.value)}/>
            </div>
            <div className="fg">
              <label className="fl">İletişim Telefon</label>
              <input className="fi" value={icerik.iletisimTel} onChange={e=>f('iletisimTel',e.target.value)}/>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-hd">
          <span className="panel-title">📝 Blog Yazıları</span>
          <button className="btn btn-primary btn-sm" onClick={() => showToast('Yeni yazı editörü açılıyor…')}>+ Yeni Yazı</button>
        </div>
        <table className="data-table">
          <thead><tr><th style={{textAlign:'left'}}>Başlık</th><th>Yayın Tarihi</th><th>Görüntülenme</th><th>Durum</th><th>İşlem</th></tr></thead>
          <tbody>
            {icerik.blogYazilari.map(b => (
              <tr key={b.id}
                onMouseOver={e=>e.currentTarget.style.background='var(--table-hover)'}
                onMouseOut={e=>e.currentTarget.style.background=''}>
                <td style={{fontWeight:700,fontSize:13,color:'var(--slate)'}}>{b.baslik}</td>
                <td style={{fontSize:12,color:'var(--slate-mid)'}}>{b.yayinTarihi}</td>
                <td style={{fontSize:12,color:'var(--slate-mid)',textAlign:'center'}}>{b.goruntulenme.toLocaleString('tr-TR')}</td>
                <td><span className={`tag ${DURUM_TAG[b.durum]}`} style={{fontSize:'9.5px'}}>{b.durum}</span></td>
                <td><button className="btn btn-secondary btn-sm" style={{fontSize:'10.5px'}} onClick={() => showToast(`"${b.baslik}" düzenleniyor…`)}>Düzenle</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
