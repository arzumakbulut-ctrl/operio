import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore, useUIStore, useDataStore } from '../store';
import { ROLES } from '../data/roles';
import { INIT_EGITIMLER, EGITIM_KATEGORILER, SORUMLULAR, SUNUM_TEMALAR, SLAYT_TIPLERI, sunumInitVeri, sunumSlaytHTML } from '../data/egitimData';

const BASE = 'http://localhost:4000/api';
const tok = () => localStorage.getItem('operio_access');

function mapEgitimFromDB(e) {
  const extra = (() => { try { return JSON.parse(e.icerik || '{}'); } catch { return {}; } })();
  return {
    id: e.id,
    baslik: e.baslik,
    aciklama: extra.aciklama || '',
    kategori: e.kategori || 'Genel',
    tip: extra.tip || 'yüz_yüze',
    ikon: extra.ikon || '📚',
    renk: extra.renk || '#0284C7',
    zorunlu: extra.zorunlu || false,
    tarih: e.tarih ? new Date(e.tarih).toISOString().split('T')[0] : '',
    saat: extra.saat || '09:00',
    sure: e.sure || 60,
    yer: extra.yer || '',
    kapasite: e.kapasite || 20,
    kayitli: e.kayitlilar || 0,
    egitmen: e.egitmen || '',
    egitmenRol: extra.egitmenRol || '',
    hedefKitle: extra.hedefKitle || ['Tüm Personel'],
    malzeme: extra.malzeme || [],
    katilimci: extra.katilimci || [],
    tamamlayan: extra.tamamlayan || 0,
    durum: (e.durum || '').toLowerCase() === 'tamamlandi' ? 'tamamlandi' : (e.durum || 'yayinda').toLowerCase(),
    taslak: (e.durum || '').toLowerCase() === 'taslak',
    olusturanRol: extra.olusturanRol || '',
  };
}

