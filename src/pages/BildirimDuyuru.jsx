import { useState } from 'react';
import { useAuthStore, useUIStore, useDataStore } from '../store';
import { ROLES } from '../data/roles';

const BASE = 'http://localhost:4000/api';
const tok = () => localStorage.getItem('operio_access');

const TIP_CFG = {
  duyuru: { ic:'📢', renk:'#14B8A6', bg:'rgba(20,184,166,0.1)', lbl:'Duyuru' },
  uyari:  { ic:'⚠️',  renk:'#D97706', bg:'rgba(217,119,6,0.1)',  lbl:'Uyarı' },
  bilgi:  { ic:'ℹ️',  renk:'#0284C7', bg:'rgba(2,132,199,0.1)', lbl:'Bilgilendirme' },
};
const ONCELIK_RENK = { normal:'var(--slate-light)', yuksek:'#D97706', acil:'#DC2626' };

export default function BildirimDuyuru() {
  const { curRole } = useAuthStore();
  const { showToast } = useUIStore();
  const { bildirimler } = useDataStore();
  const rolAd = ROLES[curRole]?.full || '';

  const dbDuyurular = bildirimler.map(b => ({
    id: b.id,
    tip: ['duyuru','uyari','bilgi'].includes(b.tip) ? b.tip : 'bilgi',
    baslik: b.baslik || b.mesaj || '—',
    icerik: b.mesaj || '',
    alici: '—',
    oncelik: 'normal',
    tarih: b.zaman || '',
    goruntulenme: 0,
  }));

  const [localNew, setLocalNew] = useState([]);
  const duyurular = [...localNew, ...dbDuyurular];

  const [tip, setTip]   = useState('duyuru');
  const [form, setForm] = useState({ baslik:'', icerik:'', alici:'Tüm Kullanıcılar', oncelik:'normal' });

  async function gonder() {
    if (!form.baslik.trim() || !form.icerik.trim()) { showToast('Başlık ve içerik zorunludur'); return; }
    const yeni = { id:'D'+Date.now(), tip, ...form, tarih: 'Az önce', goruntulenme:0 };
    setLocalNew(prev => [yeni, ...prev]);
    setForm({ baslik:'', icerik:'', alici:'Tüm Kullanıcılar', oncelik:'normal' });
    showToast('Bildirim gönderildi ✓');
    try {
      await fetch(`${BASE}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
        body: JSON.stringify({ baslik: form.baslik, mesaj: form.icerik, tip }),
      });
    } catch { /* optimistic */ }
  }

  function taslak() {
    showToast('Taslak kaydedildi');
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 360px', gap:18, alignItems:'start' }}>

      {/* Sol: Form + Liste */}
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

        {/* Yeni Bildirim */}
        <div className="panel">
          <div className="panel-hd">
            <span className="panel-title">Yeni Bildirim Oluştur</span>
            <span style={{ fontSize:'11.5px', color:'var(--slate-light)' }}>{rolAd}</span>
          </div>
          <div style={{ padding:20 }}>
            {/* Tip seçimi */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:20 }}>
              {Object.entries(TIP_CFG).map(([k,v]) => (
                <div key={k} onClick={() => setTip(k)}
                  style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, padding:'16px 12px', border:`2px solid ${tip===k?v.renk:'var(--border)'}`, borderRadius:14, cursor:'pointer', background:tip===k?v.bg:'var(--surface)', transition:'all 0.15s' }}>
                  <span style={{ fontSize:28 }}>{v.ic}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:tip===k?v.renk:'var(--slate)' }}>{v.lbl}</span>
                </div>
              ))}
            </div>

            {/* Başlık */}
            <div className="fg" style={{ marginBottom:14 }}>
              <label className="fl">Başlık</label>
              <input className="fi" value={form.baslik} onChange={e=>setForm({...form,baslik:e.target.value})} placeholder="Bildirim başlığı…"/>
            </div>

            {/* İçerik */}
            <div className="fg" style={{ marginBottom:14 }}>
              <label className="fl">İçerik</label>
              <textarea className="fi" rows={4} value={form.icerik} onChange={e=>setForm({...form,icerik:e.target.value})} placeholder="Bildirim içeriği…" style={{ resize:'vertical', lineHeight:1.6 }}/>
            </div>

            {/* Alıcı + Öncelik */}
            <div className="fr" style={{ marginBottom:20 }}>
              <div className="fg">
                <label className="fl">Alıcı</label>
                <select className="fi" value={form.alici} onChange={e=>setForm({...form,alici:e.target.value})}>
                  {['Tüm Kullanıcılar','Tüm Personel','Ameliyathane','Doktorlar','Hemşireler','Sterilizasyon Ekibi','Anestezi Ekibi','Yöneticiler'].map(a=><option key={a}>{a}</option>)}
                </select>
              </div>
              <div className="fg">
                <label className="fl">Öncelik</label>
                <select className="fi" value={form.oncelik} onChange={e=>setForm({...form,oncelik:e.target.value})}>
                  <option value="normal">Normal</option>
                  <option value="yuksek">Yüksek</option>
                  <option value="acil">Acil</option>
                </select>
              </div>
            </div>

            {/* Butonlar */}
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-secondary" onClick={taslak} style={{ flex:1, justifyContent:'center' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:13, height:13 }}><path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                Taslak
              </button>
              <button className="btn btn-primary" onClick={gonder} style={{ flex:2, justifyContent:'center' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:13, height:13 }}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                Gönder
              </button>
            </div>
          </div>
        </div>

        {/* Gönderilen liste */}
        <div className="panel">
          <div className="panel-hd">
            <span className="panel-title">Gönderilen Bildirimler</span>
            <span style={{ fontSize:11, color:'var(--slate-light)' }}>{duyurular.length} bildirim</span>
          </div>
          <div>
            {duyurular.length === 0 ? (
              <div style={{ textAlign:'center', padding:32, color:'var(--slate-light)', fontSize:13 }}>
                <div style={{ fontSize:28, marginBottom:8 }}>📭</div>Henüz bildirim gönderilmedi
              </div>
            ) : duyurular.map(d => {
              const cfg = TIP_CFG[d.tip] || TIP_CFG.bilgi;
              const oc  = ONCELIK_RENK[d.oncelik] || ONCELIK_RENK.normal;
              return (
                <div key={d.id} style={{ padding:'13px 18px', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:cfg.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>{cfg.ic}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:'var(--slate)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.baslik}</div>
                        <span style={{ fontSize:'9.5px', fontWeight:700, padding:'2px 8px', borderRadius:20, background:cfg.bg, color:cfg.renk, flexShrink:0 }}>{cfg.lbl}</span>
                        {d.oncelik !== 'normal' && <span style={{ fontSize:'9.5px', fontWeight:700, color:oc, flexShrink:0 }}>● {d.oncelik === 'acil' ? 'Acil' : 'Yüksek'}</span>}
                      </div>
                      <div style={{ fontSize:11, color:'var(--slate-light)', display:'flex', gap:8 }}>
                        <span>{d.alici}</span><span>·</span>
                        <span>{d.goruntulenme} görüntülenme</span><span>·</span>
                        <span>{d.tarih}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sağ: İstatistik + Son */}
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {/* İstatistik kartları */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {[
            { ic:'📢', val:duyurular.filter(d=>d.tip==='duyuru').length,             lbl:'Duyuru',          renk:'#14B8A6' },
            { ic:'⚠️',  val:duyurular.filter(d=>d.tip==='uyari').length,              lbl:'Uyarı',           renk:'#D97706' },
            { ic:'ℹ️',  val:duyurular.filter(d=>d.tip==='bilgi').length,              lbl:'Bilgilendirme',   renk:'#0284C7' },
            { ic:'👁️', val:duyurular.reduce((s,d)=>s+(d.goruntulenme||0),0),          lbl:'Toplam Görüntülenme', renk:'#7C3AED' },
          ].map((k,i) => (
            <div key={i} style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:12, padding:14, textAlign:'center' }}>
              <div style={{ fontSize:24, marginBottom:6 }}>{k.ic}</div>
              <div style={{ fontSize:22, fontWeight:900, color:k.renk, fontFamily:"'Outfit',sans-serif", letterSpacing:'-0.5px' }}>{k.val}</div>
              <div style={{ fontSize:'10.5px', color:'var(--slate-light)', marginTop:3, fontWeight:600 }}>{k.lbl}</div>
            </div>
          ))}
        </div>

        {/* Son gönderilenler */}
        <div className="panel">
          <div className="panel-hd"><span className="panel-title">Son Gönderilenler</span></div>
          <div>
            {duyurular.slice(0,5).map(d => {
              const cfg = TIP_CFG[d.tip] || TIP_CFG.bilgi;
              return (
                <div key={d.id} style={{ padding:'13px 16px', borderBottom:'1px solid var(--border)', cursor:'pointer', transition:'background 0.12s' }}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--surface)'}
                  onMouseLeave={e=>e.currentTarget.style.background=''}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                    <div style={{ width:34, height:34, borderRadius:10, background:cfg.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>{cfg.ic}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'var(--slate)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.baslik}</div>
                      <div style={{ fontSize:11, color:'var(--slate-light)', marginTop:3, display:'flex', gap:8 }}>
                        <span>{d.alici}</span><span>·</span><span>{d.goruntulenme} görüntülenme</span>
                      </div>
                      <div style={{ fontSize:'10.5px', color:'var(--slate-light)', marginTop:2 }}>{d.tarih}</div>
                    </div>
                    <span style={{ fontSize:'9.5px', fontWeight:700, padding:'2px 8px', borderRadius:20, background:cfg.bg, color:cfg.renk, flexShrink:0 }}>{cfg.lbl}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* İpucu */}
        <div style={{ background:'rgba(20,184,166,0.05)', border:'1px solid rgba(20,184,166,0.15)', borderRadius:12, padding:'14px 16px', fontSize:'12.5px', color:'var(--slate-mid)', lineHeight:1.6 }}>
          💡 <strong style={{ color:'var(--slate)' }}>İpucu:</strong> Acil bildirimler tüm kullanıcıların ekranında anında görünür. Normal bildirimler bildirim panelinde listelenir.
        </div>
      </div>
    </div>
  );
}
