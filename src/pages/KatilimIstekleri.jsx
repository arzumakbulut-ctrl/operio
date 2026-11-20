import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useUIStore, useDataStore } from '../store';

const BASE = 'http://localhost:4000/api';
function tok() { return localStorage.getItem('operio_access'); }

const AV_COLORS = ['#DC2626','#EA580C','#059669','#0284C7','#7C3AED','#D97706'];
function mkAv(n) { return (n||'').split(' ').filter(Boolean).map(w=>w[0]).join('').slice(0,2).toUpperCase(); }

function dbToReq(r, i) {
  const durum = (r.durum||'Bekliyor') === 'Onaylandi' ? 'onaylanan' : (r.durum||'Bekliyor') === 'Reddedildi' ? 'reddedilen' : 'bekleyen';
  const ad = [r.ad, r.soyad].filter(Boolean).join(' ');
  return {
    id: r.id,
    av: mkAv(ad),
    bg: AV_COLORS[i % AV_COLORS.length],
    n: ad,
    rol: r.uzmanlik || '—',
    kurum: r.kurum || '—',
    tip: 'doktor',
    t: r.createdAt ? new Date(r.createdAt).toLocaleString('tr-TR') : '',
    tarih: r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : '',
    tel: r.tel || '',
    email: r.email || '',
    bransDetay: r.uzmanlik || '',
    deneyim: '',
    lisans: '',
    belge: [],
    not: r.mesaj || '',
    gecmis: [],
    _durum: durum,
  };
}

// ── VERİ ─────────────────────────────────────────────────────
const INIT_REQS = {
  bekleyen: [
    { id:'KI001', av:'MK', bg:'#DC2626', n:'Dr. Mehmet Kaya',     rol:'Ortopedi Uzmanı',                  kurum:'Merkez Devlet Hastanesi',   tip:'doktor',   t:'18 dk önce',   tarih:'2025-06-13', tel:'0532 111 22 33', email:'m.kaya@hastane.com',    bransDetay:'Ortopedi & Travmatoloji', deneyim:'12 yıl',   lisans:'İstanbul Tıp Fak.',  belge:['Diploma.pdf','Uzmanlık Belgesi.pdf','Özgeçmiş.pdf'],   not:'', gecmis:[] },
    { id:'KI002', av:'BÖ', bg:'#EA580C', n:'Hem. Büşra Öztürk',   rol:'Ameliyathane Hemşiresi',           kurum:'Merkez Devlet Hastanesi',   tip:'hemshire', t:'2 saat önce',  tarih:'2025-06-13', tel:'0541 222 33 44', email:'b.ozturk@hastane.com',  bransDetay:'Ameliyathane Hemşireliği',deneyim:'5 yıl',    lisans:'Hacettepe Hemşirelik',belge:['Diploma.pdf','Sertifika.pdf'],                          not:'', gecmis:[] },
    { id:'KI003', av:'ES', bg:'#059669', n:'Tek. Enes Sarı',       rol:'Anestezi Teknisyeni',              kurum:'Merkez Devlet Hastanesi',   tip:'anestek',  t:'4 saat önce',  tarih:'2025-06-13', tel:'0533 333 44 55', email:'e.sari@hastane.com',    bransDetay:'Anestezi & Reanimasyon',  deneyim:'3 yıl',    lisans:'Sağlık Teknisyenliği',belge:['Diploma.pdf'],                                          not:'', gecmis:[] },
    { id:'KI004', av:'NC', bg:'#7C3AED', n:'Dr. Neslihan Çelik',   rol:'Genel Cerrahi Uzmanı',             kurum:'Merkez Devlet Hastanesi',   tip:'doktor',   t:'Dün 15:40',    tarih:'2025-06-12', tel:'0543 444 55 66', email:'n.celik@hastane.com',   bransDetay:'Genel Cerrahi',           deneyim:'8 yıl',    lisans:'Ankara Tıp Fak.',    belge:['Diploma.pdf','Uzmanlık Belgesi.pdf'],                   not:'', gecmis:[] },
    { id:'KI005', av:'MH', bg:'#6366F1', n:'Dr. Kadir Arslan',     rol:'Misafir Hekim — Kardiyovasküler',  kurum:'Ankara Şehir Hastanesi',    tip:'misafir',  t:'Bugün 08:15',  tarih:'2025-06-13', tel:'0530 555 66 77', email:'k.arslan@ankara.com',   bransDetay:'Kardiyovasküler Cerrahi', deneyim:'15 yıl',   lisans:'Hacettepe Tıp Fak.', belge:['Pasaport.pdf','Uzmanlık Belgesi.pdf','Referans Mektubu.pdf'], not:'Misafir hekim protokolü imzalanmalı.', gecmis:[] },
  ],
  onaylanan: [
    { id:'KI006', av:'AY', bg:'#DC2626', n:'Dr. Ahmet Yılmaz',     rol:'Genel Cerrahi',                    kurum:'Merkez Devlet Hastanesi',   tip:'doktor',   t:'3 gün önce',   tarih:'2025-06-10', tel:'0532 999 88 77', email:'a.yilmaz@hastane.com',  bransDetay:'Genel Cerrahi',           deneyim:'18 yıl',   lisans:'İstanbul Tıp Fak.',  belge:['Diploma.pdf','Uzmanlık Belgesi.pdf'], not:'', gecmis:[{tip:'onay',txt:'Başvuru onaylandı. Sisteme erişim tanımlandı.',zaman:'2025-06-10 14:00',av:'FŞ',bg:'#0284C7'}] },
    { id:'KI007', av:'AK', bg:'#EA580C', n:'Hem. Ayşe Korkmaz',    rol:'Ameliyathane Hemşiresi',           kurum:'Merkez Devlet Hastanesi',   tip:'hemshire', t:'1 hafta önce', tarih:'2025-06-06', tel:'0541 888 77 66', email:'a.korkmaz@hastane.com', bransDetay:'Ameliyathane Hemşireliği',deneyim:'9 yıl',    lisans:'EÜ Hemşirelik',      belge:['Diploma.pdf'], not:'', gecmis:[{tip:'onay',txt:'Onaylandı.',zaman:'2025-06-06 09:30',av:'FŞ',bg:'#0284C7'}] },
  ],
  reddedilen: [
    { id:'KI008', av:'TY', bg:'#94A3B8', n:'Dr. Tarık Yücel',      rol:'Plastik Cerrahi',                  kurum:'Başka Hastane',             tip:'doktor',   t:'2 hafta önce', tarih:'2025-05-30', tel:'0533 777 66 55', email:'t.yucel@baskah.com',    bransDetay:'Plastik Cerrahi',         deneyim:'6 yıl',    lisans:'Marmara Tıp Fak.',   belge:['Diploma.pdf'], not:'Eksik belgeler tamamlanmadı.', gecmis:[{tip:'red',txt:'Reddedildi: Eksik belgeler tamamlanmadı.',zaman:'2025-05-31 11:00',av:'ÜY',bg:'#94A3B8'}] },
  ],
};

