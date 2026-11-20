import { useState, useEffect } from 'react';
import { useUIStore } from '../store';

const BASE = 'http://localhost:4000/api';
const tok = () => localStorage.getItem('operio_access');

// ── VERİ (HTML'den birebir) ───────────────────────────────────
const OPERIO_MODULLER = [
  {id:'sterilizasyon', ic:'🧪', ad:'Sterilizasyon',       aciklama:'Set takip, steril depo, sayım formu, takip geçmişi',              fiyat:1200},
  {id:'anestezi',      ic:'💉', ad:'Anestezi',             aciklama:'Anestezi kayıt formu, vital takip, ilaç kaydı',                   fiyat:900},
  {id:'klinik',        ic:'📋', ad:'Klinik Belgeler',      aciklama:'Ameliyat notu, sayım formu, operatif rapor',                      fiyat:800},
  {id:'analitik',      ic:'📊', ad:'Analitik & Raporlama', aciklama:'Salon verimliliği, cerrah istatistikleri, gelişmiş raporlar',     fiyat:1500},
  {id:'mesajlasma',    ic:'💬', ad:'Mesajlaşma Pro',        aciklama:'Grup oluşturma, dosya paylaşımı, mesaj arşivi',                   fiyat:500},
  {id:'ai',            ic:'🤖', ad:'AI Asistan',            aciklama:'Claude AI arama, vaka analizi, öneri sistemi',                   fiyat:1800},
];

const MISAFIR_PAKETLER = [
  {id:'starter',   ad:'Starter',   limit:5,   fiyat:990,  renk:'#0284C7'},
  {id:'growth',    ad:'Growth',    limit:15,  fiyat:1790, renk:'#7C3AED'},
  {id:'unlimited', ad:'Unlimited', limit:999, fiyat:2990, renk:'#059669'},
];

const INIT_AKTIF_PAKET = {
  temel:        {aktif:true, fiyat:2900},
  moduller:     ['sterilizasyon','anestezi','klinik','ai'],
  misafirPaket: 'starter',
  misafirHekimler: [
    {id:'mh1',ad:'Dr. Zeynep Kara', uzmanlik:'Kardiyoloji',   email:'zkara@klinik.com',  durum:'aktif',    eklenme:'2026-04-10'},
    {id:'mh2',ad:'Dr. Murat Demir', uzmanlik:'Nöroloji',      email:'mdemir@klinik.com', durum:'aktif',    eklenme:'2026-05-01'},
    {id:'mh3',ad:'Dr. Selin Aydın', uzmanlik:'Ortopedi',      email:'saydin@ozel.com',   durum:'bekliyor', eklenme:''},
    {id:'mh4',ad:'Dr. Emre Çelik',  uzmanlik:'Genel Cerrahi', email:'ecelik@hastane.com',durum:'bekliyor', eklenme:''},
  ],
  donemBitis:   '2026-06-01',
  faturaGecmis: [
    {donem:'Mayıs 2026',  tutar:6390, tarih:'2026-05-01', durum:'ödendi'},
    {donem:'Nisan 2026',  tutar:5890, tarih:'2026-04-01', durum:'ödendi'},
    {donem:'Mart 2026',   tutar:4900, tarih:'2026-03-01', durum:'ödendi'},
  ],
};

const KARSILASTIRMA_PAKETLER = [
  {id:'basic',      ad:'Basic',      renk:'#64748B', fiyat:2900,  moduller:[],                                                           misafir:null,       ozellik:'Temel işlevler için ideal başlangıç'},
  {id:'standard',   ad:'Standard',   renk:'#0284C7', fiyat:7100,  moduller:['sterilizasyon','anestezi','klinik'],                         misafir:null,       ozellik:'Orta ölçekli hastaneler için komple çözüm'},
  {id:'pro',        ad:'Pro',        renk:'#7C3AED', fiyat:11400, moduller:['sterilizasyon','anestezi','klinik','analitik','mesajlasma','ai'], misafir:'starter',ozellik:'Tüm modüller + AI + Misafir Hekim'},
  {id:'enterprise', ad:'Enterprise', renk:'#0F766E', fiyat:null,  moduller:['sterilizasyon','anestezi','klinik','analitik','mesajlasma','ai'], misafir:'unlimited',ozellik:'Büyük hastaneler için özel fiyatlandırma'},
];

const TUM_OZELLIKLER = [
  {lbl:'Ameliyat Listesi & Takvim',           basic:true,  standard:true,  pro:true,         enterprise:true},
  {lbl:'Personel & Salon Yönetimi',            basic:true,  standard:true,  pro:true,         enterprise:true},
  {lbl:'Temel Raporlar',                       basic:true,  standard:true,  pro:true,         enterprise:true},
  {lbl:'Sterilizasyon Modülü',                 basic:false, standard:true,  pro:true,         enterprise:true},
  {lbl:'Anestezi Kayıt Formu',                 basic:false, standard:true,  pro:true,         enterprise:true},
  {lbl:'Klinik Belgeler & Notlar',             basic:false, standard:true,  pro:true,         enterprise:true},
  {lbl:'Analitik Dashboard',                   basic:false, standard:false, pro:true,         enterprise:true},
  {lbl:'Mesajlaşma Pro',                       basic:false, standard:false, pro:true,         enterprise:true},
  {lbl:'AI Asistan (Claude)',                  basic:false, standard:false, pro:true,         enterprise:true},
  {lbl:'Misafir Hekim Modülü',                 basic:false, standard:false, pro:'Starter (5)',enterprise:'Sınırsız'},
  {lbl:'Özel Entegrasyon (HBYS/E-Nabız)',      basic:false, standard:false, pro:false,        enterprise:true},
  {lbl:'Öncelikli Destek & SLA',               basic:false, standard:false, pro:false,        enterprise:true},
];

