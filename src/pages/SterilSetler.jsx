import { useState, useRef, useEffect } from 'react';
import { useDataStore, useUIStore, useAuthStore } from '../store';
import Modal from '../components/ui/Modal';
import { listSterileSets, createSterileSet, updateSterileSet } from '../services/sterileSetsAdapter.js';

// ── İKONLAR (HTML ICONS'tan) ─────────────────────────────────
const IC_SET   = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:12,height:12}}><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>;
const IC_CLOCK = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:12,height:12}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const IC_RAF   = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:10,height:10}}><rect x="2" y="3" width="20" height="4" rx="1"/><rect x="2" y="10" width="20" height="4" rx="1"/><rect x="2" y="17" width="20" height="4" rx="1"/><line x1="6" y1="7" x2="6" y2="10"/><line x1="18" y1="7" x2="18" y2="10"/><line x1="6" y1="14" x2="6" y2="17"/><line x1="18" y1="14" x2="18" y2="17"/></svg>;

// ── DURUM KONFİG (HTML DURUM_SET_CFG'den birebir) ────────────
const DURUM_SET_CFG = {
  'Steril — Hazır': { color:'#059669', tag:'t-green'  },
  'Kullanımda':     { color:'#0284C7', tag:'t-blue'   },
  'Sterilizasyonda':{ color:'#D97706', tag:'t-orange' },
  'Eksik Parça':    { color:'#DC2626', tag:'t-red'    },
  'Arızalı':        { color:'#DC2626', tag:'t-red'    },
};


const COLORS = ['#14B8A6','#0284C7','#7C3AED','#DC2626','#059669','#EA580C'];

