import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore, useDataStore } from '../store';
import Modal from '../components/ui/Modal';

const DURUM_CFG = { Aktif:{tag:'t-green',c:'#059669'}, Arızalı:{tag:'t-red',c:'#DC2626'}, Bakımda:{tag:'t-orange',c:'#D97706'}, Pasif:{tag:'t-gray',c:'#94A3B8'} };
const ONCELIK_CFG = { Yüksek:{tag:'t-red'}, Orta:{tag:'t-orange'}, Düşük:{tag:'t-blue'} };

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / 86400000);
}

export default function Biyomedikal() {
  const { cihazlar: CIHAZLAR, bakimPlanlari: BAKIM_PLANLARI, arizalar: ARIZA_BILDIRIMLERI } = useDataStore();
  const navigate = useNavigate();
  const { showToast } = useUIStore();
  const [tab, setTab] = useState('ozet');
  const [ariza] = useState(ARIZA_BILDIRIMLERI);
  const bakim = BAKIM_PLANLARI;
  const cihazlar = CIHAZLAR;
  const [detayModal, setDetayModal] = useState(null);
  const [yeniArizaModal, setYeniArizaModal] = useState(false);
  const [arizaForm, setArizaForm] = useState({ cihaz:'', aciklama:'', oncelik:'Orta' });

  const aktif   = cihazlar.filter(c => c.durum === 'Aktif').length;
  const arizali = cihazlar.filter(c => c.durum === 'Arızalı').length;
  const bakimda = cihazlar.filter(c => c.durum === 'Bakımda').length;
  const yaklaşanBakim = cihazlar.filter(c => { const d = daysUntil(c.sonucBakim); return d !== null && d <= 30 && d > 0; }).length;

  function arizaKaydet() {
    if (!arizaForm.cihaz || !arizaForm.aciklama) { showToast('Cihaz ve açıklama zorunlu'); return; }
    showToast('Arıza bildirimi oluşturuldu ✓ — Arıza Bildirimleri sayfasından takip edebilirsiniz');
    setYeniArizaModal(false);
    setArizaForm({ cihaz:'', aciklama:'', oncelik:'Orta' });
    navigate('/ariza-bildirimleri');
  }

  const TABS = [
    { key:'ozet',      lbl:'Kontrol Paneli' },
    { key:'cihazlar',  lbl:'Cihaz Listesi'  },
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>

      {/* Başlık */}
      <div className="page-hd" style={{ marginBottom:14, flexShrink:0 }}>
        <div>
          <div className="page-hd-title">Biyomedikal Kontrol Paneli</div>
          <div className="page-hd-sub">Tıbbi cihaz yönetimi ve bakım takibi</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-secondary" onClick={() => setYeniArizaModal(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:13,height:13}}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg>
            Arıza Bildir
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/envanter')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:13,height:13}}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H8a2 2 0 00-2 2v2h12V5a2 2 0 00-2-2z"/></svg>
            Cihaz Envanteri
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="dash-tabs" style={{ marginBottom:14, flexShrink:0 }}>
        {TABS.map(t => (
          <div key={t.key} className={`dash-tab${tab===t.key?' active':''}`} onClick={() => setTab(t.key)}>{t.lbl}</div>
        ))}
      </div>

      {/* İçerik */}
      <div style={{ flex:1, overflowY:'auto' }}>

        {/* ── ÖZET ── */}
        {tab === 'ozet' && (
          <div>
            {/* KPI */}
            <div className="stat-row" style={{ marginBottom:14 }}>
              {[
                { val:cihazlar.length, lbl:'Toplam Cihaz',     trend:'Kayıtlı',                  cls:'stat-card-1', si:'si-teal',   icon:<svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H8a2 2 0 00-2 2v2h12V5a2 2 0 00-2-2z"/></svg> },
                { val:aktif,           lbl:'Aktif Cihaz',       trend:'✓ Çalışıyor',               cls:'stat-card-2', si:'si-blue',   icon:<svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg> },
                { val:arizali+bakimda, lbl:'Bakım / Arızalı',  trend:`${arizali} arızalı · ${bakimda} bakımda`, cls:'stat-card-4', si:'si-orange', icon:<svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg> },
                { val:yaklaşanBakim,   lbl:'Yaklaşan Bakım',   trend:'≤30 gün içinde',             cls:'stat-card-3', si:'si-purple', icon:<svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg> },
              ].map((item,i) => (
                <div key={i} className={`stat-card ${item.cls}`}>
                  <div className="stat-card-glow"/><div className="stat-card-glow2"/>
                  <div className={`stat-icon ${item.si}`}>{item.icon}</div>
                  <div className="stat-val">{item.val}</div>
                  <div className="stat-lbl">{item.lbl}</div>
                  <div className="stat-trend">{item.trend}</div>
                </div>
              ))}
            </div>

            <div className="cg">
              {/* Arızalı Cihazlar */}
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div className="panel">
                  <div className="panel-hd">
                    <span className="panel-title">🔴 Aktif Arıza Bildirimleri</span>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate('/ariza-bildirimleri')}>Tümü →</button>
                  </div>
                  {ariza.filter(a => a.durum !== 'Kapatıldı').map(a => (
                    <div key={a.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 18px', borderBottom:'1px solid var(--border)' }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0, background:a.oncelik==='Yüksek'?'#DC2626':'#D97706' }}/>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:'var(--slate)' }}>{a.cihaz}</div>
                        <div style={{ fontSize:11, color:'var(--slate-light)', marginTop:1 }}>{a.aciklama}</div>
                        <div style={{ fontSize:10, color:'var(--slate-light)', marginTop:1 }}>{a.bildiren} · {a.tarih}</div>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                        <span className={`tag ${ONCELIK_CFG[a.oncelik]?.tag||'t-gray'}`} style={{fontSize:9}}>{a.oncelik}</span>
                        <span className="tag t-orange" style={{fontSize:9}}>{a.durum}</span>
                      </div>
                    </div>
                  ))}
                  {ariza.filter(a => a.durum !== 'Kapatıldı').length === 0 && (
                    <div style={{ padding:28, textAlign:'center', fontSize:13, color:'var(--slate-light)' }}>
                      <div style={{fontSize:28,marginBottom:8}}>✅</div>Açık arıza yok
                    </div>
                  )}
                </div>

                {/* Yaklaşan Bakımlar */}
                <div className="panel">
                  <div className="panel-hd">
                    <span className="panel-title">📅 Yaklaşan Bakımlar</span>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate('/bakim-plan')}>Tümü →</button>
                  </div>
                  {bakim.filter(b => b.durum !== 'Tamamlandı').map(b => (
                    <div key={b.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 18px', borderBottom:'1px solid var(--border)' }}>
                      <div style={{ width:40, height:40, borderRadius:10, background:'rgba(20,184,166,0.1)', border:'1px solid rgba(20,184,166,0.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:16 }}>🔧</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:'var(--slate)' }}>{b.cihaz}</div>
                        <div style={{ fontSize:11, color:'var(--slate-light)', marginTop:1 }}>{b.tip} · {b.sure} · {b.teknisyen}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:12, fontWeight:700, color:'var(--teal)' }}>{b.tarih}</div>
                        <span className={`tag ${b.durum==='Devam Ediyor'?'t-blue':b.durum==='Bekliyor'?'t-orange':'t-teal'}`} style={{fontSize:9,marginTop:4,display:'block'}}>{b.durum}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cihaz durumu özet */}
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div className="panel">
                  <div className="panel-hd"><span className="panel-title">📊 Cihaz Durum Özeti</span></div>
                  <div style={{ padding:'14px 18px' }}>
                    {Object.entries({ 'Aktif':aktif, 'Bakımda':bakimda, 'Arızalı':arizali }).map(([lbl,val]) => {
                      const renk = lbl==='Aktif'?'#059669':lbl==='Bakımda'?'#D97706':'#DC2626';
                      const pct = Math.round(val/cihazlar.length*100);
                      return (
                        <div key={lbl} style={{ marginBottom:14 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <div style={{ width:10, height:10, borderRadius:'50%', background:renk }}/>
                              <span style={{ fontSize:12.5, fontWeight:600, color:'var(--slate)' }}>{lbl}</span>
                            </div>
                            <span style={{ fontSize:12, color:'var(--slate-mid)', fontWeight:700 }}>{val} cihaz ({pct}%)</span>
                          </div>
                          <div style={{ height:6, background:'var(--border)', borderRadius:4, overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${pct}%`, background:renk, borderRadius:4, transition:'width 0.4s' }}/>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="panel">
                  <div className="panel-hd"><span className="panel-title">🔗 Hızlı İşlemler</span></div>
                  <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:8 }}>
                    {[
                      { lbl:'Bakım Planı',           icon:'📅', action:()=>navigate('/bakim-plan') },
                      { lbl:'Kalibrasyon Kayıtları', icon:'📐', action:()=>navigate('/kalibrasyon') },
                      { lbl:'Arıza Raporu Oluştur',  icon:'📋', action:()=>setYeniArizaModal(true) },
                      { lbl:'Cihaz Envanteri',       icon:'📦', action:()=>navigate('/envanter') },
                    ].map(item => (
                      <button key={item.lbl} className="btn btn-secondary" style={{ width:'100%', justifyContent:'flex-start', gap:10 }} onClick={item.action}>
                        <span>{item.icon}</span> {item.lbl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── CİHAZ LİSTESİ ── */}
        {tab === 'cihazlar' && (
          <div className="panel">
            <div className="panel-hd">
              <span className="panel-title">Cihaz Listesi</span>
              <span className="tag t-teal" style={{fontSize:10}}>{cihazlar.length} cihaz</span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{textAlign:'left'}}>Cihaz</th><th>Kategori</th><th>Seri No</th>
                  <th>Konum</th><th>Durum</th><th>Son Bakım</th><th>Sonraki Bakım</th>
                  <th>Kalibrasyon</th><th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {cihazlar.map(c => {
                  const dcfg = DURUM_CFG[c.durum] || DURUM_CFG.Pasif;
                  const kalan = daysUntil(c.sonucBakim);
                  const kalanRenk = kalan !== null && kalan <= 14 ? '#DC2626' : kalan !== null && kalan <= 30 ? '#D97706' : 'var(--slate-mid)';
                  return (
                    <tr key={c.id} style={{cursor:'pointer'}} onClick={() => setDetayModal(c)}
                      onMouseOver={e=>e.currentTarget.style.background='var(--table-hover)'}
                      onMouseOut={e=>e.currentTarget.style.background=''}>
                      <td>
                        <div style={{fontWeight:700,fontSize:13,color:'var(--slate)'}}>{c.ad}</div>
                        <div style={{fontSize:10,color:'var(--slate-light)'}}>{c.id}</div>
                      </td>
                      <td style={{fontSize:12,color:'var(--slate-mid)'}}>{c.kat}</td>
                      <td style={{fontFamily:'monospace',fontSize:11,color:'var(--slate-mid)'}}>{c.sn}</td>
                      <td style={{fontSize:12}}>{c.lok}</td>
                      <td><span className={`tag ${dcfg.tag}`} style={{fontSize:'9.5px'}}>{c.durum}</span></td>
                      <td style={{fontSize:11,color:'var(--slate-mid)'}}>{c.sonBakim}</td>
                      <td style={{fontSize:11,fontWeight:600,color:kalanRenk}}>
                        {c.sonucBakim} {kalan !== null && `(${kalan}g)`}
                      </td>
                      <td style={{fontSize:11,color:'var(--slate-mid)'}}>{c.kalibrasyon}</td>
                      <td onClick={e=>e.stopPropagation()}>
                        <button className="btn btn-secondary btn-sm" style={{fontSize:'10.5px'}} onClick={() => setDetayModal(c)}>Detay</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cihaz Detay Modal */}
      {detayModal && (
        <Modal title={detayModal.ad} onClose={() => setDetayModal(null)} width={480}>
          <div style={{ background:'var(--surface)', borderRadius:10, padding:'12px 14px', marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:44, height:44, borderRadius:12, background:`${DURUM_CFG[detayModal.durum]?.c||'#94A3B8'}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>🖥</div>
              <div>
                <div style={{fontSize:14,fontWeight:700,color:'var(--slate)'}}>{detayModal.ad}</div>
                <span className={`tag ${DURUM_CFG[detayModal.durum]?.tag}`} style={{fontSize:'9.5px',marginTop:4,display:'inline-block'}}>{detayModal.durum}</span>
              </div>
            </div>
          </div>
          {[['Cihaz ID',detayModal.id],['Seri No',detayModal.sn],['Kategori',detayModal.kat],['Konum',detayModal.lok],['Son Bakım',detayModal.sonBakim],['Sonraki Bakım',detayModal.sonucBakim],['Kalibrasyon',detayModal.kalibrasyon],['Garanti Bitiş',detayModal.garantiBitis]].map(([l,v])=>(
            <div key={l} style={{display:'flex',padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
              <span style={{color:'var(--slate-light)',width:130,flexShrink:0}}>{l}</span>
              <span style={{fontWeight:600,color:'var(--slate)'}}>{v||'—'}</span>
            </div>
          ))}
          <div className="mf" style={{marginTop:14}}>
            <button className="btn btn-secondary" onClick={() => setDetayModal(null)}>Kapat</button>
            <button className="btn btn-primary" onClick={() => { showToast('Bakım planı oluşturuldu ✓'); setDetayModal(null); navigate('/bakim-plan'); }}>Bakım Planla</button>
          </div>
        </Modal>
      )}

      {/* Yeni Arıza Modal */}
      {yeniArizaModal && (
        <Modal title="Arıza Bildirimi Oluştur" onClose={() => setYeniArizaModal(false)} width={440}>
          <div className="fg" style={{marginBottom:12}}>
            <label className="fl">Cihaz *</label>
            <select className="fi" value={arizaForm.cihaz} onChange={e=>setArizaForm(p=>({...p,cihaz:e.target.value}))}>
              <option value="">Cihaz seçin</option>
              {cihazlar.map(c=><option key={c.id} value={c.ad}>{c.ad} — {c.lok}</option>)}
            </select>
          </div>
          <div className="fg" style={{marginBottom:12}}>
            <label className="fl">Açıklama *</label>
            <textarea className="fi" rows={3} value={arizaForm.aciklama} onChange={e=>setArizaForm(p=>({...p,aciklama:e.target.value}))} placeholder="Arıza detaylarını girin…"/>
          </div>
          <div className="fg" style={{marginBottom:14}}>
            <label className="fl">Öncelik</label>
            <select className="fi" value={arizaForm.oncelik} onChange={e=>setArizaForm(p=>({...p,oncelik:e.target.value}))}>
              <option>Yüksek</option><option>Orta</option><option>Düşük</option>
            </select>
          </div>
          <div className="mf">
            <button className="btn btn-secondary" onClick={() => setYeniArizaModal(false)}>İptal</button>
            <button className="btn btn-primary" onClick={arizaKaydet}>Bildir</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
