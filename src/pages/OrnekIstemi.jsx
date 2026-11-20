import { useState, useEffect } from 'react';
import { useDataStore, useUIStore, useAuthStore } from '../store';
import { ROLES } from '../data/roles';
import Modal from '../components/ui/Modal';

const BASE = 'http://localhost:4000/api';
function tok() { return localStorage.getItem('operio_access'); }

// ── Sabit veriler ─────────────────────────────────────────────
const PATOLOJI_TIPLER = ['Rutin Histopatoloji','İntraoperatif Frozen','Sitoloji','İmmünohistokimya','Moleküler Patoloji','Kemik İliği Biyopsisi'];
const FROZEN_DOKULARI = ['Tümör Dokusu','Lenf Nodu','Cerrahi Sınır','Endometrium','Tiroid Nodu','Beyin Tümörü','Böbrek Kitlesi'];
const KAN_TESTLERI = {
  'Hematoloji':    ['Tam Kan Sayımı (CBC)','Periferik Yayma','Retikülosit Sayımı','PT/INR','aPTT','Fibrinojen'],
  'Biyokimya':     ['Glukoz','Üre','Kreatinin','ALT/AST','Albümin','CRP','Sedimantasyon','LDH','Amilaz','Lipaz'],
  'Kan Grubu':     ['ABO/Rh Grubu','Cross-Match','Coombs Testi','İrregüler Antikor Tarama'],
  'Koagülasyon':   ['D-Dimer','Anti-Xa','Trombin Zamanı','Faktör Düzeyleri'],
  'Enfeksiyon':    ['Prokalsitonin','IL-6','Kan Kültürü','HBsAg','Anti-HCV','HIV Ag/Ab'],
  'Hormonal':      ['TSH/sT4','Kortizol','İnsulin','CA-125','PSA','CEA','AFP'],
};
const ORNEKLER = ['Kan (EDTA)','Kan (Serum)','Kan (Sitrat)','Biyopsi','Frozen Doku','BOS','İdrar','BAL','Sürüntü','Dışkı'];
const ONCELIK = [
  { k:'rutin',  lbl:'Rutin',  renk:'#059669', bg:'rgba(5,150,105,0.1)',  desc:'48-72 saat' },
  { k:'acil',   lbl:'Acil',   renk:'#D97706', bg:'rgba(217,119,6,0.1)', desc:'2-4 saat'   },
  { k:'stat',   lbl:'STAT',   renk:'#DC2626', bg:'rgba(220,38,38,0.1)', desc:'<1 saat'    },
];

const DURUM_CFG = {
  bekliyor:   { lbl:'Bekliyor',   tag:'t-orange', dot:'#D97706' },
  islemde:    { lbl:'İşlemde',    tag:'t-blue',   dot:'#0284C7' },
  tamamlandi: { lbl:'Tamamlandı', tag:'t-green',  dot:'#059669' },
  iptal:      { lbl:'İptal',      tag:'t-gray',   dot:'#94A3B8' },
};

function now() { return new Date().toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }); }

// ── İstem Kartı ───────────────────────────────────────────────
function IstemKart({ istem, onIptal }) {
  const dcfg = DURUM_CFG[istem.durum] || DURUM_CFG.bekliyor;
  const oncelik = ONCELIK.find(o => o.k === istem.oncelik) || ONCELIK[0];
  return (
    <div style={{ background:'var(--card-bg)', border:`1.5px solid ${oncelik.renk}33`, borderLeft:`3px solid ${oncelik.renk}`, borderRadius:11, padding:'13px 16px', marginBottom:10 }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
        <div style={{ width:36, height:36, borderRadius:9, background:oncelik.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
          {istem.tip==='patoloji'?'🔬':istem.tip==='frozen'?'🧊':'🩸'}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:3, flexWrap:'wrap' }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--slate)' }}>{istem.baslik}</div>
            <span className={`tag ${dcfg.tag}`} style={{ fontSize:'8.5px' }}>{dcfg.lbl}</span>
            <span style={{ fontSize:'9px', padding:'2px 8px', borderRadius:20, background:oncelik.bg, color:oncelik.renk, fontWeight:700, border:`1px solid ${oncelik.renk}33` }}>{oncelik.lbl} · {oncelik.desc}</span>
          </div>
          <div style={{ fontSize:11, color:'var(--slate-light)', marginBottom:4 }}>{istem.ameliyat} · {istem.tarih}</div>
          {istem.ornekler?.length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:4 }}>
              {istem.ornekler.map((o,i) => (
                <span key={i} style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:'var(--surface)', border:'1px solid var(--border)', color:'var(--slate-mid)' }}>{o}</span>
              ))}
            </div>
          )}
          {istem.klinikBilgi && <div style={{ fontSize:11, color:'var(--slate-mid)', fontStyle:'italic' }}>"{istem.klinikBilgi}"</div>}
        </div>
        {istem.durum === 'bekliyor' && (
          <button onClick={() => onIptal(istem.id)} style={{ fontSize:10, padding:'3px 9px', borderRadius:6, border:'1px solid #FECACA', background:'#FEF2F2', color:'#DC2626', cursor:'pointer', fontFamily:'var(--font)', fontWeight:600, flexShrink:0 }}>İptal</button>
        )}
      </div>
    </div>
  );
}

