import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore, useDataStore } from '../store';

// ── SVG PATH HELPER ───────────────────────────────────────────
const SVG_PATHS = {
  staff:  '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users:  '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>',
  ane:    '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  key:    '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
  doc:    '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  pat:    '<path d="M9 12h6M9 16h6M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/>',
  dev:    '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  chart:  '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  hosp:   '<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  cal:    '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
};
function SvgIcon({ ic, size=15, stroke='currentColor' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2"
      style={{width:size,height:size,flexShrink:0}}
      dangerouslySetInnerHTML={{__html: SVG_PATHS[ic]||SVG_PATHS.key}}/>
  );
}

// ── ROL VERİSİ (HTML satır 10921'den birebir) ─────────────────
const ROL_DEFS = [
  {
    id:'superadmin', name:'Üst Yönetici', icon:'staff', color:'#14B8A6', iconBg:'rgba(20,184,166,0.15)',
    desc:'Sisteme tam erişim yetkisine sahip en üst yönetici rolüdür. Kurum kurulumu, tüm kullanıcı yönetimi ve sistem yapılandırmasından sorumludur.',
    userCount:1, systemRole:true,
    users:[{av:'ÜY',bg:'#14B8A6',n:'Dr. Üst Yönetici',dept:'Sistem Yönetimi'}],
    permGroups:[
      {name:'Kurum Yönetimi',icon:'hosp',iconBg:'rgba(20,184,166,0.15)',iconColor:'#14B8A6',perms:[
        {n:'Kurumu görüntüle',note:'Tüm kurum bilgilerini okuma',on:true,ro:true},
        {n:'Kurumu düzenle',note:'Kurum bilgilerini güncelleme',on:true,ro:true},
        {n:'Kurum sil',note:'Sistemi tamamen kaldırma',on:true,ro:true},
        {n:'Paket yönetimi',note:'Abonelik ve plan işlemleri',on:true,ro:true},
      ]},
      {name:'Kullanıcı Yönetimi',icon:'users',iconBg:'rgba(2,132,199,0.15)',iconColor:'#0284C7',perms:[
        {n:'Tüm kullanıcıları listele',note:'',on:true,ro:true},
        {n:'Kullanıcı ekle / düzenle / sil',note:'',on:true,ro:true},
        {n:'Rol ata ve değiştir',note:'',on:true,ro:true},
        {n:'Kullanıcı şifresi sıfırla',note:'',on:true,ro:true},
        {n:'Giriş loglarını görüntüle',note:'',on:true,ro:true},
      ]},
      {name:'Ameliyat Yönetimi',icon:'ane',iconBg:'rgba(124,58,237,0.15)',iconColor:'#7C3AED',perms:[
        {n:'Tüm ameliyatları görüntüle',note:'',on:true,ro:true},
        {n:'Ameliyat oluştur / düzenle / sil',note:'',on:true,ro:true},
        {n:'Ameliyat raporlarını indir',note:'',on:true,ro:true},
      ]},
      {name:'Sistem & Raporlar',icon:'chart',iconBg:'rgba(234,88,12,0.15)',iconColor:'#EA580C',perms:[
        {n:'Tüm raporları görüntüle',note:'',on:true,ro:true},
        {n:'Sistem loglarına eriş',note:'',on:true,ro:true},
        {n:'Yedek al',note:'',on:true,ro:true},
        {n:'Sistem ayarlarını değiştir',note:'',on:true,ro:true},
      ]},
    ],
  },
  {
    id:'bashemshire', name:'Ameliyathane Sorumlu Hemşiresi', icon:'staff', color:'#0284C7', iconBg:'rgba(2,132,199,0.15)',
    desc:'Hemşire kadrosunu yönetir, nöbet ve mesai listelerini düzenler. Ameliyat randevuları oluşturur ve personel atamalarını yapar.',
    userCount:1, systemRole:false,
    users:[{av:'FŞ',bg:'#0284C7',n:'Hem. Fatma Şahin',dept:'Ameliyathane'}],
    permGroups:[
      {name:'Ameliyat Yönetimi',icon:'ane',iconBg:'rgba(20,184,166,0.15)',iconColor:'#14B8A6',perms:[
        {n:'Ameliyat listesini görüntüle',note:'Tüm ameliyatları okuma',on:true,ro:false},
        {n:'Ameliyat randevusu oluştur',note:'Yeni randevu planlama',on:true,ro:false},
        {n:'Randevu düzenle / iptal et',note:'Mevcut randevuları güncelleme',on:true,ro:false},
        {n:'Personel atama yap',note:'Hemşire & yardımcı personel ata',on:true,ro:false},
        {n:'Ameliyatı sil',note:'',on:false,ro:false},
      ]},
      {name:'Personel Yönetimi',icon:'users',iconBg:'rgba(2,132,199,0.15)',iconColor:'#0284C7',perms:[
        {n:'Hemşire listesini görüntüle',note:'',on:true,ro:false},
        {n:'Katılım isteklerini onayla / reddet',note:'Yeni personel başvuruları',on:true,ro:false},
        {n:'Nöbet listesi oluştur',note:'Aylık çalışma planı',on:true,ro:false},
        {n:'Mesai hesapla',note:'Aylık mesai raporları',on:true,ro:false},
        {n:'Personel düzenle / sil',note:'',on:false,ro:false},
      ]},
      {name:'Doktor İşlemleri',icon:'key',iconBg:'rgba(234,88,12,0.15)',iconColor:'#EA580C',perms:[
        {n:'Doktor kayıt edebilir',note:'Sisteme yeni doktor ekleme',on:true,ro:false},
        {n:'Doktor bilgilerini görüntüle',note:'',on:true,ro:false},
        {n:'Doktor sil',note:'',on:false,ro:false},
      ]},
      {name:'Cihaz & Envanter',icon:'dev',iconBg:'rgba(124,58,237,0.15)',iconColor:'#7C3AED',perms:[
        {n:'Envanter görüntüle',note:'',on:true,ro:false},
        {n:'Cihaz ekle / düzenle',note:'',on:true,ro:false},
        {n:'Cihaz durumu güncelle',note:'Aktif / Bakımda / Arızalı',on:true,ro:false},
        {n:'Cihaz sil',note:'',on:false,ro:false},
      ]},
    ],
  },
  {
    id:'anestezisorum', name:'Anestezi Sorumlusu', icon:'ane', color:'#7C3AED', iconBg:'rgba(124,58,237,0.15)',
    desc:'Anestezi teknisyeni kadrosunu yönetir, nöbet listelerini düzenler. Ameliyatlara anestezi teknisyeni ataması yapar.',
    userCount:1, systemRole:false,
    users:[{av:'KA',bg:'#7C3AED',n:'Uzm. Kemal Arslan',dept:'Anestezi'}],
    permGroups:[
      {name:'Ameliyat Yönetimi',icon:'ane',iconBg:'rgba(20,184,166,0.15)',iconColor:'#14B8A6',perms:[
        {n:'Ameliyat listesini görüntüle',note:'',on:true,ro:false},
        {n:'Anestezi teknisyeni ata',note:'Ameliyatlara teknisyen atama',on:true,ro:false},
        {n:'Atama güncelle / iptal et',note:'',on:true,ro:false},
        {n:'Ameliyat oluştur / sil',note:'',on:false,ro:false},
      ]},
      {name:'Kadro Yönetimi',icon:'users',iconBg:'rgba(2,132,199,0.15)',iconColor:'#0284C7',perms:[
        {n:'Teknisyen listesi görüntüle',note:'',on:true,ro:false},
        {n:'Katılım isteklerini yönet',note:'',on:true,ro:false},
        {n:'Nöbet listesi oluştur',note:'',on:true,ro:false},
        {n:'Mesai hesapla',note:'',on:true,ro:false},
      ]},
    ],
  },
  {
    id:'anestezitdk', name:'Anestezi Teknisyeni', icon:'ane', color:'#059669', iconBg:'rgba(5,150,105,0.15)',
    desc:'Ameliyat listesinde hangi salon ve ameliyatta görevli olduğunu görür. Anestezi süreci kayıtlarını ve hasta takibini gerçekleştirir.',
    userCount:4, systemRole:false,
    users:[
      {av:'MA',bg:'#059669',n:'Tek. Mehmet Arslan',dept:'Anestezi'},
      {av:'FC',bg:'#059669',n:'Tek. Fatma Çelik',dept:'Anestezi'},
      {av:'BT',bg:'#059669',n:'Tek. Bülent Taş',dept:'Anestezi'},
      {av:'EK',bg:'#059669',n:'Tek. Esra Kılıç',dept:'Anestezi'},
    ],
    permGroups:[
      {name:'Ameliyat Görüntüleme',icon:'ane',iconBg:'rgba(20,184,166,0.15)',iconColor:'#14B8A6',perms:[
        {n:'Kendi ameliyat listesini gör',note:'Atandığı ameliyatlar',on:true,ro:false},
        {n:'Salon bilgisini görüntüle',note:'',on:true,ro:false},
        {n:'Tüm ameliyat listesi',note:'Diğer personelin ameliyatları',on:false,ro:false},
      ]},
      {name:'Hasta Takibi',icon:'pat',iconBg:'rgba(2,132,199,0.15)',iconColor:'#0284C7',perms:[
        {n:'Anestezi formu oluştur',note:'Hasta başlangıç kayıtları',on:true,ro:false},
        {n:'Vital değer kaydet',note:'SpO₂, KB, KAH vb.',on:true,ro:false},
        {n:'Olay ve not ekle',note:'Ameliyat sürecinde not',on:true,ro:false},
        {n:'Hasta kartını düzenle',note:'',on:false,ro:false},
      ]},
      {name:'Çalışma Listeleri',icon:'cal',iconBg:'rgba(234,88,12,0.15)',iconColor:'#EA580C',perms:[
        {n:'Çalışma listesini görüntüle',note:'',on:true,ro:false},
        {n:'Nöbet listesini görüntüle',note:'',on:true,ro:false},
        {n:'Liste oluştur / düzenle',note:'',on:false,ro:false},
      ]},
    ],
  },
  {
    id:'hemsire', name:'Hemşire & Ameliyathane Teknikeri', icon:'staff', color:'#EA580C', iconBg:'rgba(234,88,12,0.15)',
    desc:'Ameliyat listesinde görevli olduğu salon ve ameliyatı görür. Çalışma ve nöbet listelerine salt okunur erişimi vardır.',
    userCount:6, systemRole:false,
    users:[
      {av:'AK',bg:'#EA580C',n:'Hem. Ayşe Korkmaz',dept:'Hemşire'},
      {av:'SY',bg:'#EA580C',n:'Hem. Selin Yıldız',dept:'Ameliyathane Teknikeri'},
      {av:'BK',bg:'#EA580C',n:'Hem. Büşra Kaya',dept:'Hemşire'},
      {av:'DN',bg:'#EA580C',n:'Hem. Derya Nur',dept:'Ameliyathane Teknikeri'},
      {av:'PY',bg:'#EA580C',n:'Hem. Pınar Yalçın',dept:'Yardımcı Personel'},
      {av:'TÖ',bg:'#EA580C',n:'Hem. Tuba Özbek',dept:'Yardımcı Personel'},
    ],
    permGroups:[
      {name:'Ameliyat Görüntüleme',icon:'ane',iconBg:'rgba(20,184,166,0.15)',iconColor:'#14B8A6',perms:[
        {n:'Kendi ameliyat listesini gör',note:'Atandığı ameliyatlar',on:true,ro:false},
        {n:'Salon bilgisini görüntüle',note:'',on:true,ro:false},
        {n:'Ameliyat oluştur / düzenle',note:'',on:false,ro:false},
        {n:'Personel atama',note:'',on:false,ro:false},
      ]},
      {name:'Çalışma Listeleri',icon:'cal',iconBg:'rgba(2,132,199,0.15)',iconColor:'#0284C7',perms:[
        {n:'Çalışma listesini görüntüle',note:'',on:true,ro:false},
        {n:'Nöbet listesini görüntüle',note:'',on:true,ro:false},
        {n:'Liste oluştur / düzenle',note:'',on:false,ro:false},
      ]},
    ],
  },
  {
    id:'doktor', name:'Doktor', icon:'key', color:'#DC2626', iconBg:'rgba(220,38,38,0.15)',
    desc:'Profilini oluşturur, kuruma katılım isteği gönderir. Onaylanan ameliyatlarında kullanılacak cerrahi set, cihaz ve malzemeleri sisteme girer.',
    userCount:8, systemRole:false,
    users:[
      {av:'AY',bg:'#DC2626',n:'Dr. Ahmet Yılmaz',dept:'Genel Cerrahi'},
      {av:'GH',bg:'#DC2626',n:'Dr. Gigi Hadid',dept:'Genel Cerrahi'},
      {av:'CO',bg:'#DC2626',n:'Dr. Can Özkan',dept:'Ortopedi'},
      {av:'MA',bg:'#DC2626',n:'Dr. Mert Akar',dept:'Göz Hastalıkları'},
    ],
    permGroups:[
      {name:'Ameliyat İşlemleri',icon:'ane',iconBg:'rgba(20,184,166,0.15)',iconColor:'#14B8A6',perms:[
        {n:'Kendi ameliyat listesini gör',note:'Atandığı ameliyatlar',on:true,ro:false},
        {n:'Ameliyat talebi oluştur',note:'Yeni ameliyat isteği',on:true,ro:false},
        {n:'Cerrahi set belirt',note:'Kullanılacak aletler',on:true,ro:false},
        {n:'Cihaz talebi oluştur',note:'',on:true,ro:false},
        {n:'Asistan doktor belirt',note:'',on:true,ro:false},
        {n:'Başkasının ameliyatını görüntüle',note:'',on:false,ro:false},
      ]},
      {name:'Profil & Katılım',icon:'staff',iconBg:'rgba(2,132,199,0.15)',iconColor:'#0284C7',perms:[
        {n:'Kendi profilini düzenle',note:'',on:true,ro:false},
        {n:'Kuruma katılım isteği gönder',note:'',on:true,ro:false},
        {n:'Başka doktor profillerini gör',note:'',on:false,ro:false},
      ]},
    ],
  },
  {
    id:'sekreter', name:'Sekreterlik', icon:'doc', color:'#D97706', iconBg:'rgba(217,119,6,0.15)',
    desc:'Hasta kartı oluşturur ve ameliyat randevusu verebilir. Onay bekleyen randevuları yönetir.',
    userCount:2, systemRole:false,
    users:[
      {av:'ZÖ',bg:'#D97706',n:'Sn. Zeynep Öztürk',dept:'Sekreterlik'},
      {av:'HK',bg:'#D97706',n:'Sn. Hatice Kara',dept:'Sekreterlik'},
    ],
    permGroups:[
      {name:'Hasta Yönetimi',icon:'pat',iconBg:'rgba(20,184,166,0.15)',iconColor:'#14B8A6',perms:[
        {n:'Hasta kartı oluştur',note:'Yeni hasta kaydı',on:true,ro:false},
        {n:'Hasta bilgilerini düzenle',note:'',on:true,ro:false},
        {n:'Hasta listesini görüntüle',note:'',on:true,ro:false},
        {n:'Hasta kaydı sil',note:'',on:false,ro:false},
      ]},
      {name:'Randevu İşlemleri',icon:'cal',iconBg:'rgba(2,132,199,0.15)',iconColor:'#0284C7',perms:[
        {n:'Ameliyat randevusu oluştur',note:'',on:true,ro:false},
        {n:'Randevu görüntüle',note:'',on:true,ro:false},
        {n:'Onay bekleyenleri yönet',note:'',on:true,ro:false},
        {n:'Randevu iptal et',note:'',on:true,ro:false},
        {n:'Personel atama',note:'',on:false,ro:false},
      ]},
    ],
  },
];

