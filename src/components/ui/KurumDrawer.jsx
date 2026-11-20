import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useUIStore } from '../../store';

const DURUM_CFG = { Aktif:{tag:'t-green',bar:'#059669'}, Pasif:{tag:'t-gray',bar:'#94A3B8'}, 'Deneme Süresi':{tag:'t-orange',bar:'#D97706'} };
const FATURA_TAG = { 'Ödendi':'t-green', 'Bekliyor':'t-orange', 'Gecikti':'t-red' };

function gunKaldi(tarih) {
  return Math.ceil((new Date(tarih) - new Date()) / 86400000);
}

// ── Genel Bilgiler Tab ───────────────────────────────────────
function TabGenel({ k }) {
  const grup = KURUM_GRUPLARI.find(g => g.kurumIdler.includes(k.id));
  const kalanGun = gunKaldi(k.abonelikBitis);

  return (
    <>
      <div style={{ background:'linear-gradient(135deg, #7C3AED, #6366F1, #0891b2)', borderRadius:12, padding:'16px 18px', marginBottom:16, display:'flex', alignItems:'center', gap:14 }}>
        <div style={{ width:52, height:52, borderRadius:14, background:'rgba(255,255,255,0.2)', border:'2px solid rgba(255,255,255,0.35)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>🏥</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:16, fontWeight:800, color:'white', fontFamily:"'Outfit',sans-serif", letterSpacing:'-0.4px' }}>{k.ad}</div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.65)', marginTop:3, display:'flex', gap:10, flexWrap:'wrap' }}>
            <span>{k.tur}</span><span>{k.sehir} / {k.ilce}</span>
          </div>
        </div>
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', marginBottom:2 }}>Kurum ID</div>
          <div style={{ fontSize:14, fontWeight:800, color:'white', fontFamily:"'Outfit',sans-serif" }}>{k.id}</div>
        </div>
      </div>

      {kalanGun <= 7 && kalanGun > 0 && k.durum !== 'Pasif' && (
        <div style={{ background:'rgba(220,38,38,0.07)', border:'1.5px solid rgba(220,38,38,0.25)', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:12, color:'var(--danger)', fontWeight:600, display:'flex', alignItems:'center', gap:8 }}>
          ⚠ Abonelik {kalanGun} gün içinde sona eriyor
        </div>
      )}

      <div className="det-section">
        <div className="det-title">🏢 Kurum Bilgileri</div>
        <div className="hasta-grid">
          <div className="hasta-field"><div className="hasta-field-lbl">Tür</div><div className="hasta-field-val">{k.tur}</div></div>
          <div className="hasta-field"><div className="hasta-field-lbl">Yatak Sayısı</div><div className="hasta-field-val">{k.yatak}</div></div>
          <div className="hasta-field"><div className="hasta-field-lbl">Ameliyathane Salonu</div><div className="hasta-field-val">{k.salonSayisi}</div></div>
          <div className="hasta-field"><div className="hasta-field-lbl">Kullanıcı Sayısı</div><div className="hasta-field-val">{k.kullaniciSayisi}</div></div>
          <div className="hasta-field"><div className="hasta-field-lbl">Bağlı Grup</div><div className="hasta-field-val">{grup?.ad || '—'}</div></div>
          <div className="hasta-field"><div className="hasta-field-lbl">Durum</div><div className="hasta-field-val"><span className={`tag ${DURUM_CFG[k.durum]?.tag}`} style={{fontSize:9.5}}>{k.durum}</span></div></div>
        </div>
      </div>

      <div className="det-section" style={{marginBottom:0}}>
        <div className="det-title">📞 İletişim</div>
        <div className="hasta-grid">
          <div className="hasta-field"><div className="hasta-field-lbl">Yetkili</div><div className="hasta-field-val">{k.iletisimAd}</div></div>
          <div className="hasta-field"><div className="hasta-field-lbl">Telefon</div><div className="hasta-field-val">{k.iletisimTel}</div></div>
          <div className="hasta-field" style={{gridColumn:'span 2'}}><div className="hasta-field-lbl">E-posta</div><div className="hasta-field-val">{k.iletisimEmail}</div></div>
        </div>
      </div>
    </>
  );
}

