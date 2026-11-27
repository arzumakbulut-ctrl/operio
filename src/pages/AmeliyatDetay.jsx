import { useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDataStore, useUIStore, useAuthStore } from '../store';
import { ROLES } from '../data/roles';
import { updateSurgeryStatus, assignTeamMember, removeTeamMember } from '../services/surgeriesAdapter';

// UI'ın Türkçe durum string'i → backend enum'u (Task 1'deki STATUS_TO_TR'nin
// tersi). 'Iptal' dropdown'da seçilebilir bir seçenek olduğu için brief'teki
// 3 anahtarlı tabloya eklendi — eksik bırakılsaydı "Iptal" seçildiğinde
// backend'e status=undefined gönderilip güncelleme sessizce hiçbir şey
// yapmazdı.
const STATUS_TO_BACKEND = { 'Bekliyor':'WAITING', 'Devam Ediyor':'IN_PROGRESS', 'Tamamlandi':'COMPLETED', 'Iptal':'CANCELLED' };


const ATANABILIR_HEMSIRE  = ['scrub','sirkule','yardimci'];
const EKIP_COLORS_AD = { cerrah:'#DC2626', asistan:'#EA580C', scrub:'#0284C7', scrub2:'#0284C7', sirkule:'#7C3AED', anestezi:'#14B8A6', anesteknik:'#059669', yardimci:'#D97706' };
const EKIP_LABELS_AD = { cerrah:'Cerrah', asistan:'Asistan Cerrah', scrub:'Hemşire (Scrub)', scrub2:'Hemşire (Scrub 2)', sirkule:'Ameliyathane Teknikeri', anestezi:'Anestezi Uzmanı', anesteknik:'Anestezi Teknisyeni', yardimci:'Yardımcı Sağlık Personeli' };
const ROL_FILTRELERI_AD = { scrub:['Hemşire','Ameliyathane Teknikeri'], scrub2:['Hemşire','Ameliyathane Teknikeri'], sirkule:['Ameliyathane Teknikeri','Hemşire'], yardimci:['Yardımcı Personel'] };

// Doktor/Misafir Hekim için yapılandırılmış ameliyat notu alanları
const NOT_ALANLARI = [
  { k:'taniIslem',    lbl:'Tanı ve İşlem',         icon:'🩺', placeholder:'Preoperatif tanı, planlanan ve gerçekleştirilen işlem…' },
  { k:'cerrahiTeknik',lbl:'Cerrahi Teknik',         icon:'🔪', placeholder:'Kullanılan cerrahi yaklaşım, insizyon, teknik adımlar…' },
  { k:'bulgular',     lbl:'Bulgular',               icon:'🔍', placeholder:'İntraoperatif bulgular, anatomik gözlemler…' },
  { k:'yapilanIslem', lbl:'Yapılan İşlem',          icon:'⚙️', placeholder:'Adım adım uygulanan işlem detayları…' },
  { k:'protezBilgisi',lbl:'Protez / İmplant Bilgisi', icon:'🦴', placeholder:'Kullanılan protez/implant — marka, model, seri no, boyut…' },
  { k:'dokuOrnegi',   lbl:'Alınan Doku Örneği',     icon:'🧫', placeholder:'Patolojiye gönderilen örnek tipi, sayısı, lokalizasyonu…' },
  { k:'komplikasyon', lbl:'Komplikasyonlar',        icon:'⚠️', placeholder:'Varsa intraoperatif/postoperatif komplikasyonlar…' },
  { k:'postopNot',    lbl:'Postoperatif Not',       icon:'📋', placeholder:'Hasta durumu, takip planı, özel talimatlar…' },
];

// ── Sabitler ─────────────────────────────────────────────────
const DURUM_CFG = {
  'Devam Ediyor':{ tag:'t-green',  bar:'#059669' },
  'Bekliyor':    { tag:'t-orange', bar:'#D97706' },
  'Tamamlandı':  { tag:'t-gray',   bar:'#94A3B8' },
  'İptal':       { tag:'t-red',    bar:'#DC2626' },
};
const EKIP_COLORS = { cerrah:'#DC2626', asistan:'#EA580C', scrub:'#0284C7', sirkule:'#7C3AED', anestezi:'#14B8A6', anesteknik:'#059669', yardimci:'#D97706' };
const EKIP_LABELS = { cerrah:'Cerrah', asistan:'Asistan Cerrah', scrub:'Scrub Hemşire', sirkule:'Sirkülasyon', anestezi:'Anestezi Uzmanı', anesteknik:'Anestezi Teknisyeni', yardimci:'Yardımcı' };

// Örnek İstemleri
const PATOLOJI_TIPLER = ['Rutin Histopatoloji','İntraoperatif Frozen','Sitoloji','İmmünohistokimya','Moleküler Patoloji'];
const FROZEN_DOKULARI = ['Tümör Dokusu','Lenf Nodu','Cerrahi Sınır','Endometrium','Tiroid Nodu','Beyin Tümörü'];
const KAN_TESTLERI = {
  'Hematoloji':  ['Tam Kan Sayımı','Periferik Yayma','PT/INR','aPTT','Fibrinojen'],
  'Biyokimya':   ['Glukoz','Üre','Kreatinin','ALT/AST','CRP','LDH','Amilaz'],
  'Kan Grubu':   ['ABO/Rh Grubu','Cross-Match','Coombs Testi'],
  'Koagülasyon': ['D-Dimer','Anti-Xa','Trombin Zamanı'],
  'Enfeksiyon':  ['Prokalsitonin','Kan Kültürü','HBsAg','Anti-HCV'],
};
const ONCELIK = [
  { k:'rutin', lbl:'Rutin',  renk:'#059669', bg:'rgba(5,150,105,0.1)',  desc:'48-72s' },
  { k:'acil',  lbl:'Acil',   renk:'#D97706', bg:'rgba(217,119,6,0.1)',  desc:'2-4s'   },
  { k:'stat',  lbl:'STAT',   renk:'#DC2626', bg:'rgba(220,38,38,0.1)',  desc:'<1s'    },
];

// İmplant tipleri
const IMPLANT_TIPLER = ['Eklem Protezi','Kalça Protezi','Diz Protezi','Omurga İmplantı','Kalp Kapağı','Damar Grefti','Göz İçi Lens','Plak & Vida','Hernia Mesh','Koklear İmplant','Diğer'];