const TIP_CFG = {
  doktor:   { lbl:'Doktor',              icon:'👨‍⚕️', tag:'t-blue',   color:'#0284C7' },
  hemshire: { lbl:'Hemşire',             icon:'👩‍⚕️', tag:'t-teal',   color:'#14B8A6' },
  anestek:  { lbl:'Anestezi Teknisyeni', icon:'💉',   tag:'t-purple', color:'#7C3AED' },
  misafir:  { lbl:'Misafir Hekim',       icon:'🏥',   tag:'t-indigo', color:'#6366F1' },
};
const LOG_BG  = { onay:'#059669', red:'#DC2626', not:'#D97706', belge:'#0284C7' };
const LOG_LBL = { onay:'Onaylandı', red:'Reddedildi', not:'Not Eklendi', belge:'Belge İstendi' };

function StatusBadge({ durum }) {
  const cfg = { bekleyen:{cls:'t-orange',lbl:'Beklemede'}, onaylanan:{cls:'t-green',lbl:'Onaylandı'}, reddedilen:{cls:'t-red',lbl:'Reddedildi'} };
  const c = cfg[durum] || {cls:'t-gray',lbl:durum};
  return <span className={`tag ${c.cls}`} style={{fontSize:'9.5px'}}>{c.lbl}</span>;
}

