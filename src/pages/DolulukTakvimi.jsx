import { useState, useRef, useEffect } from 'react';
import { useUIStore, useDataStore } from '../store';
import { listSurgeries } from '../services/surgeriesAdapter.js';

const SALON_RENKLER = ['#14B8A6','#DC2626','#F59E0B','#6366F1'];
const GUN_ADLARI   = ['Pzt','Sal','Çar','Per','Cum','Cts','Paz'];
const AY_ADLARI    = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const AY_KISA      = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];

function tarihKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function haftalikGunler(offset) {
  const now = new Date(); const base = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 1);
  base.setDate(base.getDate() + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base); d.setDate(base.getDate() + i); return d;
  });
}

function aylikGunler(ayOffset) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + ayOffset, 1);
  const yil = d.getFullYear();
  const ay  = d.getMonth();
  const gunSayisi = new Date(yil, ay + 1, 0).getDate();
  return Array.from({ length: gunSayisi }, (_, i) => new Date(yil, ay, i + 1));
}

// ── COMPONENT ────────────────────────────────────────────────────
export default function DolulukTakvimi() {
  const { rooms } = useDataStore();
  const { showToast } = useUIStore();

  const [mod, setMod]         = useState('hafta');  // 'hafta' | 'saat' | 'ay'
  const [offset, setOffset]   = useState(0);
  const [data, setData]       = useState({});
  const dragSrcRef            = useRef(null);

  // Detay modal
  const [detayModal, setDetayModal] = useState(null); // {op, salon, tarih}
  // Yeni ameliyat modal
  const [yeniModal, setYeniModal]   = useState(null); // {salon, tarih}
  const [yeniForm, setYeniForm]     = useState({ op:'', hasta:'', saat:'09:00', sure:'90', cerrah:'' });

  const BUGUN = tarihKey(new Date());

  // Salonlar: DB'den yüklenen veri varsa onun anahtarları, yoksa rooms store, yoksa varsayılan
  const defaultSalonlar = rooms.length > 0
    ? rooms.map(r => r.ad || r.name || r.id)
    : ['Salon 1', 'Salon 2', 'Salon 3', 'Salon 4'];
  const salonlar = Object.keys(data).length > 0 ? Object.keys(data) : defaultSalonlar;

  // DB'den ameliyatları çek
  useEffect(() => {
    const token = localStorage.getItem('operio_access');
    if (!token) return;
    listSurgeries()
      .then(list => {
        const built = {};
        list.forEach(s => {
          const salon = s.salon || s.room?.name || s.roomId || 'Salon 1';
          const dt = new Date(s.tarihRaw || s.date || s.scheduledStart || '');
          if (isNaN(dt.getTime())) return;
          const tarih = tarihKey(dt);
          const saat  = s.saat || s.startTime || `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
          const salonIdx = Object.keys(built).indexOf(salon);
          const renk = SALON_RENKLER[(salonIdx === -1 ? Object.keys(built).length : salonIdx) % SALON_RENKLER.length];
          if (!built[salon]) built[salon] = {};
          if (!built[salon][tarih]) built[salon][tarih] = [];
          built[salon][tarih].push({
            saat,
            op:    s.op || s.type || s.title || '',
            dr:    s.dr || s.doctor?.name || s.surgeon_name || '',
            sure:  '',
            hasta: typeof s.hasta === 'string' ? s.hasta : (s.hasta ? `${s.hasta.name || ''} ${s.hasta.surname || ''}`.trim() : ''),
            renk,
          });
        });
        if (Object.keys(built).length > 0) setData(built);
      })
      .catch(() => {});
  }, []);

  // Günleri hesapla
  const gunler = mod === 'hafta' ? haftalikGunler(offset)
    : mod === 'saat' ? haftalikGunler(0)  // günlük = saatlik, bu hafta sabit
    : aylikGunler(offset);

  // Başlık
  let baslik = '';
  if (mod === 'hafta') {
    baslik = `${gunler[0].getDate()} ${AY_KISA[gunler[0].getMonth()]} – ${gunler[6].getDate()} ${AY_KISA[gunler[6].getMonth()]} ${gunler[0].getFullYear()}`;
  } else if (mod === 'saat') {
    const g = gunler[0];
    baslik = `${g.getDate()} ${AY_ADLARI[g.getMonth()]} ${g.getFullYear()} — Günlük Saat Görünümü`;
  } else {
    baslik = `${AY_ADLARI[gunler[0].getMonth()]} ${gunler[0].getFullYear()}`;
  }

  // ── DRAG & DROP ──────────────────────────────────────────────
  function handleDragStart(salon, tarih, saat) {
    dragSrcRef.current = { salon, tarih, saat };
  }

  // HTML'deki dropAmeliyat ile birebir — hedef saati de günceller
  function handleDrop(hedefSalon, hedefTarih, hedefSaat = null) {
    const src = dragSrcRef.current;
    if (!src) return;
    const { salon: srcSalon, tarih: srcTarih, saat: srcSaat } = src;

    setData(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const srcOps = next[srcSalon]?.[srcTarih] || [];
      const idx    = srcOps.findIndex(o => o.saat === srcSaat);
      if (idx === -1) return prev;
      const [op] = srcOps.splice(idx, 1);
      // Hedef saat varsa güncelle (günlük saatlik görünüm)
      if (hedefSaat !== null) {
        op.saat = `${hedefSaat.toString().padStart(2,'0')}:00`;
      }
      if (!next[hedefSalon]) next[hedefSalon] = {};
      if (!next[hedefSalon][hedefTarih]) next[hedefSalon][hedefTarih] = [];
      next[hedefSalon][hedefTarih].push(op);
      showToast(`${op.op} → ${hedefSalon} ${op.saat} taşındı ✓`);
      return next;
    });
    dragSrcRef.current = null;
  }

  // ── YENİ AMELİYAT KAYDET ────────────────────────────────────
  function saveYeni() {
    if (!yeniForm.op.trim())   { showToast('Ameliyat adı zorunludur'); return; }
    if (!yeniForm.hasta.trim()){ showToast('Hasta adı zorunludur'); return; }
    const { salon, tarih } = yeniModal;
    const renk = SALON_RENKLER[salonlar.indexOf(salon)] || '#14B8A6';
    setData(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next[salon]) next[salon] = {};
      if (!next[salon][tarih]) next[salon][tarih] = [];
      next[salon][tarih].push({ saat: yeniForm.saat, op: yeniForm.op, dr: yeniForm.cerrah, sure: yeniForm.sure + ' dk', hasta: yeniForm.hasta, renk });
      return next;
    });
    showToast('Ameliyat takvime eklendi ✓');
    setYeniModal(null);
    setYeniForm({ op:'', hasta:'', saat:'09:00', sure:'90', cerrah:'' });
  }

  // ── HAFTALİK TABLO ──────────────────────────────────────────
  const HaftaTablosu = () => (
    <div className="salon-takvim-wrap">
      <table className="salon-takvim-table">
        <thead>
          <tr>
            <th>Salon</th>
            {gunler.map((d, i) => {
              const isBugun     = tarihKey(d) === BUGUN;
              const isHaftasonu = d.getDay() === 0 || d.getDay() === 6;
              return (
                <th key={i} style={{ ...(isBugun ? { color:'var(--teal)', background:'rgba(20,184,166,0.08)' } : isHaftasonu ? { color:'var(--slate-light)' } : {}) }}>
                  {GUN_ADLARI[(d.getDay() + 6) % 7]}<br/>
                  <span style={{ fontSize:13, fontWeight: isBugun ? 800 : 600, color: isBugun ? 'var(--teal)' : 'var(--slate)' }}>
                    {d.getDate()}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {salonlar.map((salon, si) => (
            <tr key={salon}>
              <td>
                <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:SALON_RENKLER[si]||'#94A3B8', flexShrink:0 }}/>
                  <span>{salon}</span>
                </div>
              </td>
              {gunler.map((d, gi) => {
                const tk    = tarihKey(d);
                const ops   = (data[salon]?.[tk]) || [];
                const isBugun = tk === BUGUN;
                return (
                  <td key={gi}
                    style={{ background: isBugun ? 'rgba(20,184,166,0.04)' : undefined }}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = 'rgba(20,184,166,0.1)'; }}
                    onDragLeave={e => { e.currentTarget.style.background = isBugun ? 'rgba(20,184,166,0.04)' : ''; }}
                    onDrop={e => { e.currentTarget.style.background = isBugun ? 'rgba(20,184,166,0.04)' : ''; handleDrop(salon, tk); }}>
                    <div className="takvim-cell">
                      {ops.length > 0 ? ops.map((op, oi) => (
                        <div key={oi}
                          className="takvim-op-chip"
                          draggable
                          onDragStart={e => { handleDragStart(salon, tk, op.saat); e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain', op.op); e.currentTarget.style.opacity='0.5'; }}
                          onDragEnd={e => { e.currentTarget.style.opacity='1'; }}
                          style={{ background:`${op.renk}18`, color:op.renk, borderColor:`${op.renk}33`, cursor:'grab' }}
                          onClick={() => setDetayModal({ op, salon, tarih: tk })}
                          title={`${op.op} — ${op.dr} · Sürükleyerek taşıyın`}>
                          <div style={{ fontSize:9, opacity:0.7, marginBottom:1 }}>{op.saat}</div>
                          <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:110 }}>{op.op}</div>
                          <div style={{ fontSize:'8.5px', opacity:0.6, marginTop:1 }}>{op.dr}</div>
                        </div>
                      )) : (
                        <div className="takvim-bos" onClick={() => setYeniModal({ salon, tarih: tk })} title="Yeni ameliyat ekle">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                          </svg>
                        </div>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // ── SAATLİK GÖRÜNÜM ──────────────────────────────────────────
  const SAATLER = Array.from({ length: 14 }, (_, i) => i + 7); // 07:00–20:00
  const SAAT_Y  = 64;

  const GunlukGorunum = () => (
    <div style={{ overflowX:'auto', overflowY:'auto', maxHeight:'calc(100vh - 260px)', background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:16 }}>
      <div style={{ display:'grid', gridTemplateColumns:`60px ${salonlar.map(()=>'1fr').join(' ')}`, minWidth:680 }}>
        {/* Header */}
        <div style={{ position:'sticky', top:0, zIndex:10, background:'var(--surface)', borderBottom:'2px solid var(--border)', padding:'10px 0' }}/>
        {salonlar.map((s, i) => (
          <div key={s} style={{ position:'sticky', top:0, zIndex:10, background:'var(--surface)', borderBottom:'2px solid var(--border)', borderLeft:'1px solid var(--border)', padding:12, textAlign:'center' }}>
            <div style={{ width:10, height:10, borderRadius:'50%', background:SALON_RENKLER[i], margin:'0 auto 5px' }}/>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--slate)' }}>{s}</div>
          </div>
        ))}

        {/* Saat satırları */}
        {SAATLER.map(h => (
          <>
            <div key={`t${h}`} style={{ borderBottom:'1px solid var(--border)', padding:'8px 6px', fontSize:10, color:'var(--slate-light)', fontWeight:600, height:SAAT_Y, display:'flex', alignItems:'flex-start', whiteSpace:'nowrap', fontFamily:"'Outfit',sans-serif" }}>
              {String(h).padStart(2,'0')}:00
            </div>
            {salonlar.map((salon, si) => {
              const ops = (data[salon]?.[BUGUN]) || [];
              const op  = ops.find(o => Number(o.saat.split(':')[0]) === h);
              return (
                <div key={`${salon}${h}`}
                  className="takvim-saat-cell"
                  style={{ borderBottom:'1px solid var(--border)', borderLeft:'1px solid var(--border)', height:SAAT_Y, position:'relative', transition:'background 0.12s' }}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = 'rgba(20,184,166,0.08)'; }}
                  onDragLeave={e => { e.currentTarget.style.background = ''; }}
                  onDrop={e => { e.currentTarget.style.background = ''; handleDrop(salon, BUGUN, h); }}>
                  {op ? (
                    <div
                      draggable
                      onDragStart={e => { handleDragStart(salon, BUGUN, op.saat); e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain', op.op); e.currentTarget.style.opacity='0.5'; }}
                      onDragEnd={e => { e.currentTarget.style.opacity='1'; }}
                      onClick={() => setDetayModal({ op, salon, tarih: BUGUN })}
                      style={{ position:'absolute', inset:3, background:`${op.renk}15`, border:`1.5px solid ${op.renk}44`, borderLeft:`3px solid ${op.renk}`, borderRadius:8, padding:'5px 8px', cursor:'grab', overflow:'hidden', transition:'all 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.transform='scale(1.02)'}
                      onMouseLeave={e => e.currentTarget.style.transform=''}>
                      <div style={{ fontSize:11, fontWeight:700, color:'var(--slate)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{op.op}</div>
                      <div style={{ fontSize:'9.5px', color:'var(--slate-light)', marginTop:2 }}>{op.saat} · {op.sure} · {op.dr}</div>
                    </div>
                  ) : (
                    <div className="takvim-empty-slot"
                      onClick={() => setYeniModal({ salon, tarih: BUGUN })}
                      style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', opacity:0, transition:'opacity 0.15s' }}>
                      <span style={{ fontSize:11, color:'var(--teal)', fontWeight:600 }}>+ Ekle</span>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );

  // ── AYLIK GÖRÜNÜM ────────────────────────────────────────────
  const AylikGorunum = () => {
    const ilkGun = gunler[0];
    const haftaBaslangic = (ilkGun.getDay() + 6) % 7;
    const bosHucreler   = Array(haftaBaslangic).fill(null);
    const tumHucreler   = [...bosHucreler, ...gunler];
    while (tumHucreler.length % 7 !== 0) tumHucreler.push(null);

    return (
      <div>
        <div className="ay-takvim-grid">
          {GUN_ADLARI.map(g => (
            <div key={g} className="ay-takvim-gun-hd">{g}</div>
          ))}
          {tumHucreler.map((d, i) => {
            if (!d) return <div key={i}/>;
            const tk      = tarihKey(d);
            const isBugun = tk === BUGUN;
            const tumOps  = salonlar.flatMap((salon, si) =>
              ((data[salon]?.[tk]) || []).map(op => ({ ...op, renk: SALON_RENKLER[si] || '#94A3B8' }))
            );
            return (
              <div key={i} className={`ay-takvim-gun${isBugun ? ' bugun' : ''}`}
                onClick={() => {}}>
                <div className="ay-takvim-gun-no">{d.getDate()}</div>
                {tumOps.slice(0, 3).map((op, oi) => (
                  <div key={oi} className="takvim-op-chip"
                    style={{ background:`${op.renk}18`, color:op.renk, borderColor:`${op.renk}33`, fontSize:'9.5px', marginBottom:2 }}
                    onClick={e => { e.stopPropagation(); setDetayModal({ op, salon: salonlar[0], tarih: tk }); }}>
                    {op.saat} {op.op.substring(0, 15)}{op.op.length > 15 ? '…' : ''}
                  </div>
                ))}
                {tumOps.length > 3 && (
                  <div style={{ fontSize:9, color:'var(--slate-light)', marginTop:2 }}>+{tumOps.length - 3} daha</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── RENDER ───────────────────────────────────────────────────
  return (
    <div className="takvim-layout">

      {/* Toolbar */}
      <div className="takvim-header">
        <button onClick={() => setOffset(o => o - 1)}
          style={{ width:32, height:32, borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>

        <div className="takvim-title">{baslik}</div>

        <button onClick={() => setOffset(o => o + 1)}
          style={{ width:32, height:32, borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>

        <button className="btn btn-secondary btn-sm" onClick={() => setOffset(0)}>Bugün</button>

        <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'var(--slate-light)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 9l4 4 4-4"/></svg>
          Sürükle-bırak ile ameliyat taşıyın
        </div>

        <div className="view-toggle" style={{ marginLeft:'auto' }}>
          <button className={`vt-btn${mod==='hafta'?' active':''}`} onClick={() => { setMod('hafta'); setOffset(0); }}>Haftalık</button>
          <button className={`vt-btn${mod==='saat'?' active':''}`}  onClick={() => { setMod('saat');  setOffset(0); }}>Günlük</button>
          <button className={`vt-btn${mod==='ay'?' active':''}`}    onClick={() => { setMod('ay');    setOffset(0); }}>Aylık</button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
        <span style={{ fontSize:10, fontWeight:600, color:'var(--slate-light)', textTransform:'uppercase', letterSpacing:'0.4px' }}>Salonlar:</span>
        {salonlar.map((s, i) => (
          <div key={s} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:SALON_RENKLER[i]||'#94A3B8' }}/>
            <span style={{ fontSize:11.5, color:'var(--slate-mid)' }}>{s}</span>
          </div>
        ))}
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:'#e2e8f0' }}/>
          <span style={{ fontSize:11.5, color:'var(--slate-light)' }}>Boş</span>
        </div>
      </div>

      {/* İçerik */}
      {mod === 'hafta' && <HaftaTablosu/>}
      {mod === 'saat'  && <GunlukGorunum/>}
      {mod === 'ay'    && <AylikGorunum/>}

      {/* ── AMELİYAT DETAY MODAL ── */}
      {detayModal && (
        <div className="modal-bg open" onClick={() => setDetayModal(null)}>
          <div className="modal" style={{ width:440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title" id="takvimDetayTitle">{detayModal.op.op}</div>
            <div style={{ background:`${detayModal.op.renk}15`, borderLeft:`4px solid ${detayModal.op.renk}`, padding:'14px 18px', marginBottom:16, borderRadius:8 }}>
              <div style={{ fontSize:15, fontWeight:700, color:'var(--slate)', fontFamily:"'Outfit',sans-serif", marginBottom:4 }}>{detayModal.op.op}</div>
              <div style={{ fontSize:11, color:detayModal.op.renk }}>Ameliyat Bilgileri</div>
            </div>
            <div style={{ padding:'0 2px' }}>
              {[
                ['📅 Tarih',    new Date(detayModal.tarih + 'T00:00:00').toLocaleDateString('tr-TR', { weekday:'long', year:'numeric', month:'long', day:'numeric' })],
                ['⏰ Saat',     detayModal.op.saat + (detayModal.op.sure ? ' · ' + detayModal.op.sure : '')],
                ['🏥 Salon',    detayModal.salon],
                ['👨‍⚕️ Cerrah', detayModal.op.dr || '—'],
              ].map(([l, v]) => (
                <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid var(--border)', fontSize:'12.5px' }}>
                  <span style={{ color:'var(--slate-light)' }}>{l}</span>
                  <span style={{ color:'var(--slate)', fontWeight:600, textAlign:'right', maxWidth:220 }}>{v}</span>
                </div>
              ))}
            </div>
            <div className="mf">
              <button className="btn btn-secondary" onClick={() => setDetayModal(null)}>Kapat</button>
            </div>
          </div>
        </div>
      )}

      {/* ── YENİ AMELİYAT MODAL ── */}
      {yeniModal && (
        <div className="modal-bg open" onClick={() => setYeniModal(null)}>
          <div className="modal" style={{ width:460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">{yeniModal.salon} — Yeni Ameliyat</div>
            <div style={{ padding:'8px 12px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:9, marginBottom:16, fontSize:12, color:'var(--slate-mid)' }}>
              📅 {new Date(yeniModal.tarih + 'T00:00:00').toLocaleDateString('tr-TR', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
            </div>
            <div className="fg" style={{ marginBottom:12 }}>
              <label className="fl">Ameliyat Adı *</label>
              <input className="fi" value={yeniForm.op} onChange={e => setYeniForm({...yeniForm, op:e.target.value})} placeholder="Laparoskopik Kolesistektomi" autoFocus/>
            </div>
            <div className="fg" style={{ marginBottom:12 }}>
              <label className="fl">Hasta Adı *</label>
              <input className="fi" value={yeniForm.hasta} onChange={e => setYeniForm({...yeniForm, hasta:e.target.value})} placeholder="Ad Soyad"/>
            </div>
            <div className="fr" style={{ marginBottom:12 }}>
              <div className="fg">
                <label className="fl">Saat</label>
                <input className="fi" type="time" value={yeniForm.saat} onChange={e => setYeniForm({...yeniForm, saat:e.target.value})}/>
              </div>
              <div className="fg">
                <label className="fl">Süre (dk)</label>
                <input className="fi" type="number" min="15" value={yeniForm.sure} onChange={e => setYeniForm({...yeniForm, sure:e.target.value})}/>
              </div>
            </div>
            <div className="fg">
              <label className="fl">Cerrah</label>
              <input className="fi" value={yeniForm.cerrah} onChange={e => setYeniForm({...yeniForm, cerrah:e.target.value})} placeholder="Dr. ..."/>
            </div>
            <div className="mf">
              <button className="btn btn-secondary" onClick={() => setYeniModal(null)}>İptal</button>
              <button className="btn btn-primary" onClick={saveYeni}>Takvime Ekle</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .takvim-saat-cell:hover .takvim-empty-slot { opacity: 1 !important; }
        .takvim-saat-cell:hover { background: rgba(20,184,166,0.03); }
      `}</style>
    </div>
  );
}