function mkAv(ad='') {
  return ad.replace(/Dr\. |Hem\. |Uzm\. |Tek\. /g,'').split(' ').filter(Boolean).map(w=>w[0]).join('').substring(0,2).toUpperCase() || '?';
}
function nowStr() { return new Date().toLocaleString('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }

// ── Öncelik Seçici ────────────────────────────────────────────
function OncelikSec({ val, onChange }) {
  return (
    <div style={{ display:'flex', gap:8 }}>
      {ONCELIK.map(o => (
        <div key={o.k} onClick={() => onChange(o.k)}
          style={{ flex:1, padding:'8px 10px', borderRadius:9, cursor:'pointer', textAlign:'center',
            border:`1.5px solid ${val===o.k?o.renk:'var(--border)'}`,
            background:val===o.k?o.bg:'var(--surface)', transition:'all 0.15s' }}>
          <div style={{ fontSize:12, fontWeight:700, color:val===o.k?o.renk:'var(--slate-mid)' }}>{o.lbl}</div>
          <div style={{ fontSize:9.5, color:'var(--slate-light)', marginTop:2 }}>{o.desc}</div>
        </div>
      ))}
    </div>
  );
}

// ── Ana Sayfa ─────────────────────────────────────────────────
export default function AmeliyatDetay() {
  const { personel: PERSONEL } = useDataStore();
  const { surgeries, updateSurgery } = useDataStore();
  const { showToast } = useUIStore();
  const { curRole }   = useAuthStore();
  const location      = useLocation();
  const navigate      = useNavigate();

  const surgeryId = location.state?.surgeryId;
  const s = surgeries.find(x => x.id === surgeryId) || surgeries[0];
  const h = s?.hastaDetay || {};

  const isDr         = curRole === 6 || curRole === 10;
  const isHemsire    = curRole === 1;
  const isAnestezi   = curRole === 2;

  const TABS = [
    { k:'hasta',    lbl:'👤 Hasta Kartı'      },
    { k:'ekip',     lbl:'👥 Cerrahi Ekip'     },
    { k:'setler',   lbl:'🛡 Setler & Malzeme'  },
    { k:'ilac',     lbl:'💊 İlaçlar'           },
    { k:'notlar',   lbl:'📝 Ameliyat Notları'  },
    { k:'istem',    lbl:'🔬 Örnek İstemleri'   },
    { k:'implant',  lbl:'🔩 İmplantlar'        },
    { k:'medya',    lbl:'📸 Medya'             },
  ];

  const [tab, setTab]       = useState('hasta');

  // Notlar state — Tanı/İşlem, Cerrahi Teknik, Bulgular, Yapılan İşlem, Protez/İmplant,
  // Doku Örneği, Komplikasyon, Postoperatif Not
  const [notlar, setNotlar] = useState({
    taniIslem:'', cerrahiTeknik:'', bulgular:'', yapilanIslem:'',
    protezBilgisi:'', dokuOrnegi:'', komplikasyon:'', postopNot:'',
  });
  const [notKayit, setNotKayit] = useState(false);
  const [acikAlan, setAcikAlan] = useState('taniIslem');

  // Örnek İstemleri state
  const [istemler, setIstemler]       = useState([]);
  const [istemModal, setIstemModal]   = useState(null); // 'patoloji'|'frozen'|'kan'
  const [istemOncelik, setIstemOncelik] = useState('rutin');
  const [patTip, setPatTip]           = useState(PATOLOJI_TIPLER[0]);
  const [patKlinik, setPatKlinik]     = useState('');
  const [frDoku, setFrDoku]           = useState(FROZEN_DOKULARI[0]);
  const [frAdet, setFrAdet]           = useState(1);
  const [frKlinik, setFrKlinik]       = useState('');
  const [kanSecili, setKanSecili]     = useState([]);
  const [kanNot, setKanNot]           = useState('');

  // İmplant state
  const [implantlar, setImplantlar]   = useState([]);
  const [implantForm, setImplantForm] = useState({ ad:'', tip:IMPLANT_TIPLER[0], marka:'', model:'', seri:'', boyut:'', not:'' });
  const [implantAcik, setImplantAcik] = useState(false);
  const inf = (k,v) => setImplantForm(p=>({...p,[k]:v}));

  // Medya state — kaydedilince surgeries store'una yazılır, kalıcı kalır.
  const [medya, setMedya]             = useState(s?.medya || []);
  const [ekipState, setEkipState]     = useState(() => ({...(s?.ekip||{})}));
  const [atamaModal, setAtamaModal]   = useState(null); // aktif roleKey
  // Eski kod `{ekip: yeniEkip}` ile PUT /ameliyatlar/:id çağırıyordu (nonexistent
  // route). Backend ekip ataması/çıkarmayı kişi bazlı ayrı uçlardan yapıyor, o
  // yüzden yeni/eski ekip haritası karşılaştırılıp değişen her rol için ayrı
  // assignTeamMember/removeTeamMember çağrılır. PERSONEL şu an backend'de
  // /personel ucu bulunmadığı için genelde App.jsx'in seed/mock verisinde kalıyor
  // — bu durumda eşleşme bulunamayan roller sessizce atlanır (ayrı, bu planın
  // kapsamı dışında bir personel-kablolama sorunu).
  async function ekipKaydet(yeniEkip, eskiEkip) {
    for (const [roleKey, ad] of Object.entries(yeniEkip)) {
      if (!ad || ad === '—') continue;
      const eskiAd = eskiEkip?.[roleKey];
      if (eskiAd === ad) continue;
      const eskiPersonel = eskiAd ? PERSONEL.find(p => p.ad === eskiAd) : null;
      if (eskiPersonel) await removeTeamMember(s.id, eskiPersonel.id);
      const yeniPersonel = PERSONEL.find(p => p.ad === ad);
      if (yeniPersonel) await assignTeamMember(s.id, yeniPersonel.id, roleKey);
    }
    updateSurgery(s.id, { ekip: yeniEkip });
  }
  function onEkipSelect(roleKey, ad) { const eski = ekipState; const yeni = {...ekipState,[roleKey]:ad}; setEkipState(yeni); ekipKaydet(yeni, eski); setAtamaModal(null); showToast(EKIP_LABELS_AD[roleKey]+` → ${ad} atandı ✓`); }
  const [medyaKayit, setMedyaKayit]   = useState(false);
  const fileRef                       = useRef(null);

  function addIstem(istem) {
    setIstemler(p => [{ ...istem, id:Date.now(), tarih:nowStr(), durum:'bekliyor' }, ...p]);
    setIstemModal(null);
    showToast(`${istem.baslik} istemi oluşturuldu ✓`);
  }
  function iptalIstem(id) { setIstemler(p => p.map(x => x.id===id?{...x,durum:'iptal'}:x)); }

  function toggleKan(t) { setKanSecili(p => p.includes(t)?p.filter(x=>x!==t):[...p,t]); }

  function addImplant() {
    if (!implantForm.ad.trim()) { showToast('İmplant adı zorunlu'); return; }
    setImplantlar(p => [...p, { ...implantForm, id:Date.now(), tarih:nowStr() }]);
    setImplantForm({ ad:'', tip:IMPLANT_TIPLER[0], marka:'', model:'', seri:'', boyut:'', not:'' });
    setImplantAcik(false);
    showToast('İmplant kaydedildi ✓');
  }

  function handleFiles(files) {
    const yeni = [...files].map(f => ({ id:Date.now()+Math.random(), ad:f.name, tip:f.type.startsWith('video')?'video':'foto', boyut:(f.size/1024/1024).toFixed(1)+'MB', url:URL.createObjectURL(f) }));
    setMedya(p => [...p, ...yeni]);
    setMedyaKayit(false);
    showToast(`${yeni.length} dosya eklendi ✓`);
  }

  function medyaKaydet() {
    updateSurgery(s.id, { medya });
    setMedyaKayit(true);
    showToast('Medya kaydedildi ✓');
    setTimeout(() => setMedyaKayit(false), 3000);
  }

  function notKaydet() {
    setNotKayit(true);
    showToast('Ameliyat notları kaydedildi ✓');
    setTimeout(() => setNotKayit(false), 3000);
  }

  if (!s) return <div style={{ padding:40, textAlign:'center', color:'var(--slate-light)' }}>Ameliyat bulunamadı</div>;

  const dcfg = DURUM_CFG[s.durum] || DURUM_CFG['Bekliyor'];
  async function durumGuncelle(yeniDurum) {
    const sonuc = await updateSurgeryStatus(s.id, STATUS_TO_BACKEND[yeniDurum]);
    if (!sonuc) { showToast('Hata'); return; }
    updateSurgery(s.id, { durum: yeniDurum, st: yeniDurum==='Devam Ediyor'?'dot-active':yeniDurum==='Tamamlandi'?'dot-done':'dot-wait' });
    showToast('Durum guncellendi');
  }
  const ekipRows = Object.entries(s.ekip||{}).map(([key,val]) => ({ key, role:EKIP_LABELS[key]||key, name:val, color:EKIP_COLORS[key]||'#94A3B8' })).filter(r=>r.name&&r.name!=='—');

  return (
    <div style={{ display:'flex', flexDirection:'column' }}>

      {/* Başlık */}
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
        <button onClick={() => navigate(-1)} style={{ width:34, height:34, borderRadius:9, border:'1px solid var(--border)', background:'var(--surface)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--slate)" strokeWidth="2.5" style={{width:14,height:14}}><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
            <div style={{ fontSize:18, fontWeight:900, color:'var(--slate)', fontFamily:"'Outfit',sans-serif", letterSpacing:'-0.5px' }}>{s.op}</div>
            <span className={`tag ${dcfg.tag}`} style={{fontSize:'9.5px'}}>{s.durum}</span>
          </div>
          <div style={{ fontSize:11.5, color:'var(--slate-light)' }}>{s.hasta} · {s.saat}–{s.bitis} · {s.salon} · {s.dr}</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <select
            value={s.durum||'Bekliyor'}
            onChange={e=>durumGuncelle(e.target.value)}
            style={{padding:'6px 10px',borderRadius:8,border:'1px solid var(--border)',background:'var(--surface)',color:'var(--slate)',fontSize:12,fontWeight:600,cursor:'pointer'}}>
            <option>Bekliyor</option>
            <option>Devam Ediyor</option>
            <option>Tamamlandi</option>
            <option>Iptal</option>
          </select>
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>🖨 Yazdır</button>
          <button className="btn btn-primary btn-sm" onClick={() => showToast('PDF oluşturuluyor…')}>📄 PDF</button>
        </div>
      </div>

      {/* Durum çubuğu */}
      <div style={{ height:3, background:`linear-gradient(90deg,${dcfg.bar},${dcfg.bar}66,transparent)`, borderRadius:2, marginBottom:16 }}/>

      {/* Tab bar */}
      <div style={{ display:'flex', gap:2, background:'var(--surface)', borderRadius:12, padding:4, marginBottom:16, flexWrap:'wrap', border:'1px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            style={{ padding:'7px 14px', borderRadius:9, border:'none', cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:'var(--font)', transition:'all 0.15s', whiteSpace:'nowrap',
              background: tab===t.k ? 'var(--card-bg)' : 'transparent',
              color:      tab===t.k ? 'var(--teal)'    : 'var(--slate-mid)',
              boxShadow:  tab===t.k ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
            {t.lbl}
            {t.k==='istem'  && istemler.length>0  && <span style={{marginLeft:5,fontSize:9,padding:'1px 5px',borderRadius:10,background:'#7C3AED',color:'white'}}>{istemler.length}</span>}
            {t.k==='implant'&& implantlar.length>0 && <span style={{marginLeft:5,fontSize:9,padding:'1px 5px',borderRadius:10,background:'#059669',color:'white'}}>{implantlar.length}</span>}
            {t.k==='medya'  && medya.length>0      && <span style={{marginLeft:5,fontSize:9,padding:'1px 5px',borderRadius:10,background:'#0284C7',color:'white'}}>{medya.length}</span>}
          </button>
        ))}
      </div>

      {/* ── HASTA KARTI ── */}
      {tab==='hasta' && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          <div className="panel">
            <div className="panel-hd"><span className="panel-title">👤 Hasta Bilgileri</span></div>
            <div style={{padding:'14px 18px'}}>
              <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:14,padding:'12px 14px',background:'linear-gradient(135deg,rgba(20,184,166,0.08),rgba(2,132,199,0.06))',borderRadius:11,border:'1px solid rgba(20,184,166,0.15)'}}>
                <div style={{width:44,height:44,borderRadius:'50%',background:'var(--teal)',color:'white',fontSize:16,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontFamily:"'Outfit',sans-serif"}}>{mkAv(h.ad||s.hasta)}</div>
                <div>
                  <div style={{fontSize:14,fontWeight:800,color:'var(--slate)',fontFamily:"'Outfit',sans-serif"}}>{h.ad||s.hasta}</div>
                  <div style={{fontSize:11,color:'var(--slate-light)',marginTop:2}}>{h.yas&&`${h.yas} yaş · `}{h.cinsiyet} {h.kan&&`· 🩸 ${h.kan}`}</div>
                  <div style={{marginTop:5,display:'flex',gap:5}}><span className="tag t-blue" style={{fontSize:9}}>{s.anestezi||'Genel Anestezi'}</span>{h.asaSkor&&<span className="tag t-teal" style={{fontSize:9}}>{h.asaSkor}</span>}</div>
                </div>
              </div>
              {[['TC Kimlik',h.tc],['Telefon',h.tel],['Kan Grubu',h.kan],['ASA Skoru',h.asaSkor],['Alerjiler',h.alerjiler],['Tanı',h.tani]].filter(([,v])=>v).map(([l,v])=>(
                <div key={l} style={{display:'flex',padding:'7px 0',borderBottom:'1px solid var(--border)',fontSize:12.5}}>
                  <span style={{color:'var(--slate-light)',width:110,flexShrink:0,fontWeight:600}}>{l}</span>
                  <span style={{fontWeight:600,color:l==='Alerjiler'&&v!=='Yok'?'var(--warning)':l==='Kan Grubu'?'var(--danger)':'var(--slate)'}}>{v||'—'}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <div className="panel-hd"><span className="panel-title">🏥 Ameliyat Bilgileri</span></div>
            <div style={{padding:'14px 18px'}}>
              {[['Operasyon',s.op],['Tarih',s.tarih||'15.06.2025'],['Saat',`${s.saat} – ${s.bitis}`],['Salon',s.salon],['Süre',`${s.sure||90} dk`],['Anestezi',s.anestezi],['Cerrah',s.dr]].filter(([,v])=>v).map(([l,v])=>(
                <div key={l} style={{display:'flex',padding:'7px 0',borderBottom:'1px solid var(--border)',fontSize:12.5}}>
                  <span style={{color:'var(--slate-light)',width:100,flexShrink:0,fontWeight:600}}>{l}</span>
                  <span style={{fontWeight:600,color:'var(--slate)'}}>{v}</span>
                </div>
              ))}
              {h.notlar&&<div style={{marginTop:14,background:'rgba(217,119,6,0.06)',border:'1px solid rgba(217,119,6,0.2)',borderRadius:9,padding:'10px 13px',fontSize:12,color:'var(--slate-mid)',lineHeight:1.65}}><span style={{fontWeight:700,color:'#D97706'}}>Not: </span>{h.notlar}</div>}
            </div>
          </div>
        </div>
      )}

      {/* ── CERRAHİ EKİP ── */}
      {tab==='ekip' && (
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div className="panel">
            <div className="panel-hd">
              <span className="panel-title">👥 Cerrahi Ekip</span>
              {isHemsire && <span style={{fontSize:10,color:'var(--slate-light)'}}>Hemşire & personel kartlarında Değiştir butonuna tıklayın</span>}
            </div>
            <div style={{padding:'14px 18px',display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:10}}>
              {ekipRows.map(r=>{
                const canChange = isHemsire && ATANABILIR_HEMSIRE.includes(r.key);
                const displayName = ekipState[r.key] && ekipState[r.key]!=='—' ? ekipState[r.key] : r.name;
                const clr = EKIP_COLORS_AD[r.key] || r.color;
                return (
                  <div key={r.key} style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',background:'var(--surface)',border:`1px solid ${canChange?'var(--teal-mid)':'var(--border)'}`,borderRadius:11,position:'relative'}}>
                    <div style={{width:36,height:36,borderRadius:'50%',background:clr,color:'white',fontSize:12,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{mkAv(displayName)}</div>
                    <div style={{minWidth:0,flex:1}}>
                      <div style={{fontSize:12.5,fontWeight:700,color:'var(--slate)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{displayName}</div>
                      <div style={{fontSize:10,color:'var(--slate-light)',marginTop:1}}>{EKIP_LABELS_AD[r.key]||r.role}</div>
                    </div>
                    {canChange && (
                      <button className="btn btn-secondary btn-sm" style={{fontSize:'9.5px',flexShrink:0,padding:'4px 8px'}} onClick={()=>setAtamaModal(r.key)}>
                        Değiştir
                      </button>
                    )}
                  </div>
                );
              })}
              {ekipRows.length===0&&<div style={{gridColumn:'1/-1',textAlign:'center',padding:28,color:'var(--slate-light)',fontSize:12}}>Ekip atanmadı</div>}
            </div>
            {isHemsire && (
              <div style={{padding:'0 18px 14px',display:'flex',justifyContent:'flex-end'}}>
                <button className="btn btn-primary btn-sm" onClick={()=>{ekipKaydet(ekipState, s.ekip);showToast('Ekip kaydedildi')}}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:12,height:12}}><polyline points="20 6 9 17 4 12"/></svg>
                  Atamaları Kaydet
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ekip Atama Modalı */}
      {atamaModal && (() => {
        const filtre = ROL_FILTRELERI_AD[atamaModal] || [];
        const adaylar = PERSONEL.filter(p => filtre.includes(p.rol) && p.durum === 'Aktif');
        const mevcutAd = ekipState[atamaModal] || '';
        return (
          <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.55)',zIndex:1200,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)'}} onClick={()=>setAtamaModal(null)}>
            <div style={{background:'var(--card-bg)',borderRadius:16,width:400,maxWidth:'94vw',boxShadow:'0 24px 64px rgba(0,0,0,0.22)',overflow:'hidden'}} onClick={e=>e.stopPropagation()}>
              <div style={{background:'linear-gradient(135deg,#7C3AED,#6366F1,#0891b2)',padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:'white'}}>{EKIP_LABELS_AD[atamaModal]} Değiştir</div>
                  <div style={{fontSize:11,color:'rgba(255,255,255,0.7)',marginTop:2}}>Atamak istediğiniz personeli seçin</div>
                </div>
                <div style={{width:28,height:28,borderRadius:8,background:'rgba(255,255,255,0.15)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}} onClick={()=>setAtamaModal(null)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" style={{width:14,height:14}}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </div>
              </div>
              <div style={{padding:'12px 16px',maxHeight:340,overflowY:'auto'}}>
                {adaylar.length === 0 && <div style={{textAlign:'center',padding:24,fontSize:12,color:'var(--slate-light)'}}>Uygun personel bulunamadı</div>}
                {adaylar.map(p => {
                  const secili = mevcutAd === p.ad;
                  return (
                    <div key={p.id} onClick={()=>onEkipSelect(atamaModal,p.ad)}
                      style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:10,cursor:'pointer',marginBottom:4,background:secili?'rgba(20,184,166,0.08)':'transparent',border:`1px solid ${secili?'var(--teal-mid)':'var(--border)'}`,transition:'all 0.12s'}}>
                      <div style={{width:36,height:36,borderRadius:'50%',background:p.bg,color:'white',fontSize:12,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{p.av}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,color:'var(--slate)'}}>{p.ad}</div>
                        <div style={{fontSize:10,color:'var(--slate-light)',marginTop:1}}>{p.rol} · {p.uzmanlik||'—'}</div>
                      </div>
                      {secili && <svg viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.5" style={{width:16,height:16,flexShrink:0}}><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── SETLER & MALZEME ── */}
      {tab==='setler' && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14}}>
          {[
            {title:'🛡 Cerrahi Setler', items:s.setler||[], renk:'var(--teal)',   tag:'t-teal'  },
            {title:'📦 Tıbbi Malzeme',  items:s.malzeme||[],renk:'#0284C7',      tag:'t-blue'  },
            {title:'🖥 Cihaz & Ekipman',items:s.cihaz||[], renk:'#EA580C',       tag:'t-orange'},
          ].map(({title,items,renk,tag})=>(
            <div key={title} className="panel">
              <div className="panel-hd"><span className="panel-title">{title}</span><span style={{fontSize:11,color:'var(--slate-light)'}}>{items.length} kalem</span></div>
              <div style={{padding:'8px 14px'}}>
                {items.length===0?<div style={{textAlign:'center',padding:20,color:'var(--slate-light)',fontSize:12}}>Kayıt yok</div>
                :items.map((item,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 0',borderBottom:'1px solid var(--border)'}}>
                    <div style={{width:6,height:6,borderRadius:'50%',background:renk,flexShrink:0}}/>
                    <span style={{fontSize:12,color:'var(--slate)',flex:1}}>{item}</span>
                    <span className={`tag ${tag}`} style={{fontSize:8}}>✓</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── İLAÇLAR ── */}
      {tab==='ilac' && (
        <div className="panel">
          <div className="panel-hd"><span className="panel-title">💊 İlaçlar & Anestezi Ajanları</span></div>
          <div style={{padding:'14px 18px'}}>
            {h.alerjiler&&h.alerjiler!=='Yok'&&(
              <div style={{background:'rgba(220,38,38,0.07)',border:'1.5px solid rgba(220,38,38,0.25)',borderRadius:10,padding:'11px 14px',marginBottom:14,display:'flex',alignItems:'center',gap:10}}>
                <span style={{fontSize:20}}>⚠️</span>
                <div><div style={{fontSize:12,fontWeight:700,color:'var(--danger)'}}>ALERJİ UYARISI</div><div style={{fontSize:11,color:'#7F1D1D',marginTop:1}}><strong>{h.alerjiler}</strong> — uygulama öncesi kontrol edilmeli</div></div>
              </div>
            )}
            <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
              {(s.ilac||[]).map((ilac,i)=>(
                <div key={i} style={{padding:'7px 14px',borderRadius:20,background:'rgba(124,58,237,0.08)',border:'1.5px solid rgba(124,58,237,0.2)',fontSize:12,fontWeight:600,color:'#7C3AED'}}>💊 {ilac}</div>
              ))}
              {(!s.ilac||s.ilac.length===0)&&<div style={{padding:28,color:'var(--slate-light)',fontSize:12}}>İlaç kaydı yok</div>}
            </div>
            {s.lokalProtokol&&(
              <div style={{marginTop:14,background:'rgba(20,184,166,0.05)',border:'1.5px solid rgba(20,184,166,0.2)',borderRadius:10,padding:'14px 16px',fontSize:13,color:'var(--slate)',lineHeight:1.7,whiteSpace:'pre-wrap'}}>{s.lokalProtokol}</div>
            )}
          </div>
        </div>
      )}

      {/* ── AMELİYAT NOTLARI ── */}
      {tab==='notlar' && (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {NOT_ALANLARI.map(a => {
            const dolu = notlar[a.k]?.trim().length > 0;
            const acik = acikAlan === a.k;
            return (
              <div key={a.k} style={{ border:`1.5px solid ${acik?'var(--teal)':'var(--border)'}`, borderRadius:12, overflow:'hidden', transition:'border-color 0.15s' }}>
                <div onClick={() => setAcikAlan(acik ? '' : a.k)}
                  style={{ display:'flex', alignItems:'center', gap:9, padding:'11px 14px', cursor:'pointer', background: acik ? 'rgba(20,184,166,0.05)' : 'var(--surface)' }}>
                  <span style={{ fontSize:15 }}>{a.icon}</span>
                  <span style={{ fontSize:12.5, fontWeight:700, color:'var(--slate)', flex:1 }}>{a.lbl}</span>
                  {dolu && <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--teal)' }}/>}
                  <span style={{ fontSize:11, color:'var(--slate-light)', transform: acik ? 'rotate(180deg)' : 'none', transition:'transform 0.15s' }}>▼</span>
                </div>
                {acik && (
                  <textarea
                    value={notlar[a.k] || ''}
                    onChange={e => setNotlar(p => ({...p, [a.k]:e.target.value}))}
                    placeholder={a.placeholder}
                    rows={4}
                    style={{ width:'100%', border:'none', borderTop:'1px solid var(--border)', padding:'12px 14px', fontSize:12.5, lineHeight:1.65, color:'var(--slate)', background:'var(--input-bg)', resize:'vertical', outline:'none', fontFamily:"'Inter',sans-serif", boxSizing:'border-box' }}
                  />
                )}
              </div>
            );
          })}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:6}}>
            <span style={{fontSize:11,color:'var(--slate-light)'}}>{Object.values(notlar).filter(v=>v.trim()).length}/{NOT_ALANLARI.length} alan dolduruldu</span>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              {notKayit&&<span style={{fontSize:11,color:'var(--success)',fontWeight:600,display:'flex',alignItems:'center',gap:5}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:13,height:13}}><polyline points="20 6 9 17 4 12"/></svg>Kaydedildi</span>}
              <button className="btn btn-primary" onClick={notKaydet}>💾 Notları Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ÖRNEK İSTEMLERİ ── */}
      {tab==='istem' && (
        <div>
          <div style={{display:'flex',gap:8,marginBottom:14}}>
            <button className="btn btn-secondary" onClick={()=>{setIstemModal('patoloji');setPatTip(PATOLOJI_TIPLER[0]);setPatKlinik('');setIstemOncelik('rutin');}}>🔬 Patoloji İste</button>
            <button className="btn btn-secondary" onClick={()=>{setIstemModal('frozen');setFrDoku(FROZEN_DOKULARI[0]);setFrKlinik('');setFrAdet(1);setIstemOncelik('stat');}}>🧊 Frozen İste</button>
            <button className="btn btn-primary"   onClick={()=>{setIstemModal('kan');setKanSecili([]);setIstemOncelik('rutin');setKanNot('');}}>🩸 Kan Testi İste</button>
          </div>

          {istemler.length===0 ? (
            <div style={{background:'var(--card-bg)',border:'1px solid var(--border)',borderRadius:14,padding:48,textAlign:'center'}}>
              <div style={{fontSize:36,marginBottom:10}}>🔬</div>
              <div style={{fontSize:14,fontWeight:700,color:'var(--slate)',marginBottom:6}}>Henüz örnek istemi yok</div>
              <div style={{fontSize:12,color:'var(--slate-light)'}}>Yukarıdaki butonlarla yeni istem oluşturun</div>
            </div>
          ) : istemler.map(istem=>{
            const onc = ONCELIK.find(o=>o.k===istem.oncelik)||ONCELIK[0];
            return (
              <div key={istem.id} style={{background:'var(--card-bg)',border:`1.5px solid ${onc.renk}33`,borderLeft:`3px solid ${onc.renk}`,borderRadius:11,padding:'13px 16px',marginBottom:10}}>
                <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
                  <div style={{fontSize:22,flexShrink:0}}>{istem.tip==='patoloji'?'🔬':istem.tip==='frozen'?'🧊':'🩸'}</div>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:4,flexWrap:'wrap'}}>
                      <div style={{fontSize:13,fontWeight:700,color:'var(--slate)'}}>{istem.baslik}</div>
                      <span style={{fontSize:9,padding:'2px 8px',borderRadius:20,background:onc.bg,color:onc.renk,fontWeight:700}}>{onc.lbl}</span>
                      <span className={`tag ${istem.durum==='bekliyor'?'t-orange':istem.durum==='iptal'?'t-gray':'t-green'}`} style={{fontSize:8}}>{istem.durum}</span>
                    </div>
                    <div style={{fontSize:10.5,color:'var(--slate-light)',marginBottom:4}}>{istem.tarih}</div>
                    {istem.ornekler?.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:4}}>{istem.ornekler.map((o,i)=><span key={i} style={{fontSize:10,padding:'2px 8px',borderRadius:20,background:'var(--surface)',border:'1px solid var(--border)',color:'var(--slate-mid)'}}>{o}</span>)}</div>}
                    {istem.klinikBilgi&&<div style={{fontSize:11,color:'var(--slate-mid)',marginTop:4,fontStyle:'italic'}}>"{istem.klinikBilgi}"</div>}
                  </div>
                  {istem.durum==='bekliyor'&&<button onClick={()=>iptalIstem(istem.id)} style={{fontSize:10,padding:'3px 9px',borderRadius:6,border:'1px solid #FECACA',background:'#FEF2F2',color:'#DC2626',cursor:'pointer',fontFamily:'var(--font)',fontWeight:600}}>İptal</button>}
                </div>
              </div>
            );
          })}

          {/* Patoloji Modal */}
          {istemModal==='patoloji'&&(
            <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.6)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)'}} onClick={()=>setIstemModal(null)}>
              <div style={{background:'var(--card-bg)',borderRadius:18,width:500,maxWidth:'95vw',overflow:'hidden',boxShadow:'0 24px 64px rgba(0,0,0,0.25)'}} onClick={e=>e.stopPropagation()}>
                <div style={{background:'linear-gradient(135deg,#059669,#0891b2)',padding:'16px 22px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div style={{fontSize:15,fontWeight:700,color:'white'}}>🔬 Patoloji İstemi</div>
                  <div onClick={()=>setIstemModal(null)} style={{color:'rgba(255,255,255,0.7)',cursor:'pointer',fontSize:20,lineHeight:1,width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:6}} onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,0.1)'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>✕</div>
                </div>
                <div style={{padding:'20px 22px',display:'flex',flexDirection:'column',gap:12}}>
                  <div className="fg"><label className="fl">Patoloji Tipi</label><select className="fi" value={patTip} onChange={e=>setPatTip(e.target.value)}>{PATOLOJI_TIPLER.map(t=><option key={t}>{t}</option>)}</select></div>
                  <div><label className="fl" style={{display:'block',marginBottom:6}}>Öncelik</label><OncelikSec val={istemOncelik} onChange={setIstemOncelik}/></div>
                  <div className="fg"><label className="fl">Klinik Bilgi / Ön Tanı</label><textarea className="fi" rows={3} value={patKlinik} onChange={e=>setPatKlinik(e.target.value)} placeholder="Klinik bilgi, histopatoloji beklentisi…" style={{resize:'none'}}/></div>
                </div>
                <div style={{padding:'14px 22px',borderTop:'1px solid var(--border)',display:'flex',gap:8,justifyContent:'flex-end',background:'var(--surface)'}}>
                  <button className="btn btn-secondary" onClick={()=>setIstemModal(null)}>İptal</button>
                  <button className="btn btn-primary" onClick={()=>addIstem({tip:'patoloji',baslik:patTip,ornekler:[],klinikBilgi:patKlinik,oncelik:istemOncelik})}>İstem Gönder</button>
                </div>
              </div>
            </div>
          )}

          {/* Frozen Modal */}
          {istemModal==='frozen'&&(
            <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.6)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)'}} onClick={()=>setIstemModal(null)}>
              <div style={{background:'var(--card-bg)',borderRadius:18,width:480,maxWidth:'95vw',overflow:'hidden',boxShadow:'0 24px 64px rgba(0,0,0,0.25)'}} onClick={e=>e.stopPropagation()}>
                <div style={{background:'linear-gradient(135deg,#0284C7,#6366F1)',padding:'16px 22px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div style={{fontSize:15,fontWeight:700,color:'white'}}>🧊 Frozen İstemi</div>
                  <div onClick={()=>setIstemModal(null)} style={{color:'rgba(255,255,255,0.7)',cursor:'pointer',fontSize:20,lineHeight:1,width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:6}} onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,0.1)'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>✕</div>
                </div>
                <div style={{padding:'20px 22px',display:'flex',flexDirection:'column',gap:12}}>
                  <div style={{background:'rgba(2,132,199,0.07)',border:'1px solid rgba(2,132,199,0.2)',borderRadius:9,padding:'9px 13px',fontSize:11.5,color:'#0284C7',fontWeight:600}}>⚡ Frozen intraoperatif yapılır — sonuç ameliyat sırasında bildirilir</div>
                  <div className="fr">
                    <div className="fg"><label className="fl">Doku Tipi</label><select className="fi" value={frDoku} onChange={e=>setFrDoku(e.target.value)}>{FROZEN_DOKULARI.map(d=><option key={d}>{d}</option>)}</select></div>
                    <div className="fg" style={{maxWidth:90}}><label className="fl">Parça Adedi</label><input className="fi" type="number" min={1} max={10} value={frAdet} onChange={e=>setFrAdet(e.target.value)}/></div>
                  </div>
                  <div><label className="fl" style={{display:'block',marginBottom:6}}>Öncelik</label><OncelikSec val={istemOncelik} onChange={setIstemOncelik}/></div>
                  <div className="fg"><label className="fl">Klinik Soru</label><textarea className="fi" rows={2} value={frKlinik} onChange={e=>setFrKlinik(e.target.value)} placeholder="Patoloji uzmanına iletilecek klinik soru…" style={{resize:'none'}}/></div>
                </div>
                <div style={{padding:'14px 22px',borderTop:'1px solid var(--border)',display:'flex',gap:8,justifyContent:'flex-end',background:'var(--surface)'}}>
                  <button className="btn btn-secondary" onClick={()=>setIstemModal(null)}>İptal</button>
                  <button className="btn btn-primary" style={{background:'#0284C7',borderColor:'#0284C7'}} onClick={()=>addIstem({tip:'frozen',baslik:`Frozen: ${frDoku} (${frAdet} parça)`,ornekler:[frDoku],klinikBilgi:frKlinik,oncelik:istemOncelik})}>Frozen İste</button>
                </div>
              </div>
            </div>
          )}

          {/* Kan Modal */}
          {istemModal==='kan'&&(
            <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.6)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)'}} onClick={()=>setIstemModal(null)}>
              <div style={{background:'var(--card-bg)',borderRadius:18,width:560,maxWidth:'95vw',overflow:'hidden',boxShadow:'0 24px 64px rgba(0,0,0,0.25)'}} onClick={e=>e.stopPropagation()}>
                <div style={{background:'linear-gradient(135deg,#DC2626,#7C3AED)',padding:'16px 22px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div style={{fontSize:15,fontWeight:700,color:'white'}}>🩸 Kan Testi İstemi</div>
                  <div onClick={()=>setIstemModal(null)} style={{color:'rgba(255,255,255,0.7)',cursor:'pointer',fontSize:20,lineHeight:1,width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:6}} onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,0.1)'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>✕</div>
                </div>
                <div style={{padding:'20px 22px',display:'flex',flexDirection:'column',gap:12}}>
                  <div><label className="fl" style={{display:'block',marginBottom:6}}>Öncelik</label><OncelikSec val={istemOncelik} onChange={setIstemOncelik}/></div>
                  <div>
                    <label className="fl" style={{display:'block',marginBottom:8}}>Testler <span style={{color:'var(--teal)',fontWeight:700}}>({kanSecili.length} seçili)</span></label>
                    <div style={{maxHeight:240,overflowY:'auto',display:'flex',flexDirection:'column',gap:10}}>
                      {Object.entries(KAN_TESTLERI).map(([grup,testler])=>(
                        <div key={grup}>
                          <div style={{fontSize:10,fontWeight:700,color:'var(--slate-light)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:5}}>{grup}</div>
                          <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                            {testler.map(t=>{const sec=kanSecili.includes(t);return(
                              <div key={t} onClick={()=>toggleKan(t)} style={{padding:'4px 11px',borderRadius:20,cursor:'pointer',fontSize:11,fontWeight:600,border:`1.5px solid ${sec?'var(--teal)':'var(--border)'}`,background:sec?'rgba(20,184,166,0.1)':'var(--surface)',color:sec?'var(--teal)':'var(--slate-mid)',transition:'all 0.12s'}}>
                                {sec&&'✓ '}{t}
                              </div>
                            );})}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="fg"><label className="fl">Ek Not</label><input className="fi" value={kanNot} onChange={e=>setKanNot(e.target.value)} placeholder="Özel talimat, örnek alma zamanı…"/></div>
                </div>
                <div style={{padding:'14px 22px',borderTop:'1px solid var(--border)',display:'flex',gap:8,justifyContent:'flex-end',background:'var(--surface)'}}>
                  <button className="btn btn-secondary" onClick={()=>setIstemModal(null)}>İptal</button>
                  <button className="btn btn-primary" style={{background:'#DC2626',borderColor:'#DC2626'}} onClick={()=>{if(!kanSecili.length){showToast('En az bir test seçin');return;}addIstem({tip:'kan',baslik:`Kan Testleri (${kanSecili.length} test)`,ornekler:kanSecili,klinikBilgi:kanNot,oncelik:istemOncelik});}}>İstem Gönder</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── İMPLANTLAR ── */}
      {tab==='implant' && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:14}}>
            <button className="btn btn-primary" onClick={()=>setImplantAcik(p=>!p)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:13,height:13}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              İmplant Ekle
            </button>
          </div>

          {implantAcik&&(
            <div className="panel" style={{marginBottom:14}}>
              <div className="panel-hd"><span className="panel-title">🔩 Yeni İmplant Kaydı</span></div>
              <div style={{padding:'16px 18px',display:'flex',flexDirection:'column',gap:12}}>
                <div className="fr">
                  <div className="fg"><label className="fl">İmplant Adı *</label><input className="fi" value={implantForm.ad} onChange={e=>inf('ad',e.target.value)} placeholder="Total Kalça Protezi…" autoFocus/></div>
                  <div className="fg"><label className="fl">Tip</label><select className="fi" value={implantForm.tip} onChange={e=>inf('tip',e.target.value)}>{IMPLANT_TIPLER.map(t=><option key={t}>{t}</option>)}</select></div>
                </div>
                <div className="fr">
                  <div className="fg"><label className="fl">Marka</label><input className="fi" value={implantForm.marka} onChange={e=>inf('marka',e.target.value)} placeholder="Zimmer Biomet, Stryker…"/></div>
                  <div className="fg"><label className="fl">Model</label><input className="fi" value={implantForm.model} onChange={e=>inf('model',e.target.value)} placeholder="Model adı…"/></div>
                </div>
                <div className="fr">
                  <div className="fg"><label className="fl">Seri / Lot No</label><input className="fi" value={implantForm.seri} onChange={e=>inf('seri',e.target.value)} placeholder="SN-2025-XXXXX"/></div>
                  <div className="fg"><label className="fl">Boyut / Numara</label><input className="fi" value={implantForm.boyut} onChange={e=>inf('boyut',e.target.value)} placeholder="Size 5, 22mm…"/></div>
                </div>
                <div className="fg"><label className="fl">Not</label><input className="fi" value={implantForm.not} onChange={e=>inf('not',e.target.value)} placeholder="Ek bilgi…"/></div>
                <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                  <button className="btn btn-secondary" onClick={()=>setImplantAcik(false)}>İptal</button>
                  <button className="btn btn-primary" onClick={addImplant}>Kaydet ✓</button>
                </div>
              </div>
            </div>
          )}

          {implantlar.length===0&&!implantAcik?(
            <div style={{background:'var(--card-bg)',border:'1px solid var(--border)',borderRadius:14,padding:48,textAlign:'center'}}>
              <div style={{fontSize:36,marginBottom:10}}>🔩</div>
              <div style={{fontSize:14,fontWeight:700,color:'var(--slate)',marginBottom:6}}>İmplant kaydı yok</div>
              <div style={{fontSize:12,color:'var(--slate-light)'}}>Bu ameliyatta kullanılan implantları kaydedin</div>
            </div>
          ):implantlar.map(imp=>(
            <div key={imp.id} style={{background:'var(--card-bg)',border:'1.5px solid rgba(5,150,105,0.25)',borderLeft:'3px solid #059669',borderRadius:11,padding:'13px 16px',marginBottom:10}}>
              <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
                <div style={{width:36,height:36,borderRadius:9,background:'rgba(5,150,105,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>🔩</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:'var(--slate)',marginBottom:3}}>{imp.ad}</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:4}}>
                    <span className="tag t-teal" style={{fontSize:9}}>{imp.tip}</span>
                    {imp.marka&&<span style={{fontSize:10,color:'var(--slate-light)'}}>{imp.marka}{imp.model&&' — '+imp.model}</span>}
                  </div>
                  <div style={{display:'flex',gap:12,fontSize:11,color:'var(--slate-light)',flexWrap:'wrap'}}>
                    {imp.seri&&<span>SN: {imp.seri}</span>}
                    {imp.boyut&&<span>Boyut: {imp.boyut}</span>}
                    <span>{imp.tarih}</span>
                  </div>
                  {imp.not&&<div style={{marginTop:5,fontSize:11,color:'var(--slate-mid)',fontStyle:'italic'}}>{imp.not}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MEDYA ── */}
      {tab==='medya' && (
        <div>
          {medya.length===0 ? (
            /* Yükleme alanı — büyük, boş durumda */
            <div style={{border:'2px dashed var(--border)',borderRadius:14,padding:'28px 24px',textAlign:'center',marginBottom:16,cursor:'pointer',transition:'all 0.15s',background:'var(--surface)'}}
              onClick={()=>fileRef.current?.click()}
              onMouseOver={e=>{e.currentTarget.style.borderColor='var(--teal)';e.currentTarget.style.background='rgba(20,184,166,0.04)';}}
              onMouseOut={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--surface)';}}>
              <div style={{fontSize:40,marginBottom:8}}>📸</div>
              <div style={{fontSize:14,fontWeight:700,color:'var(--slate)',marginBottom:4}}>Fotoğraf veya Video Ekle</div>
              <div style={{fontSize:12,color:'var(--slate-light)',marginBottom:12}}>JPG, PNG, MP4, MOV — Sürükle bırak veya tıkla</div>
              <button className="btn btn-secondary btn-sm" style={{pointerEvents:'none'}}>Dosya Seç</button>
              <input ref={fileRef} type="file" multiple accept="image/*,video/*" style={{display:'none'}} onChange={e=>handleFiles(e.target.files)}/>
            </div>
          ) : (
            <>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12,marginBottom:16}}>
                {/* Yükleme alanı — küçük, grid kartı boyutunda */}
                <div style={{border:'2px dashed var(--border)',borderRadius:11,height:110,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',cursor:'pointer',transition:'all 0.15s',background:'var(--surface)',gap:5}}
                  onClick={()=>fileRef.current?.click()}
                  onMouseOver={e=>{e.currentTarget.style.borderColor='var(--teal)';e.currentTarget.style.background='rgba(20,184,166,0.04)';}}
                  onMouseOut={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--surface)';}}>
                  <div style={{fontSize:22,color:'var(--slate-light)'}}>＋</div>
                  <div style={{fontSize:10.5,fontWeight:600,color:'var(--slate-mid)'}}>Ekle</div>
                  <input ref={fileRef} type="file" multiple accept="image/*,video/*" style={{display:'none'}} onChange={e=>handleFiles(e.target.files)}/>
                </div>

                {medya.map(m=>(
                  <div key={m.id} style={{background:'var(--card-bg)',border:'1px solid var(--border)',borderRadius:11,overflow:'hidden'}}>
                    {m.tip==='foto'?(
                      <img src={m.url} alt={m.ad} style={{width:'100%',height:110,objectFit:'cover',display:'block'}}/>
                    ):(
                      <video src={m.url} style={{width:'100%',height:110,objectFit:'cover',display:'block'}} controls={false}/>
                    )}
                    <div style={{padding:'8px 10px'}}>
                      <div style={{fontSize:11,fontWeight:600,color:'var(--slate)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.ad}</div>
                      <div style={{display:'flex',justifyContent:'space-between',marginTop:3}}>
                        <span style={{fontSize:9.5,color:'var(--slate-light)'}}>{m.boyut}</span>
                        <span className={`tag ${m.tip==='video'?'t-purple':'t-blue'}`} style={{fontSize:8}}>{m.tip==='video'?'🎥 Video':'📷 Foto'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{display:'flex',justifyContent:'flex-end',gap:8,alignItems:'center'}}>
                {medyaKayit&&<span style={{fontSize:11,color:'var(--success)',fontWeight:600,display:'flex',alignItems:'center',gap:5}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:13,height:13}}><polyline points="20 6 9 17 4 12"/></svg>Kaydedildi</span>}
                <button className="btn btn-primary" onClick={medyaKaydet}>💾 Medyayı Kaydet</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
