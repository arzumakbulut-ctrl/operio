import { useState } from 'react';
import { useDataStore, useUIStore, useAuthStore } from '../store';
import Modal from '../components/ui/Modal';

const GOREVLER = [
  'Ameliyathane Sorumlu Hemşiresi','Scrub Hemşiresi','Ameliyathane Hemşiresi','Servis Hemşiresi',
  'Anestezi Uzmanı','Anestezi Teknisyeni',
  'Genel Cerrahi','Ortopedi','Göz Hastalıkları','KBB','Nöroşirürji','Üroloji','Kardiyoloji',
  'Sterilizasyon Sorumlusu','Sterilizasyon Teknisyeni',
  'Ameliyathane Personeli','Biyomedikal Mühendisi','Teknik Servis','Yardımcı Personel',
];

const COLORS = ['#DC2626','#EA580C','#059669','#0284C7','#7C3AED','#D97706','#be185d'];

export default function Personel() {
  const { personel, addPersonel, updatePersonel, deletePersonel } = useDataStore();
  const { showToast } = useUIStore();
  const { curRole } = useAuthStore();

  const [modal, setModal]   = useState(false);
  const [editId, setEditId] = useState(null);
  const [detay, setDetay]   = useState(null);
  const [arama, setArama]   = useState('');
  const [form, setForm]     = useState({ n:'', r:'Ameliyathane Sorumlu Hemşiresi', tel:'', email:'', sicil:'', s:'Aktif', not:'' });

  // DB'den gelen personeli orijinal formata normalize et
  function normalize(p) {
    return {
      id:    p.id,
      n:     p.ad || p.n || p.name || '',
      r:     p.specialty || p.rol || p.r || '',
      tel:   p.tel || p.phone || '',
      email: p.email || '',
      sicil: p.sicil || '',
      s:     p.durum || p.s || p.status || 'Aktif',
      not:   p.not || p.notes || '',
      av:    p.av || (p.ad||p.n||p.name||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase(),
      bg:    p.bg || '#0284C7',
      gun:   p.gun || 0,
    };
  }

  // Rol bazlı filtre — orijinal HTML mantığı
  function filtrele(list) {
    const sp = p => (normalize(p).r || '').toLowerCase();
    if (curRole === 1) return list.filter(p => (sp(p).includes('hem') || sp(p).includes('scrub') || sp(p).includes('servis hem') || sp(p).includes('ameliyathane sorumlu') || sp(p).includes('ameliyathane personeli') || sp(p).includes('yardımcı') || sp(p).includes('teknikeri')) && !sp(p).includes('steril') && !sp(p).includes('anestezi'));
    if (curRole === 2 || curRole === 3) return list.filter(p => sp(p).includes('anestezi'));
    if (curRole === 8 || curRole === 9) return list.filter(p => sp(p).includes('steril'));
    return list;
  }

  const normalizedPersonel = personel.map(normalize);

  const filtrelenmis = filtrele(normalizedPersonel);
  const sorumlu = filtrelenmis.filter(p => p.r.toLowerCase().includes('sorumlu'));
  const diger   = filtrelenmis.filter(p => !p.r.toLowerCase().includes('sorumlu'));
  const sirali  = [...sorumlu, ...diger];
  const gorunenPersonel = sirali.filter(p => {
    if (!arama) return true;
    const q = arama.toLowerCase();
    return p.n.toLowerCase().includes(q) || p.r.toLowerCase().includes(q) || (p.tel||'').includes(q);
  });

  function exportCSV() {
    const headers = ['Ad Soyad','Görev','Telefon','Email','Durum','Sicil'];
    const rows = gorunenPersonel.map(p => [p.n, p.r, p.tel, p.email, p.s, p.sicil]);
    const csv = [headers,...rows].map(r=>r.map(x=>'"'+String(x||'').replace(/"/g,'""')+'"').join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='personel.csv'; a.click();
    URL.revokeObjectURL(url);
    showToast('Personel listesi indirildi');
  }

  function openAdd() {
    setEditId(null);
    setForm({ n:'', r:'Ameliyathane Sorumlu Hemşiresi', tel:'', email:'', sicil:'', s:'Aktif', not:'' });
    setModal(true);
  }

  function openEdit(p) {
    setEditId(p.id);
    setForm({ n:p.n, r:p.r, tel:p.tel||'', email:p.email||'', sicil:p.sicil||'', s:p.s, not:p.not||'' });
    setModal(true);
  }

  async function kaydet() {
    if (!form.n.trim()) { showToast('Ad Soyad zorunludur'); return; }
    const av = form.n.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    const token = localStorage.getItem('operio_access');
    try {
      if (editId) {
        const res = await fetch(`http://localhost:4000/api/personel/${editId}`, {
          method:'PUT',
          headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
          body: JSON.stringify({ name:form.n, specialty:form.r, phone:form.tel, email:form.email, status:form.s }),
        });
        if (res.ok) {
          const guncellenen = await res.json();
          updatePersonel(editId, { ad:form.n, n:form.n, specialty:form.r, rol:form.r, r:form.r, tel:form.tel, phone:form.tel, email:form.email, durum:form.s, s:form.s, av });
          showToast('Personel güncellendi ✓');
        }
      } else {
        const res = await fetch('http://localhost:4000/api/personel', {
          method:'POST',
          headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
          body: JSON.stringify({ name:form.n, specialty:form.r, phone:form.tel, email:form.email, status:form.s, roleId:'role_1' }),
        });
        if (res.ok) {
          const yeni = await res.json();
          addPersonel({ ...yeni, ad:form.n, n:form.n, specialty:form.r, rol:form.r, r:form.r, tel:form.tel, email:form.email, durum:form.s, s:form.s, av, bg:COLORS[personel.length%COLORS.length], gun:0 });
          showToast('Personel eklendi ✓');
        } else {
          const err = await res.json();
          showToast(err.error || 'Hata oluştu');
          return;
        }
      }
    } catch(e) {
      showToast('Bağlantı hatası');
      return;
    }
    setModal(false);
  }

  async function sil(id) {
    if (!window.confirm('Bu personeli silmek istediğinize emin misiniz?')) return;
    const token = localStorage.getItem('operio_access');
    try {
      const res = await fetch(`http://localhost:4000/api/personel/${id}`, {
        method:'DELETE', headers:{'Authorization':`Bearer ${token}`}
      });
      if (res.ok) {
        deletePersonel(id);
        showToast('Personel silindi');
      }
    } catch(e) { showToast('Silme hatası'); }
  }

  return (
    <div>
      <div className="page-hd" style={{ marginBottom:16 }}>
        <div>
          <div className="page-hd-title">Personel Listesi</div>
          <div className="page-hd-sub">{gorunenPersonel.length} kayıtlı personel</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input className="fi" value={arama} onChange={e=>setArama(e.target.value)} placeholder="Ara..." style={{ width:160, fontSize:12 }}/>
          <button className="btn btn-secondary" onClick={exportCSV}>⬇ CSV</button>
          {(curRole === 0 || curRole === 1) && (
            <button className="btn btn-primary" onClick={openAdd}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width:13, height:13 }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Personel Ekle
            </button>
          )}
        </div>
      </div>

      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Ad Soyad</th>
              <th>Görev / Uzmanlık</th>
              <th>Telefon</th>
              <th>Durum</th>
              <th>Bu Ay</th>
              <th style={{ width:'1%', whiteSpace:'nowrap' }}>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {gorunenPersonel.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign:'center', padding:32, color:'var(--slate-light)' }}>Personel bulunamadı</td></tr>
            ) : gorunenPersonel.map(p => (
              <tr key={p.id} onClick={() => setDetay(p)} style={{ cursor:'pointer' }}>
                <td>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div className="avatar" style={{ background:p.bg, color:'white', width:30, height:30, fontSize:10, flexShrink:0 }}>{p.av}</div>
                    <span className="td-name">{p.n}</span>
                  </div>
                </td>
                <td>{p.r}</td>
                <td style={{ fontSize:'11.5px', color:'var(--slate-mid)' }}>{p.tel || '—'}</td>
                <td><span className={`tag ${p.s==='Aktif'?'t-green':p.s==='İzinde'?'t-orange':'t-gray'}`}>{p.s}</span></td>
                <td style={{ fontSize:12, fontWeight:600 }}>{p.gun} gün</td>
                <td onClick={e => e.stopPropagation()}>
                  <div style={{ display:'flex', gap:5, width:'fit-content' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>Düzenle</button>
                    <button className="btn btn-sm" style={{ background:'#FEF2F2', color:'#DC2626', border:'1px solid #FECACA' }} onClick={() => sil(p.id)}>Sil</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detay Drawer */}
      {detay && (
        <div style={{ position:'fixed', inset:0, zIndex:9998, display:'flex' }}>
          <div style={{ flex:1, background:'rgba(0,0,0,0.4)' }} onClick={() => setDetay(null)}/>
          <div style={{ width:360, background:'var(--card-bg)', height:'100%', overflowY:'auto', boxShadow:'-4px 0 24px rgba(0,0,0,0.15)', padding:24 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
              <div className="avatar" style={{ background:detay.bg, color:'white', width:48, height:48, fontSize:16, flexShrink:0 }}>{detay.av}</div>
              <div>
                <div style={{ fontSize:16, fontWeight:800, color:'var(--slate)' }}>{detay.n}</div>
                <div style={{ fontSize:12, color:'var(--slate-light)' }}>{detay.r}</div>
              </div>
              <button onClick={() => setDetay(null)} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'var(--slate-light)', fontSize:20 }}>✕</button>
            </div>
            {[['Telefon', detay.tel||'—'], ['Email', detay.email||'—'], ['Sicil', detay.sicil||'—'], ['Durum', detay.s], ['Bu Ay', detay.gun+' gün']].map(([k,v]) => (
              <div key={k} style={{ display:'flex', padding:'10px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
                <span style={{ color:'var(--slate-light)', width:100, flexShrink:0 }}>{k}</span>
                <span style={{ fontWeight:600, color:'var(--slate)' }}>{v}</span>
              </div>
            ))}
            {detay.not && (
              <div style={{ marginTop:12, padding:'12px 14px', background:'var(--surface)', borderRadius:10 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--slate-light)', marginBottom:4 }}>NOTLAR</div>
                <div style={{ fontSize:13, color:'var(--slate)' }}>{detay.not}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ekle/Düzenle Modal */}
      {modal && (
        <Modal onClose={() => setModal(false)}>
          <div style={{ padding:24, width:420 }}>
            <div style={{ fontSize:16, fontWeight:800, color:'var(--slate)', marginBottom:20 }}>
              {editId ? 'Personeli Düzenle' : 'Personel Ekle'}
            </div>
            <div className="fg" style={{ marginBottom:12 }}>
              <label className="fl">AD SOYAD *</label>
              <input className="fi" value={form.n} onChange={e=>setForm(p=>({...p,n:e.target.value}))} placeholder="Hem. Ayşe Korkmaz" autoFocus/>
            </div>
            <div className="fg" style={{ marginBottom:12 }}>
              <label className="fl">GÖREV / UZMANLIK *</label>
              <select className="fi" value={form.r} onChange={e=>setForm(p=>({...p,r:e.target.value}))}>
                {GOREVLER.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="fr" style={{ marginBottom:12 }}>
              <div className="fg">
                <label className="fl">TELEFON</label>
                <input className="fi" value={form.tel} onChange={e=>setForm(p=>({...p,tel:e.target.value}))} placeholder="0532 xxx xx xx"/>
              </div>
              <div className="fg">
                <label className="fl">EMAIL</label>
                <input className="fi" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} placeholder="ad@hastane.tr"/>
              </div>
            </div>
            <div className="fr" style={{ marginBottom:12 }}>
              <div className="fg">
                <label className="fl">SİCİL NO</label>
                <input className="fi" value={form.sicil} onChange={e=>setForm(p=>({...p,sicil:e.target.value}))}/>
              </div>
              <div className="fg">
                <label className="fl">DURUM</label>
                <select className="fi" value={form.s} onChange={e=>setForm(p=>({...p,s:e.target.value}))}>
                  <option>Aktif</option><option>İzinde</option><option>Pasif</option>
                </select>
              </div>
            </div>
            <div className="fg" style={{ marginBottom:20 }}>
              <label className="fl">NOT</label>
              <textarea className="fi" rows={2} value={form.not} onChange={e=>setForm(p=>({...p,not:e.target.value}))} style={{ resize:'none' }}/>
            </div>
            <div className="mf">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>İptal</button>
              <button className="btn btn-primary" onClick={kaydet}>{editId ? 'Güncelle' : 'Ekle'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