function mkInitials(ad){ return ad.split(' ').filter(w=>w).map(w=>w[0]).join('').slice(0,2); }
function fmtTL(n){ return n?.toLocaleString('tr-TR') + '₺'; }

// ── ONAY MODAL ────────────────────────────────────────────────
function OnayModal({ mesaj, onOnayla, onClose, danger=false }) {
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)'}}
      onClick={onClose}>
      <div style={{width:420,background:'var(--card-bg)',borderRadius:16,overflow:'hidden',boxShadow:'0 24px 60px rgba(0,0,0,0.2)'}}
        onClick={e=>e.stopPropagation()}>
        <div style={{padding:'16px 20px',background:danger?'linear-gradient(135deg,#7f1d1d,#DC2626)':'linear-gradient(135deg,var(--teal-dark),var(--teal))',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{fontSize:14,fontWeight:700,color:'white'}}>{danger?'⚠ Onay':'✅ Onay'}</div>
          <div onClick={onClose} style={{color:'rgba(255,255,255,0.7)',cursor:'pointer',fontSize:20}}>✕</div>
        </div>
        <div style={{padding:'20px',fontSize:13,color:'var(--slate-mid)',lineHeight:1.7}} dangerouslySetInnerHTML={{__html:mesaj}}/>
        <div style={{padding:'12px 20px',borderTop:'1px solid var(--border)',display:'flex',gap:8,justifyContent:'flex-end',background:'var(--surface)'}}>
          <button className="btn btn-secondary" onClick={onClose}>İptal</button>
          <button className="btn btn-primary" style={danger?{background:'var(--danger)',borderColor:'var(--danger)'}:{}} onClick={onOnayla}>Onayla</button>
        </div>
      </div>
    </div>
  );
}

