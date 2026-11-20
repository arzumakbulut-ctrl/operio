import { useState } from 'react';
import { useDataStore } from '../store';

export default function PlatformKullanicilar() {
  const { kurumlar: KURUMLAR, personel: PERSONEL } = useDataStore();
  const [secilenKurum, setSecilenKurum] = useState(KURUMLAR[0].id);
  const [arama, setArama] = useState('');

  const aktifKurum = KURUMLAR.find(k => k.id === secilenKurum);
  // Not: Demo veri tek hastaneye ait (PERSONEL). Diğer kurumlar seçildiğinde
  // gerçek backend entegrasyonunda o kurumun kendi kullanıcı listesi gelecektir.
  const liste = secilenKurum === KURUMLAR[0].id
    ? PERSONEL.filter(p => {
        const q = arama.toLowerCase();
        return !q || `${p.ad} ${p.rol} ${p.email}`.toLowerCase().includes(q);
      })
    : [];

  return (
    <div>
      <div className="page-hd" style={{ marginBottom:16 }}>
        <div>
          <div className="page-hd-title">Tüm Kullanıcılar</div>
          <div className="page-hd-sub">Platform genelindeki tüm hastane kullanıcılarını görüntüleyin</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <select className="fi" style={{ width:240 }} value={secilenKurum} onChange={e => setSecilenKurum(e.target.value)}>
            {KURUMLAR.map(k => <option key={k.id} value={k.id}>{k.ad}</option>)}
          </select>
          <div style={{ position:'relative' }}>
            <svg style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', width:13, height:13, stroke:'var(--slate-light)', fill:'none' }} viewBox="0 0 24 24" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              style={{ border:'1px solid var(--border)', borderRadius:8, padding:'7px 12px 7px 30px', fontSize:12, fontFamily:'var(--font)', background:'var(--surface)', color:'var(--slate)', outline:'none', width:200 }}
              placeholder="Kullanıcı ara…"
              value={arama}
              onChange={e => setArama(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div style={{ background:'rgba(20,184,166,0.06)', border:'1px solid rgba(20,184,166,0.2)', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:12, color:'var(--teal)', display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontSize:15 }}>🏥</span>
        <span><strong>{aktifKurum.ad}</strong> — {aktifKurum.kullaniciSayisi} kayıtlı kullanıcı, {aktifKurum.paket} paket</span>
      </div>

      <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ textAlign:'left', minWidth:180 }}>Kullanıcı</th>
              <th>Rol</th><th>Sicil</th><th>Telefon</th><th>E-posta</th><th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {liste.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign:'center', padding:32, color:'var(--slate-light)' }}>
                {secilenKurum === KURUMLAR[0].id ? 'Kullanıcı bulunamadı' : 'Bu kurum için kullanıcı verisi demo kapsamında mevcut değil'}
              </td></tr>
            ) : liste.map(p => (
              <tr key={p.id}
                onMouseOver={e => e.currentTarget.style.background = 'var(--table-hover)'}
                onMouseOut={e  => e.currentTarget.style.background = ''}>
                <td>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div className="avatar" style={{ background:p.bg, color:'white', width:30, height:30, fontSize:10, flexShrink:0 }}>{p.av}</div>
                    <span style={{ fontSize:'12.5px', fontWeight:700, color:'var(--slate)' }}>{p.ad}</span>
                  </div>
                </td>
                <td style={{ fontSize:11.5, color:'var(--slate-mid)' }}>{p.rol}</td>
                <td style={{ fontSize:11, fontFamily:'monospace', color:'var(--slate-mid)' }}>{p.sicil}</td>
                <td style={{ fontSize:11.5, color:'var(--slate-mid)' }}>{p.tel}</td>
                <td style={{ fontSize:11.5, color:'var(--slate-mid)' }}>{p.email}</td>
                <td><span className={`tag ${p.durum==='Aktif'?'t-green':'t-gray'}`} style={{ fontSize:'9.5px' }}>{p.durum}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
