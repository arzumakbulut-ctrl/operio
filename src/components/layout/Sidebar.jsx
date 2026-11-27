import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore, useThemeStore, useUIStore } from '../../store';
import { ROLES } from '../../data/roles';
import KatkiModal from '../ui/KatkiModal';
import { listSurgeries } from '../../services/surgeriesAdapter.js';

const ICONS = {
  dash:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  users:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  cal:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  clock:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  dev:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  chart:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  ind:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/><circle cx="22" cy="12" r="0"/><polyline points="18 4 22 8 18 12"/></svg>,
  doc:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  key:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
  staff:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  hosp:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  room:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3h18v18H3zM3 9h18M9 21V9"/></svg>,
  ane:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  set:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
  plus:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
  pat:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12h6M9 16h6M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>,
  proc:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="12" y2="16"/></svg>,
  steril: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>,
  raf:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="4" rx="1"/><rect x="2" y="10" width="20" height="4" rx="1"/><rect x="2" y="17" width="20" height="4" rx="1"/><line x1="6" y1="7" x2="6" y2="10"/><line x1="18" y1="7" x2="18" y2="10"/><line x1="6" y1="14" x2="6" y2="17"/><line x1="18" y1="14" x2="18" y2="17"/></svg>,
  qr:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="5" y="5" width="3" height="3"/><rect x="16" y="5" width="3" height="3"/><rect x="5" y="16" width="3" height="3"/></svg>,
  bell:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>,
  chat:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>,
};

export default function Sidebar({ onAIClick, mobileOpen, onMenuToggle }) {
  const { curRole, switchRole, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const { sidebarCollapsed, toggleSidebar, bekleyenSayisi, setBekleyenSayisi } = useUIStore();
  const navigate = useNavigate();
  const role = ROLES[curRole] || ROLES[0];
  const [roleOpen,  setRoleOpen]  = useState(false);
  const [katkiOpen, setKatkiOpen] = useState(false);
  const collapsed = sidebarCollapsed;

  useEffect(() => {
    const token = localStorage.getItem('operio_access');
    if (!token) return;
    listSurgeries()
      .then(list => {
        const n = list.filter(s => s.durum === 'Bekliyor').length;
        setBekleyenSayisi(n);
      })
      .catch(() => {});
  }, [setBekleyenSayisi]);

  return (
    <>
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>

      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-mark">
          <div className="logo-icon">
            <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="10" fill="url(#sbLg)"/>
              <defs><linearGradient id="sbLg" x1="0" y1="0" x2="32" y2="32"><stop stopColor="#0F766E"/><stop offset="1" stopColor="#0891b2"/></linearGradient></defs>
              <path d="M22 16h-4l-3 7L9 5l-3 7H4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="logo-text-wrap">
            <div style={{display:'flex',alignItems:'center',gap:7}}>
              <div className="logo-text">Operio</div>
              <div style={{fontSize:8,fontWeight:800,padding:'2px 8px',borderRadius:8,background:'rgba(20,184,166,0.2)',color:'rgba(45,212,191,0.9)',letterSpacing:'0.5px',textTransform:'uppercase'}}>Standard</div>
            </div>
            <div className="logo-sub">Ameliyathane Yönetimi</div>
          </div>
        </div>
      </div>

      {/* Kullanıcı pill */}
      <div className="user-pill" onClick={() => setRoleOpen(o => !o)}>
        <div className="user-pill-inner">
          <div className="avatar" style={{background:role.bg, color:'white'}}>{role.av}</div>
          <div className="user-info">
            <div className="user-name">{role.full}</div>
            <div className="user-role">{role.name}</div>
          </div>
          <span className="chevron" style={{transform:roleOpen?'rotate(180deg)':'none', transition:'transform 0.2s'}}>▼</span>
        </div>
      </div>

      {/* Rol seçici */}
      <div className={`role-switcher${roleOpen?' open':''}`} style={{maxHeight: roleOpen ? '260px' : '0', overflowY:'auto', overflowX:'hidden', transition:'max-height 0.2s ease', display:'block'}}>
        {ROLES.map(r => (
          <div key={r.id} className={`role-opt${curRole===r.id?' active':''}`}
            onClick={() => { switchRole(r.id); navigate('/dashboard'); setRoleOpen(false); }}>
            <div className="role-dot" style={{background:r.bg}}/>
            <span className="role-opt-name">{r.name}</span>
          </div>
        ))}
      </div>

      {/* Nav */}
      <nav id="navMenu" style={{overflowY:'auto', flex:1}}>
        {/* Daralt butonu */}
        <div className="sidebar-toggle-btn" onClick={toggleSidebar} id="sidebarToggleBtn">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          <span className="sidebar-toggle-lbl">Menüyü Daralt</span>
        </div>

        {/* Menü */}
        {role.nav.map((section) => (
          <div key={section.sec}>
            <div className="nav-section">{section.sec}</div>
            {section.items.map((item) => {
              const isOnay = item.path === '/onay';
              const dynLbl = isOnay && bekleyenSayisi > 0 ? 'Onay Bekleyen Randevular' : item.lbl;
              const dynBadge = isOnay ? (bekleyenSayisi > 0 ? String(bekleyenSayisi) : null) : item.badge;
              return (
                <div key={item.path + item.lbl} className="nav-item">
                  <NavLink to={item.path} className={({isActive}) => `nav-link${isActive?' active':''}`} title={dynLbl} onClick={() => mobileOpen && onMenuToggle && onMenuToggle()}>
                    <div className="nav-icon">{ICONS[item.ic] || ICONS.dash}</div>
                    <span className="nav-label">{dynLbl}</span>
                    {dynBadge && (
                      <span className="nav-badge" style={isOnay && bekleyenSayisi > 0 ? { background:'var(--danger)' } : {}}>
                        {dynBadge}
                      </span>
                    )}
                  </NavLink>
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">

        {/* Tema toggle */}
        <div className="theme-toggle" id="themeToggle">
          <div className={`theme-btn${theme==='light'?' active':''}`} onClick={() => setTheme('light')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            Açık
          </div>
          <div className={`theme-btn${theme==='dark'?' active':''}`} onClick={() => setTheme('dark')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
            Koyu
          </div>
        </div>

        {/* Yardım */}
        <div className="sfb" title="Yardım" style={{color:'rgba(255,255,255,0.7)'}} onClick={() => navigate('/yardim')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span>Yardım</span>
        </div>

        {/* Ayarlar */}
        <div className="sfb" title="Ayarlar" onClick={() => navigate('/ayarlar')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
          <span>Ayarlar</span>
        </div>

        {/* Katkıda Bulun */}
        <div className="sfb" title="Katkıda Bulun" style={{color:'#A78BFA'}} onClick={() => setKatkiOpen(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          <span>Katkıda Bulun</span>
        </div>

        {/* Çıkış */}
        <div className="sfb danger" title="Çıkış Yap" onClick={() => logout()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          <span>Çıkış Yap</span>
        </div>
      </div>

    </aside>

    {/* Katkıda Bulun Modal */}
    {katkiOpen && <KatkiModal onClose={() => setKatkiOpen(false)} />}
  </>
  );
}
