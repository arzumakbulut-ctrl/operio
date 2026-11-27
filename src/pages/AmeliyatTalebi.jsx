import { useState, useEffect } from 'react';
import { useDataStore, useUIStore } from '../store';
import { useNavigate, useLocation } from 'react-router-dom';
import { createSurgery } from '../services/surgeriesAdapter';

const BASE = 'http://localhost:4000/api';
const tok = () => localStorage.getItem('operio_access');

const INIT_KARTLAR = [
  { id:1, name:'Laparoskopik Kolesistektomi', branch:'Genel Cerrahi',     dur:90,  color:'#14B8A6' },
  { id:2, name:'İnguinal Herni Onarımı',     branch:'Genel Cerrahi',     dur:60,  color:'#0284C7' },
  { id:3, name:'Tiroidektomi (Total)',        branch:'Endokrin Cerrahisi', dur:110, color:'#7C3AED' },
];

function mapKart(p) {
  const extra = (() => { try { return JSON.parse(p.icerik || '{}'); } catch { return {}; } })();
  return { id: p.id, name: p.baslik, branch: extra.branch || '—', dur: extra.dur || 0, color: extra.color || '#14B8A6' };
}

const STEPS = [
  { n:1, lbl:'Hasta & Tarih' },
  { n:2, lbl:'Ameliyat Kartı' },
  { n:3, lbl:'Onay & Gönder' },
];