// ── ANA COMPONENT ─────────────────────────────────────────────
export default function Abonelik() {
  const { showToast } = useUIStore();
  const [aktifTab, setAktifTab] = useState('genel');
  const [paket,    setPaket]    = useState(INIT_AKTIF_PAKET);
  const [onayModal, setOnayModal] = useState(null); // {mesaj, onOnayla, danger}

  useEffect(() => {
    const h = { Authorization: `Bearer ${tok()}` };
    Promise.all([
      fetch(`${BASE}/billing/subscription`, { headers: h }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${BASE}/billing/invoices`, { headers: h }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${BASE}/misafirhekim`, { headers: h }).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([subRes, invRes, hekimler]) => {
      if (subRes?.data) {
        const sub = subRes.data;
        setPaket(p => ({
          ...p,
          temel: { aktif: sub.durum !== 'cancelled' && sub.durum !== 'iptal', fiyat: p.temel.fiyat },
          moduller: Array.isArray(sub.moduller) && sub.moduller.length > 0 ? sub.moduller : p.moduller,
          misafirPaket: sub.misafirPaket || p.misafirPaket,
          donemBitis: sub.donemBitis || p.donemBitis,
        }));
      }
      if (invRes?.data && invRes.data.length > 0) {
        setPaket(p => ({
          ...p,
          faturaGecmis: invRes.data.map(f => ({
            donem: f.donem || '',
            tutar: f.tutar || 0,
            tarih: f.tarih ? new Date(f.tarih).toLocaleDateString('tr-TR') : '',
            durum: f.durum || 'ödendi',
          })),
        }));
      }
      if (hekimler.length > 0) {
        setPaket(p => ({
          ...p,
          misafirHekimler: hekimler.map(mh => ({
            id: mh.id,
            ad: `${mh.ad} ${mh.soyad}`,
            uzmanlik: mh.uzmanlik || '—',
            email: mh.email || '',
            durum: (mh.durum || 'Aktif').toLowerCase() === 'aktif' ? 'aktif' : 'bekliyor',
            eklenme: mh.baslangic ? new Date(mh.baslangic).toLocaleDateString('tr-TR') : '',
          })),
        }));
      }
    });
  }, []);

  const mp           = MISAFIR_PAKETLER.find(p => p.id === paket.misafirPaket);
  const toplamModul  = paket.moduller.reduce((t,m) => { const mod = OPERIO_MODULLER.find(x=>x.id===m); return t+(mod?.fiyat||0); }, 0);
  const toplamMisafir = mp?.fiyat || 0;
  const toplam        = paket.temel.fiyat + toplamModul + toplamMisafir;
  const aktifHekimSayi = paket.misafirHekimler.filter(h=>h.durum==='aktif').length;

  function onayGoster(mesaj, fn, danger=false) {
    setOnayModal({ mesaj, onOnayla:()=>{ fn(); setOnayModal(null); }, danger });
  }

  function modulEkle(id) {
    if (paket.moduller.includes(id)) return;
    const mod = OPERIO_MODULLER.find(x=>x.id===id);
    onayGoster(
      `${mod.ic} <strong>${mod.ad}</strong> modülünü eklemek istiyor musunuz?<br><span style="color:var(--teal);font-weight:700">+${fmtTL(mod.fiyat)}/ay</span> eklenir. Dönem sonunda faturalanır.`,
      () => { setPaket(p=>({...p,moduller:[...p.moduller,id]})); showToast(`✅ ${mod.ic} ${mod.ad} eklendi`); }
    );
  }

  function modulKaldir(id) {
    const mod = OPERIO_MODULLER.find(x=>x.id===id);
    onayGoster(
      `${mod.ic} <strong>${mod.ad}</strong> modülünü kaldırmak istiyor musunuz?<br>Dönem sonunda fatura güncellenir. 90 gün veri saklama garantisi.`,
      () => { setPaket(p=>({...p,moduller:p.moduller.filter(m=>m!==id)})); showToast(`${mod.ic} ${mod.ad} kaldırıldı`); },
      true
    );
  }

  function misafirPaketSec(id) {
    const yeni = MISAFIR_PAKETLER.find(p=>p.id===id);
    if (id === paket.misafirPaket) return;
    onayGoster(
      `Misafir Hekim paketini <strong>${yeni.ad}</strong> olarak değiştirmek istiyor musunuz?<br><span style="color:var(--teal);font-weight:700">${fmtTL(yeni.fiyat)}/ay</span>`,
      () => { setPaket(p=>({...p,misafirPaket:id})); showToast(`✅ Misafir Hekim paketi ${yeni.ad} olarak güncellendi`); }
    );
  }

  function hekimKaldir(idx) {
    const h = paket.misafirHekimler[idx];
    onayGoster(
      `<strong>${h.ad}</strong> sistemden kaldırılsın mı?`,
      () => { setPaket(p=>({...p,misafirHekimler:p.misafirHekimler.filter((_,i)=>i!==idx)})); showToast(`${h.ad} kaldırıldı`); },
      true
    );
  }

  function paketYukselt(id) {
    const p = KARSILASTIRMA_PAKETLER.find(x=>x.id===id);
    onayGoster(
      `<strong>${p.ad}</strong> paketine geçmek istiyor musunuz?<br><span style="color:var(--teal);font-weight:700">${p.fiyat?fmtTL(p.fiyat)+'/ay':'Özel fiyat'}</span>`,
      () => { showToast(`✅ ${p.ad} paketine geçiş başlatıldı`); }
    );
  }

  const TABS = [
    {id:'genel',         lbl:'📦 Genel Bakış'},
    {id:'moduller',      lbl:'🔧 Modüller'},
    {id:'misafir',       lbl:'👥 Misafir Hekim'},
    {id:'fatura',        lbl:'🧾 Fatura Geçmişi'},
    {id:'karsilastirma', lbl:'🚀 Paket Karşılaştırma'},
  ];

  // Mevcut paket tespiti (karşılaştırma için)
  const aktifModulSet = new Set(paket.moduller);
  const aktifKarsil = KARSILASTIRMA_PAKETLER.find(p => {
    const pmSet = new Set(p.moduller);
    return [...pmSet].every(m=>aktifModulSet.has(m)) && aktifModulSet.size <= pmSet.size+1;
  }) || KARSILASTIRMA_PAKETLER[0];

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>

      {/* ── Başlık ── */}
      <div style={{padding:'0 0 14px',flexShrink:0,display:'flex',alignItems:'flex-end',justifyContent:'space-between'}}>
        <div>
          <div style={{fontSize:22,fontWeight:900,color:'var(--slate)',letterSpacing:'-0.5px',fontFamily:"'Outfit',sans-serif"}}>Paket & Modül Yönetimi</div>
          <div style={{fontSize:12,color:'var(--slate-light)',marginTop:3}}>Aboneliğinizi yönetin · Dönem: {paket.donemBitis}'e kadar aktif</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:22,fontWeight:900,color:'var(--teal)',fontFamily:"'Outfit',sans-serif"}}>{fmtTL(toplam)}<span style={{fontSize:13,fontWeight:500,color:'var(--slate-light)'}}>/ay</span></div>
          <div style={{fontSize:'10.5px',color:'var(--slate-light)',marginTop:2}}>Toplam aylık ücret</div>
        </div>
      </div>

      {/* ── Sekmeler ── */}
      <div style={{display:'flex',gap:0,borderBottom:'1px solid var(--border)',flexShrink:0,marginBottom:16}}>
        {TABS.map(t=>(
          <div key={t.id} onClick={()=>setAktifTab(t.id)}
            style={{padding:'10px 18px',fontSize:12,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',transition:'all 0.15s',
              borderBottom:`2px solid ${aktifTab===t.id?'var(--teal)':'transparent'}`,
              color:aktifTab===t.id?'var(--teal)':'var(--slate-light)'}}>
            {t.lbl}
          </div>
        ))}
      </div>

      {/* ── İçerik ── */}
      <div style={{flex:1,overflowY:'auto'}}>

        {/* ════ GENEL BAKIŞ ════ */}
        {aktifTab==='genel' && (
          <div>
            {/* Yükseltme Banner */}
            {paket.moduller.length < OPERIO_MODULLER.length && (
              <div onClick={()=>setAktifTab('karsilastirma')}
                style={{cursor:'pointer',marginBottom:18,borderRadius:16,overflow:'hidden',position:'relative',background:'linear-gradient(135deg,#1e1b4b,#312e81,#1e3a5f)',padding:'20px 24px',display:'flex',alignItems:'center',gap:16,boxShadow:'0 8px 32px rgba(124,58,237,0.25)',border:'1px solid rgba(124,58,237,0.3)',transition:'transform 0.15s'}}
                onMouseEnter={e=>e.currentTarget.style.transform='scale(1.01)'}
                onMouseLeave={e=>e.currentTarget.style.transform=''}>
                <div style={{position:'absolute',top:-30,right:-30,width:160,height:160,borderRadius:'50%',background:'radial-gradient(circle,rgba(124,58,237,0.3),transparent 70%)',pointerEvents:'none'}}/>
                <div style={{position:'absolute',bottom:-20,left:'40%',width:120,height:120,borderRadius:'50%',background:'radial-gradient(circle,rgba(20,184,166,0.15),transparent 70%)',pointerEvents:'none'}}/>
                <div style={{width:52,height:52,borderRadius:14,background:'rgba(124,58,237,0.3)',border:'1.5px solid rgba(124,58,237,0.5)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,flexShrink:0,position:'relative'}}>🚀</div>
                <div style={{flex:1,position:'relative'}}>
                  <div style={{fontSize:9,fontWeight:800,letterSpacing:'1.5px',color:'rgba(167,139,250,0.8)',textTransform:'uppercase',marginBottom:5}}>Sizi Bekliyor</div>
                  <div style={{fontSize:17,fontWeight:900,color:'white',fontFamily:"'Outfit',sans-serif",letterSpacing:'-0.3px',marginBottom:5}}>{OPERIO_MODULLER.length - paket.moduller.length} modül daha mevcut!</div>
                  <div style={{fontSize:12,color:'rgba(255,255,255,0.65)'}}>
                    {OPERIO_MODULLER.filter(m=>!paket.moduller.includes(m.id)).slice(0,3).map(m=>`${m.ic} ${m.ad}`).join(' · ')}
                    {OPERIO_MODULLER.filter(m=>!paket.moduller.includes(m.id)).length > 3 ? ' · daha fazlası' : ''}
                  </div>
                </div>
                <div style={{flexShrink:0,position:'relative'}}>
                  <div style={{background:'linear-gradient(135deg,#7C3AED,#A78BFA)',color:'white',fontSize:12,fontWeight:700,padding:'10px 20px',borderRadius:10,whiteSpace:'nowrap',boxShadow:'0 4px 16px rgba(124,58,237,0.4)'}}>Paketi İncele →</div>
                  <div style={{fontSize:'9.5px',color:'rgba(255,255,255,0.5)',textAlign:'center',marginTop:5}}>Karşılaştırmayı gör</div>
                </div>
              </div>
            )}

            {/* Özet kartlar */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
              {[
                {ic:'📦',lbl:'Temel Paket',    val:'Aktif',                                          alt:'2.900₺/ay',          renk:'var(--teal)',    bg:'rgba(20,184,166,0.1)'},
                {ic:'🔧',lbl:'Aktif Modül',    val:paket.moduller.length,                            alt:`${fmtTL(toplamModul)}/ay`,renk:'#7C3AED',   bg:'rgba(124,58,237,0.1)'},
                {ic:'👥',lbl:'Misafir Hekim',  val:`${aktifHekimSayi}/${mp?.limit===999?'∞':mp?.limit}`, alt:`${fmtTL(toplamMisafir)}/ay`,renk:'#0284C7',bg:'rgba(2,132,199,0.1)'},
                {ic:'💳',lbl:'Aylık Toplam',   val:`${fmtTL(toplam)}`,                              alt:'KDV dahil değil',     renk:'var(--success)', bg:'rgba(5,150,105,0.1)'},
              ].map(k=>(
                <div key={k.lbl} style={{background:'var(--card-bg)',border:'1px solid var(--border)',borderRadius:13,padding:16}}>
                  <div style={{width:38,height:38,borderRadius:10,background:k.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,marginBottom:10}}>{k.ic}</div>
                  <div style={{fontSize:20,fontWeight:900,color:k.renk,fontFamily:"'Outfit',sans-serif",letterSpacing:'-0.3px'}}>{k.val}</div>
                  <div style={{fontSize:12,fontWeight:600,color:'var(--slate)',marginTop:3}}>{k.lbl}</div>
                  <div style={{fontSize:'10.5px',color:'var(--slate-light)',marginTop:2}}>{k.alt}</div>
                </div>
              ))}
            </div>

            {/* Aktif modüller */}
            <div className="an-section" style={{marginBottom:16}}>
              <div className="an-section-hd">✅ Aktif Modüller</div>
              <div className="an-section-body" style={{padding:10}}>
                <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                  <span style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:20,background:'rgba(20,184,166,0.08)',border:'1.5px solid rgba(20,184,166,0.2)',fontSize:12,fontWeight:600,color:'var(--teal)'}}>📦 Temel Paket</span>
                  {paket.moduller.map(m => {
                    const mod = OPERIO_MODULLER.find(x=>x.id===m);
                    return mod ? (
                      <span key={m} style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:20,background:'rgba(124,58,237,0.07)',border:'1.5px solid rgba(124,58,237,0.2)',fontSize:12,fontWeight:600,color:'#7C3AED'}}>{mod.ic} {mod.ad}</span>
                    ) : null;
                  })}
                  {mp && <span style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:20,background:'rgba(2,132,199,0.08)',border:'1.5px solid rgba(2,132,199,0.2)',fontSize:12,fontWeight:600,color:'#0284C7'}}>👥 Misafir Hekim {mp.ad}</span>}
                </div>
              </div>
            </div>

            {/* Fatura özeti */}
            <div className="an-section">
              <div className="an-section-hd" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span>🧾 Dönem Özeti</span>
                <button onClick={()=>setAktifTab('fatura')} style={{fontSize:10,padding:'3px 10px',borderRadius:20,border:'1px solid var(--border)',background:'var(--surface)',color:'var(--slate-mid)',cursor:'pointer',fontFamily:'inherit'}}>Tüm geçmiş →</button>
              </div>
              <div className="an-section-body">
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:'var(--slate)'}}>Sonraki Fatura</div>
                    <div style={{fontSize:11,color:'var(--slate-light)',marginTop:2}}>{paket.donemBitis}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:18,fontWeight:900,color:'var(--teal)',fontFamily:"'Outfit',sans-serif"}}>{fmtTL(toplam)}</div>
                    <div style={{fontSize:10,color:'var(--slate-light)'}}>+KDV</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════ MODÜLLER ════ */}
        {aktifTab==='moduller' && (
          <div>
            {/* Temel paket */}
            <div style={{background:'linear-gradient(135deg,#0F766E15,#0F766E08)',border:'1.5px solid rgba(20,184,166,0.25)',borderRadius:14,padding:'16px 20px',marginBottom:16,display:'flex',alignItems:'center',gap:14}}>
              <div style={{width:48,height:48,borderRadius:13,background:'rgba(20,184,166,0.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>📦</div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:800,color:'var(--slate)',fontFamily:"'Outfit',sans-serif"}}>Temel Paket</div>
                <div style={{fontSize:'11.5px',color:'var(--slate-mid)',marginTop:3}}>Ameliyat listesi, takvim, personel, salon yönetimi, temel raporlar · 3 kullanıcı dahil</div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div style={{fontSize:16,fontWeight:800,color:'var(--teal)'}}>2.900₺/ay</div>
                <span style={{fontSize:10,fontWeight:700,padding:'3px 10px',borderRadius:20,background:'rgba(5,150,105,0.1)',color:'var(--success)',border:'1px solid rgba(5,150,105,0.2)'}}>✓ Aktif · Zorunlu</span>
              </div>
            </div>

            {/* Modül listesi */}
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {OPERIO_MODULLER.map(mod => {
                const aktif = paket.moduller.includes(mod.id);
                return (
                  <div key={mod.id} style={{background:'var(--card-bg)',border:`1.5px solid ${aktif?'rgba(124,58,237,0.25)':'var(--border)'}`,borderRadius:13,padding:'16px 20px',display:'flex',alignItems:'center',gap:14,transition:'all 0.15s'}}>
                    <div style={{width:48,height:48,borderRadius:13,background:aktif?'rgba(124,58,237,0.1)':'var(--surface)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>{mod.ic}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:'13.5px',fontWeight:700,color:'var(--slate)'}}>{mod.ad}</div>
                      <div style={{fontSize:11,color:'var(--slate-light)',marginTop:3}}>{mod.aciklama}</div>
                    </div>
                    <div style={{textAlign:'right',flexShrink:0,minWidth:130}}>
                      <div style={{fontSize:15,fontWeight:800,color:aktif?'#7C3AED':'var(--slate-mid)'}}>+{fmtTL(mod.fiyat)}/ay</div>
                      <div style={{marginTop:6}}>
                        {aktif
                          ? <button onClick={()=>modulKaldir(mod.id)} style={{fontSize:'10.5px',fontWeight:600,padding:'5px 14px',borderRadius:20,border:'1.5px solid rgba(220,38,38,0.3)',background:'rgba(220,38,38,0.06)',color:'var(--danger)',cursor:'pointer',fontFamily:'inherit',transition:'all 0.15s'}}>Kaldır</button>
                          : <button onClick={()=>modulEkle(mod.id)}   style={{fontSize:'10.5px',fontWeight:600,padding:'5px 14px',borderRadius:20,border:'1.5px solid rgba(124,58,237,0.35)',background:'rgba(124,58,237,0.08)',color:'#7C3AED',cursor:'pointer',fontFamily:'inherit',transition:'all 0.15s'}}>Ekle</button>
                        }
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Toplam */}
            <div style={{marginTop:16,padding:'14px 20px',background:'var(--surface)',border:'1.5px solid var(--border)',borderRadius:13,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:'var(--slate)'}}>Modül Toplam</div>
                <div style={{fontSize:'10.5px',color:'var(--slate-light)',marginTop:1}}>{paket.moduller.length} aktif modül</div>
              </div>
              <div style={{fontSize:18,fontWeight:900,color:'#7C3AED',fontFamily:"'Outfit',sans-serif"}}>{fmtTL(toplamModul)}/ay</div>
            </div>
          </div>
        )}

        {/* ════ MİSAFİR HEKİM ════ */}
        {aktifTab==='misafir' && (
          <div>
            {/* Paket seçimi */}
            <div style={{marginBottom:20}}>
              <div style={{fontSize:'10.5px',fontWeight:700,color:'var(--slate-light)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:12}}>Misafir Hekim Paketi</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
                {MISAFIR_PAKETLER.map(p => {
                  const aktif = paket.misafirPaket === p.id;
                  return (
                    <div key={p.id} onClick={()=>misafirPaketSec(p.id)}
                      style={{border:`2px solid ${aktif?p.renk:'var(--border)'}`,borderRadius:14,padding:18,cursor:'pointer',transition:'all 0.15s',background:aktif?`${p.renk}10`:'var(--card-bg)'}}
                      onMouseEnter={e=>{ if(!aktif) e.currentTarget.style.borderColor=p.renk; }}
                      onMouseLeave={e=>{ if(!aktif) e.currentTarget.style.borderColor='var(--border)'; }}>
                      <div style={{fontSize:16,fontWeight:900,color:p.renk,fontFamily:"'Outfit',sans-serif",marginBottom:6}}>{p.ad}</div>
                      <div style={{fontSize:24,fontWeight:900,color:'var(--slate)',fontFamily:"'Outfit',sans-serif",letterSpacing:'-0.5px'}}>
                        {p.limit===999?'∞':p.limit}<span style={{fontSize:12,fontWeight:500,color:'var(--slate-light)'}}> hekim</span>
                      </div>
                      <div style={{fontSize:15,fontWeight:700,color:p.renk,marginTop:8}}>{fmtTL(p.fiyat)}<span style={{fontSize:11,fontWeight:400,color:'var(--slate-light)'}}>/ay</span></div>
                      {aktif && <div style={{marginTop:10,fontSize:10,fontWeight:700,padding:'4px 12px',borderRadius:20,background:p.renk,color:'white',display:'inline-block'}}>✓ Aktif Plan</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Kullanım özeti */}
            <div style={{marginBottom:16,padding:'14px 18px',background:'var(--surface)',border:'1.5px solid var(--border)',borderRadius:12,display:'flex',alignItems:'center',gap:14}}>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:700,color:'var(--slate)',marginBottom:6}}>Slot Kullanımı</div>
                <div style={{height:8,background:'var(--border)',borderRadius:10,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${Math.min(aktifHekimSayi/(mp?.limit||5)*100,100)}%`,background:aktifHekimSayi>=(mp?.limit||5)?'var(--danger)':'var(--teal)',borderRadius:10,transition:'width 0.5s'}}/>
                </div>
              </div>
              <div style={{fontSize:16,fontWeight:900,color:aktifHekimSayi>=(mp?.limit||5)?'var(--danger)':'var(--teal)',fontFamily:"'Outfit',sans-serif",flexShrink:0}}>
                {aktifHekimSayi}/{mp?.limit===999?'∞':mp?.limit}
              </div>
            </div>

            {/* Hekim listesi */}
            <div className="an-section" style={{marginBottom:16}}>
              <div className="an-section-hd" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span>👥 Misafir Hekimler</span>
                <button onClick={()=>showToast('Davet formu açılıyor…')} style={{fontSize:'10.5px',fontWeight:600,padding:'4px 12px',borderRadius:20,border:'1.5px solid rgba(20,184,166,0.3)',background:'rgba(20,184,166,0.08)',color:'var(--teal)',cursor:'pointer',fontFamily:'inherit'}}>+ Davet Gönder</button>
              </div>
              <div>
                {paket.misafirHekimler.map((h,i) => (
                  <div key={h.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderBottom:i<paket.misafirHekimler.length-1?'1px solid var(--border)':'none'}}>
                    <div style={{width:38,height:38,borderRadius:'50%',background:'linear-gradient(135deg,#0284C7,#0891b2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800,color:'white',flexShrink:0}}>{mkInitials(h.ad)}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:700,color:'var(--slate)'}}>{h.ad}</div>
                      <div style={{fontSize:'10.5px',color:'var(--slate-light)',marginTop:1}}>{h.uzmanlik} · {h.email}</div>
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <span style={{fontSize:10,fontWeight:700,padding:'3px 10px',borderRadius:20,background:h.durum==='aktif'?'rgba(5,150,105,0.1)':'rgba(245,158,11,0.1)',color:h.durum==='aktif'?'var(--success)':'var(--warning)'}}>{h.durum==='aktif'?'✓ Aktif':'⏳ Bekliyor'}</span>
                      <div style={{marginTop:4,fontSize:10,color:'var(--slate-light)'}}>Eklenme: {h.eklenme||'—'}</div>
                    </div>
                    <button onClick={()=>hekimKaldir(i)}
                      style={{width:28,height:28,borderRadius:8,border:'1px solid var(--border)',background:'var(--surface)',color:'var(--slate-light)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:12,transition:'all 0.15s'}}
                      title="Kaldır"
                      onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--danger)';e.currentTarget.style.color='var(--danger)';}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--slate-light)';}}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════ FATURA GEÇMİŞİ ════ */}
        {aktifTab==='fatura' && (
          <div>
            {/* Dönem dökümü */}
            <div className="an-section" style={{marginBottom:16}}>
              <div className="an-section-hd">📊 Dönem Fatura Dökümü — Haziran 2026</div>
              <div>
                {[
                  {lbl:'Temel Paket',             aciklama:'Ameliyat, takvim, personel, salon', tutar:2900},
                  ...paket.moduller.map(m => { const mod=OPERIO_MODULLER.find(x=>x.id===m); return mod?{lbl:`${mod.ic} ${mod.ad}`,aciklama:mod.aciklama,tutar:mod.fiyat}:null; }).filter(Boolean),
                  mp?{lbl:`👥 Misafir Hekim — ${mp.ad}`, aciklama:`Max ${mp.limit===999?'∞':mp.limit} hekim`, tutar:mp.fiyat}:null,
                ].filter(Boolean).map((s,i,arr) => (
                  <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 16px',borderBottom:i<arr.length-1?'1px solid var(--border)':'none'}}>
                    <div>
                      <div style={{fontSize:'12.5px',fontWeight:600,color:'var(--slate)'}}>{s.lbl}</div>
                      <div style={{fontSize:'10.5px',color:'var(--slate-light)',marginTop:1}}>{s.aciklama}</div>
                    </div>
                    <div style={{fontSize:13,fontWeight:700,color:'var(--slate)'}}>{fmtTL(s.tutar)}</div>
                  </div>
                ))}
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'13px 16px',background:'var(--surface)',borderTop:'2px solid var(--border)'}}>
                  <div style={{fontSize:13,fontWeight:800,color:'var(--slate)'}}>Toplam (KDV Hariç)</div>
                  <div style={{fontSize:18,fontWeight:900,color:'var(--teal)',fontFamily:"'Outfit',sans-serif"}}>{fmtTL(toplam)}</div>
                </div>
              </div>
            </div>

            {/* Geçmiş faturalar */}
            <div className="an-section">
              <div className="an-section-hd">🧾 Geçmiş Faturalar</div>
              <table className="sf-table">
                <thead>
                  <tr>
                    <th>Dönem</th>
                    <th style={{textAlign:'right'}}>Tutar</th>
                    <th>Ödeme Tarihi</th>
                    <th style={{textAlign:'center'}}>Durum</th>
                    <th style={{textAlign:'center'}}>PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {paket.faturaGecmis.map((f,i) => (
                    <tr key={i}>
                      <td style={{fontWeight:600}}>{f.donem}</td>
                      <td style={{textAlign:'right',fontWeight:700,color:'var(--teal)'}}>{fmtTL(f.tutar)}</td>
                      <td style={{fontSize:11,color:'var(--slate-light)'}}>{f.tarih}</td>
                      <td style={{textAlign:'center'}}>
                        <span style={{fontSize:10,fontWeight:700,padding:'3px 10px',borderRadius:20,background:'rgba(5,150,105,0.1)',color:'var(--success)'}}>{f.durum}</span>
                      </td>
                      <td style={{textAlign:'center'}}>
                        <button onClick={()=>showToast('🖨 Fatura PDF hazırlanıyor…')} style={{fontSize:10,padding:'3px 10px',borderRadius:20,border:'1px solid var(--border)',background:'var(--surface)',color:'var(--slate-mid)',cursor:'pointer',fontFamily:'inherit'}}>İndir</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ════ PAKET KARŞILAŞTIRMA ════ */}
        {aktifTab==='karsilastirma' && (
          <div>
            {/* Başlık */}
            <div style={{textAlign:'center',padding:'8px 0 24px'}}>
              <div style={{fontSize:13,fontWeight:700,color:'#7C3AED',textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>🚀 Paket Karşılaştırma</div>
              <div style={{fontSize:20,fontWeight:900,color:'var(--slate)',fontFamily:"'Outfit',sans-serif",letterSpacing:'-0.3px'}}>İhtiyacınıza en uygun paketi seçin</div>
              <div style={{fontSize:12,color:'var(--slate-light)',marginTop:6}}>Modüler yapı ile sadece kullandığınız için ödersiniz</div>
            </div>

            {/* Paket kartları */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:24}}>
              {KARSILASTIRMA_PAKETLER.map(p => {
                const isAktif = p.id === aktifKarsil?.id;
                const isPro   = p.id === 'pro';
                return (
                  <div key={p.id}
                    style={{borderRadius:16,padding:'20px 16px',border:`2px solid ${isAktif?p.renk:isPro?p.renk+'44':'var(--border)'}`,background:isAktif?`${p.renk}12`:isPro?`${p.renk}06`:'var(--card-bg)',position:'relative',transition:'all 0.2s'}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=p.renk;e.currentTarget.style.transform='translateY(-2px)';}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=isAktif?p.renk:isPro?`${p.renk}44`:'var(--border)';e.currentTarget.style.transform='';}}>
                    {isPro && <div style={{position:'absolute',top:-11,left:'50%',transform:'translateX(-50%)',background:`linear-gradient(135deg,${p.renk},#A78BFA)`,color:'white',fontSize:'9.5px',fontWeight:800,padding:'3px 14px',borderRadius:20,whiteSpace:'nowrap',letterSpacing:'0.3px'}}>⭐ En Popüler</div>}
                    {isAktif && <div style={{position:'absolute',top:10,right:10,background:p.renk,color:'white',fontSize:8,fontWeight:800,padding:'2px 8px',borderRadius:10}}>Aktif</div>}
                    <div style={{fontSize:16,fontWeight:900,color:p.renk,fontFamily:"'Outfit',sans-serif",marginBottom:4}}>{p.ad}</div>
                    <div style={{fontSize:11,color:'var(--slate-light)',marginBottom:14,lineHeight:1.5}}>{p.ozellik}</div>
                    <div style={{marginBottom:16}}>
                      {p.fiyat
                        ? <>
                            <div style={{fontSize:26,fontWeight:900,color:'var(--slate)',fontFamily:"'Outfit',sans-serif",letterSpacing:'-0.5px'}}>{fmtTL(p.fiyat)}<span style={{fontSize:12,fontWeight:500,color:'var(--slate-light)'}}>/ay</span></div>
                            <div style={{fontSize:10,color:'var(--slate-light)'}}>KDV dahil değil · İptal edilebilir</div>
                          </>
                        : <>
                            <div style={{fontSize:20,fontWeight:900,color:p.renk,fontFamily:"'Outfit',sans-serif"}}>Özel Fiyat</div>
                            <div style={{fontSize:10,color:'var(--slate-light)'}}>Teklif için iletişime geçin</div>
                          </>
                      }
                    </div>
                    {!isAktif && p.fiyat
                      ? <button onClick={()=>paketYukselt(p.id)}
                          style={{width:'100%',padding:9,borderRadius:10,border:'none',background:isPro?`linear-gradient(135deg,${p.renk},#A78BFA)`:`${p.renk}20`,color:isPro?'white':p.renk,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit',transition:'all 0.15s'}}>
                          {(p.fiyat||0) > (KARSILASTIRMA_PAKETLER.find(x=>x.id===aktifKarsil?.id)?.fiyat||2900) ? 'Yükselt →' : 'Düşür'}
                        </button>
                      : isAktif
                        ? <div style={{padding:9,borderRadius:10,background:`${p.renk}20`,color:p.renk,fontSize:12,fontWeight:700,textAlign:'center'}}>✓ Mevcut Paket</div>
                        : <button onClick={()=>showToast('Teklif için operio@iletisim.com adresine yazın')}
                            style={{width:'100%',padding:9,borderRadius:10,border:`1.5px solid ${p.renk}44`,background:'transparent',color:p.renk,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                            Teklif Al →
                          </button>
                    }
                  </div>
                );
              })}
            </div>

            {/* Özellik karşılaştırma */}
            <div className="an-section">
              <div className="an-section-hd">📊 Detaylı Özellik Karşılaştırması</div>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12.5px'}}>
                  <thead>
                    <tr style={{background:'var(--surface)'}}>
                      <th style={{padding:'12px 16px',textAlign:'left',fontSize:10,fontWeight:700,color:'var(--slate-light)',textTransform:'uppercase',letterSpacing:'0.5px',borderBottom:'1.5px solid var(--border)',width:'35%'}}>Özellik</th>
                      {KARSILASTIRMA_PAKETLER.map(p=>(
                        <th key={p.id} style={{padding:'12px 10px',textAlign:'center',fontSize:11,fontWeight:800,color:p.renk,borderBottom:'1.5px solid var(--border)'}}>{p.ad}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TUM_OZELLIKLER.map((of,i) => (
                      <tr key={i} style={{borderBottom:'1px solid var(--border)',background:i%2===0?'transparent':'var(--surface)'}}>
                        <td style={{padding:'11px 16px',fontWeight:500,color:'var(--slate)'}}>{of.lbl}</td>
                        {['basic','standard','pro','enterprise'].map(pid => {
                          const val = of[pid];
                          return (
                            <td key={pid} style={{padding:'11px 10px',textAlign:'center'}}>
                              {val===true  ? <span style={{color:'var(--success)',fontSize:16,fontWeight:700}}>✓</span>
                               :val===false ? <span style={{color:'var(--border)',fontSize:14}}>—</span>
                               :<span style={{fontSize:'10.5px',fontWeight:700,color:'#7C3AED'}}>{val}</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Alt not */}
            <div style={{marginTop:16,padding:'14px 18px',background:'rgba(124,58,237,0.05)',border:'1px solid rgba(124,58,237,0.15)',borderRadius:12,display:'flex',alignItems:'center',gap:12}}>
              <div style={{fontSize:20}}>💡</div>
              <div style={{fontSize:12,color:'var(--slate-mid)',lineHeight:1.6}}>
                <strong style={{color:'var(--slate)'}}>Modüler yapı avantajı:</strong> Paket yerine tek tek modül de ekleyebilirsiniz.
                Yükseltme anında geçerli, düşürme dönem sonunda uygulanır. 90 gün veri saklama garantisi.
                <span onClick={()=>setAktifTab('moduller')} style={{color:'var(--teal)',cursor:'pointer',fontWeight:600,textDecoration:'underline'}}> Modülleri incele →</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Onay Modal ── */}
      {onayModal && (
        <OnayModal
          mesaj={onayModal.mesaj}
          onOnayla={onayModal.onOnayla}
          onClose={()=>setOnayModal(null)}
          danger={onayModal.danger}
        />
      )}
    </div>
  );
}
