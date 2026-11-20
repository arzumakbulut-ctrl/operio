import { useState, useEffect } from 'react';
import { useUIStore } from '../store';
import Modal from '../components/ui/Modal';

const ONCELIK_CFG = { Yüksek:{tag:'t-red'}, Orta:{tag:'t-orange'}, Düşük:{tag:'t-blue'} };
const TIP_ICON = { 'Teknik Destek':'🔧', 'Özellik Talebi':'💡', 'Faturalama':'💳', 'Satış':'📈' };

export default function KurumTalepleri() {
  const token = localStorage.getItem('operio_access');
  const [KURUM_TALEPLERI, setKURUM_TALEPLERI] = useState([]);
  useEffect(() => {
    fetch('http://localhost:4000/api/kurumlar/talepler', {
      headers: { 'Authorization': 'Bearer ' + token }
    }).then(r => r.ok ? r.json() : [])
      .then(data => setKURUM_TALEPLERI(data))
      .catch(() => {});
  }, []);
  const { showToast } = useUIStore();
  const [talepler, setTalepler] = useState([]);
  useEffect(() => { setTalepler(KURUM_TALEPLERI); }, [KURUM_TALEPLERI]);
  const [detayId, setDetayId] = useState(null);
  const [yeniYorum, setYeniYorum] = useState('');

  const detayModal = talepler.find(t => t.id === detayId) || null;
  const acikSayisi = talepler.filter(t=>t.durum==='Açık').length;

  function durumGuncelle(id, durum) {
    setTalepler(p => p.map(t => t.id===id ? {...t,durum} : t));
    showToast(`Talep durumu güncellendi: ${durum}`);
  }

  function yorumEkle() {
    if (!yeniYorum.trim() || !detayId) return;
    const yorum = { yazan:'Sis. Yön. Deniz Korkmaz', rol:'Operio', tarih: new Date().toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }).replace(',', ''), mesaj: yeniYorum.trim() };
    setTalepler(p => p.map(t => t.id===detayId ? { ...t, yorumlar:[...(t.yorumlar||[]), yorum] } : t));
    setYeniYorum('');
    showToast('Yanıt eklendi ✓');
  }

  return (
    <div>
      <div className="page-hd" style={{ marginBottom:16 }}>
        <div>
          <div className="page-hd-title">Kurum Talepleri</div>
          <div className="page-hd-sub">{talepler.length} talep — {acikSayisi} açık</div>
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {talepler.map(t => (
          <div key={t.id} style={{ background:'var(--card-bg)', border:`1.5px solid ${t.durum==='Tamamlandı'?'var(--border)':'rgba(220,38,38,0.2)'}`, borderRadius:12, padding:'14px 18px', cursor:'pointer' }}
            onClick={() => setDetayId(t.id)}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
              <div style={{ width:38, height:38, borderRadius:10, background:'var(--surface)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>{TIP_ICON[t.tip]||'📋'}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4 }}>
                  <span style={{ fontSize:13, fontWeight:700, color:'var(--slate)' }}>{t.konu}</span>
                  <span className={`tag ${ONCELIK_CFG[t.oncelik]?.tag||'t-gray'}`} style={{fontSize:9}}>{t.oncelik}</span>
                  <span className={`tag ${t.durum==='Tamamlandı'?'t-green':t.durum==='İşlemde'?'t-blue':'t-red'}`} style={{fontSize:9}}>{t.durum}</span>
                </div>
                <div style={{ fontSize:11.5, color:'var(--slate-mid)' }}>{t.kurumAd} · {t.tip}</div>
                <div style={{ fontSize:10.5, color:'var(--slate-light)', marginTop:2 }}>{t.tarih} · Atanan: {t.atanan} {t.yorumlar?.length > 0 && `· 💬 ${t.yorumlar.length}`}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {detayModal && (
        <Modal title={detayModal.konu} onClose={() => setDetayId(null)} width={520}>
          {[['Kurum',detayModal.kurumAd],['Tip',detayModal.tip],['Tarih',detayModal.tarih],['Öncelik',detayModal.oncelik],['Atanan',detayModal.atanan],['Durum',detayModal.durum]].map(([l,v])=>(
            <div key={l} style={{display:'flex',padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
              <span style={{color:'var(--slate-light)',width:110,flexShrink:0}}>{l}</span>
              <span style={{fontWeight:600,color:'var(--slate)'}}>{v}</span>
            </div>
          ))}

          {/* Yorum / Yanıt Geçmişi */}
          <div style={{ marginTop:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--slate-light)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:10 }}>Yanıt Geçmişi</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10, maxHeight:240, overflowY:'auto', marginBottom:14 }}>
              {(detayModal.yorumlar || []).length === 0 ? (
                <div style={{ fontSize:12, color:'var(--slate-light)', textAlign:'center', padding:'12px 0' }}>Henüz yanıt yok</div>
              ) : detayModal.yorumlar.map((y, i) => (
                <div key={i} style={{
                  background: y.rol === 'Operio' ? 'rgba(20,184,166,0.06)' : 'var(--surface)',
                  border: `1px solid ${y.rol === 'Operio' ? 'rgba(20,184,166,0.2)' : 'var(--border)'}`,
                  borderRadius:10, padding:'10px 13px' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
                    <span style={{ fontSize:12, fontWeight:700, color: y.rol === 'Operio' ? 'var(--teal)' : 'var(--slate)' }}>
                      {y.yazan} {y.rol === 'Operio' && <span style={{fontSize:9,fontWeight:600,marginLeft:4,padding:'1px 6px',borderRadius:8,background:'var(--teal)',color:'white'}}>Operio</span>}
                    </span>
                    <span style={{ fontSize:10, color:'var(--slate-light)' }}>{y.tarih}</span>
                  </div>
                  <div style={{ fontSize:12.5, color:'var(--slate-mid)', lineHeight:1.5 }}>{y.mesaj}</div>
                </div>
              ))}
            </div>

            {/* Yeni yorum ekleme */}
            <div style={{ display:'flex', gap:8 }}>
              <textarea
                className="fi"
                rows={2}
                placeholder="Yanıt yazın…"
                value={yeniYorum}
                onChange={e => setYeniYorum(e.target.value)}
                style={{ flex:1, resize:'vertical' }}
              />
              <button className="btn btn-primary btn-sm" style={{ alignSelf:'flex-end' }} onClick={yorumEkle}>Gönder</button>
            </div>
          </div>

          <div className="mf" style={{marginTop:14}}>
            <button className="btn btn-secondary" onClick={() => setDetayId(null)}>Kapat</button>
            {detayModal.durum === 'Açık' && <button className="btn btn-primary" onClick={() => durumGuncelle(detayModal.id,'İşlemde')}>İşleme Al</button>}
            {detayModal.durum === 'İşlemde' && <button className="btn btn-primary" onClick={() => durumGuncelle(detayModal.id,'Tamamlandı')}>Tamamla</button>}
          </div>
        </Modal>
      )}
    </div>
  );
}