export default function AmeliyatTalebi() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hastalar } = useDataStore();
  const { showToast } = useUIStore();
  const [kartlar, setKartlar] = useState(INIT_KARTLAR);
  useEffect(() => {
    fetch(`${BASE}/ameliyatkart`, { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (data.length > 0) setKartlar(data.map(mapKart)); })
      .catch(() => {});
  }, []);
  const [step, setStep] = useState(1);
  const gelenHasta = location.state?.hasta;
  const [data, setData] = useState({
    kart:null,
    hasta: gelenHasta ? `${gelenHasta.ad} ${gelenHasta.soyad||''}`.trim() : '',
    tc: gelenHasta?.tc || '',
    tarih:'', saat:'08:00', salon:'', asistan:'', notlar:'',
  });

  function goNext() {
    if (step === 1) {
      if (!data.hasta.trim()) { showToast('Hasta adı zorunludur'); return; }
      if (!data.tarih)         { showToast('Tarih seçiniz'); return; }
    }
    setStep(s => s + 1);
  }

  async function gonder() {
    try {
      const hasta = hastalar.find(h => `${h.ad} ${h.soyad||''}`.trim() === data.hasta.trim()) || hastalar[0];
      if (!hasta) { showToast('Hasta bulunamadı'); return; }
      const yeni = await createSurgery({
        title: data.kart?.name || 'Ameliyat Talebi',
        patientId: hasta.id,
        scheduledStart: new Date(data.tarih + 'T' + (data.saat || '08:00')).toISOString(),
        scheduledEnd: new Date(data.tarih + 'T10:00').toISOString(),
        notes: data.notlar,
      });
      if (!yeni) throw new Error('Sunucu hatasi');
      showToast('Ameliyat talebi gonderildi');
    } catch(e) { showToast('Hata: ' + e.message); return; }
    setStep(1);
    setData({ kart:null, hasta:'', tc:'', tarih:'', saat:'08:00', salon:'', asistan:'', notlar:'' });
    navigate('/randevu-durum');
  }

  const k = data.kart;

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:18, alignItems:'start' }}>

      {/* Sol: Form */}
      <div className="panel">
        {/* Başlık */}
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:40, height:40, borderRadius:12, background:'rgba(220,38,38,0.1)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:'var(--slate)', fontFamily:"'Outfit',sans-serif" }}>Ameliyat Randevu Talebi</div>
            <div style={{ fontSize:11, color:'var(--slate-light)', marginTop:2 }}>Adım {step}/3 — {STEPS[step-1].lbl}</div>
          </div>
        </div>

        {/* Wizard Steps */}
        <div style={{ padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'center', gap:0, borderBottom:'1px solid var(--border)' }}>
          {STEPS.map((s, i) => (
            <div key={s.n} style={{ display:'flex', alignItems:'center' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{
                  width:30, height:30, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:12, fontWeight:800,
                  background: step > s.n ? '#059669' : step === s.n ? 'var(--teal)' : 'var(--surface)',
                  color: step >= s.n ? 'white' : 'var(--slate-light)',
                  border: `2px solid ${step > s.n ? '#059669' : step === s.n ? 'var(--teal)' : 'var(--border)'}`,
                }}>
                  {step > s.n ? '✓' : s.n}
                </div>
                <span style={{ fontSize:12, fontWeight:600, color: step === s.n ? 'var(--teal)' : step > s.n ? '#059669' : 'var(--slate-light)' }}>{s.lbl}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ width:40, height:2, background: step > s.n ? '#059669' : 'var(--border)', margin:'0 8px' }}/>
              )}
            </div>
          ))}
        </div>

        {/* Form içeriği */}
        <div style={{ padding:'20px' }}>

          {/* Adım 1: Hasta & Tarih */}
          {step === 1 && (
            <>
              <div className="fr" style={{ marginBottom:12 }}>
                <div className="fg">
                  <label className="fl">Hasta Adı Soyadı *</label>
                  <input className="fi" list="hasta-list" value={data.hasta}
                    onChange={e => setData({...data, hasta:e.target.value})}
                    placeholder="Ad Soyad veya listeden seçin"/>
                  <datalist id="hasta-list">
                    {hastalar.map(h => <option key={h.id} value={h.ad}/>)}
                  </datalist>
                </div>
                <div className="fg">
                  <label className="fl">TC Kimlik No</label>
                  <input className="fi" maxLength={11} placeholder="12345678901" value={data.tc}
                    onChange={e => setData({...data, tc:e.target.value})}/>
                </div>
              </div>
              <div className="fr" style={{ marginBottom:12 }}>
                <div className="fg">
                  <label className="fl">Talep Edilen Tarih *</label>
                  <input className="fi" type="date" value={data.tarih} onChange={e => setData({...data, tarih:e.target.value})}/>
                </div>
                <div className="fg">
                  <label className="fl">Tercih Edilen Saat</label>
                  <input className="fi" type="time" value={data.saat} onChange={e => setData({...data, saat:e.target.value})}/>
                </div>
              </div>
              <div className="fr" style={{ marginBottom:12 }}>
                <div className="fg">
                  <label className="fl">Tercih Edilen Salon</label>
                  <select className="fi" value={data.salon} onChange={e => setData({...data, salon:e.target.value})}>
                    <option value="">Fark etmez</option>
                    {[1,2,3,4,5,6].map(n => <option key={n} value={`Salon ${n}`}>Salon {n}</option>)}
                  </select>
                </div>
                <div className="fg">
                  <label className="fl">Asistan Doktor (opsiyonel)</label>
                  <input className="fi" placeholder="Dr. ..." value={data.asistan} onChange={e => setData({...data, asistan:e.target.value})}/>
                </div>
              </div>
              <div className="fg" style={{ marginBottom:0 }}>
                <label className="fl">Notlar & Özel İstekler</label>
                <textarea className="fi" rows={2} placeholder="Özel notlar, dikkat edilmesi gerekenler…" value={data.notlar} onChange={e => setData({...data, notlar:e.target.value})} style={{ resize:'none' }}/>
              </div>
              <div style={{ display:'flex', justifyContent:'flex-end', marginTop:16 }}>
                <button className="btn btn-primary" onClick={goNext}>İleri →</button>
              </div>
            </>
          )}

          {/* Adım 2: Ameliyat Kartı */}
          {step === 2 && (
            <>
              <div style={{ marginBottom:14 }}>
                <label className="fl" style={{ marginBottom:10, display:'block' }}>Ameliyat Kartı Seçin</label>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {kartlar.map(kart => (
                    <div key={kart.id} onClick={() => setData({...data, kart})}
                      style={{
                        display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
                        border:`1.5px solid ${data.kart?.id===kart.id?'var(--teal)':'var(--border)'}`,
                        borderRadius:10, cursor:'pointer',
                        background: data.kart?.id===kart.id ? 'rgba(20,184,166,0.05)' : 'var(--surface)',
                        transition:'all 0.15s',
                      }}>
                      <div style={{ width:36, height:36, borderRadius:9, background:`${kart.color}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={kart.color} strokeWidth="2">
                          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
                          <rect x="9" y="3" width="6" height="4" rx="1"/>
                        </svg>
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:'var(--slate)' }}>{kart.name}</div>
                        <div style={{ fontSize:10, color:'var(--slate-light)', marginTop:1 }}>{kart.branch} · {kart.dur} dk</div>
                      </div>
                      {data.kart?.id === kart.id && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      )}
                    </div>
                  ))}
                  <div onClick={() => navigate('/ameliyat-kartlari')}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 14px', border:'1.5px dashed var(--border)', borderRadius:10, cursor:'pointer', color:'var(--slate-light)', fontSize:12, fontWeight:500, transition:'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor='var(--teal)'; e.currentTarget.style.color='var(--teal)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--slate-light)'; }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Yeni Ameliyat Kartı Oluştur
                  </div>
                </div>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:8 }}>
                <button className="btn btn-secondary" onClick={() => setStep(1)}>← Geri</button>
                <button className="btn btn-primary" onClick={() => setStep(3)}>İleri →</button>
              </div>
            </>
          )}

          {/* Adım 3: Onay */}
          {step === 3 && (
            <>
              <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 18px', marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--slate-light)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:12 }}>Talep Özeti</div>
                {[
                  ['Hasta',    data.hasta||'—'],
                  ['TC No',    data.tc||'—'],
                  ['Tarih',    data.tarih?new Date(data.tarih).toLocaleDateString('tr-TR'):'—'],
                  ['Saat',     data.saat||'—'],
                  ['Salon',    data.salon||'Fark etmez'],
                  ['Asistan',  data.asistan||'—'],
                  ['Ameliyat', k?.name||'—'],
                  ['Branş',    k?.branch||'—'],
                  ['Süre',     k?k.dur+' dakika':'—'],
                ].map(([l, v]) => (
                  <div key={l} style={{ display:'flex', padding:'7px 0', borderBottom:'1px solid var(--border)' }}>
                    <span style={{ fontSize:11, color:'var(--slate-light)', width:80, flexShrink:0 }}>{l}</span>
                    <span style={{ fontSize:12.5, fontWeight:600, color:'var(--slate)' }}>{v}</span>
                  </div>
                ))}
              </div>

              {k && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:16 }}>
                  {k.setler.map((s,i) => <span key={i} style={{ padding:'3px 9px', borderRadius:20, fontSize:10.5, fontWeight:600, background:'rgba(20,184,166,0.12)', color:'#0f766e' }}>{s}</span>)}
                  {k.malzeme.slice(0,3).map((m,i) => <span key={i} style={{ padding:'3px 9px', borderRadius:20, fontSize:10.5, fontWeight:600, background:'rgba(2,132,199,0.12)', color:'#0369a1' }}>{m}</span>)}
                </div>
              )}

              <div style={{ background:'rgba(20,184,166,0.06)', border:'1px solid rgba(20,184,166,0.2)', borderRadius:9, padding:'11px 14px', marginBottom:16, fontSize:11.5, color:'var(--slate-mid)', lineHeight:1.6 }}>
                ℹ Talebiniz Ameliyathane Sorumlu Hemşiresine iletilecek ve onay sonrası takvime eklenecektir.
              </div>

              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <button className="btn btn-secondary" onClick={() => setStep(2)}>← Geri</button>
                <button className="btn btn-primary" onClick={gonder}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight:6 }}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  Talebi Gönder
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sağ: Özet sidebar */}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {/* Hasta bilgileri */}
        <div className="panel">
          <div className="panel-hd"><div className="panel-title">Hasta Bilgileri</div></div>
          <div style={{ padding:'14px 16px' }}>
            {data.hasta ? (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                  <div style={{ width:34, height:34, borderRadius:'50%', background:'var(--teal)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:'white', flexShrink:0 }}>
                    {data.hasta.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--slate)' }}>{data.hasta}</div>
                    {data.tc && <div style={{ fontSize:10, color:'var(--slate-light)' }}>TC: {data.tc}</div>}
                  </div>
                </div>
                {data.tarih && <div style={{ display:'flex', fontSize:11.5, padding:'5px 0', borderBottom:'1px solid var(--border)' }}>
                  <span style={{ color:'var(--slate-light)', width:60 }}>Tarih</span>
                  <span style={{ fontWeight:600, color:'var(--slate)' }}>{new Date(data.tarih).toLocaleDateString('tr-TR')} {data.saat}</span>
                </div>}
                {data.salon && <div style={{ display:'flex', fontSize:11.5, padding:'5px 0' }}>
                  <span style={{ color:'var(--slate-light)', width:60 }}>Salon</span>
                  <span style={{ fontWeight:600, color:'var(--slate)' }}>{data.salon}</span>
                </div>}
              </>
            ) : (
              <div style={{ textAlign:'center', padding:'12px 0', fontSize:12, color:'var(--slate-light)' }}>Hasta bilgisi girin</div>
            )}
          </div>
        </div>

        {/* Seçili kart */}
        <div className="panel">
          <div className="panel-hd"><div className="panel-title">Seçili Ameliyat Kartı</div></div>
          <div style={{ padding:'14px 16px' }}>
            {k ? (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                  <div style={{ width:34, height:34, borderRadius:9, background:`${k.color}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={k.color} strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
                  </div>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:'var(--slate)' }}>{k.name}</div>
                    <div style={{ fontSize:10, color:'var(--slate-light)' }}>{k.branch} · {k.dur} dk</div>
                  </div>
                </div>
                {[['Setler',k.setler],['Malzeme',k.malzeme],['Cihaz',k.cihaz],['İlaçlar',k.ilac]].map(([lbl,arr]) => arr.length > 0 && (
                  <div key={lbl} style={{ marginBottom:7 }}>
                    <div style={{ fontSize:9, color:'var(--slate-light)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:4 }}>{lbl}</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                      {arr.map((x,i) => <span key={i} style={{ padding:'2px 8px', borderRadius:20, fontSize:9.5, fontWeight:600, background:'var(--surface)', border:'1px solid var(--border)', color:'var(--slate-mid)' }}>{x}</span>)}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ textAlign:'center', padding:'12px 0', fontSize:12, color:'var(--slate-light)' }}>Henüz kart seçilmedi</div>
            )}
          </div>
        </div>

        {/* Müsait salonlar */}
        <div className="panel">
          <div className="panel-hd"><div className="panel-title">Müsait Salonlar</div></div>
          <div style={{ padding:'8px 16px' }}>
            {[2,4,5,6].map(n => (
              <div key={n} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:n<6?'1px solid var(--border)':'none' }}>
                <span style={{ fontSize:12, color:'var(--slate)' }}>Salon {n}</span>
                <span style={{ fontSize:11, color:'#059669', fontWeight:600 }}>Müsait</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
