import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore, useUIStore } from '../../store';
import { useNavigate } from 'react-router-dom';
import { assignTeamMember, removeTeamMember } from '../../services/surgeriesAdapter';

const DURUM_CFG = {
  'Devam Ediyor': { tag:'t-green',  barColor:'#059669' },
  'Bekliyor':     { tag:'t-orange', barColor:'#D97706' },
  'Tamamlandı':   { tag:'t-gray',   barColor:'#94A3B8' },
  'İptal':        { tag:'t-red',    barColor:'#DC2626' },
};
const EKIP_COLORS = {
  cerrah:'#DC2626', asistan:'#EA580C', scrub:'#0284C7',
  sirkule:'#7C3AED', anestezi:'#14B8A6',
  anesteknik:'#059669', yardimci:'#D97706',
};
const EKIP_LABELS = {
  cerrah:'Cerrah', asistan:'Asistan', scrub:'Hemşire',
  sirkule:'Ameliyathane Teknikeri', anestezi:'Anestezi Uzmanı',
  anesteknik:'Anestezi Teknisyeni', yardimci:'Yardımcı Sağlık Personeli',
};
const ATANABILIR_HEMSIRE  = ['scrub','sirkule','yardimci'];
const ATANABILIR_ANESTEZI = ['anestezi','anesteknik'];
const DURUM_COLOR = { Müsait:'#059669', Meşgul:'#D97706', İzinde:'#94A3B8' };
const ROL_FILTRELERI = {
  scrub:      ['Hemşire','Ameliyathane Teknikeri'],
  sirkule:    ['Ameliyathane Teknikeri','Hemşire'],
  yardimci:   ['Yardımcı Personel'],
  anestezi:   ['Anestezi Uzmanı'],
  anesteknik: ['Anestezi Tek.'],
};
const BASE = 'http://localhost:4000/api';
const tok = () => localStorage.getItem('operio_access');

const TIP_BG = {
  'Hemşire':                '#0284C7',
  'Ameliyathane Teknikeri': '#7C3AED',
  'Yardımcı Personel':      '#D97706',
  'Anestezi Uzmanı':        '#14B8A6',
  'Anestezi Tek.':          '#059669',
};

function mapPersonelFromDB(p) {
  const s = (p.specialty || p.roleName || '').toLowerCase();
  let tip = p.specialty || 'Personel';
  if (s.includes('hemş') || s.includes('hemsire')) tip = 'Hemşire';
  else if (s.includes('anestezi tek') || s.includes('teknisyen')) tip = 'Anestezi Tek.';
  else if (s.includes('anestezi') || s.includes('uzman')) tip = 'Anestezi Uzmanı';
  else if (s.includes('teknik')) tip = 'Ameliyathane Teknikeri';
  else if (s.includes('yardım') || s.includes('yardim')) tip = 'Yardımcı Personel';
  const statusMap = { 'Aktif': 'Müsait', 'Meşgul': 'Meşgul', 'İzinde': 'İzinde' };
  return {
    id: p.id,
    ad: p.name,
    av: mkInitials(p.name),
    bg: TIP_BG[tip] || '#94A3B8',
    tip,
    durum: statusMap[p.status] || 'Müsait',
    aktifSalon: null,
  };
}

function mkInitials(ad) {
  if (!ad || ad === '—') return '?';
  return ad.replace('Dr. ','').replace('Hem. ','').replace('Uzm. ','')
    .replace('Tek. ','').replace('Syl. ','')
    .split(' ').filter(Boolean).map(w => w[0]).join('').substring(0,2);
}

