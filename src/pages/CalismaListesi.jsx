import React, { useState, useMemo, useEffect } from 'react';
import { useAuthStore, useUIStore } from '../store';

const INIT_VARDIYALAR = [
  { id:'v1', ad:'Gündüz',        bas:'08:00', bit:'18:00', renk:'gunduz', tip:'normal', icap:'' },
  { id:'v2', ad:'Gündüz Uzun',   bas:'08:00', bit:'20:00', renk:'gunduz', tip:'normal', icap:'' },
  { id:'v3', ad:'Gece',          bas:'18:00', bit:'08:00', renk:'gece',   tip:'normal', icap:'' },
  { id:'v4', ad:'Gece Uzun',     bas:'20:00', bit:'08:00', renk:'gece',   tip:'normal', icap:'' },
  { id:'v5', ad:'Gece 1. İcap',  bas:'18:00', bit:'08:00', renk:'icap1',  tip:'icap',   icap:'İcapçı1' },
  { id:'v6', ad:'Gece 2. İcap',  bas:'18:00', bit:'08:00', renk:'icap2',  tip:'icap',   icap:'İcapçı2' },
  { id:'v7', ad:'İzin',          bas:'—',     bit:'—',     renk:'izin',   tip:'izin',   icap:'' },
];

const VARDIYA_COLOR = { gunduz:'#0284C7', gece:'#1e3a5f', icap1:'#7C3AED', icap2:'#EA580C', izin:'#94A3B8' };
const VARDIYA_CSS   = { gunduz:'vt-gunduz', gece:'vt-gece', icap1:'vt-icap1', icap2:'vt-icap2', izin:'vt-izin' };
const GUN_ADLARI    = ['Paz','Pzt','Sal','Çar','Per','Cum','Cts'];
const AY_KISA       = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const AY_UZUN       = ['','Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

function saatHesapla(vid, vList) {
  const v = vList.find(x => x.id === vid);
  if (!v || v.tip === 'izin' || !v.bas || v.bas === '—') return 0;
  const [bh, bm] = v.bas.split(':').map(Number);
  const [eh, em] = v.bit.split(':').map(Number);
  let dk = (eh*60+em) - (bh*60+bm);
  if (dk < 0) dk += 24*60;
  return dk / 60;
}

function tarihKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function haftalikGunler(offset) {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay()+6)%7));
  base.setDate(base.getDate() + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return d;
  });
}

function aylikGunler(ayStr) {
  const [y, m] = ayStr.split('-').map(Number);
  const son = new Date(y, m, 0).getDate();
  return Array.from({ length: son }, (_, i) => new Date(y, m-1, i+1));
}

const ROLE_BG = {
  'hem': '#0284C7', 'sorumlu': '#0284C7', 'servis': '#0284C7',
  'anestezi': '#7C3AED', 'steril': '#0E7490',
  'personel': '#F59E0B', 'yardım': '#F59E0B', 'yard': '#F59E0B',
  'doktor': '#DC2626', 'cerrah': '#DC2626',
};

function dbPersonelToUi(p) {
  const rolAd = (p.role?.name || '').toLowerCase();
  const spec   = (p.specialty || '').toLowerCase();
  const combined = rolAd + ' ' + spec;
  let bg = '#64748B';
  for (const [k, c] of Object.entries(ROLE_BG)) {
    if (combined.includes(k)) { bg = c; break; }
  }
  const av = p.name.split(' ').filter(w => w.length > 1 && !/^(dr|hem|srl|tek|uzm|sn)\.?$/i.test(w)).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return { id: p.id, ad: p.name, av, bg, gorev: p.specialty || p.role?.name || '', rolAd, spec };
}