// ── KARŞILAŞTIRMA VERİSİ ──────────────────────────────────────
const COMP_PERMS = [
  {lbl:'Tüm ameliyatları görüntüle',         vals:['✓','✓','✓','—','—','—','✓']},
  {lbl:'Ameliyat oluştur / düzenle',          vals:['✓','✓','—','—','—','~','✓']},
  {lbl:'Personel atama',                      vals:['✓','✓','✓','—','—','—','—']},
  {lbl:'Nöbet listesi oluştur',               vals:['✓','✓','✓','—','—','—','—']},
  {lbl:'Hasta kartı oluştur',                 vals:['✓','—','—','—','—','—','✓']},
  {lbl:'Anestezi formu',                      vals:['✓','—','—','✓','—','—','—']},
  {lbl:'Cihaz envanteri yönet',               vals:['✓','✓','—','—','—','—','—']},
  {lbl:'Kullanıcı yönetimi',                  vals:['✓','—','—','—','—','—','—']},
  {lbl:'Sistem ayarları',                     vals:['✓','—','—','—','—','—','—']},
  {lbl:'Rapor indir',                         vals:['✓','✓','✓','—','—','—','—']},
];

const SHORT_NAMES  = ['Üst Yön.','Sor.Hem.','Ane.Sor.','Ane.Tek.','Hemşire','Doktor','Sekreter'];
const ROL_COLORS   = ['#14B8A6','#0284C7','#7C3AED','#059669','#EA580C','#DC2626','#D97706'];

