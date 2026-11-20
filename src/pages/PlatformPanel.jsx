import { useNavigate } from 'react-router-dom';
import { useDataStore } from '../store';

const DURUM_CFG = { Aktif:{tag:'t-green'}, Pasif:{tag:'t-gray'}, 'Deneme Süresi':{tag:'t-orange'} };

export default function PlatformPanel() {
  const { kurumlar: KURUMLAR } = useDataStore();
  const navigate = useNavigate();

  const aktifHastane = KURUMLAR.filter(k => k.durum === 'Aktif').length;
  const denemeHastane = KURUMLAR.filter(k => k.durum === 'Deneme Süresi').length;
  const toplamKullanici = KURUMLAR.reduce((t, k) => t + k.kullaniciSayisi, 0);
  const aylikGelir = KURUMLAR.filter(k => k.durum !== 'Pasif').reduce((t, k) => t + k.aylikUcret, 0);

  const yakindaBitenler = KURUMLAR.filter(k => {
    const gun = Math.ceil((new Date(k.abonelikBitis) - new Date()) / 86400000);
    return gun <= 30 && gun > 0;
  });

  return (
    <div>
      <div className="page-hd" style={{ marginBottom:16 }}>
        <div>
          <div className="page-hd-title">Platform Paneli</div>
          <div className="page-hd-sub">Operio'yu kullanan tüm hastane ve kurumların genel görünümü</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/hastaneler')}>+ Yeni Hastane Ekle</button>
      </div>

      <div className="stat-row" style={{ marginBottom:16 }}>
        {[
          { val:KURUMLAR.length, lbl:'Toplam Hastane',   trend:`${aktifHastane} aktif`,        cls:'stat-card-1', si:'si-teal' },
          { val:toplamKullanici, lbl:'Toplam Kullanıcı',  trend:'Tüm kurumlarda',                cls:'stat-card-2', si:'si-blue' },
          { val:denemeHastane,   lbl:'Deneme Süresinde',  trend:'30 gün ücretsiz',               cls:'stat-card-3', si:'si-purple' },
          { val:`₺${(aylikGelir/1000).toFixed(0)}K`, lbl:'Aylık Tekrarlayan Gelir', trend:'MRR', cls:'stat-card-4', si:'si-orange' },
        ].map((item,i) => (
          <div key={i} className={`stat-card ${item.cls}`}>
            <div className="stat-card-glow"/><div className="stat-card-glow2"/>
            <div className="stat-val">{item.val}</div>
            <div className="stat-lbl">{item.lbl}</div>
            <div className="stat-trend">{item.trend}</div>
          </div>
        ))}
      </div>

      <div className="cg">
        <div className="panel">
          <div className="panel-hd">
            <span className="panel-title">🏥 Hastaneler</span>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/hastaneler')}>Tümü →</button>
          </div>
          {KURUMLAR.map(k => (
            <div key={k.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 18px', borderBottom:'1px solid var(--border)', cursor:'pointer' }}
              onClick={() => navigate('/hastaneler')}
              onMouseOver={e=>e.currentTarget.style.background='var(--surface)'}
              onMouseOut={e=>e.currentTarget.style.background=''}>
              <div style={{ width:38, height:38, borderRadius:10, background:'rgba(20,184,166,0.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:16 }}>🏥</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--slate)' }}>{k.ad}</div>
                <div style={{ fontSize:11, color:'var(--slate-light)', marginTop:1 }}>{k.sehir} · {k.kullaniciSayisi} kullanıcı · {k.paket}</div>
              </div>
              <span className={`tag ${DURUM_CFG[k.durum]?.tag||'t-gray'}`} style={{fontSize:9.5}}>{k.durum}</span>
            </div>
          ))}
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="panel">
            <div className="panel-hd"><span className="panel-title">⏰ Yakında Bitecek Abonelikler</span></div>
            {yakindaBitenler.length === 0 ? (
              <div style={{ padding:24, textAlign:'center', fontSize:12, color:'var(--slate-light)' }}>30 gün içinde biten abonelik yok</div>
            ) : yakindaBitenler.map(k => (
              <div key={k.id} style={{ padding:'10px 18px', borderBottom:'1px solid var(--border)' }}>
                <div style={{ fontSize:12.5, fontWeight:700, color:'var(--slate)' }}>{k.ad}</div>
                <div style={{ fontSize:11, color:'var(--danger)', marginTop:2 }}>Bitiş: {k.abonelikBitis}</div>
              </div>
            ))}
          </div>

          <div className="panel">
            <div className="panel-hd"><span className="panel-title">🔗 Hızlı İşlemler</span></div>
            <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:8 }}>
              {[
                { lbl:'Hastane Yönetimi',      icon:'🏥', action:()=>navigate('/hastaneler') },
                { lbl:'Paket & Fiyatlandırma', icon:'💳', action:()=>navigate('/platform-paketler') },
                { lbl:'Tüm Kullanıcılar',      icon:'👥', action:()=>navigate('/platform-kullanicilar') },
              ].map(item => (
                <button key={item.lbl} className="btn btn-secondary" style={{ width:'100%', justifyContent:'flex-start', gap:10 }} onClick={item.action}>
                  <span>{item.icon}</span> {item.lbl}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