export default function CalismaListesi() {
  const { showToast } = useUIStore();
  const { curRole } = useAuthStore();
  const token = localStorage.getItem('operio_access');
  const BASE = 'http://localhost:4000/api';

  const [dbPersonel, setDbPersonel] = useState([]);

  const isUstYonetici = curRole === 0;
  const isReadOnly = [3, 4, 5, 9].includes(curRole);

  const [grupRol, setGrupRol] = useState(
    curRole === 2 || curRole === 3 ? 2 :
    curRole === 8 || curRole === 9 ? 9 :
    curRole === 5 ? 5 : 1
  );
  const [viewMode, setViewMode] = useState('hafta');
  const [haftaOffset, setHaftaOffset] = useState(0);
  const [calAy, setCalAy] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
  });
  const [listeler, setListeler] = useState({});
  const [aktifListeId, setAktifListeId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [vardiyalar, setVardiyalar] = useState(INIT_VARDIYALAR);
  const [vardiyaModal, setVardiyaModal] = useState(false);
  const [vardiyaForm, setVardiyaForm] = useState({ ad:'', bas:'08:00', bit:'17:00', renk:'gunduz', tip:'normal', icap:'' });
  const [editVardiyaId, setEditVardiyaId] = useState(null);
  const [cellModal, setCellModal] = useState(null); // {pid, pad, pav, pbg, tarih}
  const [yeniModal, setYeniModal] = useState(false);
  const [yeniForm, setYeniForm] = useState({ isim: '', ay: '' });

  const today = tarihKey(new Date());
  const gunler = viewMode === 'hafta' ? haftalikGunler(haftaOffset) : aylikGunler(calAy);
  const aktifListe = aktifListeId ? listeler[aktifListeId] : null;

  // DB'den listeleri, personeli ve vardiya tanımlarını yükle
  useEffect(() => {
    const headers = { 'Authorization': `Bearer ${token}` };
    Promise.all([
      fetch(`${BASE}/calisma`, { headers }).then(r => r.ok ? r.json() : []),
      fetch(`${BASE}/personel`, { headers }).then(r => r.ok ? r.json() : []),
      fetch(`${BASE}/vardiyalar`, { headers }).then(r => r.ok ? r.json() : []),
    ]).then(([calismaData, personelData, vardiyaData]) => {
      if (personelData.length > 0) {
        setDbPersonel(personelData.filter(p => p.status === 'Aktif').map(dbPersonelToUi));
      }
      if (calismaData && calismaData.length > 0) {
        const obj = {};
        calismaData.forEach(l => {
          obj[l.id] = {
            id: l.id, isim: l.isim, ay: l.ay,
            atamalar: (l.atamalar || []).reduce((acc, a) => {
              acc[`${a.personelId}_${a.tarih}`] = a.vardiyaId;
              return acc;
            }, {}),
          };
        });
        setListeler(obj);
        setAktifListeId(Object.keys(obj)[0]);
      }
      if (vardiyaData.length > 0) setVardiyalar(vardiyaData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Personel listesini role göre al — DB personel kullanır
  const calPersonel = useMemo(() => {
    const cat = p => {
      const c = p.rolAd + ' ' + p.spec;
      if (c.includes('steril')) return 'steril';
      if (c.includes('anestezi')) return 'anestezi';
      if (c.includes('ameliyathane personel') || c.includes('yardım') || c.includes('yard') || c.includes('yardımcı')) return 'yardimci';
      if (c.includes('hem') || c.includes('scrub') || c.includes('ameliyathane sorumlu') || c.includes('servis hem') || c.includes('teknisyen') || c.includes('teknikeri')) return 'hemsire';
      return 'diger';
    };
    const hemsireler = dbPersonel.filter(p => cat(p) === 'hemsire');
    const yardimci   = dbPersonel.filter(p => cat(p) === 'yardimci');
    const anestezi   = dbPersonel.filter(p => cat(p) === 'anestezi');
    const steril     = dbPersonel.filter(p => cat(p) === 'steril');

    if (curRole === 8 || curRole === 9) return { gruplu: false, liste: steril };
    if (curRole === 2 || curRole === 3) return { gruplu: false, liste: anestezi };
    if (curRole === 5) return { gruplu: true, gruplar: [{ ad: '👤 Ameliyathane Personeli', liste: yardimci }] };
    if (curRole === 4) return { gruplu: true, gruplar: [{ ad: '🩺 Hemşireler & Ameliyathane Teknikerleri', liste: hemsireler }] };

    if (curRole === 1) {
      const sorumlu = hemsireler.filter(p => p.spec.includes('sorumlu'));
      const digerH  = hemsireler.filter(p => !p.spec.includes('sorumlu'));
      return { gruplu: true, gruplar: [
        { ad: '🩺 Hemşireler & Ameliyathane Teknikerleri', liste: [...sorumlu, ...digerH] },
        { ad: '👤 Ameliyathane Personeli', liste: yardimci },
      ]};
    }

    if (isUstYonetici) {
      if (grupRol === 1) return { gruplu: true, gruplar: [{ ad: '🩺 Hemşireler & Ameliyathane Teknikerleri', liste: hemsireler }] };
      if (grupRol === 2) return { gruplu: false, liste: anestezi };
      if (grupRol === 5) return { gruplu: true, gruplar: [{ ad: '👤 Ameliyathane Personeli', liste: yardimci }] };
      if (grupRol === 9) return { gruplu: false, liste: steril };
      return { gruplu: true, gruplar: [
        { ad: '🩺 Hemşireler', liste: hemsireler },
        { ad: '👤 Ameliyathane Personeli', liste: yardimci },
      ]};
    }

    return { gruplu: true, gruplar: [
      { ad: '🩺 Hemşireler', liste: hemsireler },
      { ad: '👤 Ameliyathane Personeli', liste: yardimci },
    ]};
  }, [dbPersonel, grupRol, curRole]);

  function getAtama(pid, tarih) {
    return aktifListe?.atamalar?.[`${pid}_${tarih}`] || null;
  }

  async function setAtama(pid, tarih, vid) {
    if (!aktifListeId) { showToast('Önce liste seçin veya oluşturun'); return; }

    setListeler(prev => {
      const next = { ...prev };
      const lst = { ...next[aktifListeId], atamalar: { ...next[aktifListeId].atamalar } };
      if (vid) lst.atamalar[`${pid}_${tarih}`] = vid;
      else delete lst.atamalar[`${pid}_${tarih}`];
      next[aktifListeId] = lst;
      return next;
    });

    // DB'ye arka planda kaydet (hata olursa sessizce geç — local zaten güncellendi)
    try {
      if (!vid) {
        await fetch(`${BASE}/calisma/${aktifListeId}/atama`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ personelId: pid, tarih }),
        });
      } else {
        await fetch(`${BASE}/calisma/${aktifListeId}/atama`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ personelId: pid, tarih, vardiyaId: vid }),
        });
      }
    } catch(e) { console.error('Atama hatası:', e); }

    setCellModal(null);
  }

  async function kaydetListe() {
    if (!aktifListeId) { showToast('Aktif liste yok'); return; }
    try {
      await fetch(`${BASE}/calisma/${aktifListeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ isim: aktifListe?.isim }),
      });
    } catch (_) {}
    showToast('Çalışma listesi kaydedildi ✓');
  }

  async function yeniListeOlustur() {
    if (!yeniForm.isim.trim()) { showToast('Liste adı zorunlu'); return; }
    try {
      const res = await fetch(`${BASE}/calisma`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ isim: yeniForm.isim, ay: yeniForm.ay || calAy }),
      });
      if (!res.ok) throw new Error();
      const yeni = await res.json();
      setListeler(prev => ({ ...prev, [yeni.id]: { ...yeni, atamalar: {} } }));
      setAktifListeId(yeni.id);
      setYeniModal(false);
      setYeniForm({ isim: '', ay: '' });
      showToast('Liste oluşturuldu ✓');
    } catch(e) { showToast('Hata oluştu'); }
  }

  async function listeSil() {
    if (!aktifListeId) return;
    if (Object.keys(listeler).length <= 1) { showToast('En az 1 liste olmalı'); return; }
    if (!window.confirm('Bu listeyi silmek istediğinize emin misiniz?')) return;
    try {
      await fetch(`${BASE}/calisma/${aktifListeId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      setListeler(prev => { const n = { ...prev }; delete n[aktifListeId]; return n; });
      const kalan = Object.keys(listeler).filter(id => id !== aktifListeId);
      setAktifListeId(kalan[0] || null);
      showToast('Liste silindi');
    } catch(e) { showToast('Silme hatası'); }
  }

  async function kaydetVardiya() {
    if (!vardiyaForm.ad.trim()) { showToast('Vardiya adı zorunlu'); return; }
    if (vardiyaForm.tip !== 'izin' && (!vardiyaForm.bas || !vardiyaForm.bit)) { showToast('Başlangıç ve bitiş saati zorunlu'); return; }
    try {
      const body = { ...vardiyaForm, sira: vardiyalar.length };
      if (editVardiyaId) {
        const res = await fetch(`${BASE}/vardiyalar/${editVardiyaId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        const updated = await res.json();
        setVardiyalar(prev => prev.map(v => v.id === editVardiyaId ? updated : v));
        showToast('Vardiya güncellendi ✓');
      } else {
        const res = await fetch(`${BASE}/vardiyalar`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        const yeni = await res.json();
        setVardiyalar(prev => [...prev, yeni]);
        showToast('Vardiya eklendi ✓');
      }
      setVardiyaForm({ ad:'', bas:'08:00', bit:'17:00', renk:'gunduz', tip:'normal', icap:'' });
      setEditVardiyaId(null);
    } catch { showToast('Kayıt hatası'); }
  }

  async function silVardiya(id) {
    try {
      await fetch(`${BASE}/vardiyalar/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      setVardiyalar(prev => prev.filter(v => v.id !== id));
      showToast('Vardiya silindi');
    } catch { showToast('Silme hatası'); }
  }

  function vardiyaDuzenle(v) {
    setEditVardiyaId(v.id);
    setVardiyaForm({ ad: v.ad, bas: v.bas === '—' ? '' : v.bas, bit: v.bit === '—' ? '' : v.bit, renk: v.renk, tip: v.tip, icap: v.icap || '' });
  }

  const listeArr = Object.values(listeler);
  const allPersonel = calPersonel.gruplu ? calPersonel.gruplar.flatMap(g => g.liste) : calPersonel.liste;

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--slate-light)' }}>Yükleniyor...</div>;

  return (
    <div>
      {/* Personel Grubu Seçici — Üst Yönetici & Rol 1 */}
      {curRole === 0 && (
        <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'14px 18px', marginBottom:14, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <div style={{ fontSize:12, fontWeight:600, color:'var(--slate)', whiteSpace:'nowrap' }}>Personel Grubu:</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, flex:1 }}>
            {[
              { rol:1, label:'Hemşireler & Ameliyathane Teknikerleri', renk:'#0284C7' },
              { rol:2, label:'Anestezi Teknisyenleri', renk:'#7C3AED' },
              { rol:5, label:'Ameliyathane Personeli', renk:'#F59E0B' },
              { rol:9, label:'Sterilizasyon Personeli', renk:'#0E7490' },
            ].map(g => (
              <div key={g.rol} onClick={() => setGrupRol(g.rol)}
                style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 12px', borderRadius:8, cursor:'pointer', transition:'all 0.15s',
                  border:`1.5px solid ${grupRol===g.rol ? g.renk : 'var(--border)'}`,
                  background: grupRol===g.rol ? `${g.renk}15` : 'var(--surface)' }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:g.renk }}/>
                <span style={{ fontSize:'11.5px', fontWeight:600, color: grupRol===g.rol ? g.renk : 'var(--slate-mid)' }}>{g.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="cal-toolbar">
        <div className="cal-toolbar-left">
          <div className="page-hd-title">{isReadOnly ? 'Çalışma Listelerim' : 'Çalışma Listeleri'}</div>
          {!isReadOnly ? (
            <select value={aktifListeId || ''} onChange={e => setAktifListeId(e.target.value)}
              style={{ height:32, border:'1px solid var(--border)', borderRadius:7, padding:'0 28px 0 10px', fontSize:12, background:'var(--surface)', color:'var(--slate)', fontFamily:'var(--font)', outline:'none', cursor:'pointer', maxWidth:220 }}>
              {listeArr.length === 0 && <option value="">-- Liste yok --</option>}
              {listeArr.map(l => <option key={l.id} value={l.id}>{l.isim}</option>)}
            </select>
          ) : (
            <span style={{ fontSize:12, color:'var(--slate-light)' }}>{aktifListe?.isim || '—'}</span>
          )}
        </div>
        <div className="cal-toolbar-right">
          {!isReadOnly && <>
            <button className="btn btn-secondary btn-sm" style={{ border:"1px solid var(--border)" }} onClick={() => setYeniModal(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width:12, height:12 }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Yeni Liste
            </button>
            <button className="btn btn-secondary btn-sm" style={{ border:"1px solid var(--border)" }} onClick={() => { setEditVardiyaId(null); setVardiyaForm({ ad:'', bas:'08:00', bit:'17:00', renk:'gunduz', tip:'normal', icap:'' }); setVardiyaModal(true); }}>Vardiya Tanımla</button>
            <button className="btn btn-secondary btn-sm" style={{ color:"var(--danger)", border:"1px solid #FECACA" }} onClick={listeSil}>Listeyi Sil</button>
          </>}
          {!isReadOnly && (
            <button className="btn btn-primary btn-sm" onClick={kaydetListe}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:12, height:12 }}><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              Kaydet
            </button>
          )}
          <input type="month" value={calAy} onChange={e => { setCalAy(e.target.value); setHaftaOffset(0); }}
            style={{ height:32, border:'1px solid var(--border)', borderRadius:7, padding:'0 10px', fontSize:12, background:'var(--surface)', color:'var(--slate)', fontFamily:'var(--font)', outline:'none' }}/>
          <div className="view-toggle">
            <button className={`vt-btn${viewMode==='hafta'?' active':''}`} onClick={() => setViewMode('hafta')}>Haftalık</button>
            <button className={`vt-btn${viewMode==='ay'?' active':''}`} onClick={() => setViewMode('ay')}>Aylık</button>
          </div>
          {viewMode === 'hafta' && <>
            <button className="btn btn-secondary btn-sm" onClick={() => setHaftaOffset(p => p-1)}>◀</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setHaftaOffset(0)}>Bu Hafta</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setHaftaOffset(p => p+1)}>▶</button>
          </>}
          
        </div>
      </div>

      {/* Liste yok uyarısı */}
      {!aktifListeId && !isReadOnly && (
        <div style={{ padding:48, textAlign:'center', background:'var(--card-bg)', borderRadius:14, border:'1px solid var(--border)', marginTop:16 }}>
          <div style={{ fontSize:36, marginBottom:12 }}>📋</div>
          <div style={{ fontSize:15, fontWeight:700, color:'var(--slate)', marginBottom:8 }}>Henüz çalışma listesi yok</div>
          <button className="btn btn-primary" onClick={() => setYeniModal(true)}>+ Yeni Liste Oluştur</button>
        </div>
      )}

      {/* Takvim Tablosu */}
      <div className="cal-table-wrap">
        <table className="cal-table">
          <thead>
            <tr>
              <th style={{ textAlign:'left', minWidth:160, position:'sticky', left:0, zIndex:3, background:'var(--surface)' }}>Personel</th>
              {gunler.map(d => {
                const tk = tarihKey(d);
                const isToday = tk === today;
                const isHaftasonu = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <th key={tk} style={{ minWidth: viewMode==='ay'?48:64, padding:'8px 4px', textAlign:'center',
                    color: isToday ? 'var(--teal)' : isHaftasonu ? 'var(--slate-light)' : undefined,
                    background: isToday ? 'rgba(20,184,166,0.06)' : isHaftasonu ? 'rgba(148,163,184,0.05)' : undefined }}>
                    <div style={{ fontWeight:700 }}>{GUN_ADLARI[d.getDay()]}</div>
                    <div style={{ fontWeight:400, fontSize:9 }}>{d.getDate()} {AY_KISA[d.getMonth()]}</div>
                  </th>
                );
              })}
              <th style={{ minWidth:50, textAlign:'center' }}>Toplam</th>
            </tr>
          </thead>
          <tbody>
            {calPersonel.gruplu ? calPersonel.gruplar.map(grup => (
              grup.liste.length === 0 ? null : <React.Fragment key={grup.ad}>
                <tr>
                  <td colSpan={gunler.length+2} style={{ background:'var(--surface)', padding:'7px 12px', borderBottom:'1px solid var(--border)', position:'sticky', left:0, zIndex:2, boxShadow:'2px 0 6px rgba(0,0,0,0.06)', whiteSpace:'nowrap' }}>
                    <span style={{ fontSize:10, fontWeight:700, color:'var(--slate-mid)', textTransform:'uppercase', letterSpacing:'0.5px' }}>{grup.ad}</span>
                    <span style={{ fontSize:'9.5px', color:'var(--slate-light)', marginLeft:8 }}>{grup.liste.length} kişi</span>
                  </td>
                </tr>
                {grup.liste.map(p => <PersonelSatir key={p.id} p={p} gunler={gunler} today={today} getAtama={getAtama} setCellModal={setCellModal} isReadOnly={isReadOnly} viewMode={viewMode} vardiyalar={vardiyalar}/>)}
              </React.Fragment>
            )) : (calPersonel.liste || []).map(p => (
              <PersonelSatir key={p.id} p={p} gunler={gunler} today={today} getAtama={getAtama} setCellModal={setCellModal} isReadOnly={isReadOnly} viewMode={viewMode} vardiyalar={vardiyalar}/>
            ))}
          </tbody>
        </table>
      </div>

      {/* Vardiya Legend */}
      <div style={{ display:'flex', gap:10, marginTop:10, flexWrap:'wrap' }}>
        {vardiyalar.map(v => {
          const etiket = v.tip==='izin' ? 'İzin' : (v.bas && v.bas!=='—' ? `${v.bas}–${v.bit}` : v.ad);
          return (
            <div key={v.id} style={{ display:'flex', alignItems:'center', gap:5 }}>
              <span className={`vardiya-tag ${VARDIYA_CSS[v.renk]||'vt-gunduz'}`}>{etiket}</span>
              <span style={{ fontSize:10, color:'var(--slate-light)' }}>{v.ad}{v.icap ? ` (${v.icap})` : ''}</span>
            </div>
          );
        })}
      </div>

      {/* Hücre Modalı */}
      {cellModal && (
        <div style={{ position:'fixed', inset:0, zIndex:9998, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.4)' }} onClick={() => setCellModal(null)}/>
          <div style={{ position:'relative', background:'var(--card-bg)', borderRadius:16, overflow:'hidden', width:340, boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ padding:'16px 20px', background:'linear-gradient(135deg,var(--teal),#0891b2)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:'white', opacity:0.85 }}>{cellModal.tarihStr}</div>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:6 }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:cellModal.pbg||'#0284C7', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700 }}>{cellModal.pav}</div>
                  <span style={{ fontSize:13, fontWeight:700, color:'white' }}>{cellModal.pad}</span>
                </div>
              </div>
              <button onClick={() => setCellModal(null)} style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:8, width:28, height:28, cursor:'pointer', color:'white', fontSize:16 }}>✕</button>
            </div>
            <div style={{ padding:16 }}>
              {vardiyalar.map(v => {
                const isSelected = getAtama(cellModal.pid, cellModal.tarih) === v.id;
                const etiket = v.tip==='izin' ? 'İzin' : `${v.bas}–${v.bit}`;
                return (
                  <div key={v.id} onClick={() => setAtama(cellModal.pid, cellModal.tarih, v.id)}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:9, cursor:'pointer', marginBottom:4,
                      border:`1.5px solid ${isSelected ? VARDIYA_COLOR[v.renk]||'#0284C7' : 'var(--border)'}`,
                      background: isSelected ? `${VARDIYA_COLOR[v.renk]||'#0284C7'}15` : 'var(--surface)' }}>
                    <div style={{ width:10, height:10, borderRadius:'50%', background:VARDIYA_COLOR[v.renk]||'#94A3B8', flexShrink:0 }}/>
                    <span style={{ fontSize:12, fontWeight:600, color:'var(--slate)', flex:1 }}>{v.ad}</span>
                    <span style={{ fontSize:11, color:'var(--slate-light)' }}>{etiket}</span>
                    {v.icap && <span style={{ fontSize:10, color:'#7C3AED', fontWeight:700 }}>{v.icap}</span>}
                    {isSelected && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                );
              })}
              {getAtama(cellModal.pid, cellModal.tarih) && (
                <button onClick={() => setAtama(cellModal.pid, cellModal.tarih, null)}
                  style={{ width:'100%', marginTop:8, padding:'8px 0', border:'1px solid #FECACA', borderRadius:8, background:'#FEF2F2', color:'#DC2626', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                  Vardiyayı Kaldır
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Vardiya Tanımla Modalı */}
      {vardiyaModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }}>
          <div style={{ background:'var(--card-bg)', borderRadius:16, overflow:'hidden', width:560, maxHeight:'90vh', display:'flex', flexDirection:'column', boxShadow:'0 24px 64px rgba(0,0,0,0.3)' }}>
            {/* Header */}
            <div style={{ padding:'16px 20px', background:'linear-gradient(135deg,#1e3a5f,#0891b2)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <div style={{ fontSize:15, fontWeight:800, color:'white' }}>Vardiya Tanımları</div>
              <button onClick={() => { setVardiyaModal(false); setEditVardiyaId(null); }} style={{ background:'rgba(255,255,255,0.15)', border:'none', borderRadius:8, width:28, height:28, cursor:'pointer', color:'white', fontSize:16 }}>✕</button>
            </div>

            {/* Mevcut vardiyalar listesi */}
            <div style={{ overflowY:'auto', padding:'14px 20px', flex:1 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--slate-light)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>Mevcut Vardiyalar ({vardiyalar.length})</div>
              {vardiyalar.map(v => {
                const etiket = v.tip==='izin' ? '—' : `${v.bas}–${v.bit}`;
                return (
                  <div key={v.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:9, border:'1px solid var(--border)', marginBottom:6, background: editVardiyaId===v.id ? 'rgba(20,184,166,0.06)' : 'var(--surface)' }}>
                    <span className={`vardiya-tag ${VARDIYA_CSS[v.renk]||'vt-gunduz'}`} style={{ fontSize:9, padding:'2px 7px', flexShrink:0 }}>{v.renk.toUpperCase()}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:'var(--slate)' }}>{v.ad}</div>
                      <div style={{ fontSize:10, color:'var(--slate-light)', marginTop:1 }}>{etiket}{v.icap ? ` · ${v.icap}` : ''} · {v.tip}</div>
                    </div>
                    <button onClick={() => vardiyaDuzenle(v)} style={{ fontSize:11, padding:'4px 9px', border:'1px solid var(--border)', borderRadius:6, background:'var(--surface)', cursor:'pointer', color:'var(--slate)' }}>Düzenle</button>
                    <button onClick={() => silVardiya(v.id)} style={{ fontSize:11, padding:'4px 9px', border:'1px solid #FECACA', borderRadius:6, background:'#FEF2F2', cursor:'pointer', color:'#DC2626' }}>Sil</button>
                  </div>
                );
              })}

              {/* Yeni / Düzenle Formu */}
              <div style={{ marginTop:16, padding:'14px 16px', borderRadius:10, border:'1px solid var(--border)', background:'var(--card-bg)' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--slate)', marginBottom:10 }}>{editVardiyaId ? '✏ Düzenle' : '+ Yeni Vardiya'}</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                  <div className="fg">
                    <label className="fl">VARDIYA ADI *</label>
                    <input className="fi" value={vardiyaForm.ad} onChange={e => setVardiyaForm(p => ({...p, ad:e.target.value}))} placeholder="Gündüz, Gece 1. İcap…"/>
                  </div>
                  <div className="fg">
                    <label className="fl">TİP</label>
                    <select className="fi" value={vardiyaForm.tip} onChange={e => setVardiyaForm(p => ({...p, tip:e.target.value, bas: e.target.value==='izin'?'—':'', bit: e.target.value==='izin'?'—':''}))}>
                      <option value="normal">Normal</option>
                      <option value="icap">İcap</option>
                      <option value="izin">İzin / Tatil</option>
                    </select>
                  </div>
                  {vardiyaForm.tip !== 'izin' && <>
                    <div className="fg">
                      <label className="fl">BAŞLANGIÇ SAATİ</label>
                      <input className="fi" type="time" value={vardiyaForm.bas} onChange={e => setVardiyaForm(p => ({...p, bas:e.target.value}))}/>
                    </div>
                    <div className="fg">
                      <label className="fl">BİTİŞ SAATİ</label>
                      <input className="fi" type="time" value={vardiyaForm.bit} onChange={e => setVardiyaForm(p => ({...p, bit:e.target.value}))}/>
                    </div>
                  </>}
                  <div className="fg">
                    <label className="fl">RENK</label>
                    <select className="fi" value={vardiyaForm.renk} onChange={e => setVardiyaForm(p => ({...p, renk:e.target.value}))}>
                      <option value="gunduz">Gündüz (Mavi)</option>
                      <option value="gece">Gece (Koyu)</option>
                      <option value="icap1">İcap 1 (Mor)</option>
                      <option value="icap2">İcap 2 (Turuncu)</option>
                      <option value="izin">İzin (Gri)</option>
                    </select>
                  </div>
                  {vardiyaForm.tip === 'icap' && (
                    <div className="fg">
                      <label className="fl">İCAP ETİKETİ</label>
                      <input className="fi" value={vardiyaForm.icap} onChange={e => setVardiyaForm(p => ({...p, icap:e.target.value}))} placeholder="İcapçı1"/>
                    </div>
                  )}
                </div>
                <div className="mf">
                  {editVardiyaId && <button className="btn btn-secondary" onClick={() => { setEditVardiyaId(null); setVardiyaForm({ ad:'', bas:'08:00', bit:'17:00', renk:'gunduz', tip:'normal', icap:'' }); }}>İptal</button>}
                  <button className="btn btn-primary" onClick={kaydetVardiya}>{editVardiyaId ? 'Güncelle' : 'Ekle'}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Yeni Liste Modalı */}
      {yeniModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }}>
          <div style={{ background:'var(--card-bg)', borderRadius:16, overflow:'hidden', width:400 }}>
            <div style={{ padding:'16px 20px', background:'linear-gradient(135deg,#7C3AED,#6366F1,#0891b2)' }}>
              <div style={{ fontSize:15, fontWeight:800, color:'white' }}>Yeni Çalışma Listesi</div>
            </div>
            <div style={{ padding:20 }}>
              <div className="fg" style={{ marginBottom:12 }}>
                <label className="fl">LİSTE ADI *</label>
                <input className="fi" value={yeniForm.isim} onChange={e => setYeniForm(p => ({ ...p, isim:e.target.value }))}
                  placeholder="Haziran 2026 — Hemşire Listesi" autoFocus/>
              </div>
              <div className="fg" style={{ marginBottom:16 }}>
                <label className="fl">AY</label>
                <input type="month" className="fi" value={yeniForm.ay || calAy} onChange={e => setYeniForm(p => ({ ...p, ay:e.target.value }))}/>
              </div>
              <div className="mf">
                <button className="btn btn-secondary" onClick={() => setYeniModal(false)}>İptal</button>
                <button className="btn btn-primary" onClick={yeniListeOlustur}>Oluştur</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Personel satırı component
function PersonelSatir({ p, gunler, today, getAtama, setCellModal, isReadOnly, viewMode, vardiyalar }) {
  const toplam = gunler.reduce((t, d) => {
    const vid = getAtama(p.id, tarihKey(d));
    return t + (vid ? saatHesapla(vid, vardiyalar) : 0);
  }, 0);

  return (
    <tr style={{ borderBottom:'1px solid var(--border)' }}>
      <td style={{ position:'sticky', left:0, background:'var(--card-bg)', zIndex:1, minWidth:160, padding:'10px 12px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div className="avatar" style={{ background:p.bg||'#0284C7', color:'white', width:26, height:26, fontSize:9, flexShrink:0 }}>
            {p.av || (p.ad||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize:12, fontWeight:600, color:'var(--slate)', letterSpacing:'-0.01em' }}>{p.ad}</div>
            <div style={{ fontSize:'9.5px', color:'var(--slate-light)' }}>{p.gorev}</div>
          </div>
        </div>
      </td>
      {gunler.map(d => {
        const tk = tarihKey(d);
        const vid = getAtama(p.id, tk);
        const v = vid ? vardiyalar.find(x => x.id === vid) : null;
        const isToday = tk === today;
        const saat = v && v.tip !== 'izin' && v.bas !== '—' ? `${v.bas}–${v.bit}` : v ? 'İzin' : '';
        return (
          <td key={tk} style={{ padding: viewMode==='ay'?2:4, textAlign:'center', background: isToday ? 'rgba(20,184,166,0.04)' : undefined }}>
            <div
              className="day-cell"
              onClick={isReadOnly ? undefined : () => {
                const dd = new Date(tk+'T00:00:00');
                const GUN_UZUN = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
                const AY_KISA2 = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
                setCellModal({ pid:p.id, pad:p.ad, pav:p.av, pbg:p.bg, tarih:tk, tarihStr:`${GUN_UZUN[dd.getDay()]}, ${dd.getDate()} ${AY_KISA2[dd.getMonth()]}` });
              }}
              style={{ cursor: isReadOnly ? 'default' : 'pointer' }}>
              {v ? (
                <div className={`vardiya-tag ${VARDIYA_CSS[v.renk]||'vt-gunduz'}`} style={{ flexDirection:'column', padding:'3px 7px', gap:0 }}>
                  <div style={{ fontSize:'9.5px', fontWeight:700, lineHeight:1.2 }}>{saat}</div>
                  {v.icap && <div style={{ fontSize:8, fontWeight:700, opacity:0.75, marginTop:1, lineHeight:1 }}>{v.icap}</div>}
                </div>
              ) : (
                !isReadOnly && <div className="day-cell-empty">+</div>
              )}
            </div>
          </td>
        );
      })}
      <td style={{ fontSize:11, fontWeight:700, color: toplam>48?'var(--warning)':'var(--slate)', textAlign:'center' }}>
        {toplam > 0 ? `${toplam.toFixed(0)}s` : '—'}
      </td>
    </tr>
  );
}
