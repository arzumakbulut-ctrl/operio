import { useState, useEffect } from 'react';
import { useDataStore, useUIStore, useAuthStore } from '../store';

const BASE = 'http://localhost:4000/api';

const AY_ADLARI = ['','Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

const ROL_GRUPLARI = [
  { label:'Hemşire & Ameliyathane Teknikerleri', rol:1, renk:'#0284C7' },
  { label:'Ameliyathane Personeli',              rol:5, renk:'#F59E0B' },
  { label:'Anestezi Teknisyenleri',              rol:2, renk:'#7C3AED' },
  { label:'Sterilizasyon Personeli',             rol:9, renk:'#0E7490' },
];

const FALLBACK_VARDIYALAR = [
  { id:'v1', bas:'08:00', bit:'18:00', renk:'gunduz', tip:'normal' },
  { id:'v2', bas:'08:00', bit:'20:00', renk:'gunduz', tip:'normal' },
  { id:'v3', bas:'18:00', bit:'08:00', renk:'gece',   tip:'gece'   },
  { id:'v4', bas:'20:00', bit:'08:00', renk:'gece',   tip:'gece'   },
  { id:'v5', bas:'18:00', bit:'08:00', renk:'icap1',  tip:'icap'   },
  { id:'v6', bas:'18:00', bit:'08:00', renk:'icap2',  tip:'icap'   },
  { id:'v7', bas:'—',     bit:'—',     renk:'izin',   tip:'izin'   },
];

function vardiyaTip(v) {
  const r = (v.renk || '').toLowerCase();
  if (r.includes('izin') || v.tip === 'izin') return 'izin';
  if (r.includes('icap') || v.tip === 'icap') return 'icap';
  if (r.includes('gece') || v.tip === 'gece') return 'gece';
  return 'normal';
}

function saatHesapla(v) {
  if (!v || vardiyaTip(v) === 'izin' || !v.bas || v.bas === '—') return 0;
  const [bh, bm] = v.bas.split(':').map(Number);
  const [eh, em] = v.bit.split(':').map(Number);
  let dk = (eh * 60 + em) - (bh * 60 + bm);
  if (dk < 0) dk += 24 * 60;
  return dk / 60;
}

export default function MesaiHesaplama() {
  const { personel } = useDataStore();
  const { showToast } = useUIStore();
  const { curRole } = useAuthStore();

  const isUstYonetici = curRole === 0;
  const isSorumlu = curRole === 1 || curRole === 2 || curRole === 8;

  const [grupRol, setGrupRol] = useState(
    curRole === 2 || curRole === 3 ? 2 :
    curRole === 8 || curRole === 9 ? 9 : 1
  );

  // DB'den çalışma listesi atamalarını ve vardiya tanımlarını çek
  const [dbAtamalar, setDbAtamalar] = useState({});   // { 'pid|tarih': vardiyaObj }
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('operio_access');
    const h = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${BASE}/calisma`, { headers: h }).then(r => r.ok ? r.json() : []),
      fetch(`${BASE}/vardiyalar`, { headers: h }).then(r => r.ok ? r.json() : []),
    ]).then(([calismaData, vData]) => {
      const vardiyalar = (vData && vData.length > 0) ? vData : FALLBACK_VARDIYALAR;
      const map = {};
      (calismaData || []).forEach(liste => {
        (liste.atamalar || []).forEach(a => {
          const vObj = vardiyalar.find(v => v.id === a.vardiyaId);
          if (vObj) map[`${a.personelId}|${a.tarih}`] = vObj;
        });
      });
      setDbAtamalar(map);
    }).catch(() => {}).finally(() => setYukleniyor(false));
  }, []);

  const now = new Date();
  const [secilenYil, setSecilenYil] = useState(now.getFullYear());
  const [secilenAy,  setSecilenAy]  = useState(now.getMonth() + 1); // 1-12

  function oncekiAy() {
    if (secilenAy === 1) { setSecilenAy(12); setSecilenYil(y => y - 1); }
    else setSecilenAy(a => a - 1);
  }
  function sonrakiAy() {
    if (secilenAy === 12) { setSecilenAy(1); setSecilenYil(y => y + 1); }
    else setSecilenAy(a => a + 1);
  }

  const ayStr    = AY_ADLARI[secilenAy] + ' ' + secilenYil;
  const ayPrefix = `${secilenYil}-${String(secilenAy).padStart(2, '0')}`; // "2025-06"
  const buAy     = secilenYil === now.getFullYear() && secilenAy === now.getMonth() + 1;

  // Personeli normalize et - DB ve mock uyumlu
  function normalize(p) {
    return {
      id:    p.id,
      ad:    p.ad || p.n || p.name || '',
      av:    p.av || (p.ad||p.n||p.name||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase(),
      bg:    p.bg || '#14B8A6',
      gorev: p.specialty || p.rol || p.r || '',
    };
  }

  // Rol bazlı filtre
  const aktifGrup = ROL_GRUPLARI.find(g => g.rol === grupRol);
  const gosterilecekPersonel = (() => {
    const sp = p => (p.specialty || p.rol || p.r || '').toLowerCase();
    if (grupRol === 1) {
      const liste = personel.filter(p => (sp(p).includes('hem') || sp(p).includes('scrub') || sp(p).includes('servis hem') || sp(p).includes('ameliyathane sorumlu') || sp(p).includes('teknisyen') || sp(p).includes('teknikeri')) && !sp(p).includes('steril') && !sp(p).includes('anestezi'));
      return [...liste.filter(p=>sp(p).includes('sorumlu')), ...liste.filter(p=>!sp(p).includes('sorumlu'))];
    }
    if (grupRol === 2) return personel.filter(p => sp(p).includes('anestezi'));
    if (grupRol === 5) return personel.filter(p => sp(p).includes('ameliyathane personeli') || sp(p).includes('yardımcı') || sp(p).includes('yard'));
    if (grupRol === 9) return personel.filter(p => sp(p).includes('steril'));
    return personel;
  })();

  // Mesai hesapla — DB atamalarından
  const hesap = gosterilecekPersonel.map((p) => {
    const norm = normalize(p);
    let normalSaat=0, geceSaat=0, icapSaat=0, izinGun=0;
    let normalGun=0, geceGun=0, icapGun=0;

    Object.entries(dbAtamalar).forEach(([k, vObj]) => {
      if (!k.startsWith(norm.id + '|')) return;
      const tarihPart = k.split('|')[1] || '';
      if (!tarihPart.startsWith(ayPrefix)) return;
      const tip  = vardiyaTip(vObj);
      const saat = saatHesapla(vObj);
      if (tip === 'icap')   { icapSaat  += saat; icapGun++; }
      else if (tip === 'gece') { geceSaat += saat; geceGun++; }
      else if (tip === 'izin') { izinGun++; }
      else                     { normalSaat += saat; normalGun++; }
    });

    const toplam = normalSaat + geceSaat + icapSaat;
    const fazla  = Math.max(0, toplam - 160);

    return { ...norm, normalSaat, geceSaat, icapSaat, izinGun, normalGun, geceGun, icapGun, toplam, fazla, ek: 0 };
  });

  const toplamNormal = hesap.reduce((a,p) => a+p.normalSaat, 0);
  const toplamGece   = hesap.reduce((a,p) => a+p.geceSaat,   0);
  const toplamIcap   = hesap.reduce((a,p) => a+p.icapSaat,   0);
  const toplamFazla  = hesap.reduce((a,p) => a+p.fazla,      0);
  const toplamIzin   = hesap.reduce((a,p) => a+p.izinGun,    0);

  return (
    <div>
      <div className="page-hd" style={{ marginBottom:16 }}>
        <div>
          <div className="page-hd-title">Mesai Hesaplama</div>
          <div className="page-hd-sub">{hesap.length} personel</div>
        </div>

        {/* Ay Seçici */}
        <div style={{ display:'flex', alignItems:'center', gap:6, background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:10, padding:'4px 6px' }}>
          <button onClick={oncekiAy} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--slate-mid)', padding:'4px 8px', borderRadius:6, fontSize:16, lineHeight:1, display:'flex', alignItems:'center' }}>
            ‹
          </button>
          <span style={{ fontSize:13, fontWeight:700, color:'var(--slate)', minWidth:120, textAlign:'center', letterSpacing:'-0.2px' }}>
            {ayStr}
          </span>
          <button onClick={sonrakiAy} disabled={buAy} style={{ background:'none', border:'none', cursor: buAy ? 'default' : 'pointer', color: buAy ? 'var(--border)' : 'var(--slate-mid)', padding:'4px 8px', borderRadius:6, fontSize:16, lineHeight:1, display:'flex', alignItems:'center' }}>
            ›
          </button>
        </div>

        <button className="btn btn-primary" onClick={() => showToast('Mesai raporu indiriliyor…')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:12, height:12 }}>
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Rapor İndir
        </button>
      </div>

      {/* Özet KPI */}
      <div className="mesai-ozet-grid" style={{ marginBottom:14 }}>
        {[
          { val: hesap.length,                  lbl: 'Toplam Personel', color: 'var(--slate)'   },
          { val: toplamNormal.toFixed(0)+'s',   lbl: 'Normal Mesai',    color: 'var(--teal)'    },
          { val: toplamGece.toFixed(0)+'s',     lbl: 'Gece Mesai',      color: '#1e3a5f'        },
          { val: toplamIcap.toFixed(0)+'s',     lbl: 'İcap Mesai',      color: '#7C3AED'        },
          { val: toplamFazla.toFixed(0)+'s',    lbl: 'Fazla Mesai',     color: toplamFazla>0?'#D97706':'var(--slate)' },
        ].map((k,i) => (
          <div key={i} className="mesai-ozet-kart">
            <div className="mok-val" style={{ color: k.color }}>{k.val}</div>
            <div className="mok-lbl">{k.lbl}</div>
          </div>
        ))}
      </div>

      {/* Personel Grubu Seçici */}
      {(isUstYonetici || isSorumlu) && (
        <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'14px 18px', marginBottom:14, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <div style={{ fontSize:12, fontWeight:600, color:'var(--slate)', whiteSpace:'nowrap' }}>Personel Grubu:</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, flex:1 }}>
            {(isUstYonetici
              ? ROL_GRUPLARI
              : curRole === 1
                ? ROL_GRUPLARI.filter(g => g.rol === 1 || g.rol === 5)
                : curRole === 2
                  ? ROL_GRUPLARI.filter(g => g.rol === 2)
                  : ROL_GRUPLARI.filter(g => g.rol === 9)
            ).map(g => (
              <div key={g.rol} onClick={() => isUstYonetici || curRole === 1 ? setGrupRol(g.rol) : undefined}
                style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 12px', borderRadius:8,
                  cursor: isUstYonetici || curRole === 1 ? 'pointer' : 'default',
                  transition:'all 0.15s',
                  border:`1.5px solid ${grupRol===g.rol ? g.renk : 'var(--border)'}`,
                  background: grupRol===g.rol ? `${g.renk}15` : 'var(--surface)' }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:g.renk }}/>
                <span style={{ fontSize:'11.5px', fontWeight:600, color:grupRol===g.rol?g.renk:'var(--slate-mid)' }}>{g.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mesai yoksa bilgi */}
      {!yukleniyor && hesap.length > 0 && hesap.every(p => p.toplam === 0) && (
        <div style={{ padding:'12px 16px', background:'rgba(217,119,6,0.08)', border:'1px solid rgba(217,119,6,0.2)', borderRadius:10, marginBottom:14, fontSize:12, color:'#D97706', fontWeight:600 }}>
          ℹ️ Bu ay için çalışma listesinde henüz vardiya ataması yok.
        </div>
      )}
      {yukleniyor && (
        <div style={{ padding:'12px 16px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, marginBottom:14, fontSize:12, color:'var(--slate-light)' }}>
          Veriler yükleniyor...
        </div>
      )}

      {/* Tablo */}
      <div className="cal-table-wrap">
        <table className="cal-table">
          <thead>
            <tr>
              <th style={{ textAlign:'left', minWidth:160, position:'sticky', left:0, zIndex:3, background:'var(--surface)' }}>Personel</th>
              <th style={{ minWidth:80, textAlign:'center' }}><span style={{ color:'var(--teal)' }}>Normal</span><br/><span style={{ fontSize:'8.5px', fontWeight:400, color:'var(--slate-light)' }}>Saat / Gün</span></th>
              <th style={{ minWidth:80, textAlign:'center' }}><span style={{ color:'#1e3a5f' }}>Gece</span><br/><span style={{ fontSize:'8.5px', fontWeight:400, color:'var(--slate-light)' }}>Saat / Gün</span></th>
              <th style={{ minWidth:80, textAlign:'center' }}><span style={{ color:'#7C3AED' }}>İcap</span><br/><span style={{ fontSize:'8.5px', fontWeight:400, color:'var(--slate-light)' }}>Saat / Nöbet</span></th>
              <th style={{ minWidth:60, textAlign:'center' }}>İzin<br/><span style={{ fontSize:'8.5px', fontWeight:400, color:'var(--slate-light)' }}>Gün</span></th>
              <th style={{ minWidth:70, textAlign:'center' }}>Toplam<br/><span style={{ fontSize:'8.5px', fontWeight:400, color:'var(--slate-light)' }}>Saat</span></th>
              <th style={{ minWidth:70, textAlign:'center' }}><span style={{ color:'var(--teal)' }}>Ek Mesai</span><br/><span style={{ fontSize:'8.5px', fontWeight:400, color:'var(--slate-light)' }}>Saat</span></th>
              <th style={{ minWidth:80, textAlign:'center' }}>Durum</th>
            </tr>
          </thead>
          <tbody>
            {hesap.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign:'center', padding:32, color:'var(--slate-light)' }}>Bu grupta personel bulunamadı</td></tr>
            ) : hesap.map(p => (
              <tr key={p.id}>
                <td style={{ position:'sticky', left:0, background:'var(--card-bg)', zIndex:1, minWidth:160 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div className="avatar" style={{ background:p.bg, color:'white', width:28, height:28, fontSize:9, flexShrink:0 }}>{p.av}</div>
                    <div>
                      <div style={{ fontSize:12, fontWeight:600, color:'var(--slate)', whiteSpace:'nowrap' }}>{p.ad}</div>
                      <div style={{ fontSize:'9.5px', color:'var(--slate-light)' }}>{p.gorev}</div>
                    </div>
                  </div>
                </td>
                <td style={{ textAlign:'center' }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--teal)' }}>{p.normalSaat.toFixed(0)}s</div>
                  <div style={{ fontSize:9, color:'var(--slate-light)' }}>{p.normalGun} gün</div>
                </td>
                <td style={{ textAlign:'center' }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'#1e3a5f' }}>{p.geceSaat.toFixed(0)}s</div>
                  <div style={{ fontSize:9, color:'var(--slate-light)' }}>{p.geceGun} gün</div>
                </td>
                <td style={{ textAlign:'center' }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'#7C3AED' }}>{p.icapSaat.toFixed(0)}s</div>
                  <div style={{ fontSize:9, color:'var(--slate-light)' }}>{p.icapGun} nöbet</div>
                </td>
                <td style={{ textAlign:'center' }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--slate-light)' }}>{p.izinGun}</div>
                  <div style={{ fontSize:9, color:'var(--slate-light)' }}>gün</div>
                </td>
                <td style={{ textAlign:'center' }}>
                  <div style={{ fontSize:13, fontWeight:800, fontFamily:"'Outfit',sans-serif", letterSpacing:'-0.5px',
                    color: p.fazla>0?'var(--warning)':p.toplam>=100?'var(--slate)':'var(--slate-light)' }}>
                    {p.toplam.toFixed(0)}s
                  </div>
                </td>
                <td style={{ textAlign:'center' }}>
                  {p.ek > 0
                    ? <span style={{ fontSize:12, fontWeight:800, color:'var(--teal)', background:'rgba(20,184,166,0.1)', border:'1px solid rgba(20,184,166,0.2)', borderRadius:20, padding:'3px 10px' }}>+{p.ek}s</span>
                    : <span style={{ fontSize:11, color:'var(--slate-light)' }}>—</span>}
                </td>
                <td style={{ textAlign:'center' }}>
                  {p.fazla > 0
                    ? <span className="tag t-orange" style={{ fontSize:9 }}>+{p.fazla.toFixed(0)}s</span>
                    : <span className="tag t-green"  style={{ fontSize:9 }}>Normal</span>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background:'var(--surface)', borderTop:'2px solid var(--border)' }}>
              <td style={{ fontSize:11, fontWeight:700, color:'var(--slate)', padding:'10px 12px', position:'sticky', left:0, background:'var(--surface)' }}>Genel Toplam</td>
              <td style={{ textAlign:'center', fontSize:12, fontWeight:700, color:'var(--teal)' }}>{toplamNormal.toFixed(0)}s</td>
              <td style={{ textAlign:'center', fontSize:12, fontWeight:700, color:'#1e3a5f' }}>{toplamGece.toFixed(0)}s</td>
              <td style={{ textAlign:'center', fontSize:12, fontWeight:700, color:'#7C3AED' }}>{toplamIcap.toFixed(0)}s</td>
              <td style={{ textAlign:'center', fontSize:12, fontWeight:700, color:'var(--slate-light)' }}>{toplamIzin}</td>
              <td style={{ textAlign:'center', fontSize:13, fontWeight:800, color:'var(--slate)', fontFamily:"'Outfit',sans-serif" }}>
                {(toplamNormal+toplamGece+toplamIcap).toFixed(0)}s
              </td>
              <td style={{ textAlign:'center', fontSize:12, fontWeight:700, color:'var(--teal)' }}>—</td>
              <td style={{ textAlign:'center' }}>
                {toplamFazla > 0
                  ? <span className="tag t-orange" style={{ fontSize:9 }}>+{toplamFazla.toFixed(0)}s Fazla</span>
                  : <span className="tag t-green"  style={{ fontSize:9 }}>Normal</span>}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