// ── Ana Sayfa ─────────────────────────────────────────────────
export default function OrnekIstemi() {
  const { surgeries } = useDataStore();
  const { showToast } = useUIStore();
  const { curRole }   = useAuthStore();

  const myFullName = ROLES[curRole]?.full || '';
  const benimAmeliyatlar = surgeries.filter(s => s.dr === myFullName || s.ekip?.cerrah === myFullName);

  const [aktifTab, setAktifTab]     = useState('patoloji');
  const [istemler, setIstemler]     = useState([]);
  const [modal, setModal]           = useState(null); // 'patoloji' | 'frozen' | 'kan'

  useEffect(() => {
    fetch(`${BASE}/ornek`, { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const DM = { 'Bekliyor':'bekliyor','İşlemde':'islemde','Tamamlandı':'tamamlandi','İptal':'iptal' };
        setIstemler(data.map(x => ({
          id: x.id,
          tip: x.ornekTuru || 'patoloji',
          baslik: x.patolojiTur || x.ornekTuru || '—',
          ameliyat: '—',
          tarih: x.createdAt ? new Date(x.createdAt).toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '',
          durum: DM[x.durum] || 'bekliyor',
          ornekler: [],
          klinikBilgi: x.notlar || '',
          oncelik: x.oncelik || 'rutin',
        })));
      })
      .catch(() => {});
  }, []);
  const [secAmeliyet, setSecAmeliyat] = useState(benimAmeliyatlar[0]?.id || '');
  const [oncelik, setOncelik]       = useState('rutin');
  const [klinik, setKlinik]         = useState('');
  const [not, setNot]               = useState('');

  // Patoloji form
  const [patTip, setPatTip]         = useState(PATOLOJI_TIPLER[0]);
  const [patOrnek, setPatOrnek]     = useState('');
  const [patKlinik, setPatKlinik]   = useState('');

  // Frozen form
  const [frDoku, setFrDoku]         = useState(FROZEN_DOKULARI[0]);
  const [frKlinik, setFrKlinik]     = useState('');
  const [frAdet, setFrAdet]         = useState(1);

  // Kan testleri form
  const [kanSecili, setKanSecili]   = useState([]);

  function secAmeliyatObj() { return benimAmeliyatlar.find(s => String(s.id) === String(secAmeliyet)); }

  async function addIstem(istem) {
    const newItem = { ...istem, id: String(Date.now()), tarih: now(), durum:'bekliyor' };
    setIstemler(p => [newItem, ...p]);
    setModal(null);
    showToast(`${istem.baslik} istemi oluşturuldu ✓`);
    try {
      const res = await fetch(`${BASE}/ornek`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${tok()}` },
        body: JSON.stringify({ ornekTuru: istem.tip, patolojiTur: istem.baslik, oncelik: istem.oncelik, notlar: istem.klinikBilgi, durum:'Bekliyor' }),
      });
      const data = await res.json();
      if (data.id) setIstemler(p => p.map(x => x.id === newItem.id ? { ...x, id: data.id } : x));
    } catch(e) { /* optimistic */ }
  }

  async function iptalEt(id) {
    setIstemler(p => p.map(x => x.id === id ? {...x, durum:'iptal'} : x));
    showToast('İstem iptal edildi');
    try {
      await fetch(`${BASE}/ornek/${id}`, { method:'PUT', headers:{'Content-Type':'application/json',Authorization:`Bearer ${tok()}`}, body: JSON.stringify({ durum:'İptal' }) });
    } catch(e) { /* optimistic */ }
  }

  function toggleKan(test) {
    setKanSecili(p => p.includes(test) ? p.filter(x=>x!==test) : [...p, test]);
  }

  const patolojiIstemler = istemler.filter(x => x.tip==='patoloji');
  const frozenIstemler   = istemler.filter(x => x.tip==='frozen');
  const kanIstemler      = istemler.filter(x => x.tip==='kan');

  const TABS = [
    { k:'patoloji', lbl:'🔬 Patoloji',    count: patolojiIstemler.length },
    { k:'frozen',   lbl:'🧊 Frozen',      count: frozenIstemler.length   },
    { k:'kan',      lbl:'🩸 Kan Testleri',count: kanIstemler.length      },
    { k:'tumü',     lbl:'📋 Tümü',        count: istemler.length         },
  ];

  const goster = aktifTab === 'tumü' ? istemler
    : aktifTab === 'patoloji' ? patolojiIstemler
    : aktifTab === 'frozen'   ? frozenIstemler
    : kanIstemler;

  // Ortak ameliyat seçici
  function AmeliyatSec({ val, onChange }) {
    return (
      <div className="fg">
        <label className="fl">Ameliyat *</label>
        <select className="fi" value={val} onChange={e=>onChange(e.target.value)}>
          {benimAmeliyatlar.map(s => (
            <option key={s.id} value={s.id}>{s.saat} — {s.op} ({s.hasta})</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div>
      <div className="page-hd" style={{ marginBottom:16 }}>
        <div>
          <div className="page-hd-title">Örnek İstemleri</div>
          <div className="page-hd-sub">Patoloji, frozen ve kan testleri isteme formu</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-secondary" onClick={() => { setModal('patoloji'); setPatTip(PATOLOJI_TIPLER[0]); setPatOrnek(''); setPatKlinik(''); setOncelik('rutin'); setSecAmeliyat(benimAmeliyatlar[0]?.id||''); }}>🔬 Patoloji İste</button>
          <button className="btn btn-secondary" onClick={() => { setModal('frozen'); setFrDoku(FROZEN_DOKULARI[0]); setFrKlinik(''); setFrAdet(1); setOncelik('stat'); setSecAmeliyat(benimAmeliyatlar[0]?.id||''); }}>🧊 Frozen İste</button>
          <button className="btn btn-primary"   onClick={() => { setModal('kan'); setKanSecili([]); setOncelik('rutin'); setSecAmeliyat(benimAmeliyatlar[0]?.id||''); setNot(''); }}>🩸 Kan Testi İste</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="dash-tabs" style={{ marginBottom:14 }}>
        {TABS.map(t => (
          <div key={t.k} className={`dash-tab${aktifTab===t.k?' active':''}`} onClick={() => setAktifTab(t.k)}>
            {t.lbl}
            {t.count > 0 && <span className="dash-tab-badge">{t.count}</span>}
          </div>
        ))}
      </div>

      {/* Liste */}
      {goster.length === 0 ? (
        <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:14, padding:48, textAlign:'center' }}>
          <div style={{ fontSize:36, marginBottom:10 }}>
            {aktifTab==='patoloji'?'🔬':aktifTab==='frozen'?'🧊':aktifTab==='kan'?'🩸':'📋'}
          </div>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--slate)', marginBottom:6 }}>Henüz istem yok</div>
          <div style={{ fontSize:12, color:'var(--slate-light)' }}>Yukarıdaki butonları kullanarak yeni istem oluşturun</div>
        </div>
      ) : (
        <div>
          {goster.map(istem => <IstemKart key={istem.id} istem={istem} onIptal={iptalEt}/>)}
        </div>
      )}

      {/* ── PATOLOJİ MODAL ── */}
      {modal === 'patoloji' && (
        <Modal title="🔬 Patoloji İstemi" onClose={() => setModal(null)} width={520}>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <AmeliyatSec val={secAmeliyet} onChange={setSecAmeliyat}/>
            <div className="fr">
              <div className="fg">
                <label className="fl">Patoloji Tipi *</label>
                <select className="fi" value={patTip} onChange={e=>setPatTip(e.target.value)}>
                  {PATOLOJI_TIPLER.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="fg">
                <label className="fl">Örnek Tipi</label>
                <select className="fi" value={patOrnek} onChange={e=>setPatOrnek(e.target.value)}>
                  <option value="">Seçin</option>
                  {ORNEKLER.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="fl">Öncelik</label>
              <div style={{ display:'flex', gap:8, marginTop:6 }}>
                {ONCELIK.map(o => (
                  <div key={o.k} onClick={() => setOncelik(o.k)}
                    style={{ flex:1, padding:'8px 10px', borderRadius:9, cursor:'pointer', textAlign:'center', border:`1.5px solid ${oncelik===o.k?o.renk:'var(--border)'}`, background:oncelik===o.k?o.bg:'var(--surface)', transition:'all 0.15s' }}>
                    <div style={{ fontSize:12, fontWeight:700, color:oncelik===o.k?o.renk:'var(--slate-mid)' }}>{o.lbl}</div>
                    <div style={{ fontSize:9.5, color:'var(--slate-light)', marginTop:2 }}>{o.desc}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="fg">
              <label className="fl">Klinik Bilgi / Ön Tanı</label>
              <textarea className="fi" rows={3} value={patKlinik} onChange={e=>setPatKlinik(e.target.value)} placeholder="Klinik bilgi, ön tanı, histopatoloji beklentisi…" style={{ resize:'none' }}/>
            </div>
          </div>
          <div className="mf">
            <button className="btn btn-secondary" onClick={() => setModal(null)}>İptal</button>
            <button className="btn btn-primary" onClick={() => {
              if (!secAmeliyet) { showToast('Ameliyat seçin'); return; }
              const s = secAmeliyatObj();
              addIstem({ tip:'patoloji', baslik:patTip, ameliyat:`${s?.op||'—'} (${s?.hasta||''})`, oncelik, ornekler:patOrnek?[patOrnek]:[], klinikBilgi:patKlinik });
            }}>İstem Gönder</button>
          </div>
        </Modal>
      )}

      {/* ── FROZEN MODAL ── */}
      {modal === 'frozen' && (
        <Modal title="🧊 Frozen İstemi" icon="🧊" onClose={() => setModal(null)} width={500}>
          <div style={{ background:'rgba(2,132,199,0.06)', border:'1px solid rgba(2,132,199,0.2)', borderRadius:9, padding:'10px 14px', marginBottom:14, fontSize:12, color:'#0284C7', fontWeight:600 }}>
            ⚡ Frozen intraoperatif yapılır — sonuç ameliyat sırasında bildirilir
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <AmeliyatSec val={secAmeliyet} onChange={setSecAmeliyat}/>
            <div className="fr">
              <div className="fg">
                <label className="fl">Doku Tipi *</label>
                <select className="fi" value={frDoku} onChange={e=>setFrDoku(e.target.value)}>
                  {FROZEN_DOKULARI.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div className="fg" style={{ maxWidth:100 }}>
                <label className="fl">Parça Sayısı</label>
                <input className="fi" type="number" min={1} max={10} value={frAdet} onChange={e=>setFrAdet(e.target.value)}/>
              </div>
            </div>
            <div>
              <label className="fl">Öncelik</label>
              <div style={{ display:'flex', gap:8, marginTop:6 }}>
                {ONCELIK.map(o => (
                  <div key={o.k} onClick={() => setOncelik(o.k)}
                    style={{ flex:1, padding:'8px 10px', borderRadius:9, cursor:'pointer', textAlign:'center', border:`1.5px solid ${oncelik===o.k?o.renk:'var(--border)'}`, background:oncelik===o.k?o.bg:'var(--surface)', transition:'all 0.15s' }}>
                    <div style={{ fontSize:12, fontWeight:700, color:oncelik===o.k?o.renk:'var(--slate-mid)' }}>{o.lbl}</div>
                    <div style={{ fontSize:9.5, color:'var(--slate-light)', marginTop:2 }}>{o.desc}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="fg">
              <label className="fl">Klinik Soru</label>
              <textarea className="fi" rows={2} value={frKlinik} onChange={e=>setFrKlinik(e.target.value)} placeholder="Patoloji uzmanına iletilecek klinik soru…" style={{ resize:'none' }}/>
            </div>
          </div>
          <div className="mf">
            <button className="btn btn-secondary" onClick={() => setModal(null)}>İptal</button>
            <button className="btn btn-primary" style={{ background:'#0284C7', borderColor:'#0284C7' }} onClick={() => {
              if (!secAmeliyet) { showToast('Ameliyat seçin'); return; }
              const s = secAmeliyatObj();
              addIstem({ tip:'frozen', baslik:`Frozen: ${frDoku} (${frAdet} parça)`, ameliyat:`${s?.op||'—'} (${s?.hasta||''})`, oncelik, ornekler:[frDoku], klinikBilgi:frKlinik });
            }}>Frozen İste</button>
          </div>
        </Modal>
      )}

      {/* ── KAN TESTLERİ MODAL ── */}
      {modal === 'kan' && (
        <Modal title="🩸 Kan Testi İstemi" onClose={() => setModal(null)} width={580}>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <AmeliyatSec val={secAmeliyet} onChange={setSecAmeliyat}/>
            <div>
              <label className="fl">Öncelik</label>
              <div style={{ display:'flex', gap:8, marginTop:6 }}>
                {ONCELIK.map(o => (
                  <div key={o.k} onClick={() => setOncelik(o.k)}
                    style={{ flex:1, padding:'8px 10px', borderRadius:9, cursor:'pointer', textAlign:'center', border:`1.5px solid ${oncelik===o.k?o.renk:'var(--border)'}`, background:oncelik===o.k?o.bg:'var(--surface)', transition:'all 0.15s' }}>
                    <div style={{ fontSize:12, fontWeight:700, color:oncelik===o.k?o.renk:'var(--slate-mid)' }}>{o.lbl}</div>
                    <div style={{ fontSize:9.5, color:'var(--slate-light)', marginTop:2 }}>{o.desc}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="fl" style={{ display:'block', marginBottom:8 }}>
                Testler * <span style={{ color:'var(--teal)', fontWeight:700 }}>({kanSecili.length} seçili)</span>
              </label>
              <div style={{ maxHeight:280, overflowY:'auto', display:'flex', flexDirection:'column', gap:10 }}>
                {Object.entries(KAN_TESTLERI).map(([grup, testler]) => (
                  <div key={grup}>
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--slate-light)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>{grup}</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {testler.map(t => {
                        const sec = kanSecili.includes(t);
                        return (
                          <div key={t} onClick={() => toggleKan(t)}
                            style={{ padding:'5px 12px', borderRadius:20, cursor:'pointer', fontSize:11, fontWeight:600, transition:'all 0.12s',
                              border: `1.5px solid ${sec?'var(--teal)':'var(--border)'}`,
                              background: sec?'rgba(20,184,166,0.1)':'var(--surface)',
                              color: sec?'var(--teal)':'var(--slate-mid)' }}>
                            {sec && '✓ '}{t}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="fg">
              <label className="fl">Ek Not</label>
              <input className="fi" value={not} onChange={e=>setNot(e.target.value)} placeholder="Özel talimat, örnek alma zamanı vb."/>
            </div>
          </div>
          <div className="mf">
            <button className="btn btn-secondary" onClick={() => setModal(null)}>İptal</button>
            <button className="btn btn-primary" style={{ background:'#DC2626', borderColor:'#DC2626' }} onClick={() => {
              if (!secAmeliyet) { showToast('Ameliyat seçin'); return; }
              if (!kanSecili.length) { showToast('En az bir test seçin'); return; }
              const s = secAmeliyatObj();
              addIstem({ tip:'kan', baslik:`Kan Testleri (${kanSecili.length} test)`, ameliyat:`${s?.op||'—'} (${s?.hasta||''})`, oncelik, ornekler:kanSecili, klinikBilgi:not });
            }}>İstem Gönder</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