// ── EĞİTİM KART (HTML egitimKartHTML satır 6546 birebir) ─────
function EgitimKart({ e, onDetay, onBaslat, onYayinla, onSil, onDuzenle, canManage }) {
  const kalan = e.kapasite - e.kayitli;
  const dolulukYuzde = Math.round(e.kayitli / e.kapasite * 100);
  const durumCfg = { yayinda:{lbl:'Yayında',renk:'var(--success)',bg:'rgba(5,150,105,0.1)'}, taslak:{lbl:'Taslak',renk:'#D97706',bg:'rgba(217,119,6,0.1)'}, tamamlandi:{lbl:'Tamamlandı',renk:'var(--slate-light)',bg:'var(--border)'} };
  const dc = durumCfg[e.durum] || durumCfg.yayinda;

  return (
    <div className="eg-kutu-kart" onClick={() => onDetay(e)}>
      {/* Banner */}
      <div style={{height:80,background:`linear-gradient(135deg,${e.renk}22,${e.renk}08)`,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 16px',borderBottom:`1px solid ${e.renk}20`,position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',right:-20,top:-20,width:100,height:100,borderRadius:'50%',background:`${e.renk}10`}}/>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:44,height:44,borderRadius:12,background:`${e.renk}18`,border:`1.5px solid ${e.renk}30`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>{e.ikon}</div>
          <div>
            <span className="eg-tag" style={{background:dc.bg,color:dc.renk,marginBottom:4}}>{dc.lbl}</span>
            {e.zorunlu && <span className="eg-tag" style={{background:'rgba(220,38,38,0.1)',color:'var(--danger)',marginLeft:4,marginBottom:4}}>Zorunlu</span>}
          </div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:10,color:'var(--slate-light)'}}>{e.tarih.slice(8)}.{e.tarih.slice(5,7)}.{e.tarih.slice(0,4)}</div>
          <div style={{fontSize:11,fontWeight:700,color:'var(--slate)'}}>{e.saat}</div>
        </div>
      </div>
      {/* İçerik */}
      <div style={{padding:'14px 16px'}}>
        <div style={{fontSize:'13.5px',fontWeight:800,color:'var(--slate)',fontFamily:"'Outfit',sans-serif",letterSpacing:'-0.2px',marginBottom:6,lineHeight:1.4}}>{e.baslik}</div>
        <div style={{fontSize:11,color:'var(--slate-light)',marginBottom:10,lineHeight:1.5,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{e.aciklama}</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:10}}>
          <span style={{fontSize:10,display:'flex',alignItems:'center',gap:4,color:'var(--slate-mid)'}}>👤 {e.egitmen}</span>
          <span style={{fontSize:10,color:'var(--slate-light)'}}>·</span>
          <span style={{fontSize:10,display:'flex',alignItems:'center',gap:4,color:'var(--slate-mid)'}}>📍 {e.yer}</span>
          <span style={{fontSize:10,color:'var(--slate-light)'}}>·</span>
          <span style={{fontSize:10,display:'flex',alignItems:'center',gap:4,color:'var(--slate-mid)'}}>⏱ {e.sure} dk</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
          <div style={{flex:1,height:5,background:'var(--border)',borderRadius:10,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${dolulukYuzde}%`,background:dolulukYuzde>=90?'var(--danger)':dolulukYuzde>=70?'var(--warning)':'var(--teal)',borderRadius:10}}/>
          </div>
          <span style={{fontSize:'10.5px',fontWeight:700,color:dolulukYuzde>=90?'var(--danger)':'var(--slate-mid)',flexShrink:0}}>{e.kayitli}/{e.kapasite}</span>
        </div>
        <div style={{display:'flex',gap:6}} onClick={ev => ev.stopPropagation()}>
          {e.taslak ? <>
            {canManage && <button onClick={() => onYayinla(e.id)} className="btn btn-primary" style={{flex:1,fontSize:11}}>🚀 Yayınla</button>}
            {canManage && <button onClick={() => onDuzenle(e.id)} className="btn btn-secondary" style={{fontSize:11}}>Düzenle</button>}
            {canManage && <button onClick={() => onSil(e.id)} className="btn btn-secondary" style={{fontSize:11,color:'var(--danger)'}}>🗑</button>}
          </> : <>
            <button onClick={() => onDetay(e)} className="btn btn-secondary" style={{flex:1,fontSize:11}}>Detay</button>
            <button onClick={() => onBaslat(e.id)} className="btn btn-sm" style={{fontSize:11,background:'rgba(124,58,237,0.1)',color:'#7C3AED',border:'1.5px solid rgba(124,58,237,0.25)',display:'flex',alignItems:'center',gap:4}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:11,height:11}}><polygon points="5 3 19 12 5 21 5 3"/></svg> Başlat
            </button>
            {e.durum !== 'tamamlandi' && canManage && <button onClick={() => onDuzenle(e.id)} className="btn btn-secondary" style={{fontSize:11}}>✏️</button>}
            {e.durum === 'tamamlandi' && <span style={{fontSize:10,fontWeight:700,color:'var(--success)',display:'flex',alignItems:'center',gap:4,padding:'0 6px'}}>✓ {e.tamamlayan}</span>}
          </>}
        </div>
      </div>
    </div>
  );
}

// ── ANA COMPONENT ─────────────────────────────────────────────
export default function EgitimYonetim() {
  const { personel, surgeries } = useDataStore();
  const { curRole }   = useAuthStore();
  const { showToast } = useUIStore();
  const canManage = true; // Orijinalde tüm roller Eğitim Oluştur ve Yükle butonlarını görebilir

  const [egitimler, setEgitimler] = useState([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetch(`${BASE}/egitim`, { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => setEgitimler(data.length > 0 ? data.map(mapEgitimFromDB) : INIT_EGITIMLER))
      .catch(() => setEgitimler(INIT_EGITIMLER));
  }, []);
  const [tab, setTab]             = useState('liste');
  const [detay, setDetay]         = useState(null);
  const [formAcik, setFormAcik]   = useState(false);
  const [duzenleId, setDuzenleId] = useState(null);
  const [yukleAcik, setYukleAcik] = useState(false);
  const [yukleAd, setYukleAd]     = useState('');
  const [yukleUrl, setYukleUrl]   = useState('');
  const [yukleTip, setYukleTip]   = useState('pdf');
  const [slaytMenu, setSlaytMenu] = useState(false);

  // Sunum modu
  const [sunumVeri]               = useState({});
  const [sunumMod, setSunumMod]   = useState(false);
  const [sunumEgitimId, setSunumEgitimId] = useState(null);
  const [sunumIdx, setSunumIdx]   = useState(0);
  const [sunumBaslangic, setSunumBaslangic] = useState(null);
  const [sunumSure, setSunumSure] = useState('00:00');

  // Sunum editör
  const [editorAcik, setEditorAcik] = useState(false);
  const [editorEgitimId, setEditorEgitimId] = useState(null);
  const [editorSlaytIdx, setEditorSlaytIdx] = useState(0);

  // ── Form state ──
  const [form, setForm] = useState({baslik:'',aciklama:'',kategori:'Hasta Güvenliği',tip:'yüz_yüze',ikon:'📚',renk:'#0284C7',zorunlu:false,tarih:'',saat:'09:00',sure:60,yer:'',kapasite:20,egitmen:SORUMLULAR[0]?.ad,hedefKitle:[],malzeme:[]});
  const f = (k,v) => setForm(p=>({...p,[k]:v}));

  function resetForm() { setForm({baslik:'',aciklama:'',kategori:'Hasta Güvenliği',tip:'yüz_yüze',ikon:'📚',renk:'#0284C7',zorunlu:false,tarih:'',saat:'09:00',sure:60,yer:'',kapasite:20,egitmen:SORUMLULAR[0]?.ad,hedefKitle:[],malzeme:[]}); }

  // ── Malzeme işlemleri ──
  function addMalzeme() { setForm(p=>({...p,malzeme:[...p.malzeme,{ad:'',tip:'pdf',url:''}]})); }
  function removeMalzeme(i) { setForm(p=>({...p,malzeme:p.malzeme.filter((_,idx)=>idx!==i)})); }
  function updateMalzeme(i,k,v) { setForm(p=>({...p,malzeme:p.malzeme.map((m,idx)=>idx===i?{...m,[k]:v}:m)})); }

  // ── Listeleme ──
  const yayin  = egitimler.filter(e => !e.taslak && e.durum !== 'tamamlandi');
  const taslak = egitimler.filter(e => e.taslak);
  const gecmis = egitimler.filter(e => e.durum === 'tamamlandi');
  const toplam = egitimler.filter(e => !e.taslak).length;
  const buAy   = egitimler.filter(e => e.tarih.startsWith('2026-06') && !e.taslak).length;

  // ── Aksiyonlar ──
  async function yayinla(id) {
    setEgitimler(p=>p.map(e=>e.id===id?{...e,taslak:false,durum:'yayinda'}:e));
    try { await fetch(`${BASE}/egitim/${id}`, { method:'PUT', headers:{'Content-Type':'application/json',Authorization:`Bearer ${tok()}`}, body:JSON.stringify({ durum:'Yayinda' }) }); } catch {}
    showToast('🚀 Yayınlandı!');
  }
  async function sil(id) {
    if(!window.confirm('Bu eğitimi silmek istiyor musunuz?')) return;
    setEgitimler(p=>p.filter(e=>e.id!==id));
    try { await fetch(`${BASE}/egitim/${id}`, { method:'DELETE', headers:{Authorization:`Bearer ${tok()}`} }); } catch {}
    showToast('Eğitim silindi');
  }
  function duzenle(id) { setDuzenleId(id); const e=egitimler.find(x=>x.id===id); if(e) setForm({baslik:e.baslik,aciklama:e.aciklama,kategori:e.kategori,tip:e.tip,ikon:e.ikon,renk:e.renk,zorunlu:e.zorunlu,tarih:e.tarih,saat:e.saat,sure:e.sure,yer:e.yer,kapasite:e.kapasite,egitmen:e.egitmen,hedefKitle:e.hedefKitle||[],malzeme:e.malzeme||[]}); setFormAcik(true); }

  async function formKaydet(taslakMi) {
    if (!form.baslik.trim()) { showToast('Başlık zorunlu'); return; }
    if (!form.tarih) { showToast('Tarih zorunlu'); return; }
    const egitmenObj = SORUMLULAR.find(s=>s.ad===form.egitmen);
    const extraData = { aciklama:form.aciklama, tip:form.tip, ikon:form.ikon, renk:form.renk, zorunlu:form.zorunlu, saat:form.saat, yer:form.yer, egitmenRol:egitmenObj?.rol||'', hedefKitle:form.hedefKitle.length?form.hedefKitle:['Tüm Personel'], malzeme:form.malzeme.filter(m=>m.ad.trim()), katilimci:[], tamamlayan:0, olusturanRol:curRole };
    const dbBody = { baslik:form.baslik, kategori:form.kategori, sure:form.sure, egitmen:form.egitmen, tarih:form.tarih||null, kapasite:form.kapasite, kayitlilar:duzenleId?(egitimler.find(e=>e.id===duzenleId)?.kayitli||0):0, durum:taslakMi?'Taslak':'Yayinda', tur:form.tip, icerik:JSON.stringify(extraData) };
    try {
      const res = await fetch(duzenleId ? `${BASE}/egitim/${duzenleId}` : `${BASE}/egitim`, { method:duzenleId?'PUT':'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${tok()}`}, body:JSON.stringify(dbBody) });
      const saved = await res.json();
      const obj = { ...form, id:saved.id||duzenleId||Date.now(), egitmenRol:egitmenObj?.rol||'', hedefKitle:extraData.hedefKitle, durum:taslakMi?'taslak':'yayinda', taslak:taslakMi, kayitli:dbBody.kayitlilar, malzeme:extraData.malzeme, katilimci:[], tamamlayan:0, olusturanRol:curRole };
      if (duzenleId) { setEgitimler(p=>p.map(e=>e.id===duzenleId?obj:e)); } else { setEgitimler(p=>[obj,...p]); }
    } catch {
      const obj = { ...form, id:duzenleId||Date.now(), egitmenRol:egitmenObj?.rol||'', hedefKitle:extraData.hedefKitle, durum:taslakMi?'taslak':'yayinda', taslak:taslakMi, kayitli:duzenleId?(egitimler.find(e=>e.id===duzenleId)?.kayitli||0):0, malzeme:extraData.malzeme, katilimci:[], tamamlayan:0, olusturanRol:curRole };
      if (duzenleId) { setEgitimler(p=>p.map(e=>e.id===duzenleId?obj:e)); } else { setEgitimler(p=>[obj,...p]); }
    }
    setFormAcik(false); setDuzenleId(null); resetForm();
    showToast(taslakMi ? '📝 Taslak kaydedildi' : '🚀 Eğitim yayınlandı!');
  }

  async function yukleKaydet(ad, url, tip) {
    const rol = ROLES[curRole];
    const extraData = { aciklama:'Dışarıdan yüklenen materyal.', tip:'online', ikon:'📎', renk:'#6366F1', zorunlu:false, saat:'09:00', yer:'Online', egitmenRol:rol?.name||'', hedefKitle:['Tüm Personel'], malzeme:[{ad,tip,url}], katilimci:[], tamamlayan:0, olusturanRol:curRole };
    const dbBody = { baslik:ad, kategori:'Diğer', sure:60, egitmen:rol?.full||'', tarih:new Date().toISOString().split('T')[0], kapasite:100, kayitlilar:0, durum:'Yayinda', tur:'online', icerik:JSON.stringify(extraData) };
    try {
      const res = await fetch(`${BASE}/egitim`, { method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${tok()}`}, body:JSON.stringify(dbBody) });
      const saved = await res.json();
      setEgitimler(p => [{ id:saved.id||Date.now(), baslik:ad, ...extraData, kayitli:0, durum:'yayinda', taslak:false, tarih:dbBody.tarih, saat:'09:00', sure:60, kapasite:100, kategori:'Diğer', egitmen:rol?.full||'' }, ...p]);
    } catch {
      setEgitimler(p => [{ id:Date.now(), baslik:ad, aciklama:'Dışarıdan yüklenen materyal.', kategori:'Diğer', tip:'online', ikon:'📎', renk:'#6366F1', egitmen:rol?.full||'', egitmenRol:rol?.name||'', hedefKitle:['Tüm Personel'], tarih:new Date().toISOString().split('T')[0], saat:'09:00', sure:60, yer:'Online', kapasite:100, kayitli:0, durum:'yayinda', zorunlu:false, malzeme:[{ad,tip,url}], katilimci:[], tamamlayan:0, taslak:false, olusturanRol:curRole }, ...p]);
    }
    setYukleAcik(false);
    showToast(`✅ "${ad}" sisteme yüklendi`);
  }

  // ── SUNUM MODU ──
  function baslat(egitimId) {
    sunumInitVeri(sunumVeri, egitimId, egitimler);
    setSunumEgitimId(egitimId); setSunumIdx(0); setSunumBaslangic(Date.now()); setSunumMod(true);
    setDetay(null);
  }
  function sunumKapat() { setSunumMod(false); setSunumEgitimId(null); }

  useEffect(() => {
    if (!sunumMod) return;
    const handler = e => {
      if (e.key==='ArrowRight'||e.key===' ') setSunumIdx(i => { const v=sunumVeri[sunumEgitimId]; return v && i < v.slaytlar.length-1 ? i+1 : i; });
      else if (e.key==='ArrowLeft') setSunumIdx(i => i > 0 ? i-1 : 0);
      else if (e.key==='Escape') sunumKapat();
    };
    document.addEventListener('keydown', handler);
    const timer = setInterval(() => {
      const s = Math.floor((Date.now()-(sunumBaslangic||Date.now()))/1000);
      setSunumSure(String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'));
    }, 1000);
    return () => { document.removeEventListener('keydown', handler); clearInterval(timer); };
  }, [sunumMod, sunumEgitimId, sunumBaslangic]);

  // ── SUNUM EDİTÖR ──
  function editorAc(egitimId) {
    sunumInitVeri(sunumVeri, egitimId, egitimler);
    setEditorEgitimId(egitimId); setEditorSlaytIdx(0); setEditorAcik(true); setFormAcik(false);
  }
  function editorSlaytGuncelle(alan, deger) {
    const v = sunumVeri[editorEgitimId]; if(!v) return;
    v.slaytlar[editorSlaytIdx] = { ...v.slaytlar[editorSlaytIdx], [alan]: deger };
    setEditorSlaytIdx(i=>i); // force re-render
  }
  function editorSlaytEkle(tip) {
    const v = sunumVeri[editorEgitimId]; if(!v) return;
    const defaults = {
      baslik:{tip:'baslik',baslik:'Yeni Başlık',altBaslik:'Alt başlık',ikon:'📌',not:''},
      icerik:{tip:'icerik',baslik:'Konu Başlığı',metin:'İçerik metni…',not:''},
      liste:{tip:'liste',baslik:'Liste Başlığı',maddeler:['Madde 1','Madde 2','Madde 3'],not:''},
      gorsel:{tip:'gorsel',baslik:'Görsel Başlık',metin:'Açıklama',gorselUrl:'',not:''},
      alinti:{tip:'alinti',metin:'"Önemli bir alıntı"',kaynak:'Kaynak',not:''},
      soru:{tip:'soru',soru:'Soru?',secenekler:['A)','B)','C)','D)'],dogru:0,not:''},
      bolum:{tip:'bolum',baslik:'Yeni Bölüm',alt:'Açıklama',renk:'#14B8A6',not:''},
      kapak:{tip:'kapak',baslik:'Teşekkürler!',altBaslik:'Sorularınız için hazırız.',ikon:'🎉',not:''},
    };
    v.slaytlar.splice(editorSlaytIdx+1, 0, {...defaults[tip]});
    setEditorSlaytIdx(editorSlaytIdx+1);
  }
  function editorSlaytSil(idx) {
    const v = sunumVeri[editorEgitimId]; if(!v||v.slaytlar.length<=1) return;
    v.slaytlar.splice(idx,1);
    setEditorSlaytIdx(Math.min(idx, v.slaytlar.length-1));
  }
  function editorSlaytTasi(idx,yon) {
    const v = sunumVeri[editorEgitimId]; if(!v) return;
    const h = idx+yon; if(h<0||h>=v.slaytlar.length) return;
    [v.slaytlar[idx],v.slaytlar[h]] = [v.slaytlar[h],v.slaytlar[idx]];
    setEditorSlaytIdx(h);
  }
  function editorTemaSec(temaId) { const v=sunumVeri[editorEgitimId]; if(v) v.tema=temaId; setEditorSlaytIdx(i=>i); }

  // ── TABS ──
  const TABS = [
    {id:'liste', lbl:`📋 Aktif Eğitimler (${yayin.length})`},
    {id:'taslak',lbl:`📝 Taslaklar (${taslak.length})`},
    {id:'gecmis',lbl:`🗂 Geçmiş (${gecmis.length})`},
    {id:'plan',  lbl:'📆 Yıllık Plan'},
  ];

  function renderListe(liste) {
    if (!liste.length) return <div style={{textAlign:'center',padding:'60px 20px',color:'var(--slate-light)'}}><div style={{fontSize:48,marginBottom:16}}>📚</div><div style={{fontSize:15,fontWeight:700,color:'var(--slate)',marginBottom:8}}>Kayıt yok</div>{canManage && <button className="btn btn-primary" onClick={()=>{setDuzenleId(null);resetForm();setFormAcik(true);}} style={{fontSize:12}}>+ Eğitim Oluştur</button>}</div>;
    return <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:14}}>{liste.map(e=><EgitimKart key={e.id} e={e} onDetay={setDetay} onBaslat={baslat} onYayinla={yayinla} onSil={sil} onDuzenle={duzenle} canManage={canManage}/>)}</div>;
  }

  // ── YILLIK PLAN ──
  function renderPlan() {
    const aylar = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
    return (
      <div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <div style={{fontSize:15,fontWeight:800,color:'var(--slate)',fontFamily:"'Outfit',sans-serif"}}>Yıllık Eğitim Planı — 2026</div>
          {canManage && <button onClick={()=>{setDuzenleId(null);resetForm();setFormAcik(true);}} className="btn btn-primary btn-sm" style={{fontSize:11}}>+ Plan Ekle</button>}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
          {aylar.map((ay,i) => {
            const ayNo = String(i+1).padStart(2,'0');
            const ayE = egitimler.filter(e => e.tarih.startsWith('2026-'+ayNo) && !e.taslak);
            const gecti = i < 4;
            return (
              <div key={ay} style={{background:'var(--card-bg)',border:`1.5px solid ${ayE.length?'rgba(20,184,166,0.25)':'var(--border)'}`,borderRadius:13,padding:14}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                  <div style={{fontSize:'12.5px',fontWeight:800,color:gecti?'var(--slate-light)':'var(--slate)'}}>{ay}</div>
                  {ayE.length ? <span style={{fontSize:9,fontWeight:700,padding:'2px 8px',borderRadius:20,background:'rgba(20,184,166,0.1)',color:'var(--teal)'}}>{ayE.length} eğitim</span>
                  : gecti ? <span style={{fontSize:9,color:'var(--slate-light)'}}>Tamamlandı</span>
                  : <span style={{fontSize:9,color:'var(--slate-light)'}}>Planlanmadı</span>}
                </div>
                {ayE.length ? <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {ayE.slice(0,3).map(e => <div key={e.id} onClick={()=>setDetay(e)} style={{display:'flex',alignItems:'center',gap:7,padding:'6px 9px',borderRadius:8,background:`${e.renk}10`,border:`1px solid ${e.renk}25`,cursor:'pointer'}}>
                    <span style={{fontSize:13}}>{e.ikon}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:10,fontWeight:700,color:'var(--slate)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{e.baslik}</div>
                      <div style={{fontSize:9,color:'var(--slate-light)'}}>{e.tarih.slice(8)} {e.saat} · {e.sure} dk</div>
                    </div>
                  </div>)}
                  {ayE.length>3 && <div style={{fontSize:'9.5px',color:'var(--slate-light)',textAlign:'center'}}>+{ayE.length-3} daha</div>}
                </div> : <div style={{textAlign:'center',padding:'12px 0'}}>
                  {canManage && <div onClick={()=>{setDuzenleId(null);resetForm();setFormAcik(true);}} style={{fontSize:10,color:'var(--slate-light)',cursor:'pointer',padding:6,border:'1px dashed var(--border)',borderRadius:8}}>+ Eğitim Ekle</div>}
                </div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  // ── SUNUM MODU OVERLAY ──
  if (sunumMod && sunumVeri[sunumEgitimId]) {
    const veri = sunumVeri[sunumEgitimId];
    const tema = SUNUM_TEMALAR.find(t=>t.id===veri.tema) || SUNUM_TEMALAR[0];
    const slayt = veri.slaytlar[sunumIdx];
    const total = veri.slaytlar.length;
    const yuzde = Math.round((sunumIdx+1)/total*100);
    return (
      <div className="sunum-mode">
        <div className="sunum-progress"><div className="sunum-progress-bar" style={{width:`${yuzde}%`}}/></div>
        <div className="sunum-slide" style={{background:tema.bg,color:tema.metin}} onClick={()=>setSunumIdx(i=>Math.min(total-1,i+1))}>
          <div style={{width:'85vw',maxWidth:1200,aspectRatio:'16/9',position:'relative',overflow:'hidden'}} dangerouslySetInnerHTML={{__html:sunumSlaytHTML(slayt,tema,true)}}/>
        </div>
        <div className="sunum-nav">
          <button onClick={()=>setSunumIdx(i=>Math.max(0,i-1))} disabled={sunumIdx===0} style={{background:'rgba(255,255,255,0.1)',border:'none',color:'white',width:36,height:36,borderRadius:'50%',cursor:sunumIdx===0?'not-allowed':'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',opacity:sunumIdx===0?0.3:1}}>◀</button>
          <span style={{color:'white',fontSize:12,fontWeight:600,minWidth:70,textAlign:'center'}}>{sunumIdx+1} / {total}</span>
          <button onClick={()=>setSunumIdx(i=>Math.min(total-1,i+1))} disabled={sunumIdx===total-1} style={{background:'rgba(255,255,255,0.1)',border:'none',color:'white',width:36,height:36,borderRadius:'50%',cursor:sunumIdx===total-1?'not-allowed':'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',opacity:sunumIdx===total-1?0.3:1}}>▶</button>
          <div style={{width:1,height:20,background:'rgba(255,255,255,0.2)'}}/>
          <span style={{color:'rgba(255,255,255,0.6)',fontSize:11,fontWeight:600}}>{sunumSure}</span>
          {slayt.not && <button onClick={()=>showToast(`📝 ${slayt.not}`)} style={{background:'rgba(255,255,255,0.1)',border:'none',color:'rgba(255,255,255,0.7)',fontSize:11,padding:'5px 10px',borderRadius:20,cursor:'pointer'}}>📝 Not</button>}
          <button onClick={sunumKapat} style={{background:'rgba(220,38,38,0.3)',border:'none',color:'white',fontSize:11,padding:'5px 12px',borderRadius:20,cursor:'pointer',fontWeight:600}}>✕ Çıkış</button>
        </div>
      </div>
    );
  }

  // ── SUNUM EDİTÖR OVERLAY ──
  if (editorAcik && sunumVeri[editorEgitimId]) {
    const veri = sunumVeri[editorEgitimId];
    const tema = SUNUM_TEMALAR.find(t=>t.id===veri.tema) || SUNUM_TEMALAR[0];
    const slayt = veri.slaytlar[editorSlaytIdx];
    const e = egitimler.find(x=>x.id===editorEgitimId);

    return (
      <div style={{position:'fixed',inset:0,background:'var(--card-bg)',zIndex:9999,display:'flex',flexDirection:'column'}}>
        {/* Toolbar */}
        <div style={{height:52,background:'var(--surface)',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:10,padding:'0 16px',flexShrink:0}}>
          <div onClick={()=>setEditorAcik(false)} style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',color:'var(--slate-mid)',fontSize:12,fontWeight:600,padding:'6px 10px',borderRadius:8}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg> Geri
          </div>
          <div style={{width:1,height:24,background:'var(--border)'}}/>
          <div style={{fontSize:13,fontWeight:700,color:'var(--slate)',fontFamily:"'Outfit',sans-serif",flex:1}}>{e?.baslik || 'Sunum Editörü'}</div>
          <div style={{display:'flex',gap:5,alignItems:'center'}}>
            <span style={{fontSize:'10.5px',color:'var(--slate-light)',fontWeight:600}}>Tema:</span>
            {SUNUM_TEMALAR.map(t=><div key={t.id} onClick={()=>editorTemaSec(t.id)} title={t.ad} style={{width:20,height:20,borderRadius:'50%',background:t.bg,border:`2px solid ${veri.tema===t.id?'white':'transparent'}`,cursor:'pointer'}}/>)}
          </div>
          <div style={{width:1,height:24,background:'var(--border)'}}/>
          <div style={{position:'relative'}}>
            <button onClick={()=>setSlaytMenu(!slaytMenu)} className="btn btn-secondary btn-sm" style={{fontSize:11}}>+ Slayt Ekle</button>
            {slaytMenu && <div style={{position:'absolute',top:36,right:0,width:200,background:'var(--card-bg)',border:'1px solid var(--border)',borderRadius:12,boxShadow:'0 8px 32px rgba(0,0,0,0.15)',zIndex:10,overflow:'hidden'}}>
              {SLAYT_TIPLERI.map(t=><div key={t.id} onClick={()=>{editorSlaytEkle(t.id);setSlaytMenu(false);}} style={{display:'flex',alignItems:'center',gap:9,padding:'9px 14px',cursor:'pointer',fontSize:12,fontWeight:500,color:'var(--slate)'}} onMouseEnter={e=>e.currentTarget.style.background='var(--surface)'} onMouseLeave={e=>e.currentTarget.style.background=''}>{t.ikon} {t.ad}</div>)}
            </div>}
          </div>
          <button onClick={()=>{setEditorAcik(false);baslat(editorEgitimId);}} className="btn btn-primary btn-sm" style={{fontSize:11,background:'linear-gradient(135deg,#7C3AED,#6366F1)'}}>▶ Sunumu Başlat</button>
          <button onClick={()=>{showToast('💾 Sunum kaydedildi');}} className="btn btn-secondary btn-sm" style={{fontSize:11}}>💾 Kaydet</button>
        </div>
        {/* Ana alan */}
        <div style={{flex:1,display:'flex',overflow:'hidden'}}>
          {/* Sol: slayt listesi */}
          <div className="slayt-list">
            {veri.slaytlar.map((s,i)=>(
              <div key={i} className={`slayt-thumb${i===editorSlaytIdx?' active':''}`} onClick={()=>setEditorSlaytIdx(i)}>
                <div className="slayt-thumb-no">{i+1}</div>
                <div style={{aspectRatio:'16/9',background:tema.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:tema.metin,padding:6,textAlign:'center',overflow:'hidden'}}>
                  {(s.tip==='baslik'||s.tip==='kapak') ? <div><div style={{fontSize:14}}>{s.ikon||'📌'}</div><div style={{fontSize:8,marginTop:2,opacity:0.9}}>{s.baslik?.slice(0,20)}</div></div>
                  : <div style={{fontSize:8,fontWeight:800,opacity:0.9}}>{s.baslik?.slice(0,20)||s.soru?.slice(0,18)||''}</div>}
                </div>
              </div>
            ))}
          </div>
          {/* Orta: canvas */}
          <div className="slayt-canvas">
            <div className="slayt-render" style={{background:tema.bg,color:tema.metin}} dangerouslySetInnerHTML={{__html:sunumSlaytHTML(slayt,tema,false)}}/>
          </div>
          {/* Sağ: özellikler */}
          <div style={{width:240,flexShrink:0,borderLeft:'1px solid var(--border)',background:'var(--surface)',overflowY:'auto',padding:14}}>
            <div style={{fontSize:10,fontWeight:700,color:'var(--slate-light)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:10}}>Slayt {editorSlaytIdx+1} / {veri.slaytlar.length}</div>
            <div style={{display:'flex',gap:4,marginBottom:14}}>
              <button onClick={()=>editorSlaytTasi(editorSlaytIdx,-1)} className="btn btn-secondary btn-sm" style={{flex:1,fontSize:11}} disabled={editorSlaytIdx===0}>↑</button>
              <button onClick={()=>editorSlaytTasi(editorSlaytIdx,1)} className="btn btn-secondary btn-sm" style={{flex:1,fontSize:11}} disabled={editorSlaytIdx===veri.slaytlar.length-1}>↓</button>
              <button onClick={()=>editorSlaytSil(editorSlaytIdx)} className="btn btn-secondary btn-sm" style={{fontSize:11,color:'var(--danger)'}} disabled={veri.slaytlar.length<=1}>🗑</button>
            </div>
            <div style={{padding:'8px 11px',background:'rgba(124,58,237,0.08)',border:'1px solid rgba(124,58,237,0.2)',borderRadius:9,fontSize:11,fontWeight:600,color:'#7C3AED',marginBottom:14}}>
              {SLAYT_TIPLERI.find(t=>t.id===slayt.tip)?.ikon} {SLAYT_TIPLERI.find(t=>t.id===slayt.tip)?.ad||slayt.tip}
            </div>
            {/* Alan düzenleyici */}
            {(slayt.tip==='baslik'||slayt.tip==='kapak') && <>
              <div className="fg" style={{marginBottom:8}}><label className="fl">Başlık</label><input className="fi" value={slayt.baslik||''} onChange={e=>editorSlaytGuncelle('baslik',e.target.value)}/></div>
              <div className="fg" style={{marginBottom:8}}><label className="fl">Alt Başlık</label><input className="fi" value={slayt.altBaslik||''} onChange={e=>editorSlaytGuncelle('altBaslik',e.target.value)}/></div>
              <div className="fg" style={{marginBottom:8}}><label className="fl">İkon</label><input className="fi" value={slayt.ikon||''} onChange={e=>editorSlaytGuncelle('ikon',e.target.value)} style={{fontSize:20,textAlign:'center'}}/></div>
            </>}
            {slayt.tip==='icerik' && <>
              <div className="fg" style={{marginBottom:8}}><label className="fl">Başlık</label><input className="fi" value={slayt.baslik||''} onChange={e=>editorSlaytGuncelle('baslik',e.target.value)}/></div>
              <div className="fg" style={{marginBottom:8}}><label className="fl">Metin</label><textarea className="fi" rows={5} value={slayt.metin||''} onChange={e=>editorSlaytGuncelle('metin',e.target.value)}/></div>
            </>}
            {slayt.tip==='liste' && <>
              <div className="fg" style={{marginBottom:8}}><label className="fl">Başlık</label><input className="fi" value={slayt.baslik||''} onChange={e=>editorSlaytGuncelle('baslik',e.target.value)}/></div>
              <div className="fg" style={{marginBottom:8}}><label className="fl">Maddeler (satır satır)</label><textarea className="fi" rows={6} value={(slayt.maddeler||[]).join('\n')} onChange={e=>editorSlaytGuncelle('maddeler',e.target.value.split('\n').filter(l=>l.trim()))}/></div>
            </>}
            {slayt.tip==='alinti' && <>
              <div className="fg" style={{marginBottom:8}}><label className="fl">Alıntı</label><textarea className="fi" rows={4} value={slayt.metin||''} onChange={e=>editorSlaytGuncelle('metin',e.target.value)}/></div>
              <div className="fg" style={{marginBottom:8}}><label className="fl">Kaynak</label><input className="fi" value={slayt.kaynak||''} onChange={e=>editorSlaytGuncelle('kaynak',e.target.value)}/></div>
            </>}
            {slayt.tip==='soru' && <>
              <div className="fg" style={{marginBottom:8}}><label className="fl">Soru</label><textarea className="fi" rows={3} value={slayt.soru||''} onChange={e=>editorSlaytGuncelle('soru',e.target.value)}/></div>
              <div className="fg" style={{marginBottom:8}}><label className="fl">Seçenekler (satır satır)</label><textarea className="fi" rows={4} value={(slayt.secenekler||[]).join('\n')} onChange={e=>editorSlaytGuncelle('secenekler',e.target.value.split('\n').filter(l=>l.trim()))}/></div>
              <div className="fg" style={{marginBottom:8}}><label className="fl">Doğru (0=A,1=B…)</label><input className="fi" type="number" value={slayt.dogru||0} min={0} max={3} onChange={e=>editorSlaytGuncelle('dogru',parseInt(e.target.value)||0)}/></div>
            </>}
            {slayt.tip==='bolum' && <>
              <div className="fg" style={{marginBottom:8}}><label className="fl">Başlık</label><input className="fi" value={slayt.baslik||''} onChange={e=>editorSlaytGuncelle('baslik',e.target.value)}/></div>
              <div className="fg" style={{marginBottom:8}}><label className="fl">Alt Metin</label><input className="fi" value={slayt.alt||''} onChange={e=>editorSlaytGuncelle('alt',e.target.value)}/></div>
              <div className="fg" style={{marginBottom:8}}><label className="fl">Renk</label><input className="fi" type="color" value={slayt.renk||'#14B8A6'} onChange={e=>editorSlaytGuncelle('renk',e.target.value)} style={{height:36,padding:4}}/></div>
            </>}
            {slayt.tip==='gorsel' && <>
              <div className="fg" style={{marginBottom:8}}><label className="fl">Başlık</label><input className="fi" value={slayt.baslik||''} onChange={e=>editorSlaytGuncelle('baslik',e.target.value)}/></div>
              <div className="fg" style={{marginBottom:8}}><label className="fl">Metin</label><textarea className="fi" rows={3} value={slayt.metin||''} onChange={e=>editorSlaytGuncelle('metin',e.target.value)}/></div>
              <div className="fg" style={{marginBottom:8}}><label className="fl">Görsel URL</label><input className="fi" value={slayt.gorselUrl||''} onChange={e=>editorSlaytGuncelle('gorselUrl',e.target.value)} placeholder="https://…"/></div>
            </>}
            <div style={{marginTop:12,paddingTop:12,borderTop:'1px solid var(--border)'}}>
              <div className="fg"><label className="fl">📝 Konuşmacı Notu</label><textarea className="fi" rows={3} value={slayt.not||''} onChange={e=>editorSlaytGuncelle('not',e.target.value)} placeholder="Bu slaytta söylenecekler…" style={{fontSize:11}}/></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── ANA SAYFA ──
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      {/* Başlık */}
      <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',padding:'0 0 16px',flexShrink:0}}>
        <div>
          <div style={{fontSize:22,fontWeight:900,color:'var(--slate)',letterSpacing:'-0.5px',fontFamily:"'Outfit',sans-serif"}}>Eğitim Yönetimi</div>
          <div style={{fontSize:12,color:'var(--slate-light)',marginTop:3}}>{toplam} aktif · {buAy} bu ay · {taslak.length} taslak</div>
        </div>
        {canManage && <div style={{display:'flex',gap:8}}>
          <button className="btn btn-secondary" onClick={()=>setYukleAcik(true)} style={{fontSize:12,display:'flex',alignItems:'center',gap:6}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:13,height:13}}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Eğitim Yükle
          </button>
          <button className="btn btn-primary" onClick={()=>{setDuzenleId(null);resetForm();setFormAcik(true);}} style={{fontSize:12,display:'flex',alignItems:'center',gap:6}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:13,height:13}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Eğitim Oluştur
          </button>
        </div>}
      </div>

      {/* Metrikler */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10,marginBottom:16,flexShrink:0}}>
        {[
          {ic:'📚',lbl:'Toplam Eğitim',val:toplam,renk:'var(--teal)',bg:'rgba(20,184,166,0.1)'},
          {ic:'📅',lbl:'Bu Ay',val:buAy,renk:'#0284C7',bg:'rgba(2,132,199,0.1)'},
          {ic:'⏳',lbl:'Taslak',val:taslak.length,renk:'#D97706',bg:'rgba(217,119,6,0.1)'},
          {ic:'✅',lbl:'Tamamlanan',val:gecmis.length,renk:'var(--success)',bg:'rgba(5,150,105,0.1)'},
          {ic:'👥',lbl:'Toplam Katılım',val:egitimler.reduce((a,e)=>a+e.kayitli,0),renk:'#7C3AED',bg:'rgba(124,58,237,0.1)'},
        ].map(k=>(
          <div key={k.lbl} style={{background:'var(--card-bg)',border:'1px solid var(--border)',borderRadius:12,padding:'14px 16px',display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:38,height:38,borderRadius:10,background:k.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{k.ic}</div>
            <div>
              <div style={{fontSize:20,fontWeight:900,color:k.renk,fontFamily:"'Outfit',sans-serif",letterSpacing:'-0.3px'}}>{k.val}</div>
              <div style={{fontSize:'10.5px',color:'var(--slate-light)',marginTop:1}}>{k.lbl}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Sekmeler */}
      <div style={{display:'flex',borderBottom:'1px solid var(--border)',flexShrink:0,marginBottom:14}}>
        {TABS.map(t=>(
          <div key={t.id} onClick={()=>setTab(t.id)} style={{padding:'9px 16px',fontSize:12,fontWeight:600,cursor:'pointer',borderBottom:`2px solid ${tab===t.id?'var(--teal)':'transparent'}`,color:tab===t.id?'var(--teal)':'var(--slate-light)',transition:'all 0.15s',whiteSpace:'nowrap'}}>{t.lbl}</div>
        ))}
      </div>

      {/* İçerik */}
      <div style={{flex:1,overflowY:'auto'}}>
        {tab==='liste'  && renderListe(yayin)}
        {tab==='taslak' && renderListe(taslak)}
        {tab==='gecmis' && renderListe(gecmis)}
        {tab==='plan'   && renderPlan()}
      </div>

      {/* ── DETAY MODAL ── */}
      {detay && (() => {
        const e = detay;
        const dolulukYuzde = Math.round(e.kayitli/e.kapasite*100);
        return (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)'}} onClick={()=>setDetay(null)}>
            <div style={{width:680,maxWidth:'96vw',maxHeight:'90vh',background:'var(--card-bg)',borderRadius:20,overflow:'hidden',display:'flex',flexDirection:'column',boxShadow:'0 32px 80px rgba(0,0,0,0.25)'}} onClick={ev=>ev.stopPropagation()}>
              {/* Header */}
              <div style={{background:`linear-gradient(135deg,${e.renk},${e.renk}99)`,padding:'20px 24px',flexShrink:0}}>
                <div style={{display:'flex',alignItems:'flex-start',gap:14}}>
                  <div style={{width:52,height:52,borderRadius:14,background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,flexShrink:0}}>{e.ikon}</div>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',gap:6,marginBottom:6}}>
                      <span style={{fontSize:'9.5px',fontWeight:700,padding:'2px 9px',borderRadius:20,background:'rgba(255,255,255,0.2)',color:'white'}}>{e.kategori}</span>
                      {e.zorunlu && <span style={{fontSize:'9.5px',fontWeight:700,padding:'2px 9px',borderRadius:20,background:'rgba(220,38,38,0.3)',color:'white'}}>⚠ Zorunlu</span>}
                      <span style={{fontSize:'9.5px',fontWeight:700,padding:'2px 9px',borderRadius:20,background:'rgba(255,255,255,0.15)',color:'white'}}>{e.tip==='online'?'💻 Online':'🏛 Yüz Yüze'}</span>
                    </div>
                    <div style={{fontSize:18,fontWeight:900,color:'white',fontFamily:"'Outfit',sans-serif",letterSpacing:'-0.3px',lineHeight:1.3}}>{e.baslik}</div>
                  </div>
                  <div onClick={()=>setDetay(null)} style={{color:'rgba(255,255,255,0.7)',cursor:'pointer',fontSize:22,flexShrink:0}}>✕</div>
                </div>
              </div>
              {/* Body */}
              <div style={{flex:1,overflowY:'auto',padding:'20px 24px'}}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:16}}>
                  {[{ic:'📅',lbl:'Tarih',val:e.tarih.split('-').reverse().join('.')},{ic:'⏰',lbl:'Saat',val:e.saat},{ic:'⏱',lbl:'Süre',val:e.sure+' dakika'},{ic:'📍',lbl:'Yer',val:e.yer}].map(x=>(
                    <div key={x.lbl} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,padding:'10px 12px'}}>
                      <div style={{fontSize:16,marginBottom:4}}>{x.ic}</div>
                      <div style={{fontSize:10,color:'var(--slate-light)',textTransform:'uppercase',letterSpacing:'0.4px'}}>{x.lbl}</div>
                      <div style={{fontSize:12,fontWeight:700,color:'var(--slate)',marginTop:2}}>{x.val}</div>
                    </div>
                  ))}
                </div>
                <div className="an-section" style={{marginBottom:14}}><div className="an-section-hd">📖 Açıklama</div><div className="an-section-body" style={{fontSize:13,color:'var(--slate-mid)',lineHeight:1.7}}>{e.aciklama}</div></div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
                  <div className="an-section"><div className="an-section-hd">👤 Eğitmen</div><div className="an-section-body"><div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:38,height:38,borderRadius:'50%',background:e.renk,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800,color:'white'}}>{e.egitmen.split(' ').map(w=>w[0]).join('').slice(0,2)}</div><div><div style={{fontSize:13,fontWeight:700,color:'var(--slate)'}}>{e.egitmen}</div><div style={{fontSize:'10.5px',color:'var(--slate-light)'}}>{e.egitmenRol}</div></div></div></div></div>
                  <div className="an-section"><div className="an-section-hd">🎯 Hedef Kitle</div><div className="an-section-body"><div style={{display:'flex',flexWrap:'wrap',gap:5}}>{(e.hedefKitle||[]).map(h=><span key={h} style={{fontSize:'10.5px',padding:'3px 10px',borderRadius:20,background:`${e.renk}12`,border:`1px solid ${e.renk}25`,color:'var(--slate-mid)'}}>{h}</span>)}</div></div></div>
                </div>
                <div className="an-section" style={{marginBottom:14}}>
                  <div className="an-section-hd">👥 Katılım Durumu</div>
                  <div className="an-section-body">
                    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
                      <div style={{flex:1,height:10,background:'var(--border)',borderRadius:10,overflow:'hidden'}}><div style={{height:'100%',width:`${dolulukYuzde}%`,background:dolulukYuzde>=90?'var(--danger)':dolulukYuzde>=70?'var(--warning)':'var(--teal)',borderRadius:10}}/></div>
                      <div style={{fontSize:14,fontWeight:900,color:'var(--slate)',fontFamily:"'Outfit',sans-serif",flexShrink:0}}>{e.kayitli}/{e.kapasite}</div>
                    </div>
                    <div style={{display:'flex',gap:12}}>
                      {[{v:e.kayitli,l:'Kayıtlı',c:'var(--teal)'},{v:e.kapasite-e.kayitli,l:'Boş Yer',c:'var(--slate)'},{v:e.tamamlayan,l:'Tamamladı',c:'var(--success)'},{v:dolulukYuzde+'%',l:'Doluluk',c:'#7C3AED'}].map(x=><div key={x.l} className="eg-stat"><div className="eg-stat-val" style={{color:x.c}}>{x.v}</div><div className="eg-stat-lbl">{x.l}</div></div>)}
                    </div>
                  </div>
                </div>
                {e.malzeme?.length > 0 && <div className="an-section"><div className="an-section-hd">📎 Eğitim Materyalleri</div><div className="an-section-body" style={{display:'flex',flexDirection:'column',gap:7}}>
                  {e.malzeme.map((m,i) => { const tc = {pdf:{ic:'📑',renk:'#DC2626',bg:'rgba(220,38,38,0.08)'},video:{ic:'🎥',renk:'#7C3AED',bg:'rgba(124,58,237,0.08)'},slayt:{ic:'📊',renk:'#0284C7',bg:'rgba(2,132,199,0.08)'}}[m.tip]||{ic:'📄',renk:'var(--slate)',bg:'var(--surface)'}; return (
                    <div key={i} onClick={()=>showToast(`📥 ${m.ad} indiriliyor…`)} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:9,background:tc.bg,border:`1px solid ${tc.renk}20`,cursor:'pointer'}}>
                      <span style={{fontSize:20}}>{tc.ic}</span><div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:'var(--slate)'}}>{m.ad}</div><div style={{fontSize:10,color:'var(--slate-light)',textTransform:'uppercase',marginTop:1}}>{m.tip}</div></div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tc.renk} strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </div>);
                  })}
                </div></div>}
              </div>
              {/* Footer */}
              <div style={{padding:'12px 24px',borderTop:'1px solid var(--border)',display:'flex',gap:8,justifyContent:'space-between',background:'var(--surface)',flexShrink:0}}>
                <div style={{display:'flex',gap:8}}>
                  {e.durum!=='tamamlandi' && canManage && <button onClick={()=>{setDetay(null);duzenle(e.id);}} className="btn btn-secondary" style={{fontSize:12}}>✏️ Düzenle</button>}
                  {e.taslak && canManage && <button onClick={()=>{yayinla(e.id);setDetay(null);}} className="btn btn-primary" style={{fontSize:12,background:'#059669'}}>🚀 Yayınla</button>}
                  <button onClick={()=>{setDetay(null);baslat(e.id);}} className="btn btn-sm" style={{fontSize:12,background:'rgba(124,58,237,0.1)',color:'#7C3AED',border:'1.5px solid rgba(124,58,237,0.25)'}}>🎬 Sunumu Başlat</button>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>showToast('🖨 Yazdırılıyor…')} className="btn btn-secondary" style={{fontSize:12}}>🖨 Yazdır</button>
                  <button onClick={()=>setDetay(null)} className="btn btn-secondary" style={{fontSize:12}}>Kapat</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── OLUŞTUR MODAL ── */}
      {formAcik && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:9999,display:'flex',alignItems:'flex-start',justifyContent:'center',backdropFilter:'blur(4px)',overflowY:'auto',padding:'32px 16px'}} onClick={()=>{setFormAcik(false);setDuzenleId(null);}}>
          <div style={{width:580,maxWidth:'100%',background:'var(--card-bg)',borderRadius:20,overflow:'hidden',boxShadow:'0 32px 80px rgba(0,0,0,0.25)',margin:'auto'}} onClick={ev=>ev.stopPropagation()}>

            {/* Başlık */}
            <div style={{padding:'18px 22px',background:'linear-gradient(135deg,#0F766E,#0891b2)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{fontSize:15,fontWeight:800,color:'white'}}>{duzenleId ? '✏️ Eğitimi Düzenle' : '📚 Yeni Eğitim Oluştur'}</div>
              <div onClick={()=>{setFormAcik(false);setDuzenleId(null);}} style={{color:'rgba(255,255,255,0.7)',cursor:'pointer',fontSize:20,lineHeight:1}}>✕</div>
            </div>

            {/* Form */}
            <div style={{padding:'20px 22px',display:'flex',flexDirection:'column',gap:14}}>

              <div><label className="fl">Eğitim Başlığı *</label><input className="fi" value={form.baslik} onChange={e=>f('baslik',e.target.value)} placeholder="Eğitim adını girin…" autoFocus/></div>
              <div><label className="fl">Açıklama *</label><textarea className="fi" rows={3} value={form.aciklama} onChange={e=>f('aciklama',e.target.value)} placeholder="Eğitimin amacı, içeriği ve hedefleri…" style={{resize:'vertical'}}/></div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div><label className="fl">Kategori</label><select className="fi" value={form.kategori} onChange={e=>f('kategori',e.target.value)}>{EGITIM_KATEGORILER.map(k=><option key={k}>{k}</option>)}</select></div>
                <div><label className="fl">Tip</label><select className="fi" value={form.tip} onChange={e=>f('tip',e.target.value)}><option value="yüz_yüze">🏛 Yüz Yüze</option><option value="online">💻 Online</option><option value="hibrit">🔀 Hibrit</option></select></div>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'80px 1fr auto',gap:12,alignItems:'end'}}>
                <div><label className="fl">İkon</label><input className="fi" value={form.ikon} onChange={e=>f('ikon',e.target.value)} maxLength={2} style={{fontSize:20,textAlign:'center'}}/></div>
                <div><label className="fl">Renk Teması</label><select className="fi" value={form.renk} onChange={e=>f('renk',e.target.value)}>{[['#0284C7','🔵 Mavi'],['#7C3AED','🟣 Mor'],['#DC2626','🔴 Kırmızı'],['#059669','🟢 Yeşil'],['#D97706','🟠 Turuncu'],['#0891b2','🩵 Teal'],['#6366F1','💜 İndigo']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
                <div style={{display:'flex',alignItems:'center',gap:7,paddingBottom:10}}>
                  <input type="checkbox" checked={form.zorunlu} onChange={e=>f('zorunlu',e.target.checked)} style={{width:15,height:15,accentColor:'var(--danger)',cursor:'pointer'}}/>
                  <label style={{fontSize:12,fontWeight:600,color:'var(--slate)',whiteSpace:'nowrap',cursor:'pointer'}}>Zorunlu</label>
                </div>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 120px',gap:12}}>
                <div><label className="fl">Tarih *</label><input className="fi" type="date" value={form.tarih} onChange={e=>f('tarih',e.target.value)}/></div>
                <div><label className="fl">Saat *</label><input className="fi" type="time" value={form.saat} onChange={e=>f('saat',e.target.value)}/></div>
                <div><label className="fl">Süre (dk)</label><input className="fi" type="number" value={form.sure} min={15} max={480} onChange={e=>f('sure',parseInt(e.target.value)||60)}/></div>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 120px',gap:12}}>
                <div><label className="fl">Yer / Platform</label><input className="fi" value={form.yer} onChange={e=>f('yer',e.target.value)} placeholder="Konferans Salonu A / Zoom…"/></div>
                <div><label className="fl">Kapasite</label><input className="fi" type="number" value={form.kapasite} min={1} max={200} onChange={e=>f('kapasite',parseInt(e.target.value)||20)}/></div>
              </div>

              <div><label className="fl">Eğitmen *</label><select className="fi" value={form.egitmen} onChange={e=>f('egitmen',e.target.value)}>{SORUMLULAR.map(s=><option key={s.ad} value={s.ad}>{s.ad} — {s.rol}</option>)}</select></div>

              <div>
                <label className="fl">Hedef Kitle (çoklu seçim)</label>
                <div style={{display:'flex',flexWrap:'wrap',gap:7,marginTop:6}}>
                  {['Tüm Personel','Hemşire','Anestezi Teknisyeni','Ameliyathane Personeli','Sterilizasyon Personeli','Doktor','Sekreterlik'].map(h=>{
                    const secili = form.hedefKitle.includes(h);
                    return <div key={h} onClick={()=>f('hedefKitle',secili?form.hedefKitle.filter(x=>x!==h):[...form.hedefKitle,h])} style={{padding:'5px 13px',borderRadius:20,cursor:'pointer',fontSize:'11.5px',fontWeight:600,border:`1.5px solid ${secili?'var(--teal)':'var(--border)'}`,background:secili?'rgba(20,184,166,0.1)':'var(--surface)',color:secili?'var(--teal)':'var(--slate-light)',transition:'all 0.12s'}}>{h}</div>;
                  })}
                </div>
              </div>

            </div>

            {/* Footer */}
            <div style={{padding:'14px 22px',borderTop:'1px solid var(--border)',display:'flex',gap:8,flexWrap:'wrap',justifyContent:'space-between',background:'var(--surface)'}}>
              <button className="btn btn-sm" style={{background:'rgba(124,58,237,0.1)',color:'#7C3AED',border:'1.5px solid rgba(124,58,237,0.25)',fontSize:12,display:'flex',alignItems:'center',gap:6}} onClick={()=>{
                const id = duzenleId || Date.now();
                if (!duzenleId) { formKaydet(true); }
                setFormAcik(false);
                setTimeout(()=>editorAc(id), 100);
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:13,height:13}}><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Operio Sunumu Oluştur
              </button>
              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-secondary" onClick={()=>{setFormAcik(false);setDuzenleId(null);}}>İptal</button>
                <button className="btn btn-secondary" onClick={()=>formKaydet(true)} style={{color:'#D97706',borderColor:'rgba(217,119,6,0.4)'}}>📝 Taslak Kaydet</button>
                <button className="btn btn-primary" onClick={()=>formKaydet(false)}>🚀 Yayınla</button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── YÜKLE MODAL ── */}
      {yukleAcik && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)'}} onClick={()=>setYukleAcik(false)}>
            <div style={{width:480,background:'var(--card-bg)',borderRadius:18,overflow:'hidden',boxShadow:'0 24px 60px rgba(0,0,0,0.25)'}} onClick={ev=>ev.stopPropagation()}>
              <div style={{padding:'16px 22px',background:'linear-gradient(135deg,#7C3AED,#6366F1)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div style={{fontSize:14,fontWeight:700,color:'white'}}>📤 Dışarıdan Eğitim Yükle</div>
                <div onClick={()=>setYukleAcik(false)} style={{color:'rgba(255,255,255,0.7)',cursor:'pointer',fontSize:20}}>✕</div>
              </div>
              <div style={{padding:'20px 22px'}}>
                <div style={{border:'2px dashed var(--border)',borderRadius:14,padding:32,textAlign:'center',background:'var(--surface)',marginBottom:14}}>
                  <div style={{fontSize:36,marginBottom:12}}>📁</div>
                  <div style={{fontSize:'13.5px',fontWeight:700,color:'var(--slate)',marginBottom:6}}>Dosyaları buraya sürükleyin</div>
                  <div style={{fontSize:11,color:'var(--slate-light)',marginBottom:14}}>PDF, PPT, PPTX, MP4, YouTube linki desteklenir</div>
                  <button onClick={()=>showToast('📂 Dosya seçici açılıyor…')} className="btn btn-secondary" style={{fontSize:'11.5px'}}>Dosya Seç</button>
                </div>
                <div className="an-section" style={{marginBottom:0}}>
                  <div className="an-section-hd">🔗 URL ile Yükle</div>
                  <div className="an-section-body">
                    <div className="fg" style={{marginBottom:8}}><label className="fl">Video / Belge URL</label><input className="fi" value={yukleUrl} onChange={e=>setYukleUrl(e.target.value)} placeholder="https://youtube.com/... veya https://...pdf"/></div>
                    <div className="fg" style={{marginBottom:8}}><label className="fl">Materyal Adı</label><input className="fi" value={yukleAd} onChange={e=>setYukleAd(e.target.value)} placeholder="Eğitim materyali adı…"/></div>
                    <div className="fg"><label className="fl">Tür</label><select className="fi" value={yukleTip} onChange={e=>setYukleTip(e.target.value)}><option value="pdf">📑 PDF Döküman</option><option value="video">🎥 Video</option><option value="slayt">📊 Sunum / Slayt</option></select></div>
                  </div>
                </div>
              </div>
              <div style={{padding:'12px 22px',borderTop:'1px solid var(--border)',display:'flex',gap:8,justifyContent:'flex-end',background:'var(--surface)'}}>
                <button className="btn btn-secondary" onClick={()=>setYukleAcik(false)}>İptal</button>
                <button className="btn btn-primary" onClick={()=>{ if(!yukleAd||!yukleUrl){showToast('Ad ve URL zorunlu');return;} yukleKaydet(yukleAd,yukleUrl,yukleTip); }}>📥 Yükle ve Kaydet</button>
              </div>
            </div>
          </div>
      )}
    </div>
  );
}
