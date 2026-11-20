import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useDataStore, useUIStore } from '../../store';
import { ROLES } from '../../data/roles';

// Rol bazlı istatistikler — HTML buildPdMenu'den birebir
const PD_STATS = {
  0:  [{v:'48',l:'Bu Ay Op.'},{v:'12',l:'Personel'},{v:'4',l:'Salon'}],
  1:  [{v:'48',l:'Bu Ay Op.'},{v:'8',l:'Hemşire'},{v:'4',l:'Salon'}],
  2:  [{v:'48',l:'Bu Ay Op.'},{v:'3',l:'Teknisyen'},{v:'4',l:'Salon'}],
  3:  [{v:'12',l:'Bugün'},{v:'3',l:'Hasta'},{v:'1',l:'Salon'}],
  4:  [{v:'12',l:'Bugün'},{v:'4',l:'Görev'},{v:'1',l:'Salon'}],
  5:  [{v:'6',l:'Bugün'},{v:'2',l:'Görev'},{v:'1',l:'Salon'}],
  6:  [{v:'5',l:'Ameliyat'},{v:'18',l:'Hasta'},{v:'2',l:'Bekleyen'}],
  7:  [{v:'24',l:'Randevu'},{v:'12',l:'Hasta'},{v:'3',l:'Bekleyen'}],
  8:  [{v:'14',l:'Set'},{v:'3',l:'Personel'},{v:'2',l:'Bekleyen'}],
  9:  [{v:'8',l:'Set'},{v:'2',l:'Teslim'},{v:'1',l:'Bekleyen'}],
  10: [{v:'3',l:'Ameliyat'},{v:'5',l:'Hasta'},{v:'1',l:'Bekleyen'}],
};

// SVG ikonları
const IC = {
  profil:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  kurum:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>,
  ayarlar:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
  bildirim: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>,
  takvim:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  ameliyat: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  personel: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  steril:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  hasta:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M12 11v6M9 14h6"/></svg>,
  rapor:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  roller:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  katki:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
  cikis:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>,
};

// Rol bazlı menü öğeleri — HTML buildPdMenu'den birebir
const PD_MENU = {
  0:  [ ['profil','Profilim','/profil'], ['kurum','Kurum Yönetimi','/kurum'], ['personel','Personel Listesi','/personel'], ['roller','Yetki & Roller','/roller'], ['rapor','Raporlar','/raporlar'], null, ['ayarlar','Ayarlar',null], ['bildirim','Bildirim Tercihleri',null], ['katki','Katkıda Bulun',null] ],
  1:  [ ['profil','Profilim','/profil'], ['ameliyat','Ameliyat Listesi','/ameliyatlar'], ['takvim','Doluluk Takvimi','/takvim'], ['personel','Hemşire Kadrosu','/personel'], null, ['ayarlar','Ayarlar',null], ['bildirim','Bildirim Tercihleri',null], ['katki','Katkıda Bulun',null] ],
  2:  [ ['profil','Profilim','/profil'], ['ameliyat','Ameliyat Listesi','/ameliyatlar'], ['personel','Teknisyen Kadrosu','/personel'], null, ['ayarlar','Ayarlar',null], ['bildirim','Bildirim Tercihleri',null], ['katki','Katkıda Bulun',null] ],
  3:  [ ['profil','Profilim','/profil'], ['ameliyat','Ameliyat Listem','/ameliyatlar'], ['hasta','Hasta Takibi','/hastalar'], null, ['ayarlar','Ayarlar',null], ['bildirim','Bildirim Tercihleri',null], ['katki','Katkıda Bulun',null] ],
  4:  [ ['profil','Profilim','/profil'], ['ameliyat','Ameliyat Listem','/ameliyatlar'], ['takvim','Çalışma Listem','/calisma'], null, ['ayarlar','Ayarlar',null], ['katki','Katkıda Bulun',null] ],
  5:  [ ['profil','Profilim','/profil'], ['ameliyat','Ameliyat Listesi','/ameliyatlar'], ['takvim','Çalışma Listem','/calisma'], null, ['ayarlar','Ayarlar',null], ['katki','Katkıda Bulun',null] ],
  6:  [ ['profil','Profilim','/profil'], ['ameliyat','Ameliyat Panosu','/ameliyatlar'], ['hasta','Hasta Kayıtları','/hastalar'], ['takvim','Randevu Durumlarım','/randevu'], null, ['ayarlar','Ayarlar',null], ['bildirim','Bildirim Tercihleri',null], ['katki','Katkıda Bulun',null] ],
  7:  [ ['profil','Profilim','/profil'], ['hasta','Hasta Kartları','/hastalar'], ['takvim','Randevu Takvimi','/takvim'], null, ['ayarlar','Ayarlar',null], ['katki','Katkıda Bulun',null] ],
  8:  [ ['profil','Profilim','/profil'], ['steril','Set Takip Paneli','/set-takip'], ['steril','Steril Depo','/depo'], ['personel','Sterilizasyon Personeli','/steril-personel'], ['rapor','Raporlar','/raporlar'], null, ['ayarlar','Ayarlar',null], ['bildirim','Bildirim Tercihleri',null], ['katki','Katkıda Bulun',null] ],
  9:  [ ['profil','Profilim','/profil'], ['steril','Set Takip Paneli','/set-takip'], ['steril','Steril Depo','/depo'], ['takvim','Çalışma Listem','/calisma'], null, ['ayarlar','Ayarlar',null], ['katki','Katkıda Bulun',null] ],
  10: [ ['profil','Profilim','/profil'], ['ameliyat','Ameliyat Panosu','/ameliyatlar'], ['hasta','Hasta Kayıtları','/hastalar'], null, ['ayarlar','Ayarlar',null], ['katki','Katkıda Bulun',null] ],
  11: [ ['profil','Profilim','/profil'], ['equip','Cihaz Envanteri','/envanter'], ['cal','Bakım Planı','/bakim-plan'], ['alert','Arıza Bildirimleri','/ariza-bildirimleri'], null, ['ayarlar','Ayarlar',null], ['katki','Katkıda Bulun',null] ],
  12: [ ['profil','Profilim','/profil'], ['alert','Servis Talepleri','/servis-talepleri'], ['doc','İş Emirleri','/is-emirleri'], ['equip','Cihaz Listesi','/envanter'], null, ['ayarlar','Ayarlar',null], ['katki','Katkıda Bulun',null] ],
};

