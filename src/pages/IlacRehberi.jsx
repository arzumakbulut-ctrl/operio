import { useState, useEffect, useMemo } from 'react';

const BASE = 'http://localhost:4000/api';
const tok = () => localStorage.getItem('operio_access');

const KATEGORI_ICONS = {
  'Anestezik (IV)':'💉', 'Anestezik (İnhalasyon)':'💨', 'Opioid Analjezik':'🩹',
  'Nöromüsküler Bloker':'🧬', 'Benzodiazepin':'😴', 'Antikolinerjik':'⚕️',
  'Vazopresör':'❤️', 'Lokal Anestezik':'📍', 'Analjezik (Non-opioid)':'💊',
  'Kortikosteroid':'🛡️', 'Antiemetik':'🤢', 'Kolinesteraz İnhibitörü':'🔄',
  'Selektif Bağlayıcı Ajan':'🔗', 'Antikoagülan':'🩸', 'Antifibrinolitik':'🩸',
  'Antibiyotik (Sefalosporin)':'🦠',
};

function mapIlac(i) {
  return {
    id: i.id,
    ad: i.name,
    kategori: i.category || 'Genel',
    kullanimAlani: i.description || '—',
    notlar: i.genericName || '',
    stok: i.stock ?? 0,
  };
}

export default function IlacRehberi() {
  const [ilaclar, setIlaclar] = useState([]);
  const [arama, setArama] = useState('');
  const [aktifKategori, setAktifKategori] = useState('tumu');
  const [detayModal, setDetayModal] = useState(null);

  useEffect(() => {
    fetch(`${BASE}/ilaclar`, { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => setIlaclar(data.map(mapIlac)))
      .catch(() => {});
  }, []);

  const kategoriler = useMemo(() => ['tumu', ...new Set(ilaclar.map(i => i.kategori))], [ilaclar]);

  const filtered = useMemo(() => {
    const q = arama.toLocaleLowerCase('tr-TR').trim();
    return ilaclar.filter(i => {
      const matchKat = aktifKategori === 'tumu' || i.kategori === aktifKategori;
      if (!q) return matchKat;
      return matchKat && (
        i.ad.toLocaleLowerCase('tr-TR').includes(q) ||
        i.kategori.toLocaleLowerCase('tr-TR').includes(q) ||
        i.kullanimAlani.toLocaleLowerCase('tr-TR').includes(q)
      );
    });
  }, [arama, aktifKategori, ilaclar]);

  return (
    <div>
      <div className="page-hd" style={{ marginBottom:16 }}>
        <div>
          <div className="page-hd-title">İlaç Rehberi</div>
          <div className="page-hd-sub">{ilaclar.length} ilaç — genel referans bilgisi</div>
        </div>
      </div>

      <div style={{ background:'rgba(217,119,6,0.07)', border:'1px solid rgba(217,119,6,0.25)', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:12, color:'#B45309', display:'flex', alignItems:'flex-start', gap:8 }}>
        <span style={{ fontSize:15, flexShrink:0 }}>⚠️</span>
        <span>Bu rehber yalnızca genel bilgi amaçlıdır; doz, etkileşim ve kontrendikasyon bilgisi içermez. Klinik kararlar için resmi prospektüs ve kurum protokolleri esas alınmalıdır.</span>
      </div>

      <div style={{ display:'flex', gap:10, marginBottom:18, flexWrap:'wrap' }}>
        <input
          className="fi"
          placeholder="İlaç adı, kategori veya kullanım alanı ara…"
          value={arama}
          onChange={e => setArama(e.target.value)}
          style={{ flex:1, minWidth:220 }}
        />
      </div>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:18 }}>
        {kategoriler.map(kat => (
          <button key={kat} onClick={() => setAktifKategori(kat)}
            style={{
              padding:'6px 13px', borderRadius:20, fontSize:11.5, fontWeight:600,
              cursor:'pointer', border:'1px solid var(--border)',
              background: aktifKategori === kat ? 'var(--teal)' : 'var(--surface)',
              color: aktifKategori === kat ? 'white' : 'var(--slate-mid)',
              transition:'all 0.12s',
            }}>
            {kat === 'tumu' ? '🗂 Tümü' : `${KATEGORI_ICONS[kat] || '📌'} ${kat}`}
          </button>
        ))}
      </div>

      <div style={{ fontSize:12, color:'var(--slate-light)', marginBottom:14 }}>
        {filtered.length === 0 ? (ilaclar.length === 0 ? 'İlaç kaydı bulunamadı' : 'Sonuç bulunamadı') : `${filtered.length} ilaç`}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:12 }}>
        {filtered.map(ilac => (
          <div key={ilac.id}
            onClick={() => setDetayModal(ilac)}
            style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px', cursor:'pointer', transition:'all 0.12s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--teal-mid)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = ''; }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <span style={{ fontSize:18 }}>{KATEGORI_ICONS[ilac.kategori] || '📌'}</span>
              <span style={{ fontSize:14, fontWeight:700, color:'var(--slate)' }}>{ilac.ad}</span>
            </div>
            <span className="tag t-teal" style={{ fontSize:9.5, marginBottom:8, display:'inline-block' }}>{ilac.kategori}</span>
            <div style={{ fontSize:12, color:'var(--slate-mid)', lineHeight:1.5 }}>{ilac.kullanimAlani}</div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn:'1/-1', textAlign:'center', padding:40, color:'var(--slate-light)' }}>
            {ilaclar.length === 0 ? 'Henüz ilaç kaydı eklenmemiş' : 'Aramanızla eşleşen ilaç bulunamadı'}
          </div>
        )}
      </div>

      {detayModal && (
        <div style={{ position:'fixed', inset:0, zIndex:3000, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={e => e.target === e.currentTarget && setDetayModal(null)}>
          <div style={{ background:'var(--card-bg)', borderRadius:16, width:420, maxWidth:'90vw', overflow:'hidden', border:'1px solid var(--border)' }}>
            <div style={{ padding:'16px 20px', background:'var(--surface)', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:24 }}>{KATEGORI_ICONS[detayModal.kategori] || '📌'}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:15, fontWeight:800, color:'var(--slate)' }}>{detayModal.ad}</div>
                <span className="tag t-teal" style={{ fontSize:9.5, marginTop:3, display:'inline-block' }}>{detayModal.kategori}</span>
              </div>
              <div onClick={() => setDetayModal(null)} style={{ cursor:'pointer', color:'var(--slate-light)', fontSize:20, lineHeight:1 }}>✕</div>
            </div>
            <div style={{ padding:'16px 20px' }}>
              <div style={{ fontSize:10.5, fontWeight:700, color:'var(--slate-light)', textTransform:'uppercase', marginBottom:6 }}>Kullanım Alanı</div>
              <div style={{ fontSize:13, color:'var(--slate)', lineHeight:1.6, marginBottom:14 }}>{detayModal.kullanimAlani}</div>
              {detayModal.notlar && <>
                <div style={{ fontSize:10.5, fontWeight:700, color:'var(--slate-light)', textTransform:'uppercase', marginBottom:6 }}>Not</div>
                <div style={{ fontSize:13, color:'var(--slate-mid)', lineHeight:1.6 }}>{detayModal.notlar}</div>
              </>}
              {detayModal.stok !== undefined && (
                <div style={{ marginTop:14, padding:'8px 12px', background:'var(--surface)', borderRadius:8, fontSize:12 }}>
                  Stok: <strong>{detayModal.stok}</strong> adet
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
