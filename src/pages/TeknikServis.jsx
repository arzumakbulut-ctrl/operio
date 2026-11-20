import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../store';
import Modal from '../components/ui/Modal';

const ONCELIK_CFG = { Acil:{tag:'t-red'}, Yüksek:{tag:'t-red'}, Orta:{tag:'t-orange'}, Düşük:{tag:'t-blue'} };

export default function TeknikServis() {
  const { arizalar: SERVIS_TALEPLERI, bakimPlanlari: IS_EMIRLERI, cihazlar: PARCA_STOK } = useDataStore();
  const navigate = useNavigate();
  const { showToast } = useUIStore();
  const talepler = SERVIS_TALEPLERI;
  const emirler = IS_EMIRLERI;
  const parca = PARCA_STOK;
  const [yeniTalepModal, setYeniTalepModal] = useState(false);
  const [talepForm, setTalepForm] = useState({ cihaz:'', aciklama:'', oncelik:'Orta' });

  const acik      = talepler.filter(t => t.durum === 'Açık').length;
  const islemde   = talepler.filter(t => t.durum === 'İşlemde').length;
  const tamamlandi= talepler.filter(t => t.durum === 'Tamamlandı').length;
  const kritikParca = parca.filter(p => p.stok <= p.kritikStok).length;

  function talepKaydet() {
    if (!talepForm.cihaz || !talepForm.aciklama) { showToast('Cihaz ve açıklama zorunlu'); return; }
    showToast('Servis talebi oluşturuldu ✓ — Servis Talepleri sayfasından takip edebilirsiniz');
    setYeniTalepModal(false);
    setTalepForm({ cihaz:'', aciklama:'', oncelik:'Orta' });
    navigate('/servis-talepleri');
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>

      {/* Başlık */}
      <div className="page-hd" style={{ marginBottom:14, flexShrink:0 }}>
        <div>
          <div className="page-hd-title">Teknik Servis Paneli</div>
          <div className="page-hd-sub">Cihaz bakım, onarım ve servis yönetimi</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-secondary" onClick={() => navigate('/envanter')}>📦 Cihaz Listesi</button>
          <button className="btn btn-primary" onClick={() => setYeniTalepModal(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:13,height:13}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Yeni Servis Talebi
          </button>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto' }}>
        <div className="stat-row" style={{ marginBottom:14 }}>
          {[
            { val:acik,       lbl:'Açık Talep',      trend:'⚡ Bekliyor',        cls:'stat-card-4', si:'si-orange', icon:<svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg> },
            { val:islemde,    lbl:'İşlemdeki',        trend:'🔧 Aktif servis',    cls:'stat-card-2', si:'si-blue',   icon:<svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg> },
            { val:tamamlandi, lbl:'Tamamlandı',       trend:'✓ Bu ay',            cls:'stat-card-1', si:'si-teal',   icon:<svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg> },
            { val:kritikParca,lbl:'Kritik Parça',     trend:'⚠ Stok yetersiz',   cls:'stat-card-3', si:'si-purple', icon:<svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H8a2 2 0 00-2 2v2h12V5a2 2 0 00-2-2z"/></svg> },
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
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {/* Açık talepler */}
            <div className="panel">
              <div className="panel-hd">
                <span className="panel-title">🔴 Açık Servis Talepleri</span>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/servis-talepleri')}>Tümü →</button>
              </div>
              {talepler.filter(t => t.durum !== 'Tamamlandı').map(t => (
                <div key={t.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 18px', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0, background:t.oncelik==='Acil'||t.oncelik==='Yüksek'?'#DC2626':'#D97706' }}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--slate)' }}>{t.cihaz}</div>
                    <div style={{ fontSize:11, color:'var(--slate-light)', marginTop:1 }}>{t.aciklama}</div>
                    <div style={{ fontSize:10, color:'var(--slate-light)', marginTop:1 }}>{t.atanan} · {t.tarih}</div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                    <span className={`tag ${ONCELIK_CFG[t.oncelik]?.tag||'t-gray'}`} style={{fontSize:9}}>{t.oncelik}</span>
                    <span className={`tag ${t.durum==='Açık'?'t-red':'t-blue'}`} style={{fontSize:9}}>{t.durum}</span>
                  </div>
                </div>
              ))}
              {talepler.filter(t => t.durum !== 'Tamamlandı').length === 0 && (
                <div style={{ padding:28, textAlign:'center', fontSize:13, color:'var(--slate-light)' }}>
                  <div style={{fontSize:28,marginBottom:8}}>✅</div>Açık talep yok
                </div>
              )}
            </div>

            {/* İş Emirleri */}
            <div className="panel">
              <div className="panel-hd">
                <span className="panel-title">📋 Aktif İş Emirleri</span>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/is-emirleri')}>Tümü →</button>
              </div>
              {emirler.filter(e => e.durum !== 'Tamamlandı').map(e => (
                <div key={e.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 18px', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ width:40, height:40, borderRadius:10, background:'rgba(124,58,237,0.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:16 }}>🔧</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--slate)' }}>{e.cihaz}</div>
                    <div style={{ fontSize:11, color:'var(--slate-light)', marginTop:1 }}>{e.tip} · {e.teknisyen}</div>
                    <div style={{ fontSize:10, color:'var(--slate-light)', marginTop:1 }}>Başlangıç: {e.baslangic}</div>
                  </div>
                  <span className="tag t-blue" style={{fontSize:'9.5px'}}>{e.durum}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sağ */}
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {/* Kritik parçalar */}
            {kritikParca > 0 && (
              <div className="panel">
                <div className="panel-hd">
                  <span className="panel-title">⚠ Kritik Stok Uyarısı</span>
                  <button className="btn btn-secondary btn-sm" onClick={() => navigate('/parca-takip')}>Stoka Git →</button>
                </div>
                {parca.filter(p => p.stok <= p.kritikStok).map(p => (
                  <div key={p.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 18px', borderBottom:'1px solid var(--border)' }}>
                    <div style={{ width:34, height:34, borderRadius:9, background:'rgba(220,38,38,0.1)', border:'1px solid rgba(220,38,38,0.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:14 }}>📦</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12.5, fontWeight:700, color:'var(--slate)' }}>{p.ad}</div>
                      <div style={{ fontSize:11, color:'var(--slate-light)', marginTop:1 }}>{p.tedarikci}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:12, fontWeight:800, color:'#DC2626' }}>{p.stok} {p.birim}</div>
                      <div style={{ fontSize:9.5, color:'var(--slate-light)' }}>Min: {p.kritikStok}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="panel">
              <div className="panel-hd"><span className="panel-title">🔗 Hızlı İşlemler</span></div>
              <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:8 }}>
                {[
                  { lbl:'Yeni Servis Talebi', icon:'🔧', action:()=>setYeniTalepModal(true) },
                  { lbl:'İş Emirleri',        icon:'📋', action:()=>navigate('/is-emirleri') },
                  { lbl:'Parça & Stok',       icon:'📦', action:()=>navigate('/parca-takip') },
                  { lbl:'Bakım Takvimi',      icon:'📅', action:()=>navigate('/bakim-takvimi') },
                  { lbl:'Cihaz Listesi',      icon:'🖥', action:()=>navigate('/envanter')    },
                ].map(item => (
                  <button key={item.lbl} className="btn btn-secondary" style={{ width:'100%', justifyContent:'flex-start', gap:10 }} onClick={item.action}>
                    <span>{item.icon}</span> {item.lbl}
                  </button>
                ))}
              </div>
            </div>

            {/* Performans */}
            <div className="panel">
              <div className="panel-hd"><span className="panel-title">📊 Bu Ay Performans</span></div>
              <div style={{ padding:'14px 18px' }}>
                {[['Kapatılan Talep','12 adet','#059669'],['Ort. Kapanma Süresi','4.2 saat','#0284C7'],['İlk Temas Çözüm','%78','#7C3AED'],['Müşteri Memnuniyeti','4.6/5','#D97706']].map(([l,v,c]) => (
                  <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                    <span style={{ fontSize:12, color:'var(--slate-light)' }}>{l}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:c }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Yeni Talep Modal */}
      {yeniTalepModal && (
        <Modal title="Yeni Servis Talebi" onClose={() => setYeniTalepModal(false)} width={440}>
          <div className="fg" style={{marginBottom:12}}>
            <label className="fl">Cihaz *</label>
            <input className="fi" value={talepForm.cihaz} onChange={e=>setTalepForm(p=>({...p,cihaz:e.target.value}))} placeholder="Cihaz adı…" autoFocus/>
          </div>
          <div className="fg" style={{marginBottom:12}}>
            <label className="fl">Açıklama *</label>
            <textarea className="fi" rows={3} value={talepForm.aciklama} onChange={e=>setTalepForm(p=>({...p,aciklama:e.target.value}))} placeholder="Sorunun detaylarını girin…"/>
          </div>
          <div className="fg" style={{marginBottom:14}}>
            <label className="fl">Öncelik</label>
            <select className="fi" value={talepForm.oncelik} onChange={e=>setTalepForm(p=>({...p,oncelik:e.target.value}))}>
              <option>Acil</option><option>Yüksek</option><option>Orta</option><option>Düşük</option>
            </select>
          </div>
          <div className="mf">
            <button className="btn btn-secondary" onClick={() => setYeniTalepModal(false)}>İptal</button>
            <button className="btn btn-primary" onClick={talepKaydet}>Oluştur</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