// ── ANA COMPONENT ─────────────────────────────────────────────
export default function Roller() {
  const { showToast } = useUIStore();
  const navigate = useNavigate();
  const [selIdx,     setSelIdx]     = useState(0);
  const [profilUser, setProfilUser] = useState(null);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [addUserForm, setAddUserForm] = useState({ad:'', email:'', dept:''});
  const [mainTab,    setMainTab]    = useState('roller');    // 'roller' | 'karsilastir'
  const [detailTab,  setDetailTab]  = useState('yetkiler'); // 'yetkiler' | 'kullanicilar'
  const [aramaQ,     setAramaQ]     = useState('');
  // toggleStates: {rolId: {'grpName|permName': bool}}
  const [toggles, setToggles]       = useState(() => {
    const t = {};
    ROL_DEFS.forEach(r => {
      t[r.id] = {};
      r.permGroups.forEach(g => g.perms.forEach(p => {
        t[r.id][g.name+'|'+p.n] = p.on;
      }));
    });
    return t;
  });

  function getToggle(rolId, gName, pName) { return toggles[rolId]?.[gName+'|'+pName] ?? false; }
  function flipToggle(rolId, gName, pName) {
    setToggles(prev => ({
      ...prev,
      [rolId]: { ...prev[rolId], [gName+'|'+pName]: !prev[rolId]?.[gName+'|'+pName] }
    }));
  }

  const filteredRols = aramaQ
    ? ROL_DEFS.map((r,i) => ({r,i})).filter(({r}) => r.name.toLowerCase().includes(aramaQ.toLowerCase()))
    : ROL_DEFS.map((r,i) => ({r,i}));

  const r = ROL_DEFS[selIdx];
  const totalOn   = r.permGroups.reduce((a,g) => a + g.perms.filter(p => getToggle(r.id,g.name,p.n)).length, 0);
  const totalPerm = r.permGroups.reduce((a,g) => a + g.perms.length, 0);

  return (
    <>
      {/* ── Başlık + Ana Tab ── */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
        <div>
          <div style={{fontSize:22,fontWeight:700,color:'var(--slate)',letterSpacing:'-0.4px',fontFamily:"'Outfit',sans-serif"}}>Yetki & Roller Yönetimi</div>
          <div style={{fontSize:'11.5px',color:'var(--slate-light)',marginTop:2}}>7 sistem rolü — her rol için izinleri ayrı ayrı özelleştirin</div>
        </div>
        <div className="roller-tabs">
          {[{id:'roller',lbl:'Rol Detayı'},{id:'karsilastir',lbl:'Karşılaştır'}].map(t=>(
            <div key={t.id} className={`rtab${mainTab===t.id?' active':''}`} onClick={()=>setMainTab(t.id)}>{t.lbl}</div>
          ))}
        </div>
      </div>

      {/* ── İki kolon layout ── */}
      <div className="roller-layout">

        {/* SOL: Rol listesi */}
        <div style={{display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{background:'var(--card-bg)',border:'1px solid var(--border)',borderRadius:'var(--radius-lg)',overflow:'hidden',display:'flex',flexDirection:'column',height:'100%'}}>
            {/* Arama */}
            <div style={{padding:'11px 13px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
              <div style={{fontSize:'9.5px',fontWeight:600,color:'var(--slate-light)',textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:8}}>Sistem Rolleri</div>
              <div style={{position:'relative'}}>
                <svg style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',width:12,height:12,stroke:'var(--slate-light)',fill:'none'}} viewBox="0 0 24 24" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input style={{width:'100%',border:'1px solid var(--border)',borderRadius:7,padding:'6px 10px 6px 28px',fontSize:'11.5px',fontFamily:'var(--font)',outline:'none',background:'var(--input-bg)',color:'var(--slate)',letterSpacing:'-0.01em'}}
                  placeholder="Rol ara…" value={aramaQ} onChange={e=>setAramaQ(e.target.value)}/>
              </div>
            </div>
            {/* Rol kartları */}
            <div style={{flex:1,overflowY:'auto',padding:8}}>
              {filteredRols.map(({r:rol,i})=>(
                <div key={rol.id} className={`rol-card${i===selIdx?' selected':''}`}
                  onClick={()=>{setSelIdx(i);setMainTab('roller');setDetailTab('yetkiler');}}>
                  <div className="rol-card-top">
                    <div className="rol-icon" style={{background:rol.iconBg}}>
                      <SvgIcon ic={rol.icon} size={15} stroke={rol.color}/>
                    </div>
                    <span className="rol-card-name">{rol.name}</span>
                    <span className="rol-card-count">{rol.userCount} kişi</span>
                  </div>
                  <div className="rol-card-desc">{rol.desc.substring(0,80)}…</div>
                  <div className="rol-card-perms">
                    {rol.permGroups.slice(0,3).map(g=>(
                      <span key={g.name} className="rol-perm-chip">{g.name}</span>
                    ))}
                    {rol.permGroups.length>3 && <span className="rol-perm-chip">+{rol.permGroups.length-3}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SAĞ: Detay veya Karşılaştır */}
        <div className="rol-detail">

          {mainTab === 'karsilastir' ? (
            /* ── KARŞILAŞTIRMA TABLOSU ── */
            <>
              <div className="rol-detail-header" style={{borderBottom:'1px solid var(--border)'}}>
                <div style={{flex:1}}>
                  <div className="rol-detail-name">Rol Karşılaştırma Tablosu</div>
                  <div className="rol-detail-desc">Tüm rollerin yetki matrisini yan yana inceleyin.</div>
                </div>
              </div>
              <div className="rol-detail-body">
                <div style={{overflowX:'auto'}}>
                  <table className="comp-table">
                    <thead>
                      <tr>
                        <th style={{minWidth:180}}>Yetki</th>
                        {SHORT_NAMES.map((n,i)=>(
                          <th key={n} style={{minWidth:90}}>
                            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                              <div style={{width:24,height:24,borderRadius:'50%',background:ROL_COLORS[i],display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:800,color:'white'}}>{ROL_DEFS[i].users[0]?.av||'?'}</div>
                              {n}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {COMP_PERMS.map(p=>(
                        <tr key={p.lbl}>
                          <td>{p.lbl}</td>
                          {p.vals.map((v,i)=>(
                            <td key={i}>
                              {v==='✓' ? <span className="comp-check">✓</span>
                               : v==='~' ? <span className="comp-partial">~</span>
                               : <span className="comp-cross">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{marginTop:12,display:'flex',gap:16,fontSize:11,color:'var(--slate-light)'}}>
                  <span><span className="comp-check">✓</span> Tam yetki</span>
                  <span><span className="comp-partial">~</span> Kısmi yetki</span>
                  <span><span className="comp-cross">—</span> Erişim yok</span>
                </div>
              </div>
            </>
          ) : (
            /* ── ROL DETAYI ── */
            <>
              {/* Header */}
              <div className="rol-detail-header">
                <div className="rol-detail-icon" style={{background:r.iconBg}}>
                  <SvgIcon ic={r.icon} size={20} stroke={r.color}/>
                </div>
                <div className="rol-detail-info">
                  <div className="rol-detail-name">{r.name}</div>
                  <div className="rol-detail-desc">{r.desc}</div>
                  <div className="rol-detail-meta">
                    <span className="rol-meta-chip">
                      <SvgIcon ic="users" size={11}/>
                      {r.userCount} Kullanıcı
                    </span>
                    <span className="rol-meta-chip">
                      <SvgIcon ic="key" size={11}/>
                      {totalOn}/{totalPerm} Yetki Aktif
                    </span>
                    {r.systemRole
                      ? <span className="tag t-teal" style={{fontSize:9}}>Sistem Rolü</span>
                      : <span className="tag t-blue" style={{fontSize:9}}>Özelleştirilebilir</span>
                    }
                  </div>
                </div>
                <div className="rol-detail-actions">
                  {!r.systemRole && <button className="btn btn-secondary btn-sm" onClick={()=>showToast('Rol klonlandı ✓')}>Klonla</button>}
                  <button className="btn btn-primary btn-sm" onClick={()=>showToast('Yetki değişiklikleri kaydedildi ✓')}>Kaydet</button>
                </div>
              </div>

              {/* Detail tabs */}
              <div style={{padding:12,borderBottom:'1px solid var(--border)'}}>
                <div className="roller-tabs">
                  {[{id:'yetkiler',lbl:'Yetki Matrisi'},{id:'kullanicilar',lbl:`Kullanıcılar (${r.userCount})`}].map(t=>(
                    <div key={t.id} className={`rtab${detailTab===t.id?' active':''}`} onClick={()=>setDetailTab(t.id)}>{t.lbl}</div>
                  ))}
                </div>
              </div>

              {/* Detail body */}
              <div className="rol-detail-body">
                {detailTab === 'yetkiler' ? (
                  <div className="rol-section">
                    <div className="rol-section-title">
                      <SvgIcon ic="key" size={11}/>
                      İzin Grupları
                    </div>
                    {r.permGroups.map(g => {
                      const actv = g.perms.filter(p => getToggle(r.id,g.name,p.n)).length;
                      return (
                        <div key={g.name} className="perm-group">
                          <div className="perm-group-header">
                            <div className="perm-group-icon" style={{background:g.iconBg}}>
                              <SvgIcon ic={g.icon} size={12} stroke={g.iconColor}/>
                            </div>
                            <span className="perm-group-name">{g.name}</span>
                            <span className="perm-group-count">{actv}/{g.perms.length} aktif</span>
                          </div>
                          {g.perms.map(p => {
                            const isOn = getToggle(r.id,g.name,p.n);
                            return (
                              <div key={p.n} className="perm-item">
                                <div className="perm-label">
                                  <div className="perm-name">{p.n}</div>
                                  {p.note && <div className="perm-note">{p.note}</div>}
                                </div>
                                <button
                                  className={`tog${isOn?' on':''}${p.ro?' ro':''}`}
                                  disabled={p.ro}
                                  title={p.ro ? 'Sistem rolü — değiştirilemez' : 'Tıklayarak değiştir'}
                                  onClick={() => { if(!p.ro) flipToggle(r.id,g.name,p.n); }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rol-section">
                    <div className="rol-section-title">
                      <SvgIcon ic="users" size={11}/>
                      Bu Roldeki Kullanıcılar
                    </div>
                    <div className="rol-user-grid">
                      {r.users.map(u=>(
                        <div key={u.n} className="rol-user-card">
                          <div className="avatar" style={{background:u.bg,color:'white',width:32,height:32,fontSize:10,flexShrink:0}}>{u.av}</div>
                          <div className="rol-user-info">
                            <div className="rol-user-name">{u.n}</div>
                            <div className="rol-user-dept">{u.dept}</div>
                          </div>
                          <button className="btn btn-secondary btn-sm" onClick={()=>setProfilUser(u)}>Profil</button>
                        </div>
                      ))}
                      <div className="rol-user-card" style={{borderStyle:'dashed',cursor:'pointer',justifyContent:'center',gap:6,color:'var(--slate-light)'}}
                        onClick={()=>{setAddUserForm({ad:'',email:'',dept:r.name});setAddUserOpen(true);}}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        <span style={{fontSize:11,fontWeight:600}}>Kullanıcı Ekle</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Kullanıcı Profil Modal */}
      {profilUser && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)'}} onClick={()=>setProfilUser(null)}>
          <div style={{width:400,background:'var(--card-bg)',borderRadius:18,overflow:'hidden',boxShadow:'0 24px 60px rgba(0,0,0,0.2)'}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:'20px 22px',background:`linear-gradient(135deg,${profilUser.bg},${profilUser.bg}99)`,textAlign:'center'}}>
              <div style={{width:56,height:56,borderRadius:'50%',background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:800,color:'white',margin:'0 auto 12px',border:'3px solid rgba(255,255,255,0.3)'}}>{profilUser.av}</div>
              <div style={{fontSize:16,fontWeight:800,color:'white',fontFamily:"'Outfit',sans-serif"}}>{profilUser.n}</div>
              <div style={{fontSize:12,color:'rgba(255,255,255,0.7)',marginTop:4}}>{profilUser.dept}</div>
            </div>
            <div style={{padding:'16px 22px'}}>
              {[{lbl:'Ad Soyad',val:profilUser.n},{lbl:'Departman',val:profilUser.dept},{lbl:'Rol',val:r.name}].map(x=>(
                <div key={x.lbl} style={{display:'flex',justifyContent:'space-between',padding:'9px 0',borderBottom:'1px solid var(--border)'}}>
                  <span style={{fontSize:12,color:'var(--slate-light)'}}>{x.lbl}</span>
                  <span style={{fontSize:12,fontWeight:600,color:'var(--slate)'}}>{x.val}</span>
                </div>
              ))}
            </div>
            <div style={{padding:'12px 22px',borderTop:'1px solid var(--border)',display:'flex',justifyContent:'flex-end',background:'var(--surface)'}}>
              <button className="btn btn-secondary" onClick={()=>setProfilUser(null)}>Kapat</button>
            </div>
          </div>
        </div>
      )}

      {/* Kullanıcı Ekle Modal */}
      {addUserOpen && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)'}} onClick={()=>setAddUserOpen(false)}>
          <div style={{width:460,background:'var(--card-bg)',borderRadius:18,overflow:'hidden',boxShadow:'0 24px 60px rgba(0,0,0,0.2)'}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:'16px 20px',background:'linear-gradient(135deg,#0F766E,#0891b2)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{fontSize:14,fontWeight:700,color:'white'}}>👤 Kullanıcı Ekle — {r.name}</div>
              <div onClick={()=>setAddUserOpen(false)} style={{color:'rgba(255,255,255,0.7)',cursor:'pointer',fontSize:20}}>✕</div>
            </div>
            <div style={{padding:'20px 22px'}}>
              <div className="fg" style={{marginBottom:10}}><label className="fl">Ad Soyad *</label><input className="fi" value={addUserForm.ad} onChange={e=>setAddUserForm(f=>({...f,ad:e.target.value}))} placeholder="Ad Soyad"/></div>
              <div className="fg" style={{marginBottom:10}}><label className="fl">E-posta *</label><input className="fi" type="email" value={addUserForm.email} onChange={e=>setAddUserForm(f=>({...f,email:e.target.value}))} placeholder="ad@hastane.gov.tr"/></div>
              <div className="fg"><label className="fl">Departman</label><input className="fi" value={addUserForm.dept} onChange={e=>setAddUserForm(f=>({...f,dept:e.target.value}))} placeholder={r.name}/></div>
            </div>
            <div style={{padding:'12px 22px',borderTop:'1px solid var(--border)',display:'flex',gap:8,justifyContent:'flex-end',background:'var(--surface)'}}>
              <button className="btn btn-secondary" onClick={()=>setAddUserOpen(false)}>İptal</button>
              <button className="btn btn-primary" onClick={()=>{
                if(!addUserForm.ad.trim()){showToast('Ad Soyad zorunlu');return;}
                const av = addUserForm.ad.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
                r.users.push({av, bg:r.color, n:addUserForm.ad.trim(), dept:addUserForm.dept||r.name});
                r.userCount = r.users.length;
                setAddUserOpen(false);
                showToast(`✅ ${addUserForm.ad.trim()} eklendi`);
              }}>Ekle</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