// ── Detay Paneli ─────────────────────────────────────────────
function DetayPanel({ req, durum, onAksiyon, onClose }) {
  const { curRole } = useAuthStore();
  const { showToast } = useUIStore();
  const [notText, setNotText] = useState(req.not||'');
  const [belgeMenu, setBelgeMenu] = useState(null); // belge adı

  function handleBelge(ad, action) {
    setBelgeMenu(null);
    if (action === 'goruntule') {
      // Simüle: yeni sekmede PDF viewer aç
      const w = window.open('', '_blank');
      w.document.write(`<!DOCTYPE html><html><head><title>${ad}</title><style>
        body{margin:0;display:flex;flex-direction:column;height:100vh;font-family:system-ui;background:#1a1a2e}
        .bar{background:#0F766E;padding:12px 20px;display:flex;align-items:center;justify-content:space-between}
        .bar span{color:white;font-size:14px;font-weight:600}
        .bar button{background:rgba(255,255,255,0.15);color:white;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px}
        .viewer{flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px}
        .icon{font-size:64px}.name{color:rgba(255,255,255,0.7);font-size:16px}
        .btn{background:#14B8A6;color:white;border:none;padding:10px 24px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600}
      </style></head><body>
        <div class="bar"><span>📄 ${ad}</span><button onclick="window.close()">Kapat ✕</button></div>
        <div class="viewer">
          <div class="icon">📑</div>
          <div class="name">${ad}</div>
          <button class="btn" onclick="window.print()">🖨 Yazdır / PDF Olarak Kaydet</button>
        </div>
      </body></html>`);
      w.document.close();
    } else if (action === 'indir') {
      const a = document.createElement('a');
      const blob = new Blob([`Belge: ${ad}\nKişi: ${req.n}\nTarih: ${req.tarih}`], {type:'application/octet-stream'});
      a.href = URL.createObjectURL(blob);
      a.download = ad;
      a.click();
      URL.revokeObjectURL(a.href);
      showToast(`${ad} indiriliyor…`);
    }
  }
  const canAct = [0,1,2,8].includes(curRole) && durum === 'bekleyen';
  const tip = TIP_CFG[req.tip] || TIP_CFG.doktor;
  const tum_gecmis = [...req.gecmis];

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden',background:'var(--card-bg)',border:'1px solid var(--border)',borderRadius:14}}>

      {/* Başlık */}
      <div style={{padding:'14px 18px',borderBottom:'1px solid var(--border)',background:'var(--surface)',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div className="avatar" style={{background:req.bg,color:'white',width:44,height:44,fontSize:14,flexShrink:0}}>{req.av}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
              <div style={{fontSize:14,fontWeight:800,color:'var(--slate)',fontFamily:"'Outfit',sans-serif"}}>{req.n}</div>
              {req.tip==='misafir' && <span className="tag" style={{background:'rgba(99,102,241,0.12)',color:'#6366F1',border:'1px solid rgba(99,102,241,0.25)',fontSize:'8.5px'}}>Misafir Hekim</span>}
            </div>
            <div style={{fontSize:11,color:'var(--teal)',fontWeight:600}}>{req.rol}</div>
            <div style={{fontSize:10.5,color:'var(--slate-light)',marginTop:2}}>🏥 {req.kurum}</div>
          </div>
          <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6}}>
            <StatusBadge durum={durum}/>
            <span className={`tag ${tip.tag}`} style={{fontSize:'9px'}}>{tip.icon} {tip.lbl}</span>
          </div>
        </div>
      </div>

      {/* Scroll içerik */}
      <div style={{flex:1,overflowY:'auto',padding:'14px 18px'}}>

        {/* Kişisel Bilgiler */}
        <div className="det-section">
          <div className="det-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:12,height:12}}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Kişisel Bilgiler
          </div>
          <div className="hasta-grid">
            {[['Başvuru Tarihi',req.tarih],['Telefon',req.tel],['E-posta',req.email],['Branş / Alan',req.bransDetay],['Deneyim',req.deneyim],['Eğitim',req.lisans]].map(([l,v])=>(
              <div key={l} className="hasta-field"><div className="hasta-field-lbl">{l}</div><div className="hasta-field-val">{v||'—'}</div></div>
            ))}
          </div>
        </div>

        {/* Belgeler */}
        <div className="det-section">
          <div className="det-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:12,height:12}}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Yüklenen Belgeler
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {(req.belge||[]).map((b,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:9,padding:'8px 12px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,position:'relative'}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span style={{flex:1,fontSize:'11.5px',color:'var(--slate)',fontWeight:500}}>{b}</span>
                <div style={{display:'flex',gap:5}}>
                  <button onClick={()=>handleBelge(b,'goruntule')}
                    style={{fontSize:10,padding:'4px 10px',borderRadius:6,border:'1px solid rgba(20,184,166,0.3)',background:'rgba(20,184,166,0.08)',color:'var(--teal)',cursor:'pointer',fontFamily:'var(--font)',fontWeight:600}}>
                    👁 Görüntüle
                  </button>
                  <button onClick={()=>handleBelge(b,'indir')}
                    style={{fontSize:10,padding:'4px 10px',borderRadius:6,border:'1px solid var(--border)',background:'var(--card-bg)',color:'var(--slate-mid)',cursor:'pointer',fontFamily:'var(--font)',fontWeight:600}}>
                    ⬇ İndir
                  </button>
                </div>
              </div>
            ))}
            {!req.belge?.length && <div style={{fontSize:12,color:'var(--slate-light)'}}>Belge yüklenmemiş</div>}
          </div>
        </div>

        {/* Not varsa göster */}
        {req.not && durum !== 'bekleyen' && (
          <div className="det-section">
            <div className="det-title">📝 Not</div>
            <div style={{background:'rgba(217,119,6,0.06)',border:'1px solid rgba(217,119,6,0.2)',borderRadius:9,padding:'10px 13px',fontSize:12,color:'var(--slate-mid)',lineHeight:1.65}}>{req.not}</div>
          </div>
        )}

        {/* İşlem Geçmişi */}
        {tum_gecmis.length > 0 && (
          <div className="det-section" style={{marginBottom:0}}>
            <div className="det-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:12,height:12}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              İşlem Geçmişi
            </div>
            <div className="onay-timeline">
              {tum_gecmis.map((l,i)=>(
                <div key={i} className="ot-item">
                  <div className="ot-dot" style={{background:LOG_BG[l.tip]||'#94A3B8'}}>{l.av}</div>
                  <div className="ot-body">
                    <div className="ot-title">{LOG_LBL[l.tip]||l.tip}</div>
                    <div className="ot-note">{l.txt}</div>
                    <div className="ot-time">{l.zaman}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer aksiyonlar */}
      {canAct && (
        <div className="onay-detail-ft">
          <div style={{fontSize:10,fontWeight:600,color:'var(--slate-light)',textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:4}}>Not / Gerekçe</div>
          <textarea className="onay-not-area" rows={2} value={notText} onChange={e=>setNotText(e.target.value)} placeholder="Onay notu, red sebebi veya ek bilgi talebi..."/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,marginTop:2}}>
            <button className="onay-aksiyon-btn oba-onayla" onClick={()=>onAksiyon(req.id,'onayla',notText)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:14,height:14}}><polyline points="20 6 9 17 4 12"/></svg>
              Onayla
            </button>
            <button className="onay-aksiyon-btn oba-duzelt" onClick={()=>onAksiyon(req.id,'belge',notText)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Belge İste
            </button>
          </div>
          <button className="onay-aksiyon-btn oba-reddet" style={{marginTop:2}} onClick={()=>onAksiyon(req.id,'reddet',notText)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Reddet
          </button>
        </div>
      )}

      {durum === 'onaylanan' && (
        <div className="onay-detail-ft">
          <div style={{background:'#ECFDF5',border:'1px solid #BBF7D0',borderRadius:9,padding:'11px 14px',textAlign:'center'}}>
            <div style={{fontSize:13,fontWeight:700,color:'#059669',marginBottom:2}}>✓ Onaylandı</div>
            <div style={{fontSize:11,color:'#065F46'}}>Kullanıcı sisteme eklenmiş ve erişim tanımlanmıştır.</div>
          </div>
        </div>
      )}

      {durum === 'reddedilen' && (
        <div className="onay-detail-ft">
          <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:9,padding:'11px 14px',textAlign:'center'}}>
            <div style={{fontSize:13,fontWeight:700,color:'#DC2626',marginBottom:2}}>✕ Reddedildi</div>
            <div style={{fontSize:11,color:'#7F1D1D'}}>Bu başvuru reddedilmiştir.</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Ana Sayfa ─────────────────────────────────────────────────
export default function KatilimIstekleri() {
  const { personel } = useDataStore();
  const { curRole } = useAuthStore();
  const { showToast } = useUIStore();
  const navigate = useNavigate();
  const canAct = [0,1,2,8].includes(curRole);

  const EMPTY_REQS = { bekleyen:[], onaylanan:[], reddedilen:[] };
  const [reqs, setReqs] = useState(EMPTY_REQS);
  const [aktifTab, setAktifTab] = useState('bekleyen');
  const [selId, setSelId] = useState(null);

  useEffect(() => {
    fetch(`${BASE}/katilim`, { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const mapped = data.map(dbToReq);
        const grouped = { bekleyen: [], onaylanan: [], reddedilen: [] };
        mapped.forEach(r => { grouped[r._durum]?.push(r); });
        setReqs(grouped);
        setSelId(grouped.bekleyen[0]?.id || null);
      })
      .catch(() => {});
  }, []);
  const [aramaQ, setAramaQ] = useState('');

  const liste = reqs[aktifTab]?.filter(r =>
    !aramaQ || `${r.n} ${r.rol} ${r.kurum}`.toLowerCase().includes(aramaQ.toLowerCase())
  ) || [];

  const selReq = Object.values(reqs).flat().find(r => r.id === selId) || liste[0] || null;

  function switchTab(tab) {
    setAktifTab(tab);
    setSelId(reqs[tab]?.[0]?.id || null);
  }

  async function handleAksiyon(id, tip, notText) {
    const zaman = new Date().toLocaleString('tr-TR');
    const rolAd = ['ÜY','FŞ','KA','MA','AK','HÖ','AY','ZÖ','MD'][curRole] || 'YN';
    const rolBg = ['#14B8A6','#0284C7','#7C3AED','#059669','#EA580C','#D97706','#DC2626','#D97706','#059669'][curRole] || '#94A3B8';

    if (tip === 'onayla') {
      setReqs(prev => {
        const item = prev.bekleyen.find(r => r.id === id);
        if (!item) return prev;
        const updated = { ...item, not: notText, gecmis: [...item.gecmis, { tip:'onay', txt:'Başvuru onaylandı.' + (notText?' Not: '+notText:''), zaman, av:rolAd, bg:rolBg }] };
        return { ...prev, bekleyen: prev.bekleyen.filter(r => r.id !== id), onaylanan: [updated, ...prev.onaylanan] };
      });
      await fetch(`${BASE}/katilim/${id}`, { method:'PUT', headers:{'Content-Type':'application/json',Authorization:`Bearer ${tok()}`}, body: JSON.stringify({ durum:'Onaylandi' }) }).catch(()=>{});
      switchTab('onaylanan');
      setSelId(id);
      showToast(`${reqs.bekleyen.find(r=>r.id===id)?.n} onaylandı ✓`);
    } else if (tip === 'reddet') {
      if (!notText.trim()) { showToast('Lütfen red gerekçesi yazın'); return; }
      setReqs(prev => {
        const item = prev.bekleyen.find(r => r.id === id);
        if (!item) return prev;
        const updated = { ...item, not: notText, gecmis: [...item.gecmis, { tip:'red', txt:'Reddedildi: '+notText, zaman, av:rolAd, bg:rolBg }] };
        return { ...prev, bekleyen: prev.bekleyen.filter(r => r.id !== id), reddedilen: [updated, ...prev.reddedilen] };
      });
      await fetch(`${BASE}/katilim/${id}`, { method:'PUT', headers:{'Content-Type':'application/json',Authorization:`Bearer ${tok()}`}, body: JSON.stringify({ durum:'Reddedildi' }) }).catch(()=>{});
      switchTab('reddedilen');
      setSelId(id);
      showToast('Başvuru reddedildi');
    } else if (tip === 'belge') {
      if (!notText.trim()) { showToast('Hangi belge istendiğini yazın'); return; }
      setReqs(prev => ({
        ...prev,
        bekleyen: prev.bekleyen.map(r => r.id !== id ? r : { ...r, not: notText, gecmis: [...r.gecmis, { tip:'belge', txt:'Belge istendi: '+notText, zaman, av:rolAd, bg:rolBg }] })
      }));
      showToast('Belge talebi gönderildi');
    }
  }

  const TABS = [
    { k:'bekleyen',   lbl:'Bekleyen',    badge: reqs.bekleyen.length },
    { k:'onaylanan',  lbl:'Onaylanan',   badge: reqs.onaylanan.length },
    { k:'reddedilen', lbl:'Reddedilen',  badge: reqs.reddedilen.length },
  ];

  return (
    <div style={{display:'flex',flexDirection:'column',height:'calc(100vh - 80px)',overflow:'hidden'}}>

      {/* Başlık */}
      <div className="page-hd" style={{marginBottom:14,flexShrink:0}}>
        <div>
          <div className="page-hd-title">Katılım İstekleri</div>
          <div className="page-hd-sub">Sisteme katılım başvurularını değerlendirin</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <div style={{position:'relative'}}>
            <svg style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',width:13,height:13,stroke:'var(--slate-light)',fill:'none'}} viewBox="0 0 24 24" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input style={{border:'1px solid var(--border)',borderRadius:8,padding:'7px 12px 7px 30px',fontSize:12,background:'var(--surface)',color:'var(--slate)',outline:'none',width:200}} placeholder="İsim, rol, kurum ara…" value={aramaQ} onChange={e=>setAramaQ(e.target.value)}/>
          </div>
          {reqs.bekleyen.length > 0 && <span className="tag t-orange" style={{fontSize:11,padding:'5px 12px'}}>{reqs.bekleyen.length} Bekliyor</span>}
        </div>
      </div>

      {/* Tablar */}
      <div className="onay-tabs" style={{flexShrink:0}}>
        {TABS.map(t=>(
          <div key={t.k} className={`onay-tab${aktifTab===t.k?' active':''}`} onClick={()=>switchTab(t.k)}>
            {t.lbl}
            {t.badge > 0 && (
              <span className="onay-badge" style={{background:t.k==='bekleyen'?'var(--danger)':'#94A3B8'}}>{t.badge}</span>
            )}
          </div>
        ))}
      </div>

      {/* 2 kolonlu layout */}
      <div className="onay-layout" style={{flex:1,overflow:'hidden',marginTop:0,gridTemplateColumns:'280px 1fr',minHeight:0,height:'calc(100vh - 220px)'}}>

        {/* Sol: Liste */}
        <div style={{overflowY:'auto'}}>
          {liste.length === 0 ? (
            <div className="empty" style={{padding:'40px 20px'}}>
              <div className="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" width="32" height="32"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
              <div className="empty-text">Bu kategoride başvuru yok</div>
            </div>
          ) : liste.map(r => {
            const tip = TIP_CFG[r.tip] || TIP_CFG.doktor;
            const isSelected = r.id === selId;
            return (
              <div key={r.id} className={`onay-card${isSelected?' selected':''}`}
                onClick={()=>setSelId(r.id)}>
                <div className="onay-card-stripe" style={{background:r.bg}}/>
                <div className="onay-card-body">
                  <div className="onay-card-top">
                    <div style={{display:'flex',alignItems:'center',gap:10,flex:1,minWidth:0}}>
                      <div className="avatar" style={{background:r.bg,color:'white',width:34,height:34,fontSize:11,flexShrink:0}}>{r.av}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div className="onay-card-op" style={{display:'flex',alignItems:'center',gap:6}}>
                          {r.n}
                          {r.tip==='misafir' && <span className="tag" style={{background:'rgba(99,102,241,0.12)',color:'#6366F1',border:'1px solid rgba(99,102,241,0.25)',fontSize:'8px'}}>Misafir</span>}
                        </div>
                        <div className="onay-card-doc">{r.rol}</div>
                      </div>
                    </div>
                    <span className={`tag ${tip.tag}`} style={{fontSize:'9px',flexShrink:0}}>{tip.icon}</span>
                  </div>
                  <div className="onay-card-meta">
                    <div className="onay-meta-chip">🏥 {r.kurum}</div>
                    <div className="onay-meta-chip">📅 {r.tarih}</div>
                    <div className="onay-meta-chip">📎 {r.belge?.length||0} belge</div>
                  </div>
                </div>
                <div className="onay-card-footer">
                  <span style={{fontSize:10,color:'var(--slate-light)'}}>{r.t}</span>
                  {r.gecmis?.length > 0 && <span style={{fontSize:10,color:'var(--teal)',fontWeight:600}}>✓ {r.gecmis.length} işlem</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Sağ: Detay */}
        <div style={{overflow:'hidden',display:'flex',flexDirection:'column'}}>
          {selReq ? (
            <DetayPanel
              req={selReq}
              durum={aktifTab}
              onAksiyon={handleAksiyon}
              onClose={()=>setSelId(null)}
            />
          ) : (
            <div style={{background:'var(--card-bg)',border:'1px solid var(--border)',borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12,height:'100%',color:'var(--slate-light)'}}>
              <div style={{fontSize:36}}>👤</div>
              <div style={{fontSize:14,fontWeight:700,color:'var(--slate)'}}>Başvuru Seçin</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
