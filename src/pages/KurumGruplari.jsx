import { useState } from 'react';
import { useDataStore, useUIStore } from '../store';
import Modal from '../components/ui/Modal';

export default function KurumGruplari() {
  const { kurumlar, kurumGruplari: gruplar, setKurumGrubu, kurumuGruptanCikar } = useDataStore();
  const { showToast } = useUIStore();
  const [detayId, setDetayId] = useState(null);
  const [eklenecekKurum, setEklenecekKurum] = useState('');

  const detayModal = gruplar.find(g => g.id === detayId) || null;

  function kurumAdlari(kurumIdler) {
    return kurumIdler.map(id => kurumlar.find(k => k.id === id)?.ad).filter(Boolean);
  }

  // Bu grubun zaten içermediği tüm kurumlar (başka bir gruba ait olsa bile gösterilir, seçilince oradan transfer edilir)
  function eklenebilirKurumlar(grup) {
    return kurumlar.filter(k => !grup.kurumIdler.includes(k.id));
  }

  function mevcutGrup(kurumId) {
    return gruplar.find(g => g.kurumIdler.includes(kurumId));
  }

  function kurumCikar(grupId, kurumId) {
    const kurum = kurumlar.find(k => k.id === kurumId);
    kurumuGruptanCikar(kurumId, grupId);
    showToast(`${kurum?.ad || 'Kurum'} gruptan çıkarıldı`);
  }

  function kurumEkle(grupId) {
    if (!eklenecekKurum) return;
    const kurum = kurumlar.find(k => k.id === eklenecekKurum);
    const eskiGrup = mevcutGrup(eklenecekKurum);
    setKurumGrubu(eklenecekKurum, grupId);
    showToast(eskiGrup
      ? `${kurum?.ad || 'Kurum'} "${eskiGrup.ad}" grubundan bu gruba taşındı ✓`
      : `${kurum?.ad || 'Kurum'} gruba eklendi ✓`);
    setEklenecekKurum('');
  }

  return (
    <div>
      <div className="page-hd" style={{ marginBottom:16 }}>
        <div>
          <div className="page-hd-title">Kurum Grupları</div>
          <div className="page-hd-sub">{gruplar.length} grup — hastane zincirleri ve bağlı kurumlar</div>
        </div>
        <button className="btn btn-primary" onClick={() => showToast('Yeni grup oluşturuluyor…')}>+ Yeni Grup Oluştur</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:16 }}>
        {gruplar.map(g => (
          <div key={g.id} style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden', cursor:'pointer' }}
            onClick={() => setDetayId(g.id)}>
            <div style={{ height:4, background:'#1E293B' }}/>
            <div style={{ padding:'16px 18px' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:'var(--slate)' }}>{g.ad}</div>
                  <div style={{ fontSize:11, color:'var(--slate-light)', marginTop:2 }}>{g.tip}</div>
                </div>
                <span className={`tag ${g.durum==='Aktif'?'t-green':'t-gray'}`} style={{ fontSize:9.5 }}>{g.durum}</span>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:12 }}>
                {kurumAdlari(g.kurumIdler).map((ad,i) => (
                  <span key={i} style={{ fontSize:10.5, padding:'3px 9px', borderRadius:20, background:'var(--surface)', border:'1px solid var(--border)', color:'var(--slate-mid)' }}>{ad}</span>
                ))}
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', paddingTop:10, borderTop:'1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize:9.5, color:'var(--slate-light)', textTransform:'uppercase', fontWeight:700 }}>Yetkili</div>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--slate)', marginTop:2 }}>{g.yetkiliAd}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:9.5, color:'var(--slate-light)', textTransform:'uppercase', fontWeight:700 }}>Aylık Gelir</div>
                  <div style={{ fontSize:13, fontWeight:800, color:'var(--teal)', marginTop:2 }}>₺{g.toplamGelir.toLocaleString('tr-TR')}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {detayModal && (
        <Modal title={detayModal.ad} onClose={() => setDetayId(null)} width={520}>
          {[['Grup Tipi',detayModal.tip],['Yetkili',detayModal.yetkiliAd],['E-posta',detayModal.yetkiliEmail],['Bağlı Kurum Sayısı',detayModal.kurumIdler.length],['Toplam Aylık Gelir',`₺${detayModal.toplamGelir.toLocaleString('tr-TR')}`],['Durum',detayModal.durum]].map(([l,v])=>(
            <div key={l} style={{display:'flex',padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
              <span style={{color:'var(--slate-light)',width:160,flexShrink:0}}>{l}</span>
              <span style={{fontWeight:600,color:'var(--slate)'}}>{v}</span>
            </div>
          ))}

          <div style={{marginTop:14}}>
            <div style={{fontSize:11,fontWeight:700,color:'var(--slate-light)',textTransform:'uppercase',marginBottom:8}}>Bağlı Kurumlar</div>
            {detayModal.kurumIdler.length === 0 ? (
              <div style={{fontSize:12,color:'var(--slate-light)',padding:'8px 0'}}>Bu gruba bağlı kurum yok</div>
            ) : detayModal.kurumIdler.map(id => {
              const kurum = kurumlar.find(k => k.id === id);
              if (!kurum) return null;
              return (
                <div key={id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
                  <span style={{fontSize:13,color:'var(--slate)'}}>🏥 {kurum.ad}</span>
                  <button className="btn btn-sm" style={{background:'#FEF2F2',color:'#DC2626',border:'1px solid #FECACA',fontSize:10.5}}
                    onClick={() => kurumCikar(detayModal.id, id)}>Çıkar</button>
                </div>
              );
            })}
          </div>

          {/* Yeni kurum ekleme */}
          {eklenebilirKurumlar(detayModal).length > 0 && (
            <div style={{marginTop:14,paddingTop:14,borderTop:'1px solid var(--border)'}}>
              <div style={{fontSize:11,fontWeight:700,color:'var(--slate-light)',textTransform:'uppercase',marginBottom:8}}>Gruba Kurum Ekle</div>
              <div style={{display:'flex',gap:8}}>
                <select className="fi" style={{flex:1}} value={eklenecekKurum} onChange={e=>setEklenecekKurum(e.target.value)}>
                  <option value="">Kurum seçin…</option>
                  {eklenebilirKurumlar(detayModal).map(k => {
                    const eg = mevcutGrup(k.id);
                    return <option key={k.id} value={k.id}>{k.ad}{eg ? ` — şu an: ${eg.ad}` : ''}</option>;
                  })}
                </select>
                <button className="btn btn-primary btn-sm" onClick={() => kurumEkle(detayModal.id)} disabled={!eklenecekKurum}>Ekle</button>
              </div>
            </div>
          )}

          <div className="mf" style={{marginTop:14}}>
            <button className="btn btn-secondary" onClick={() => setDetayId(null)}>Kapat</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