// ── Abonelik & Faturalama Tab ──────────────────────────────────
function TabAbonelik({ k }) {
  const faturalar = FATURALAR.filter(f => f.kurumId === k.id);
  const kalanGun = gunKaldi(k.abonelikBitis);

  return (
    <div>
      <div className="det-section">
        <div className="det-title">📦 Abonelik Bilgileri</div>
        <div style={{ background:'rgba(20,184,166,0.06)', border:'1.5px solid rgba(20,184,166,0.25)', borderRadius:11, padding:'14px 16px', marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <span style={{ fontSize:14, fontWeight:800, color:'var(--slate)' }}>{k.paket} Paket</span>
            <span style={{ fontSize:16, fontWeight:900, color:'var(--teal)' }}>₺{k.aylikUcret.toLocaleString('tr-TR')}<span style={{fontSize:11,fontWeight:500}}>/ay</span></span>
          </div>
          <div style={{ fontSize:11.5, color:'var(--slate-mid)' }}>
            {k.abonelikBaslangic} — {k.abonelikBitis} {kalanGun > 0 && `(${kalanGun} gün kaldı)`}
          </div>
        </div>
      </div>

      <div className="det-section" style={{marginBottom:0}}>
        <div className="det-title">💳 Fatura Geçmişi</div>
        {faturalar.length === 0 ? (
          <div className="empty"><div className="empty-text">Fatura kaydı yok</div></div>
        ) : faturalar.map(f => (
          <div key={f.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
            <div>
              <div style={{ fontSize:12.5, fontWeight:700, color:'var(--slate)', fontFamily:'monospace' }}>{f.id}</div>
              <div style={{ fontSize:11, color:'var(--slate-light)', marginTop:2 }}>{f.kesimTarihi}</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:12.5, fontWeight:700, color:'var(--teal)' }}>₺{f.tutar.toLocaleString('tr-TR')}</div>
              <span className={`tag ${FATURA_TAG[f.durum]}`} style={{fontSize:9,marginTop:2,display:'inline-block'}}>{f.durum}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Aktivite Tab ────────────────────────────────────────────────
function TabAktivite({ k }) {
  const loglar = AKTIVITE_LOGLARI.filter(l => l.detay.includes(k.ad));

  return (
    <div>
      {loglar.length === 0 ? (
        <div className="empty"><div className="empty-text">Bu kurum için aktivite kaydı yok</div></div>
      ) : loglar.map(l => (
        <div key={l.id} style={{ display:'flex', gap:10, padding:'11px 0', borderBottom:'1px solid var(--border)' }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--teal)', marginTop:5, flexShrink:0 }}/>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12.5, fontWeight:700, color:'var(--slate)' }}>{l.islem}</div>
            <div style={{ fontSize:11.5, color:'var(--slate-mid)', marginTop:1 }}>{l.detay}</div>
            <div style={{ fontSize:10.5, color:'var(--slate-light)', marginTop:3 }}>{l.kullanici} · {l.tarih}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Ana Drawer ────────────────────────────────────────────────
const TABS = ['genel','abonelik','aktivite'];
const TAB_LBLS = { genel:'Genel Bilgiler', abonelik:'Abonelik & Faturalama', aktivite:'Aktivite' };

export default function KurumDrawer({ kurum: k, onClose, onDurumDegistir, onDuzenle }) {
  const { faturalar: FATURALAR, kurumGruplari: KURUM_GRUPLARI } = useDataStore();
  const { showToast } = useUIStore();
  const [activeTab, setActiveTab] = useState('genel');
  if (!k) return null;

  const dcfg = DURUM_CFG[k.durum] || { tag:'t-gray', bar:'#94A3B8' };

  const drawer = (
    <>
      <div className="drawer-overlay open" onClick={onClose}/>
      <div className="drawer open" style={{width:680}}>
        <div className="drawer-status-bar" style={{background:dcfg.bar}}/>
        <div className="drawer-header">
          <div style={{flex:1,minWidth:0}}>
            <div className="drawer-title">{k.ad}</div>
            <div className="drawer-sub">{k.id} · {k.sehir} · {k.paket}</div>
          </div>
          <span className={`tag ${dcfg.tag}`} style={{fontSize:10,marginRight:10}}>{k.durum}</span>
          <div className="drawer-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </div>
        </div>
        <div className="drawer-tabs">
          {TABS.map(t => (
            <div key={t} className={`dtab${activeTab===t?' active':''}`} onClick={()=>setActiveTab(t)}>{TAB_LBLS[t]}</div>
          ))}
        </div>
        <div className="drawer-body">
          {activeTab==='genel'    && <TabGenel    k={k}/>}
          {activeTab==='abonelik' && <TabAbonelik k={k}/>}
          {activeTab==='aktivite' && <TabAktivite k={k}/>}
        </div>
        <div className="drawer-footer">
          <button className="btn btn-secondary" onClick={onClose}>Kapat</button>
          <button className="btn btn-secondary btn-sm" onClick={()=>{ onClose(); onDuzenle?.(k); }}>✏ Düzenle</button>
          {k.durum !== 'Pasif' ? (
            <button className="btn btn-primary btn-sm" style={{background:'#DC2626',borderColor:'#DC2626'}} onClick={()=>{ onDurumDegistir?.(k.id,'Pasif'); onClose(); }}>Pasife Al</button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={()=>{ onDurumDegistir?.(k.id,'Aktif'); onClose(); }}>Aktif Et</button>
          )}
        </div>
      </div>
    </>
  );

  return createPortal(drawer, document.body);
}
