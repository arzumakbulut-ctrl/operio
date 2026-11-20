import { useTranslation } from 'react-i18next';
import { changeLanguage, getCurrentLanguage } from '../../i18n';

const LANGUAGES = [
  { code: 'tr', label: 'TR', full: 'Türkçe', flag: '🇹🇷' },
  { code: 'en', label: 'EN', full: 'English', flag: '🇬🇧' },
];

export default function LanguageSwitcher({ variant = 'topbar', onClose }) {
  const { t } = useTranslation();
  const current = getCurrentLanguage();

  function handleChange(code) {
    changeLanguage(code);
    onClose?.();
  }

  if (variant === 'sidebar') {
    return (
      <div style={{ display:'flex', background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:30, padding:3, margin:'0 4px 8px' }}>
        {LANGUAGES.map(lang => (
          <button key={lang.code} onClick={() => handleChange(lang.code)} title={lang.full}
            style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:4, padding:'5px 8px', borderRadius:20, cursor:'pointer', fontSize:10, fontWeight:700, background:current===lang.code?'rgba(20,184,166,0.25)':'transparent', color:current===lang.code?'#14B8A6':'rgba(255,255,255,0.45)', border:'none', transition:'all 0.15s' }}>
            <span>{lang.flag}</span><span>{lang.label}</span>
          </button>
        ))}
      </div>
    );
  }

  if (variant === 'topbar') {
    return (
      <div style={{ display:'flex', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:2, gap:1 }}>
        {LANGUAGES.map(lang => (
          <button key={lang.code} onClick={() => handleChange(lang.code)} title={lang.full}
            style={{ padding:'4px 9px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:700, background:current===lang.code?'var(--teal)':'transparent', color:current===lang.code?'white':'var(--slate-light)', border:'none', transition:'all 0.15s', display:'flex', alignItems:'center', gap:3 }}>
            <span style={{ fontSize:13 }}>{lang.flag}</span>
            <span>{lang.label}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div style={{ padding:'6px 0' }}>
      <div style={{ fontSize:10, fontWeight:700, color:'var(--slate-light)', textTransform:'uppercase', letterSpacing:'0.5px', padding:'4px 12px 8px' }}>
        {t('language.label')}
      </div>
      {LANGUAGES.map(lang => (
        <div key={lang.code} onClick={() => handleChange(lang.code)}
          style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', cursor:'pointer', borderRadius:8, margin:'0 4px', background:current===lang.code?'rgba(20,184,166,0.08)':'transparent', transition:'background 0.12s' }}>
          <span style={{ fontSize:18 }}>{lang.flag}</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--slate)' }}>{lang.full}</div>
          </div>
          {current===lang.code && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          )}
        </div>
      ))}
    </div>
  );
}