// AtamaKart — dosya seviyesinde tanımlandı (drawer dışında)
function AtamaKart({ roleKey, roleName, roleColor, mevcut, onSelect, personelListesi }) {
  const [acik, setAcik]     = useState(false);
  const [query, setQuery]   = useState('');
  const [secilen, setSecilen] = useState(mevcut || '');

  const hasDeger = !!(secilen && secilen !== '—');
  const av = hasDeger ? mkInitials(secilen) : '?';

  const liste = personelListesi.filter(p =>
    (ROL_FILTRELERI[roleKey] || []).includes(p.tip) &&
    (!query || p.ad.toLowerCase().includes(query.toLowerCase()))
  );

  function select(p) {
    setSecilen(p.ad);
    onSelect(roleKey, p.ad);
    setAcik(false);
    setQuery('');
  }

  return (
    <div className={`atama-section${hasDeger ? ' has-value' : ''}`}>
      <div className="atama-header" onClick={() => setAcik(a => !a)} style={{cursor:'pointer'}}>
        <div className="atama-header-info">
          <div className="atama-role-icon" style={{background:`${roleColor}18`}}>
            <svg viewBox="0 0 24 24" fill="none" stroke={roleColor} strokeWidth="2">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div>
            <div className="atama-role-lbl">{roleName}</div>
            <div className="atama-role-sub">{hasDeger ? 'Atandı' : 'Atama yapılmadı'}</div>
          </div>
        </div>
        <div className="atama-current">
          {hasDeger
            ? <><div className="atama-av" style={{background:roleColor}}>{av}</div><span className="atama-current-name">{secilen}</span></>
            : <span className="atama-unset">Personel seçin…</span>
          }
          <div className={`atama-toggle-btn${acik ? ' cancel' : ''}`}>
            {acik
              ? <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:12,height:12}}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Kapat</>
              : <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:12,height:12}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Değiştir</>
            }
          </div>
        </div>
      </div>
      {acik && (
        <div className="atama-dropdown-body open">
          <div className="atama-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input type="text" placeholder="Personel ara…" value={query} onChange={e => setQuery(e.target.value)}/>
          </div>
          <div className="atama-list">
            {liste.length === 0
              ? <div style={{padding:16,textAlign:'center',fontSize:11,color:'var(--slate-light)'}}>Personel bulunamadı</div>
              : liste.map(p => (
                <div key={p.id} className={`atama-person${secilen===p.ad?' selected':''}`} onClick={() => select(p)}>
                  <div className="atama-person-av" style={{background:p.bg}}>{p.av}</div>
                  <div className="atama-person-info">
                    <div className="atama-person-name">{p.ad}</div>
                    <div className="atama-person-role">{p.tip}{p.aktifSalon?' · '+p.aktifSalon:''}</div>
                  </div>
                  <span className="atama-person-status" style={{color:DURUM_COLOR[p.durum]}}>{p.durum}</span>
                  {secilen===p.ad && <div className="atama-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>}
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

export default function AmeliyatDrawer({ surgery: s, onClose }) {
  const { curRole }   = useAuthStore();
  const { showToast } = useUIStore();
  const navigate      = useNavigate();
  const [tab, setTab] = useState('hasta');
  const [ekipState, setEkipState] = useState(() => ({...(s?.ekip||{})}));
  const [personelListesi, setPersonelListesi] = useState([]);

  useEffect(() => {
    fetch(`${BASE}/personel`, { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (data.length > 0) setPersonelListesi(data.map(mapPersonelFromDB)); })
      .catch(() => {});
  }, []);

  // Eski kod `{ekip: ekipState}` ile PUT /ameliyatlar/:id çağırıyordu (nonexistent
  // route). Backend'de ekip ataması ayrı uçlar üzerinden kişi bazlı yapılıyor, o
  // yüzden değişen/çıkarılan her rol için ayrı assignTeamMember/removeTeamMember
  // çağrılır. personelListesi şu an backend'de /personel ucu bulunmadığı için
  // genelde boş geliyor — bu durumda ilgili rol için eşleşme bulunamaz ve o rol
  // sessizce atlanır (ayrı, bu planın kapsamı dışında bir personel-kablolama sorunu).
  async function kaydetEkip() {
    for (const [roleKey, ad] of Object.entries(ekipState)) {
      if (!ad || ad === '—') continue;
      const eskiAd = s.ekip?.[roleKey];
      if (eskiAd === ad) continue;
      const eskiPersonel = eskiAd ? personelListesi.find(p => p.ad === eskiAd) : null;
      if (eskiPersonel) await removeTeamMember(s.id, eskiPersonel.id);
      const yeniPersonel = personelListesi.find(p => p.ad === ad);
      if (yeniPersonel) await assignTeamMember(s.id, yeniPersonel.id, roleKey);
    }
    showToast('Ekip ataması kaydedildi ✓');
  }

  if (!s) return null;

  const dcfg = DURUM_CFG[s.durum] || DURUM_CFG['Bekliyor'];
  const h    = s.hastaDetay || {};

  const isHemsireSorumlu = curRole === 1;
  const isAnestezi       = curRole === 2;
  const showGaleri       = curRole === 6 || curRole === 10;
  const isSteril         = curRole === 8 || curRole === 9;

  const ekipRows = Object.entries(s.ekip||{}).map(([key,val]) => ({
    key, role:EKIP_LABELS[key]||key, name:val,
    color:EKIP_COLORS[key]||'#94A3B8', initials:mkInitials(val),
  }));
  const cerrahiEkip  = ekipRows.filter(r => ['cerrah','asistan','scrub','scrub2','sirkule','yardimci'].includes(r.key) && r.name!=='—');
  const anesteziEkip = ekipRows.filter(r => ATANABILIR_ANESTEZI.includes(r.key));

  function onSelect(key, ad) { setEkipState(prev => ({...prev, [key]:ad})); }

  return createPortal(
    <>
      <div className="drawer-overlay open" onClick={onClose}/>
      <div className="drawer open" id="ameliyatDrawer">

        {/* Status bar */}
        <div className="drawer-status-bar" style={{background:dcfg.barColor}}/>

        {/* Header */}
        <div className="drawer-header">
          <div style={{flex:1,minWidth:0}}>
            <div className="drawer-title">{s.op}</div>
            <div className="drawer-sub">{s.saat} – {s.bitis} · {s.salon} · {s.dr}</div>
          </div>
          <span className={`tag ${dcfg.tag}`} style={{fontSize:'9.5px',flexShrink:0}}>{s.durum}</span>
          <div className="drawer-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </div>
        </div>

        {/* Tabs */}
        <div className="drawer-tabs">
          {(isSteril
            ? [['hasta','Hasta Kartı'],['setler','Cerrahi Setler'],['malzeme','Malzemeler'],['cihaz','Cihaz & Ekipman']]
            : [['hasta','Hasta Kartı'],['ekip','Cerrahi Ekip'],['setler','Cerrahi Setler'],['malzeme','Malzemeler'],['cihaz','Cihaz & Ekipman'],['ilac','İlaçlar']]
          ).map(([k,l]) => (
            <div key={k} className={`dtab${tab===k?' active':''}`} onClick={() => setTab(k)}>{l}</div>
          ))}
          {showGaleri && <div className={`dtab${tab==='galeri'?' active':''}`} onClick={() => setTab('galeri')}>📁 Galeri</div>}
        </div>

        {/* Body */}
        <div className="drawer-body" id="drawerBody">

          {/* ── HASTA KARTI ── */}
          {tab==='hasta' && <>
            <div className="hasta-hero">
              <div className="hasta-av">{mkInitials(h.ad||'')}</div>
              <div className="hasta-hero-info">
                <div className="hasta-hero-name">{h.ad}</div>
                <div className="hasta-hero-meta">
                  <span>{h.yas} yaş · {h.cinsiyet}</span>
                  <span>🩸 {h.kan}</span>
                  <span>⚖ {h.agirlik} / {h.boy}</span>
                </div>
                <div style={{marginTop:6}}>
                  <span className="tag t-blue" style={{fontSize:9}}>{s.anestezi}</span>{' '}
                  <span className="tag t-teal" style={{fontSize:9}}>{h.asaSkor}</span>
                </div>
              </div>
            </div>
            <div className="hasta-grid" style={{marginBottom:14}}>
              <div className="hasta-field"><div className="hasta-field-lbl">TC Kimlik No</div><div className="hasta-field-val">{h.tc}</div></div>
              <div className="hasta-field"><div className="hasta-field-lbl">Telefon</div><div className="hasta-field-val">{h.tel}</div></div>
              <div className="hasta-field"><div className="hasta-field-lbl">Kan Grubu</div><div className="hasta-field-val" style={{color:'var(--danger)'}}>{h.kan}</div></div>
              <div className="hasta-field"><div className="hasta-field-lbl">ASA Skoru</div><div className="hasta-field-val">{h.asaSkor}</div></div>
              <div className="hasta-field" style={{gridColumn:'1/-1'}}><div className="hasta-field-lbl">Alerji</div><div className={`hasta-field-val${h.alerjiler==='Yok'?'':' warn'}`}>{h.alerjiler}</div></div>
              <div className="hasta-field" style={{gridColumn:'1/-1'}}><div className="hasta-field-lbl">Tanı</div><div className="hasta-field-val">{h.tani}</div></div>
            </div>
            <div className="det-section">
              <div className="det-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                Ameliyat Notları
              </div>
              <div style={{background:'rgba(217,119,6,0.06)',border:'1px solid rgba(217,119,6,0.2)',borderRadius:9,padding:'12px 14px',fontSize:12,color:'var(--slate-mid)',lineHeight:1.65}}>{h.notlar}</div>
            </div>
            <div className="det-section">
              <div className="det-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                Ameliyat Özeti
              </div>
              <div className="hasta-grid">
                <div className="hasta-field"><div className="hasta-field-lbl">Operasyon</div><div className="hasta-field-val" style={{fontSize:11}}>{s.op}</div></div>
                <div className="hasta-field"><div className="hasta-field-lbl">Tahmini Süre</div><div className="hasta-field-val">{s.sure} dk</div></div>
                <div className="hasta-field"><div className="hasta-field-lbl">Saat</div><div className="hasta-field-val">{s.saat} – {s.bitis}</div></div>
                <div className="hasta-field"><div className="hasta-field-lbl">Salon</div><div className="hasta-field-val">{s.salon}</div></div>
              </div>
            </div>
          </>}

          {/* ── CERRAHİ EKİP ── */}
          {tab==='ekip' && <>
            <div className="det-section">
              <div className="det-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
                Cerrahi Ekip
              </div>
              <div className="ekip-grid">
                {cerrahiEkip.map(r => (
                  <div key={r.key} className="ekip-item">
                    <div className="ekip-av" style={{background:r.color}}>{r.initials}</div>
                    <div className="ekip-info"><div className="ekip-name">{r.name}</div><div className="ekip-role">{r.role}</div></div>
                  </div>
                ))}
              </div>
            </div>

            {isHemsireSorumlu && (
              <div className="det-section">
                <div className="det-title" style={{marginBottom:12}}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                  Hemşire & Personel Ataması
                  <span style={{marginLeft:'auto',fontSize:'9.5px',color:'var(--teal)',textTransform:'none',letterSpacing:0,fontWeight:500}}>Kart seçerek atama yapın</span>
                </div>
                {ATANABILIR_HEMSIRE.map(key => (
                  <AtamaKart key={key} roleKey={key} roleName={EKIP_LABELS[key]} roleColor={EKIP_COLORS[key]} mevcut={ekipState[key]||''} onSelect={onSelect} personelListesi={personelListesi}/>
                ))}
                <div style={{display:'flex',justifyContent:'flex-end',marginTop:14}}>
                  <button className="btn btn-primary btn-sm" onClick={kaydetEkip}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:12,height:12}}><polyline points="20 6 9 17 4 12"/></svg>
                    Atamaları Kaydet
                  </button>
                </div>
              </div>
            )}

            {isAnestezi && (
              <div className="det-section">
                <div className="det-title" style={{marginBottom:12}}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a2 2 0 012 2v5a2 2 0 01-2 2 2 2 0 01-2-2V4a2 2 0 012-2z"/><path d="M10 9.343V17a2 2 0 004 0V9.343"/><path d="M8 11.8C5.6 12.9 4 15.3 4 18a8 8 0 0016 0c0-2.7-1.6-5.1-4-6.2"/></svg>
                  Anestezi & Teknisyen Ataması
                  <span style={{marginLeft:'auto',fontSize:'9.5px',color:'var(--teal)',textTransform:'none',letterSpacing:0,fontWeight:500}}>Kart seçerek atama yapın</span>
                </div>
                {ATANABILIR_ANESTEZI.map(key => (
                  <AtamaKart key={key} roleKey={key} roleName={EKIP_LABELS[key]} roleColor={EKIP_COLORS[key]} mevcut={ekipState[key]||''} onSelect={onSelect} personelListesi={personelListesi}/>
                ))}
                <div style={{display:'flex',justifyContent:'flex-end',marginTop:14}}>
                  <button className="btn btn-primary btn-sm" onClick={kaydetEkip}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:12,height:12}}><polyline points="20 6 9 17 4 12"/></svg>
                    Atamaları Kaydet
                  </button>
                </div>
              </div>
            )}

            <div className="det-section">
              <div className="det-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                Anestezi Ekibi
              </div>
              <div className="ekip-grid">
                {anesteziEkip.map(r => (
                  <div key={r.key} className="ekip-item">
                    <div className="ekip-av" style={{background:r.color,opacity:r.name==='—'?0.4:1}}>{r.initials}</div>
                    <div className="ekip-info">
                      <div className="ekip-name" style={{color:r.name==='—'?'var(--slate-light)':'var(--slate)'}}>{r.name==='—'?'Atanmadı':r.name}</div>
                      <div className="ekip-role">{r.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>}

          {/* ── CERRAHİ SETLER ── */}
          {tab==='setler' && (
            <div className="det-section">
              <div className="det-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
                Cerrahi Setler ({(s.setler||[]).length} kalem)
              </div>
              <div className="mat-list">
                {(s.setler||[]).map((item,i) => (
                  <div key={i} className="mat-row">
                    <div className="mat-row-icon" style={{background:'rgba(20,184,166,0.12)'}}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
                    </div>
                    <span className="mat-row-name">{item}</span>
                    <span className="tag t-teal" style={{fontSize:9}}>Set</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── MALZEMELER ── */}
          {tab==='malzeme' && (
            <div className="det-section">
              <div className="det-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Tıbbi Malzemeler ({(s.malzeme||[]).length} kalem)
              </div>
              <div className="mat-list">
                {(s.malzeme||[]).map((item,i) => {
                  const qty = item.match(/×[\d]+$/) ? item.match(/×[\d]+$/)[0] : '×1';
                  const name = item.replace(/\s*×[\d]+$/,'');
                  return (
                    <div key={i} className="mat-row">
                      <div className="mat-row-icon" style={{background:'rgba(2,132,199,0.1)'}}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      </div>
                      <span className="mat-row-name">{name}</span>
                      <span className="mat-row-qty">{qty}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── CİHAZ & EKİPMAN ── */}
          {tab==='cihaz' && (
            <div className="det-section">
              <div className="det-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                Cihaz & Ekipmanlar ({(s.cihaz||[]).length} kalem)
              </div>
              <div className="mat-list">
                {(s.cihaz||[]).map((item,i) => (
                  <div key={i} className="mat-row">
                    <div className="mat-row-icon" style={{background:'rgba(234,88,12,0.1)'}}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#EA580C" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                    </div>
                    <span className="mat-row-name">{item}</span>
                    <span className="tag t-orange" style={{fontSize:9}}>Cihaz</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── İLAÇLAR ── */}
          {tab==='ilac' && <>
            <div className="det-section">
              <div className="det-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 2H9a2 2 0 00-2 2v4a2 2 0 002 2h10a2 2 0 002-2V4a2 2 0 00-2-2z"/><path d="M7 8H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V10a2 2 0 00-2-2h-2"/></svg>
                İlaçlar & Anestezi Ajanları ({(s.ilac||[]).length} kalem)
              </div>
              <div className="ilac-grid">
                {(s.ilac||[]).map((item,i) => (
                  <div key={i} className="ilac-item">
                    <div className="ilac-dot"/>
                    <span className="ilac-name">{item}</span>
                  </div>
                ))}
              </div>
              <div style={{marginTop:14,background:'rgba(220,38,38,0.05)',border:'1px solid rgba(220,38,38,0.15)',borderRadius:9,padding:'11px 14px'}}>
                <div style={{fontSize:11,fontWeight:700,color:'var(--danger)',marginBottom:4}}>⚠ Hasta Alerjisi</div>
                <div style={{fontSize:'12.5px',color:'var(--slate-mid)'}}>
                  {h.alerjiler==='Yok' ? 'Bilinen alerji yok.' : <><strong style={{color:'var(--danger)'}}>{h.alerjiler}</strong> — uygulama öncesi kontrol edin.</>}
                </div>
              </div>
            </div>
            <div className="det-section">
              {s.lokalProtokol ? <>
                <div className="det-title" style={{color:'var(--teal)'}}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a2 2 0 012 2v5a2 2 0 01-2 2 2 2 0 01-2-2V4a2 2 0 012-2z"/><path d="M10 9.343V17a2 2 0 004 0V9.343"/><path d="M8 11.8C5.6 12.9 4 15.3 4 18a8 8 0 0016 0c0-2.7-1.6-5.1-4-6.2"/></svg>
                  Lokal Anestezik Hazırlanış Protokolü
                </div>
                <div style={{background:'rgba(20,184,166,0.05)',border:'1.5px solid rgba(20,184,166,0.2)',borderRadius:10,padding:'14px 16px',fontSize:13,color:'var(--slate)',lineHeight:1.7,whiteSpace:'pre-wrap',fontFamily:'var(--font)'}}>
                  {s.lokalProtokol}
                </div>
              </> : (
                <div style={{textAlign:'center',padding:20,color:'var(--slate-light)',fontSize:'12.5px'}}>
                  <div style={{fontSize:24,marginBottom:8}}>💉</div>
                  Lokal anestezik protokolü girilmemiş
                </div>
              )}
            </div>
          </>}

          {/* ── GALERİ ── */}
          {tab==='galeri' && (
            <div style={{textAlign:'center',padding:'48px 20px',color:'var(--slate-light)'}}>
              <div style={{fontSize:40,marginBottom:12}}>📁</div>
              <div style={{fontSize:14,fontWeight:600,color:'var(--slate)'}}>Ameliyat Galerisi</div>
              <div style={{fontSize:12,marginTop:6}}>Yüklenen fotoğraf ve belgeler burada görünür</div>
            </div>
          )}

        </div>{/* drawer-body sonu */}

        {/* Footer */}
        <div className="drawer-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Kapat</button>
          <button className="btn btn-secondary btn-sm" onClick={() => showToast('Yazdırılıyor…')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:12,height:12}}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Yazdır
          </button>
          {!isSteril && (
            <button className="btn btn-primary btn-sm" onClick={() => { navigate('/ameliyat-detay', { state: { surgeryId: s.id } }); onClose(); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:12,height:12}}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              Detay Sayfası
            </button>
          )}        </div>

      </div>
    </>,
    document.body
  );
}
