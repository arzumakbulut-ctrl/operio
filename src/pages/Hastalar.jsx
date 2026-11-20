import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useDataStore, useUIStore } from '../store';
import { ROLES } from '../data/roles';
import HastaDrawer from '../components/ui/HastaDrawer';

function mkInitials(ad, soyad) {
  return `${ad||''} ${soyad||''}`.trim().split(' ').filter(Boolean).map(w=>w[0]).join('').substring(0,2).toUpperCase() || '?';
}

export default function Hastalar() {
  const navigate = useNavigate();
  const { curRole } = useAuthStore();
  const { showToast } = useUIStore();
  const { hastalar, surgeries } = useDataStore();
  const [arama, setArama]         = useState('');
  const [drawerHasta, setDrawer]  = useState(null);

  // Doktor (6) ve Misafir Hekim (10) sadece kendi ameliyatlarındaki hastaları görür
  function exportCSV() {
    const headers = ['Ad','Soyad','TC','Telefon','Kan Grubu','Cinsiyet','Alerjiler'];
    const rows = liste.map(h => [h.ad||'',h.soyad||'',h.tc||'',h.tel||'',h.kan||'',h.cinsiyet||'',h.alerjiler||'']);
    const csv = [headers,...rows].map(r=>r.map(x=>'"'+String(x||'').replace(/"/g,'""')+'"').join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='hastalar.csv'; a.click();
    URL.revokeObjectURL(url);
    showToast('Hasta listesi indirildi');
  }

  const isDrRole = curRole === 6 || curRole === 10;
  const myFullName = ROLES[curRole]?.full || '';

  const liste = hastalar.filter(p => {
    // Doktor tum hastalari gorebilir
    const q = arama.toLowerCase();
    return !q || `${p.ad} ${p.soyad||''} ${p.tc} ${p.tel}`.toLowerCase().includes(q);
  });

  function durumTag(d) {
    return d === 'Acil' ? 't-red' : d === 'Aktif' ? 't-blue' : 't-teal';
  }

  return (
    <div>
      {/* Başlık */}
      <div className="page-hd" style={{ marginBottom:16 }}>
        <div>
          <div className="page-hd-title">Hasta Kartları</div>
          <div className="page-hd-sub">{liste.length} hasta kayıtlı</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ position:'relative' }}>
            <svg style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', width:13, height:13, stroke:'var(--slate-light)', fill:'none' }} viewBox="0 0 24 24" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              style={{ border:'1px solid var(--border)', borderRadius:8, padding:'7px 12px 7px 30px', fontSize:12, fontFamily:'var(--font)', background:'var(--surface)', color:'var(--slate)', outline:'none', width:220 }}
              placeholder="Hasta ara…"
              value={arama}
              onChange={e => setArama(e.target.value)}
            />
          </div>
          <button className="btn btn-secondary" onClick={exportCSV} style={{marginRight:8}}>⬇ CSV</button>
          <button className="btn btn-primary" onClick={() => navigate('/yeni-hasta')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:13,height:13}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Yeni Hasta Ekle
          </button>
        </div>
      </div>

      {/* Tablo */}
      <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
        <table className="data-table" id="hastaTable">
          <thead>
            <tr>
              <th style={{ textAlign:'left', minWidth:180 }}>Hasta</th>
              <th>TC Kimlik</th>
              <th>Yaş / Cinsiyet</th>
              <th>Kan Grubu</th>
              <th>Telefon</th>
              <th>Sigorta</th>
              <th>Alerji</th>
              <th>Durum</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {liste.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign:'center', padding:32, color:'var(--slate-light)' }}>Kayıtlı hasta yok</td></tr>
            ) : liste.map(p => {
              const initials = mkInitials(p.ad, p.soyad);
              const alerjiTxt = p.alerjiler && p.alerjiler !== 'Yok' ? p.alerjiler : '—';
              const alerjiRenk = alerjiTxt !== '—' ? { color:'var(--warning)', fontWeight:600 } : {};
              return (
                <tr key={p.id} style={{ cursor:'pointer' }}
                  onClick={() => setDrawer(p)}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--table-hover)'}
                  onMouseOut={e  => e.currentTarget.style.background = ''}
                >
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div className="avatar" style={{ background:'var(--teal)', color:'white', width:32, height:32, fontSize:11, flexShrink:0 }}>{initials}</div>
                      <div>
                        <div style={{ fontSize:'12.5px', fontWeight:700, color:'var(--slate)', letterSpacing:'-0.02em' }}>{p.ad} {p.soyad||''}</div>
                        <div style={{ fontSize:10, color:'var(--slate-light)', marginTop:1 }}>{p.id}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize:'11.5px', color:'var(--slate-mid)', fontFamily:'monospace', letterSpacing:'0.5px' }}>{p.tc}</td>
                  <td style={{ textAlign:'center' }}>
                    <span style={{ fontSize:12, fontWeight:600, color:'var(--slate)' }}>{p.yas}</span>
                  </td>
                  <td style={{ textAlign:'center' }}>
                    <span style={{ fontSize:12, fontWeight:700, color:'var(--danger)' }}>{p.kan||'—'}</span>
                  </td>
                  <td style={{ fontSize:'11.5px', color:'var(--slate-mid)' }}>{p.tel}</td>
                  <td style={{ textAlign:'center' }}>
                    <span className="tag t-blue" style={{ fontSize:'9.5px' }}>{p.sigortaTip||'SGK'}</span>
                  </td>
                  <td style={{ fontSize:11, ...alerjiRenk }}>{alerjiTxt}</td>
                  <td style={{ textAlign:'center' }}>
                    <span className={`tag ${durumTag(p.durum)}`} style={{ fontSize:'9.5px' }}>{p.durum||'Aktif'}</span>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display:'flex', gap:5, justifyContent:'center' }}>
                      <button className="btn btn-secondary btn-sm" style={{ fontSize:'10.5px' }} onClick={() => setDrawer(p)}>Detay</button>
                      <button className="btn btn-primary btn-sm" style={{ fontSize:'10.5px' }} onClick={() => navigate('/talep', { state: { hasta: p } })}>Randevu Oluştur</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {drawerHasta && <HastaDrawer hasta={drawerHasta} onClose={() => setDrawer(null)}/>}
    </div>
  );
}
