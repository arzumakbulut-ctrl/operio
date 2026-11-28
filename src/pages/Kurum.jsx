import { useState, useEffect } from 'react';
import { useAuthStore, useDataStore, useUIStore } from '../store';
import Modal from '../components/ui/Modal';

const AV_RENKLER = ['#DC2626','#0284C7','#7C3AED','#059669','#D97706','#EA580C'];
function avHarf(ad) {
  if (!ad) return '';
  const p = ad.replace(/Dr\. |Hem\. |Uzm\. |Sn\. /g, '').split(' ');
  return (p[0]?.[0] || '') + (p[1]?.[0] || '');
}

const SALON_DUR = {
  active:      { lbl:'Ameliyatta',  renk:'#059669' },
  idle:        { lbl:'Boşta',       renk:'#94A3B8' },
  maintenance: { lbl:'Bakımda',     renk:'#D97706' },
  reserved:    { lbl:'Hazır',       renk:'#0284C7' },
};

export default function Kurum() {
  const { kurumlar, kurumGruplari, rooms, personel, surgeries, cihazlar } = useDataStore();
  const { curRole } = useAuthStore();
  const { showToast } = useUIStore();
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('operio_access');
    // Gerçek backend #1 uç noktası: GET /api/audit — {success,data:[],meta} zarfı,
    // satırlar düz (nested .user yok) snake_case DB kolonları: action, resource,
    // resource_id, created_at, full_name (LEFT JOIN users).
    fetch('http://localhost:4000/api/audit', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json().catch(() => null).then(json => ({ status: r.status, json })))
      .then(({ status, json }) => {
        if (!json?.success) {
          // Final review Finding 5: GET /api/audit sadece Üst Yönetici'ye
          // (authorize(0)) açık — diğer roller için backend 403/FORBIDDEN
          // döner. Bu gerçek bir hata değil, rol bazlı bir görünürlük kısıtı;
          // bu durumda sessizce boş liste göster, toast GÖSTERME (diğer tüm
          // hata türlerinde toast göstermeye devam et).
          if (status === 403 || json?.error?.code === 'FORBIDDEN') { setLogs([]); return; }
          showToast(json?.error?.message || 'Aktivite günlüğü yüklenemedi');
          return;
        }
        setLogs(Array.isArray(json.data) ? json.data : []);
      })
      .catch(() => showToast('Aktivite günlüğü yüklenemedi'));
  }, []);

  const enrichedRooms = (rooms || []).map(r => {
    const devamEden = (surgeries || []).find(s => s.salon === r.ad && s.st === 'dot-active');
    return {
      ...r,
      active:  !!devamEden,
      op:      devamEden ? devamEden.op : 'Bugün planı yok',
      durum:   devamEden ? 'active' : 'idle',
    };
  });

  const now = new Date();
  const buAyAmeliyat = (surgeries || []).filter(s => {
    const d = new Date(s.tarihRaw);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const AYLAR = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
  const opData = AYLAR.map((_, i) =>
    (surgeries || []).filter(s => {
      const d = new Date(s.tarihRaw);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === i;
    }).length
  );
  const ytdToplam = opData.reduce((a, v) => a + v, 0);
  const maxOp = Math.max(...opData, 1);
  const [tab, setTab] = useState('genel');
  const canEdit = [0, 1].includes(curRole);

  const [kurum, setKurum] = useState({
    ad:          'Merkez Devlet Hastanesi',
    tur:         'Devlet Hastanesi',
    adres:       'Bağcılar Mah. Tıp Cad. No:42, Bağcılar / İstanbul',
    telefon:     '(0212) 555 10 20',
    email:       'ameliyathane@merkezdevlet.sag.gov.tr',
    web:         'www.merkezdevlethastanesi.sag.gov.tr',
    yatak:       '450 Yatak',
    jci:         'Evet (2023)',
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(kurum);

  function openEdit() {
    setForm(kurum);
    setModalOpen(true);
  }
  function saveKurum() {
    if (!form.ad.trim()) { showToast('Kurum adı zorunlu'); return; }
    setKurum(form);
    setModalOpen(false);
    showToast('Kurum bilgileri güncellendi ✓');
  }

  const tablar = [
    { k:'genel',      lbl:'Genel Bilgiler' },
    { k:'salonlar',   lbl:'Ameliyat Salonları' },
    { k:'yoneticiler',lbl:'Yöneticiler' },
    { k:'istatistik', lbl:'İstatistikler' },
    { k:'aktivite',   lbl:'Aktivite Günlüğü' },
  ];

  const distData = [
    {lbl:'Genel Cerrahi',    pct:34, renk:'#14B8A6'},
    {lbl:'Ortopedi & Travma',pct:22, renk:'#7C3AED'},
    {lbl:'Göz Hastalıkları', pct:14, renk:'#0284C7'},
    {lbl:'KBB',              pct:11, renk:'#EA580C'},
    {lbl:'Nöroşirürji',      pct:9,  renk:'#DC2626'},
    {lbl:'Diğer',            pct:10, renk:'#94A3B8'},
  ];

  return (
    <div>
      {/* Hero */}
      <div style={{ background:'linear-gradient(135deg,#0f766e,#0891b2)', borderRadius:16, padding:'24px 28px', display:'flex', alignItems:'center', gap:20, marginBottom:20 }}>
        <div style={{ width:64, height:64, borderRadius:14, background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:900, color:'white', flexShrink:0 }}>M</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:22, fontWeight:900, color:'white', fontFamily:"'Outfit',sans-serif" }}>Merkez Devlet Hastanesi</div>
          <div style={{ display:'flex', gap:12, marginTop:8, flexWrap:'wrap' }}>
            {[
              ['📍','İstanbul, Türkiye'],
              [`🏥`,`${enrichedRooms.length} Ameliyat Salonu`],
              [`👥`,`${(personel||[]).filter(p=>p.durum==='Aktif').length || (personel||[]).length} Aktif Personel`],
              ['● Aktif Sistem','','#4ADE80'],
            ].map(([ic, lbl, renk], i) => (
              <span key={i} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11.5, color: renk || 'rgba(255,255,255,0.85)', background:'rgba(255,255,255,0.15)', padding:'4px 10px', borderRadius:20, border:'1px solid rgba(255,255,255,0.2)' }}>
                {ic} {lbl}
              </span>
            ))}
          </div>
        </div>
        {canEdit && (
          <button className="btn" onClick={openEdit} style={{ background:'rgba(255,255,255,0.15)', color:'white', border:'1px solid rgba(255,255,255,0.3)' }}>
            ✏ Kurumu Düzenle
          </button>
        )}
      </div>

      {/* Tablar */}
      <div style={{ display:'flex', gap:2, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:4, marginBottom:18, width:'fit-content' }}>
        {tablar.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{
            padding:'7px 16px', borderRadius:9, fontSize:12.5, fontWeight:600,
            border:'none', cursor:'pointer',
            background: tab===t.k ? 'var(--teal)' : 'transparent',
            color: tab===t.k ? 'white' : 'var(--slate-light)',
          }}>{t.lbl}</button>
        ))}
      </div>

      {/* GENEL BİLGİLER */}
      {tab === 'genel' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
            {[
              {ic:'📅', lbl:'Sisteme Kayıt',   val:'12 Oca 2024',              alt:'491 gündür aktif',                           renk:'var(--slate)'},
              {ic:'🏥', lbl:'Bu Ay Ameliyat',  val:buAyAmeliyat,               alt:`${(surgeries||[]).length} toplam kayıt`,     renk:'var(--teal)'},
              {ic:'👥', lbl:'Toplam Personel', val:(personel||[]).length,       alt:`${(personel||[]).filter(p=>p.durum==='Aktif').length} aktif`, renk:'var(--slate)'},
              {ic:'🖥', lbl:'Kayıtlı Cihaz',   val:(cihazlar||[]).length,       alt:`${enrichedRooms.length} salon kayıtlı`,     renk:'var(--slate)'},
            ].map((k,i) => (
              <div key={i} style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:13, padding:'14px 16px' }}>
                <div style={{ fontSize:22 }}>{k.ic}</div>
                <div style={{ fontSize:22, fontWeight:900, color:k.renk, fontFamily:"'Outfit',sans-serif", marginTop:4 }}>{k.val}</div>
                <div style={{ fontSize:11.5, fontWeight:600, color:'var(--slate-mid)', marginTop:2 }}>{k.lbl}</div>
                <div style={{ fontSize:10.5, color:'var(--slate-light)', marginTop:2 }}>{k.alt}</div>
              </div>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div className="panel">
              <div className="panel-hd"><div className="panel-title">🏛 Kurum Bilgileri</div></div>
              <div style={{ padding:'8px 0' }}>
                {[
                  ['Kurum Adı',       kurum.ad],
                  ['Kurum Türü',      kurum.tur],
                  ['Adres',           kurum.adres],
                  ['Telefon',         kurum.telefon],
                  ['E-posta',         kurum.email],
                  ['Web',             kurum.web],
                  ['Yatak Kapasitesi',kurum.yatak],
                  ['JCI Akreditasyonu',kurum.jci],
                ].map(([l,v]) => (
                  <div key={l} style={{ display:'flex', padding:'9px 18px', borderBottom:'1px solid var(--border)' }}>
                    <span style={{ fontSize:11, fontWeight:600, color:'var(--slate-light)', width:140, flexShrink:0 }}>{l}</span>
                    <span style={{ fontSize:12, color:'var(--slate)' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel">
              <div className="panel-hd"><div className="panel-title">⚙ Sistem Paket Bilgisi</div></div>
              <div style={{ padding:'14px 18px' }}>
                <div style={{ background:'linear-gradient(135deg,rgba(20,184,166,0.08),rgba(8,145,178,0.08))', border:'1px solid rgba(20,184,166,0.2)', borderRadius:12, padding:'14px 16px', marginBottom:12 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:16, fontWeight:800, color:'var(--teal)' }}>Enterprise Paket</span>
                    <span className="tag t-teal">Aktif</span>
                  </div>
                  <div style={{ fontSize:11, color:'var(--slate-light)' }}>Yenileme: 12 Ocak 2026</div>
                </div>
                {[
                  ['Max Kullanıcı','Sınırsız'],['Max Ameliyat Salonu','Sınırsız'],
                  ['Veri Saklama','10 Yıl'],['Destek','7/24 Öncelikli'],
                  ['API Erişimi','Evet'],['Çoklu Kurum','Evet'],
                ].map(([l,v]) => (
                  <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                    <span style={{ fontSize:12, color:'var(--slate-mid)' }}>{l}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:'var(--slate)' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* SALONLAR */}
      {tab === 'salonlar' && (
        <>
          <div className="page-hd" style={{ marginBottom:14 }}>
            <div>
              <div className="page-hd-title">Ameliyat Salonları</div>
              <div className="page-hd-sub">{enrichedRooms.length} salon kayıtlı — {enrichedRooms.filter(r=>r.active).length} aktif</div>
            </div>
            {canEdit && <button className="btn btn-primary" onClick={() => showToast('Salon ekleme açılıyor…')}>+ Salon Ekle</button>}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
            {enrichedRooms.length === 0 ? (
              <div style={{ padding:32, textAlign:'center', color:'var(--slate-light)', gridColumn:'1/-1' }}>Henüz salon kaydı yok</div>
            ) : enrichedRooms.map((r, i) => {
              const dcfg = SALON_DUR[r.durum] || SALON_DUR.idle;
              return (
                <div key={r.id} style={{ background:'var(--card-bg)', border:`1.5px solid ${dcfg.renk}44`, borderRadius:14, padding:16, position:'relative', overflow:'hidden' }}>
                  <div style={{ position:'absolute', left:0, top:0, bottom:0, width:4, background:dcfg.renk }}/>
                  <div style={{ paddingLeft:8 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:'var(--slate-light)', textTransform:'uppercase', letterSpacing:'0.5px' }}>Salon {i + 1}</div>
                      <span style={{ fontSize:10, fontWeight:700, color:dcfg.renk }}>● {dcfg.lbl}</span>
                    </div>
                    <div style={{ fontSize:13.5, fontWeight:700, color:'var(--slate)', marginBottom:6 }}>{r.ad}</div>
                    <div style={{ fontSize:11.5, color:'var(--slate-mid)', marginBottom:10 }}>{r.op}</div>
                    <div style={{ display:'flex', gap:8 }}>
                      <span className="tag t-gray">👥 {r.kapasite || 0} Kişi</span>
                      <span className="tag t-gray">{r.active ? '🟢 Aktif' : '⚪ Boşta'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* YÖNETİCİLER */}
      {tab === 'yoneticiler' && (
        <>
          <div className="page-hd" style={{ marginBottom:14 }}>
            <div><div className="page-hd-title">Sistem Yöneticileri</div><div className="page-hd-sub">Alt yöneticiler ve sorumlular</div></div>
            {canEdit && <button className="btn btn-primary" onClick={() => showToast('Yönetici ekleme açılıyor…')}>+ Yönetici Ekle</button>}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div className="panel">
              <div className="panel-hd"><div className="panel-title">Üst Yönetici</div></div>
              <div style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:12, background:'rgba(20,184,166,0.04)', border:'1px solid rgba(20,184,166,0.2)', borderRadius:10, margin:'12px 16px' }}>
                <div style={{ width:42, height:42, borderRadius:'50%', background:'#14B8A6', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800, color:'white' }}>ÜY</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13.5, fontWeight:700, color:'var(--slate)' }}>Dr. Üst Yönetici</div>
                  <div style={{ fontSize:11, color:'var(--slate-light)', marginTop:2 }}>Sistem Üst Yöneticisi · Tüm yetkiler</div>
                </div>
                <span className="tag t-teal">Süper Admin</span>
              </div>
            </div>
            <div className="panel">
              <div className="panel-hd"><div className="panel-title">Personel & Sorumlular</div></div>
              <div style={{ padding:'8px 16px' }}>
                {(personel || []).length === 0 ? (
                  <div style={{ padding:'16px 0', textAlign:'center', color:'var(--slate-light)', fontSize:12 }}>Henüz personel kaydı yok</div>
                ) : (personel || []).slice(0, 6).map((p, i) => (
                  <div key={p.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom: i < Math.min((personel||[]).length, 6) - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ width:36, height:36, borderRadius:'50%', background:AV_RENKLER[i % 6], display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:'white', flexShrink:0 }}>{avHarf(p.ad)}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12.5, fontWeight:600, color:'var(--slate)' }}>{p.ad}</div>
                      <div style={{ fontSize:10.5, color:'var(--slate-light)', marginTop:1 }}>{p.uzmanlik || p.rol || ''}</div>
                    </div>
                    <span className={`tag ${p.durum === 'Aktif' ? 't-green' : 't-gray'}`} style={{ fontSize:9 }}>{p.durum || 'Aktif'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* İSTATİSTİK */}
      {tab === 'istatistik' && (
        <>
          <div className="page-hd" style={{ marginBottom:14 }}>
            <div><div className="page-hd-title">Kurum İstatistikleri</div><div className="page-hd-sub">2025 yılı genel performans verileri</div></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
            <div className="panel">
              <div className="panel-hd"><div className="panel-title">Branşa Göre Dağılım</div></div>
              <div style={{ padding:'14px 18px', display:'flex', flexDirection:'column', gap:10 }}>
                {distData.map((d,i) => (
                  <div key={i}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11.5, marginBottom:4 }}>
                      <span style={{ color:'var(--slate-mid)' }}>{d.lbl}</span>
                      <span style={{ fontWeight:700, color:d.renk }}>%{d.pct}</span>
                    </div>
                    <div style={{ height:6, background:'var(--border)', borderRadius:20, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${d.pct}%`, background:d.renk, borderRadius:20 }}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel">
              <div className="panel-hd"><div className="panel-title">Aylık Ameliyat Trendi 2025</div></div>
              <div style={{ padding:'14px 18px' }}>
                <div style={{ display:'flex', alignItems:'flex-end', gap:5, height:120 }}>
                  {opData.map((v, i) => {
                    const h = v ? Math.max(8, Math.round((v / maxOp) * 110)) : 5;
                    const isCurrentMonth = i === now.getMonth();
                    return (
                      <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                        <div style={{ width:'100%', height:h, background: v ? (isCurrentMonth ? 'var(--teal)' : 'rgba(20,184,166,0.35)') : 'var(--border)', borderRadius:'3px 3px 0 0' }}/>
                        <span style={{ fontSize:8, color:'var(--slate-light)' }}>{AYLAR[i]}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:12 }}>
                  <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:9, padding:10, textAlign:'center' }}>
                    <div style={{ fontSize:20, fontWeight:800, color:'var(--slate)' }}>{ytdToplam}</div>
                    <div style={{ fontSize:10, color:'var(--slate-light)' }}>YTD Toplam</div>
                  </div>
                  <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:9, padding:10, textAlign:'center' }}>
                    <div style={{ fontSize:20, fontWeight:800, color:'var(--teal)' }}>{buAyAmeliyat}</div>
                    <div style={{ fontSize:10, color:'var(--slate-light)' }}>Bu Ay</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="panel">
            <div className="panel-hd"><div className="panel-title">Salon Durumu</div></div>
            <div style={{ padding:'14px 18px', display:'flex', flexDirection:'column', gap:10 }}>
              {enrichedRooms.length === 0 ? (
                <div style={{ textAlign:'center', color:'var(--slate-light)', fontSize:12 }}>Salon verisi yok</div>
              ) : enrichedRooms.map((r, i) => {
                const aktifAmeliyat = (surgeries || []).filter(s => s.salon === r.ad).length;
                const toplamAmeliyat = Math.max((surgeries || []).length, 1);
                const w = Math.round((aktifAmeliyat / toplamAmeliyat) * 100);
                return (
                  <div key={r.id}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11.5, marginBottom:4 }}>
                      <span style={{ color:'var(--slate-mid)' }}>Salon {i+1} — {r.ad}</span>
                      <span style={{ fontWeight:700, color: r.active?'var(--teal)':'#94A3B8' }}>{r.active ? '🟢 Aktif' : '⚪ Boşta'}</span>
                    </div>
                    <div style={{ height:6, background:'var(--border)', borderRadius:20, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${Math.max(w, r.active ? 15 : 0)}%`, background: r.active?'var(--teal)':'#94A3B8', borderRadius:20 }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* AKTİVİTE */}
      {tab === 'aktivite' && (
        <>
          <div className="page-hd" style={{ marginBottom:14 }}>
            <div><div className="page-hd-title">Aktivite Günlüğü</div><div className="page-hd-sub">Son sistem aktiviteleri</div></div>
          </div>
          <div className="panel">
            <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
              {logs.length === 0 ? (
                <div style={{ padding:'32px 20px', textAlign:'center', color:'var(--slate-light)', fontSize:12 }}>Henüz aktivite kaydı yok</div>
              ) : logs.slice(0, 20).map((a, i) => (
                <div key={a.id} style={{ display:'flex', gap:14, padding:'14px 20px', borderBottom: i < Math.min(logs.length, 20) - 1 ? '1px solid var(--border)' : 'none', alignItems:'flex-start' }}>
                  <div style={{ width:38, height:38, borderRadius:10, background:'rgba(20,184,166,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>📋</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--slate)' }}>{a.action}</div>
                    <div style={{ fontSize:11.5, color:'var(--slate-light)', marginTop:2 }}>
                      {a.full_name || 'Sistem'}{a.resource ? ` · ${a.resource}${a.resource_id ? ' #' + a.resource_id : ''}` : ''}
                    </div>
                  </div>
                  <div style={{ fontSize:11, color:'var(--slate-light)', flexShrink:0 }}>
                    {a.created_at ? new Date(a.created_at).toLocaleString('tr-TR') : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      {/* ── KURUMU DÜZENLE MODAL ── */}
      {modalOpen && (
        <Modal title="Kurum Bilgilerini Düzenle" onClose={()=>setModalOpen(false)} width={620}>
          <div className="fr" style={{marginBottom:8}}>
            <div className="fg"><label className="fl">Kurum Adı *</label><input className="fi" value={form.ad} onChange={e=>setForm({...form,ad:e.target.value})}/></div>
            <div className="fg">
              <label className="fl">Kurum Türü</label>
              <select className="fi" value={form.tur} onChange={e=>setForm({...form,tur:e.target.value})}>
                {['Devlet Hastanesi','Eğitim Araştırma Hastanesi','Özel Hastane','Üniversite Hastanesi','Tıp Merkezi'].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="fg" style={{marginBottom:8}}>
            <label className="fl">Adres</label>
            <input className="fi" value={form.adres} onChange={e=>setForm({...form,adres:e.target.value})}/>
          </div>
          <div className="fr" style={{marginBottom:8}}>
            <div className="fg"><label className="fl">Telefon</label><input className="fi" value={form.telefon} onChange={e=>setForm({...form,telefon:e.target.value})}/></div>
            <div className="fg"><label className="fl">E-posta</label><input className="fi" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div>
          </div>
          <div className="fg" style={{marginBottom:8}}>
            <label className="fl">Web</label>
            <input className="fi" value={form.web} onChange={e=>setForm({...form,web:e.target.value})}/>
          </div>
          <div className="fr" style={{marginBottom:0}}>
            <div className="fg"><label className="fl">Yatak Kapasitesi</label><input className="fi" value={form.yatak} onChange={e=>setForm({...form,yatak:e.target.value})}/></div>
            <div className="fg"><label className="fl">JCI Akreditasyonu</label><input className="fi" value={form.jci} onChange={e=>setForm({...form,jci:e.target.value})} placeholder="Evet (2023) / Hayır"/></div>
          </div>
          <div className="mf">
            <button className="btn btn-secondary" onClick={()=>setModalOpen(false)}>İptal</button>
            <button className="btn btn-primary" onClick={saveKurum}>Kaydet</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
