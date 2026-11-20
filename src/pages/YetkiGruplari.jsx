import { useState, useEffect } from 'react';
import { useUIStore } from '../store';
import Modal from '../components/ui/Modal';
import { YETKI_GRUPLARI } from '../data/mockData';

const BASE = 'http://localhost:4000/api';
const tok = () => localStorage.getItem('operio_access');

export default function YetkiGruplari() {
  const { showToast } = useUIStore();
  const [gruplar, setGruplar] = useState(YETKI_GRUPLARI);
  const [detayModal, setDetayModal] = useState(null);

  useEffect(() => {
    fetch(`${BASE}/yetki`, { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (data.length > 0) setGruplar(data); })
      .catch(() => {});
  }, []);

  return (
    <div>
      <div className="page-hd" style={{ marginBottom:16 }}>
        <div>
          <div className="page-hd-title">Yetki Grupları</div>
          <div className="page-hd-sub">{gruplar.length} grup — platform yönetici izinleri</div>
        </div>
        <button className="btn btn-primary" onClick={() => showToast('Yeni yetki grubu oluşturuluyor…')}>+ Yeni Grup Oluştur</button>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {gruplar.map(g => (
          <div key={g.id} style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:14, padding:'16px 20px', cursor:'pointer' }}
            onClick={() => setDetayModal(g)}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:38, height:38, borderRadius:10, background:'rgba(30,41,59,0.08)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🔑</div>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:'var(--slate)' }}>{g.ad}</div>
                  <div style={{ fontSize:11.5, color:'var(--slate-light)', marginTop:2 }}>{g.aciklama}</div>
                </div>
              </div>
              <span className="tag t-teal" style={{ fontSize:9.5 }}>{g.kullaniciSayisi} kullanıcı</span>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginLeft:50 }}>
              {g.izinler.slice(0,3).map((izin,i) => (
                <span key={i} style={{ fontSize:10.5, padding:'3px 9px', borderRadius:20, background:'var(--surface)', border:'1px solid var(--border)', color:'var(--slate-mid)' }}>{izin}</span>
              ))}
              {g.izinler.length > 3 && <span style={{ fontSize:10.5, padding:'3px 9px', borderRadius:20, background:'var(--surface)', border:'1px solid var(--border)', color:'var(--slate-light)' }}>+{g.izinler.length-3}</span>}
            </div>
          </div>
        ))}
      </div>

      {detayModal && (
        <Modal title={detayModal.ad} onClose={() => setDetayModal(null)} width={460}>
          <div style={{ fontSize:13, color:'var(--slate-mid)', marginBottom:16, lineHeight:1.6 }}>{detayModal.aciklama}</div>
          <div style={{fontSize:11,fontWeight:700,color:'var(--slate-light)',textTransform:'uppercase',marginBottom:8}}>İzinler</div>
          {detayModal.izinler.map((izin,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 0', fontSize:13, color:'var(--slate)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.5" style={{width:13,height:13,flexShrink:0}}><polyline points="20 6 9 17 4 12"/></svg>
              {izin}
            </div>
          ))}
          <div style={{marginTop:14,paddingTop:14,borderTop:'1px solid var(--border)',display:'flex',justifyContent:'space-between',fontSize:13}}>
            <span style={{color:'var(--slate-light)'}}>Bu grupta</span>
            <span style={{fontWeight:700,color:'var(--slate)'}}>{detayModal.kullaniciSayisi} kullanıcı</span>
          </div>
          <div className="mf" style={{marginTop:14}}>
            <button className="btn btn-secondary" onClick={() => setDetayModal(null)}>Kapat</button>
            <button className="btn btn-primary" onClick={() => showToast('Grup düzenleniyor…')}>Grubu Düzenle</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