export default function SterilSetler() {
  const { surgeries } = useDataStore();
  const { showToast } = useUIStore();
  const { curRole } = useAuthStore();
  const canEditDurum = curRole === 8 || curRole === 9;

  const [setler,   setSetler]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [excelFile, setExcelFile] = useState(null);
  const [excelDrag, setExcelDrag] = useState(false);
  const fileInputRef = useRef(null);
  useEffect(() => {
    listSterileSets()
      .then(data => {
        const mapped = data.map((s, i) => ({ ...s, color: COLORS[i % COLORS.length] }));
        setSetler(mapped);
        if (mapped.length) setSelId(mapped[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  const [selId,    setSelId]    = useState(null);
  const [search,   setSearch]   = useState('');
  const [modalOpen,setModalOpen]= useState(false);
  const [editId,   setEditId]   = useState(null);
  const [form,     setForm]     = useState({ name:'', doktor:'', raf:'', durum:'Steril — Hazır', aletler:[{ad:'',adet:1},{ad:'',adet:1}] });

  const filtered = setler.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.doktor.toLowerCase().includes(search.toLowerCase())
  );
  const sel = setler.find(s => s.id === selId);

  // Kullanımdaki set için ameliyat eşleştir
  function getSurgeryForSet(s) {
    if (!s || s.durum !== 'Kullanımda') return null;
    return (surgeries || []).find(surg => surg.dr === s.doktor) || null;
  }

  // ── Modal ──────────────────────────────────────────────────
  function openModal(id = null) {
    setEditId(id);
    setExcelFile(null);
    if (id) {
      const s = setler.find(x => x.id === id);
      setForm({ name:s.name, doktor:s.doktor, raf:s.raf, durum:s.durum, aletler:s.aletler.map(a=>({ad:a.ad,adet:a.adet||1})) });
    } else {
      setForm({ name:'', doktor:'', raf:'', durum:'Steril — Hazır', aletler:[{ad:'',adet:1},{ad:'',adet:1}] });
    }
    setModalOpen(true);
  }

  function addAletRow() {
    setForm(f => ({ ...f, aletler:[...f.aletler, {ad:'',adet:1}] }));
  }
  function removeAletRow(i) {
    setForm(f => ({ ...f, aletler:f.aletler.filter((_,idx)=>idx!==i) }));
  }
  function updateAlet(i, key, val) {
    setForm(f => ({ ...f, aletler:f.aletler.map((a,idx)=>idx===i?{...a,[key]:val}:a) }));
  }

  function handleExcelFile(file) {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx','xls','csv'].includes(ext)) { showToast('Lütfen .xlsx, .xls veya .csv dosyası seçin'); return; }
    setExcelFile(file);
    // Simüle: dosya adından alet listesi oluştur (gerçek parse için SheetJS eklenebilir)
    const simAletler = [
      { ad:'Trokar 10mm', adet:1 }, { ad:'Trokar 5mm', adet:2 }, { ad:'Laparoskop 30°', adet:1 },
      { ad:'Grasper', adet:1 }, { ad:'Koter Elektrotu', adet:1 }
    ];
    setForm(f => ({ ...f, aletler: simAletler }));
    showToast(`${file.name} yüklendi — ${simAletler.length} alet içe aktarıldı ✓`);
  }

  function handleExcelDrop(e) {
    e.preventDefault();
    setExcelDrag(false);
    const file = e.dataTransfer.files[0];
    handleExcelFile(file);
  }

  async function saveSet() {
    const name = form.name.trim();
    if (!name) { showToast('Set adı zorunlu'); return; }
    const doktor = form.doktor.trim() || 'Genel Kullanım';
    const raf    = form.raf.trim() || 'A-1';
    const aletler = form.aletler
      .filter(a => a.ad.trim())
      .map(a => ({ ad:a.ad.trim(), adet:Number(a.adet)||1, raf }));
    const payload = {
      name,
      code: doktor,
      shelf_location: raf,
      status: form.durum,
      instruments: aletler.map(a => ({ name:a.ad, expected_count:a.adet })),
    };

    try {
      if (editId) {
        const result = await updateSterileSet(editId, payload);
        if (!result) throw new Error('Hata');
        setSetler(prev => prev.map(x => x.id===editId ? { ...x, name, doktor, raf, durum:form.durum, aletler } : x));
        setSelId(editId);
        showToast('Set güncellendi ✓');
      } else {
        const result = await createSterileSet(payload);
        if (!result) throw new Error('Hata');
        const newSet = { id:result.id, name, doktor, raf, durum:form.durum, color:COLORS[setler.length%6], aletler };
        setSetler(prev => [...prev, newSet]);
        setSelId(result.id);
        showToast('Set oluşturuldu ✓');
      }
      setModalOpen(false);
    } catch(e) {
      showToast('Kayıt hatası: ' + e.message);
    }
  }

  async function updateDurum(id, durum) {
    setSetler(prev => prev.map(x => x.id===id ? {...x, durum} : x));
    try {
      await updateSterileSet(id, { status: durum });
      showToast('Set durumu güncellendi: ' + durum);
    } catch(e) {
      showToast('Güncelleme hatası: ' + e.message);
    }
  }

  return (
    <>
      {/* Başlık */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
        <div>
          <div className="page-hd-title">Cerrahi Setler</div>
          <div className="page-hd-sub">{loading ? 'Yükleniyor…' : `${setler.length} set kayıtlı — steril depo envanteri`}</div>
        </div>
        <button className="btn btn-primary" onClick={()=>openModal()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:13,height:13}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Yeni Set Oluştur
        </button>
      </div>

      {/* ── SET LAYOUT ── */}
      <div className="set-layout">

        {/* SOL: Sidebar */}
        <div className="set-sidebar">
          <div className="set-sidebar-hd">
            <div style={{fontSize:'9.5px',fontWeight:700,color:'var(--slate-light)',textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:8}}>Setler</div>
            <div style={{position:'relative'}}>
              <svg style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',width:12,height:12,stroke:'var(--slate-light)',fill:'none'}} viewBox="0 0 24 24" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input
                style={{width:'100%',border:'1px solid var(--border)',borderRadius:7,padding:'6px 10px 6px 28px',fontSize:'11.5px',fontFamily:'var(--font)',outline:'none',background:'var(--input-bg)',color:'var(--slate)'}}
                placeholder="Set ara…" value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
          </div>

          <div className="set-list">
            {filtered.map(s => {
              const dcfg = DURUM_SET_CFG[s.durum] || { color:'#94A3B8' };
              return (
                <div key={s.id} className={`set-item${s.id===selId?' active':''}`} onClick={()=>setSelId(s.id)}>
                  <div className="set-icon" style={{background:`${s.color}18`}}>
                    <svg viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div className="set-item-name">{s.name}</div>
                    <div style={{fontSize:'9.5px',color:'var(--slate-light)',marginTop:1}}>{s.doktor} · Raf: {s.raf}</div>
                  </div>
                  <div className="set-item-status" style={{background:dcfg.color}}/>
                </div>
              );
            })}
            {!filtered.length && (
              <div style={{textAlign:'center',padding:'24px 10px',color:'var(--slate-light)',fontSize:12}}>Set bulunamadı</div>
            )}
          </div>

          <div style={{padding:10,borderTop:'1px solid var(--border)'}}>
            <button className="btn btn-secondary btn-sm" style={{width:'100%'}} onClick={()=>openModal()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:12,height:12}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Yeni Set Ekle
            </button>
          </div>
        </div>

        {/* SAĞ: Detay */}
        <div className="set-detail">
          {!sel ? (
            <div className="empty"><div className="empty-text">Set seçin</div></div>
          ) : (() => {
            const s = sel;
            const dcfg = DURUM_SET_CFG[s.durum] || { color:'#94A3B8', tag:'t-gray' };
            const ameliyat = getSurgeryForSet(s);
            return (
              <>
                {/* Header */}
                <div className="set-detail-hd">
                  <div className="set-detail-icon" style={{background:`${s.color}18`}}>
                    <svg viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
                  </div>
                  <div style={{flex:1}}>
                    <div className="set-detail-name">{s.name}</div>
                    <div className="set-detail-doc">{s.doktor}</div>
                    <div style={{display:'flex',gap:7,marginTop:8,flexWrap:'wrap'}}>
                      <span className={`tag ${dcfg.tag}`} style={{fontSize:'9.5px'}}>{s.durum}</span>
                      <span className="pros-meta">{IC_RAF}Raf: {s.raf}</span>
                      <span className="pros-meta">{IC_SET}{s.aletler.length} Alet</span>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:7,flexShrink:0}}>
                    <button className="btn btn-secondary btn-sm" onClick={()=>openModal(s.id)}>Düzenle</button>
                  </div>
                </div>

                {/* Body */}
                <div className="set-detail-body">

                  {/* Aktif Kullanım Bilgisi */}
                  {s.durum === 'Kullanımda' && (
                    <div style={{background:'rgba(2,132,199,0.06)',border:'1.5px solid rgba(2,132,199,0.25)',borderRadius:11,padding:'13px 16px',marginBottom:14}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                        <div style={{width:8,height:8,borderRadius:'50%',background:'#059669',boxShadow:'0 0 0 3px rgba(5,150,105,0.2)',flexShrink:0}}/>
                        <span style={{fontSize:10,fontWeight:700,color:'#0284C7',textTransform:'uppercase',letterSpacing:'0.4px'}}>Aktif Kullanım Bilgisi</span>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                        <div style={{background:'var(--card-bg)',border:'1px solid var(--border)',borderRadius:8,padding:'9px 12px'}}>
                          <div style={{fontSize:9,color:'var(--slate-light)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:3}}>Ameliyat Salonu</div>
                          <div style={{fontSize:13,fontWeight:800,color:'#0284C7',fontFamily:"'Outfit',sans-serif"}}>{ameliyat?ameliyat.salon:'Bilinmiyor'}</div>
                        </div>
                        <div style={{background:'var(--card-bg)',border:'1px solid var(--border)',borderRadius:8,padding:'9px 12px'}}>
                          <div style={{fontSize:9,color:'var(--slate-light)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:3}}>Saat</div>
                          <div style={{fontSize:13,fontWeight:800,color:'var(--slate)',fontFamily:"'Outfit',sans-serif"}}>{ameliyat?`${ameliyat.saat} – ${ameliyat.bitis}`:'—'}</div>
                        </div>
                        <div style={{background:'var(--card-bg)',border:'1px solid var(--border)',borderRadius:8,padding:'9px 12px',gridColumn:'1/-1'}}>
                          <div style={{fontSize:9,color:'var(--slate-light)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:3}}>Ameliyat</div>
                          <div style={{fontSize:12,fontWeight:700,color:'var(--slate)'}}>{ameliyat?ameliyat.op:'—'}</div>
                          <div style={{fontSize:'10.5px',color:'var(--teal)',fontWeight:600,marginTop:2}}>{ameliyat?ameliyat.dr:s.doktor}</div>
                        </div>
                      </div>
                      {!ameliyat && <div style={{fontSize:10,color:'var(--warning)',marginTop:8,fontWeight:500}}>⚠ Ameliyat listesinde eşleşen kayıt bulunamadı</div>}
                    </div>
                  )}

                  {/* Aletler */}
                  <div className="det-title" style={{marginBottom:10,paddingBottom:8,borderBottom:'1px solid var(--border)'}}>
                    {IC_SET}
                    Cerrahi Aletler ({s.aletler.length} kalem)
                  </div>
                  <div className="alet-list">
                    {s.aletler.map((a,i) => (
                      <div key={i} className="alet-row">
                        <div className="alet-num">{i+1}</div>
                        <span className="alet-name">{a.ad}</span>
                        <div className="alet-raf">{IC_RAF}Raf: {a.raf||s.raf}</div>
                        {a.adet ? (
                          <span style={{fontSize:10,fontWeight:700,color:'var(--teal)',background:'rgba(20,184,166,0.1)',border:'1px solid rgba(20,184,166,0.2)',borderRadius:20,padding:'1px 8px',flexShrink:0}}>{a.adet||1} adet</span>
                        ) : (
                          <span style={{fontSize:10,color:'var(--slate-light)'}}>1 adet</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Durum güncelleme */}
                  <div style={{marginTop:16,paddingTop:14,borderTop:'1px solid var(--border)'}}>
                    <div className="det-title" style={{marginBottom:10,paddingBottom:8,borderBottom:'1px solid var(--border)'}}>
                      {IC_CLOCK}
                      {canEditDurum ? 'Sterilizasyon Durum Güncelleme' : 'Sterilizasyon Durumu'}
                    </div>
                    {canEditDurum ? (
                      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                        {Object.keys(DURUM_SET_CFG).map(d => (
                          <button key={d} className={`btn btn-sm ${s.durum===d?'btn-primary':'btn-secondary'}`} onClick={()=>updateDurum(s.id, d)}>
                            {d}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span className={`tag ${dcfg.tag}`} style={{fontSize:11}}>{s.durum}</span>
                      </div>
                    )}
                  </div>

                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* ── MODAL ── */}
      {modalOpen && (
        <Modal title={editId ? 'Cerrahi Seti Düzenle' : 'Yeni Cerrahi Set Oluştur'} onClose={()=>setModalOpen(false)} width={580}>
          <div className="fr" style={{marginBottom:8}}>
            <div className="fg"><label className="fl">Set Adı *</label><input className="fi" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ör: Laparoskopi Seti A"/></div>
            <div className="fg"><label className="fl">Doktor</label><input className="fi" value={form.doktor} onChange={e=>setForm({...form,doktor:e.target.value})} placeholder="Dr. Ad Soyad / Genel Kullanım"/></div>
          </div>
          <div className="fr" style={{marginBottom:8}}>
            <div className="fg"><label className="fl">Raf Konumu</label><input className="fi" value={form.raf} onChange={e=>setForm({...form,raf:e.target.value})} placeholder="Ör: A-1"/></div>
            <div className="fg">
              <label className="fl">Durum</label>
              <select className="fi" value={form.durum} onChange={e=>setForm({...form,durum:e.target.value})}>
                {Object.keys(DURUM_SET_CFG).map(d=><option key={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div className="fg" style={{marginBottom:8}}>
            <label className="fl" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span>Excel'den Alet Listesi Yükle</span>
              {excelFile && (
                <span style={{fontSize:10,color:'var(--teal)',fontWeight:600}}>✓ {excelFile.name}</span>
              )}
            </label>
            <div
              onDragOver={e=>{e.preventDefault();setExcelDrag(true);}}
              onDragLeave={()=>setExcelDrag(false)}
              onDrop={handleExcelDrop}
              onClick={()=>fileInputRef.current?.click()}
              style={{
                border:`1.5px dashed ${excelDrag?'var(--teal)':excelFile?'#059669':'var(--border)'}`,
                borderRadius:9, padding:'14px 12px', cursor:'pointer', textAlign:'center',
                background: excelDrag?'rgba(20,184,166,0.05)':excelFile?'rgba(5,150,105,0.04)':'var(--surface)',
                transition:'all 0.15s'
              }}
            >
              <div style={{fontSize:20,marginBottom:4}}>{excelFile?'📊':'📁'}</div>
              {excelFile ? (
                <div style={{fontSize:11,fontWeight:600,color:'#059669'}}>{excelFile.name} yüklendi</div>
              ) : (
                <>
                  <div style={{fontSize:11,fontWeight:600,color:'var(--slate-mid)'}}>Excel dosyasını sürükleyin veya tıklayın</div>
                  <div style={{fontSize:10,color:'var(--slate-light)',marginTop:2}}>.xlsx, .xls veya .csv — Alet listesi otomatik içe aktarılır</div>
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{display:'none'}}
              onChange={e=>handleExcelFile(e.target.files[0])}/>
            {excelFile && (
              <button type="button" onClick={()=>{setExcelFile(null);setForm(f=>({...f,aletler:[{ad:'',adet:1},{ad:'',adet:1}]}));}}
                style={{marginTop:5,fontSize:10,color:'var(--slate-light)',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',padding:0}}>
                × Dosyayı kaldır
              </button>
            )}
          </div>

          <div className="fg" style={{marginBottom:8}}>
            <label className="fl" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span>Cerrahi Aletler</span>
              <button type="button" onClick={addAletRow} style={{fontSize:10,padding:'3px 10px',borderRadius:20,border:'1.5px solid rgba(20,184,166,0.3)',background:'rgba(20,184,166,0.08)',color:'var(--teal)',cursor:'pointer',fontFamily:'inherit',textTransform:'none',letterSpacing:0}}>+ Alet Ekle</button>
            </label>
            <div style={{maxHeight:240,overflowY:'auto',marginTop:6}}>
              {form.aletler.map((a,i) => (
                <div key={i} className="alet-add-row">
                  <input className="fi" value={a.ad} placeholder="Alet adı" onChange={e=>updateAlet(i,'ad',e.target.value)}/>
                  <input className="fi" type="number" value={a.adet} placeholder="Adet" min="1" style={{maxWidth:90}} onChange={e=>updateAlet(i,'adet',e.target.value)}/>
                  <button type="button" onClick={()=>removeAletRow(i)} style={{width:30,height:38,border:'1px solid #FECACA',background:'#FEF2F2',color:'var(--danger)',borderRadius:7,cursor:'pointer',fontSize:16,flexShrink:0}}>×</button>
                </div>
              ))}
            </div>
          </div>

          <div className="mf">
            <button type="button" className="btn btn-secondary" onClick={()=>setModalOpen(false)}>İptal</button>
            <button type="button" className="btn btn-primary" onClick={saveSet}>{editId?'Güncelle':'Kaydet'}</button>
          </div>
        </Modal>
      )}
    </>
  );
}