const LANGS = [
  { code:'tr', label:'TR', flag:'🇹🇷' },
  { code:'en', label:'EN', flag:'🇬🇧' },
];

export default function Topbar({ onAIClick, onMenuToggle }) {
  const { curRole, logout } = useAuthStore();
  const { bildirimler, markAllRead, surgeries, hastalar, personel } = useDataStore();
  const [aramaAcik, setAramaAcik] = useState(false);
  const [aramaSonuclari, setAramaSonuclari] = useState([]);
  const { showToast } = useUIStore();
  const navigate = useNavigate();
  const role = ROLES[curRole] || ROLES[0];

  const [notifOpen,   setNotifOpen]   = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [lang, setLang]               = useState('tr');
  const [reqOpen, setReqOpen]         = useState(false);
  const [reqTab, setReqTab]           = useState('bekleyen');
  const [reqData, setReqData]         = useState({
    bekleyen:[
      {av:'MK',bg:'#DC2626',n:'Dr. Mehmet Kaya',role:'Ortopedi Uzmanı',kurum:'Merkez Devlet Hastanesi',t:'18 dk önce',tip:'doktor'},
      {av:'BÖ',bg:'#EA580C',n:'Hem. Büşra Öztürk',role:'Hemşire',kurum:'Merkez Devlet Hastanesi',t:'2 saat önce',tip:'hemshire'},
      {av:'ES',bg:'#059669',n:'Tek. Enes Sarı',role:'Anestezi Teknisyeni',kurum:'Merkez Devlet Hastanesi',t:'4 saat önce',tip:'anestek'},
      {av:'NC',bg:'#7C3AED',n:'Dr. Neslihan Çelik',role:'Genel Cerrahi Uzmanı',kurum:'Merkez Devlet Hastanesi',t:'Dün 15:40',tip:'doktor'},
      {av:'MH',bg:'#6366F1',n:'Dr. Kadir Arslan',role:'Misafir Hekim — Kardiyovasküler',kurum:'Ankara Şehir Hastanesi',t:'Bugün 08:15',tip:'misafir'},
    ],
    onaylanan:[
      {av:'AY',bg:'#DC2626',n:'Dr. Ahmet Yılmaz',role:'Genel Cerrahi',kurum:'Merkez Devlet Hastanesi',t:'3 gün önce',tip:'doktor'},
      {av:'AK',bg:'#EA580C',n:'Hem. Ayşe Korkmaz',role:'Hemşire',kurum:'Merkez Devlet Hastanesi',t:'1 hafta önce',tip:'hemshire'},
    ],
    reddedilen:[
      {av:'TY',bg:'#94A3B8',n:'Dr. Tarık Yücel',role:'Plastik Cerrahi',kurum:'Başka Hastane',t:'2 hafta önce',tip:'doktor'},
    ],
  });

  const unread = bildirimler.filter(b => !b.okundu).length;

  function handleArama(q) {
    if (!q.trim()) { setAramaSonuclari([]); return; }
    const ql = q.toLowerCase();
    const sonuclar = [
      ...surgeries.filter(s => (s.op||'').toLowerCase().includes(ql) || (s.hasta||'').toLowerCase().includes(ql)).slice(0,3).map(s => ({tip:'Ameliyat',ad:s.op,alt:s.hasta,path:'/ameliyatlar'})),
      ...hastalar.filter(h => (h.ad||'').toLowerCase().includes(ql) || (h.tc||'').includes(ql)).slice(0,3).map(h => ({tip:'Hasta',ad:h.ad+' '+(h.soyad||''),alt:h.tc,path:'/hastalar'})),
      ...personel.filter(p => (p.ad||'').toLowerCase().includes(ql)).slice(0,3).map(p => ({tip:'Personel',ad:p.ad,alt:p.rol,path:'/personel'})),
    ];
    setAramaSonuclari(sonuclar);
  }
  const reqCount  = reqData.bekleyen.length;
  const stats     = PD_STATS[curRole] || PD_STATS[0];
  const menuItems = PD_MENU[curRole]  || PD_MENU[0];

  const tipIcon = { uyari:'⚠️', ekipman:'🔧', tamamlandi:'✅', katilim:'👤', sistem:'📢' };
  const tipRenk = { uyari:'#DC2626', ekipman:'#D97706', tamamlandi:'#059669', katilim:'#7C3AED', sistem:'#14B8A6' };

  function acceptReq(i) {
    setReqData(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const item = next.bekleyen.splice(i, 1)[0];
      item.t = 'Şimdi';
      next.onaylanan.unshift(item);
      return next;
    });
    showToast(reqData.bekleyen[i]?.n + ' onaylandı ✓');
  }
  function rejectReq(i) {
    setReqData(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const item = next.bekleyen.splice(i, 1)[0];
      item.t = 'Şimdi';
      next.reddedilen.unshift(item);
      return next;
    });
    showToast(reqData.bekleyen[i]?.n + ' reddedildi');
  }
  function toggleReqPanel() {
    setReqOpen(o => !o);
    setNotifOpen(false);
    setProfileOpen(false);
  }

  // WebSocket durumu — ConnectionStatus yerine inline
  const wsOnline = false; // demo

  function closeAll() { setNotifOpen(false); setProfileOpen(false); setReqOpen(false); }

  return (
    <div className="topbar">

      {/* Hamburger — yalnızca mobilde görünür */}
      <button className="hamburger-btn" onClick={onMenuToggle} aria-label="Menüyü aç/kapat">
        <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="7" x2="21" y2="7"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="17" x2="21" y2="17"/>
        </svg>
      </button>

      {/* Sol: Kurum bilgisi */}
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <div style={{width:34,height:34,borderRadius:9,background:'rgba(20,184,166,0.12)',border:'1px solid rgba(20,184,166,0.2)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
        <div>
          <div className="topbar-title">Merkez Devlet Hastanesi</div>
          <div className="topbar-crumb" style={{display:'flex',alignItems:'center',gap:6}}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--slate-light)" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <span style={{color:'var(--slate-light)'}}>Bağcılar, İstanbul</span>
          </div>
        </div>
      </div>

      {/* Sağ: Aksiyonlar */}
      <div className="topbar-actions">

        {/* Bildirim */}
        <div className="notif-wrap">
          <div className="btn-icon" onClick={()=>{setNotifOpen(o=>!o);setProfileOpen(false);}} style={{position:'relative'}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
            {unread > 0 && <div className="notif-count">{unread}</div>}
          </div>
        </div>

        {/* Katılım İstekleri */}
        {[0,1,2,8].includes(curRole) && (
          <div className="req-notif-btn" onClick={toggleReqPanel} title="Katılım İstekleri">
            <div className="btn-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15}}>
                <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/>
                <line x1="22" y1="11" x2="16" y2="11"/>
              </svg>
            </div>
            {reqCount > 0 && <div className="req-badge">{reqCount}</div>}
          </div>
        )}

        {/* Katılım İstekleri Paneli */}
        {reqOpen && (
          <div className="req-panel open" style={{maxHeight:'88vh', zIndex:710}}>
            <div className="req-panel-hd">
              <span className="req-panel-title">Katılım İstekleri</span>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div className="req-panel-tabs">
                  {[{id:'bekleyen',lbl:'Bekleyen'},{id:'onaylanan',lbl:'Onaylanan'},{id:'reddedilen',lbl:'Reddedilen'}].map(t=>(
                    <div key={t.id} className={`req-ptab${reqTab===t.id?' active':''}`} onClick={()=>setReqTab(t.id)}>
                      {t.lbl} {t.id==='bekleyen' && reqCount>0 && <span style={{background:'var(--danger)',color:'white',fontSize:8,fontWeight:700,padding:'1px 5px',borderRadius:10,marginLeft:2}}>{reqCount}</span>}
                    </div>
                  ))}
                </div>
                <span style={{cursor:'pointer',color:'var(--slate-light)',fontSize:16,lineHeight:1}} onClick={()=>setReqOpen(false)}>✕</span>
              </div>
            </div>
            <div className="req-panel-body">
              {!(reqData[reqTab]?.length) ? (
                <div className="req-empty">
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--teal-mid)" strokeWidth="2" width="32" height="32"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <span>Kayıt bulunamadı</span>
                </div>
              ) : reqData[reqTab].map((r,i) => (
                <div key={i} className="req-item">
                  <div className="avatar" style={{background:r.bg,color:'white',width:36,height:36,fontSize:11,flexShrink:0}}>{r.av}</div>
                  <div className="req-item-info">
                    <div className="req-item-name" style={{display:'flex',alignItems:'center',gap:6}}>
                      {r.n}
                      {r.tip==='misafir' && <span className="tag" style={{background:'rgba(99,102,241,0.12)',color:'#6366F1',border:'1px solid rgba(99,102,241,0.25)',fontSize:'8.5px',padding:'1px 7px',borderRadius:20,fontWeight:700}}>Misafir Hekim</span>}
                    </div>
                    <div className="req-item-role">{r.role}</div>
                    <div className="req-item-kurum">🏥 {r.kurum}</div>
                    <div className="req-item-time">{r.t}</div>
                  </div>
                  {reqTab==='bekleyen' ? (
                    <div style={{display:'flex',flexDirection:'column',gap:4,alignItems:'flex-end',flexShrink:0}}>
                      <button onClick={()=>{setReqOpen(false);navigate('/katilim-istekleri');}} style={{fontSize:'10px',padding:'5px 12px',borderRadius:6,border:'1px solid var(--teal-mid)',background:'rgba(20,184,166,0.08)',color:'var(--teal)',cursor:'pointer',fontFamily:'var(--font)',fontWeight:700,whiteSpace:'nowrap'}}>Detay →</button>
                    </div>
                  ) : (
                    <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4,flexShrink:0}}>
                      <span className={`tag ${reqTab==='onaylanan'?'t-green':'t-red'}`} style={{fontSize:9}}>{reqTab==='onaylanan'?'Onaylandı':'Reddedildi'}</span>
                      <button onClick={()=>{setReqOpen(false);navigate('/katilim-istekleri');}} style={{fontSize:'10px',padding:'5px 12px',borderRadius:6,border:'1px solid var(--border)',background:'var(--surface)',color:'var(--teal)',cursor:'pointer',fontFamily:'var(--font)',fontWeight:700,whiteSpace:'nowrap'}}>Detay →</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Arama */}
        <div className="ai-search-trigger" onClick={onAIClick} title="Yapay Zeka Destekli Arama (Ctrl+K)">
          <div className="ai-search-trigger-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" style={{width:14,height:14}}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
          <span className="ai-search-trigger-text">Ameliyat, set, alet, malzeme ara…</span>
          <div className="ai-search-trigger-right">
            <span className="ai-search-trigger-badge">AI</span>
            <span className="ai-search-trigger-kbd">⌘K</span>
          </div>
        </div>

        {/* Dil Değiştirici */}
        <div className="lang-switcher" style={{display:'flex',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:3,gap:1,height:42,alignItems:'center',boxSizing:'border-box'}}>
          {LANGS.map(l => (
            <button key={l.code} onClick={() => setLang(l.code)}
              style={{padding:'4px 9px',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:700,
                background:lang===l.code?'var(--teal)':'transparent',
                color:lang===l.code?'white':'var(--slate-light)',
                border:'none',transition:'all 0.15s',display:'flex',alignItems:'center',gap:3,height:34}}>
              <span style={{fontSize:13}}>{l.flag}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>

        {/* Profil */}
        <div className="profile-wrap">
          <div className="profile-trigger" onClick={()=>{setProfileOpen(o=>!o);setNotifOpen(false);}}>
            <div className="av-sm" style={{background:role.bg,color:'white'}}>{role.av}</div>
            <div>
              <div className="pname">{role.full}</div>
              <div className="prole">{role.name}</div>
            </div>
            <span className="pchev">{profileOpen?'▲':'▼'}</span>
          </div>

          {/* Profile Dropdown — HTML ile birebir */}
          {profileOpen && (
            <div className="profile-dropdown open">
              {/* pd-header */}
              <div className="pd-header">
                <div className="pd-av" style={{background:role.bg,color:'white'}}>{role.av}</div>
                <div className="pd-name">{role.full}</div>
                <div className="pd-role">{role.name}</div>
                <div className="pd-kurum">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:10,height:10}}>
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                  </svg>
                  Merkez Devlet Hastanesi
                </div>
              </div>

              {/* pd-stats — rol bazlı */}
              <div className="pd-stats">
                {stats.map((s,i) => (
                  <div key={i} className="pd-stat">
                    <div className="pd-stat-val">{s.v}</div>
                    <div className="pd-stat-lbl">{s.l}</div>
                  </div>
                ))}
              </div>

              {/* Bağlantı durumu — pd menüsü içinde */}
              <div style={{padding:'8px 10px 0',borderBottom:'1px solid var(--border)'}}>
                <div style={{display:'flex',alignItems:'center',gap:6,padding:'6px 4px',fontSize:11,color:wsOnline?'var(--success)':'var(--warning)',fontWeight:600}}>
                  <div style={{width:6,height:6,borderRadius:'50%',background:wsOnline?'var(--success)':'var(--warning)',flexShrink:0}}/>
                  {wsOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
                  <span style={{color:'var(--slate-light)',fontWeight:400,marginLeft:'auto',fontSize:10}}>WebSocket</span>
                </div>
              </div>

              {/* pd-menu — rol bazlı */}
              <div className="pd-menu">
                {menuItems.map((item, i) =>
                  item === null ? (
                    <div key={i} className="pd-sep"/>
                  ) : (
                    <div key={i} className="pd-item" onClick={() => {
                      if (item[2]) navigate(item[2]);
                      else showToast(`${item[1]} açılıyor…`);
                      setProfileOpen(false);
                    }}>
                      {IC[item[0]]}
                      {item[1]}
                    </div>
                  )
                )}
                <div className="pd-sep"/>
                <div className="pd-item danger" onClick={() => { logout(); setProfileOpen(false); }}>
                  {IC.cikis}
                  Çıkış Yap
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bildirim paneli */}
        {notifOpen && (
          <div className="notif-panel open">
            <div className="np-hd">
              <span className="np-title">Bildirimler</span>
              {unread > 0 && <span className="np-badge">{unread}</span>}
              <span className="np-mark" onClick={()=>{markAllRead();showToast('Tümü okundu ✓');}}>Tümünü okundu say</span>
            </div>
            <div className="np-body">
              {bildirimler.map(b => (
                <div key={b.id} className={`nitem${!b.okundu?' unread tip-'+b.kategori:''}`}>
                  <div className="nitem-icon" style={{background:`${tipRenk[b.tip]||'#14B8A6'}18`}}>
                    {tipIcon[b.tip]||'🔔'}
                  </div>
                  <div className="nc">
                    <div className="nt"><strong>{b.baslik}</strong><br/>{b.mesaj}</div>
                    <div className="ntm">{b.zaman}</div>
                  </div>
                  {!b.okundu && <div className="undot"/>}
                </div>
              ))}
              {!bildirimler.length && (
                <div className="np-empty">
                  <div className="np-empty-icon">🔔</div>
                  <div className="np-empty-text">Bildirim yok</div>
                </div>
              )}
            </div>
            <div className="np-footer">
              <span className="np-footer-btn" onClick={()=>setNotifOpen(false)}>Tümünü gör</span>
              <span className="np-footer-btn" onClick={()=>{markAllRead();showToast('Tümü okundu ✓');}}>Tümünü temizle</span>
            </div>
          </div>
        )}
      </div>

      {/* Overlay */}
      {/* Overlay — notif ve profil için */}
      {(notifOpen||profileOpen) && (
        <div style={{position:'fixed',inset:0,zIndex:800}} onClick={closeAll}/>
      )}
      {/* Req panel overlay — ayrı, daha düşük z-index */}
      {reqOpen && (
        <div style={{position:'fixed',inset:0,zIndex:700}} onClick={()=>setReqOpen(false)}/>
      )}
    </div>
  );
}
