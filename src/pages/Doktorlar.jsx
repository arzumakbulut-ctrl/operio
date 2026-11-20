import { useState } from 'react';
import { useUIStore, useDataStore } from '../store';
import Modal from '../components/ui/Modal';

const GOREVLER = ['Genel Cerrahi','Ortopedi','Kardiyoloji','Nöroloji','Anesteziyoloji','Hemşire','Ameliyathane Teknikeri','Anestezi Tek.','Sterilizasyon'];
const DURUMLAR = ['Aktif','İzinde','Pasif'];
const AV_COLORS = ['#DC2626','#EA580C','#059669','#0284C7','#7C3AED','#D97706'];

export default function Doktorlar() {
  const { showToast } = useUIStore();
  const { personel: storePersonel } = useDataStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [viewP, setViewP] = useState(null);

  const personel = storePersonel.map((p, i) => ({
    ...p,
    n:  p.ad || p.n || '',
    bg: AV_COLORS[i % AV_COLORS.length],
  }));

  function openModal(id) {
    setViewP(personel.find(x => x.id === id) || null);
    setModalOpen(true);
  }

  return (
    <>
      <div className="page-hd" style={{ marginBottom:16 }}>
        <div>
          <div className="page-hd-title">Doktor & Personel Yönetimi</div>
          <div className="page-hd-sub">{personel.length} kayıtlı personel</div>
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
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {personel.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign:'center', color:'var(--slate-light)', padding:32 }}>Yükleniyor…</td></tr>
            ) : personel.map(p => (
              <tr key={p.id}>
                <td>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div className="avatar" style={{ background:p.bg, color:'white', width:30, height:30, fontSize:10, flexShrink:0 }}>{p.av}</div>
                    <span className="td-name">{p.n}</span>
                  </div>
                </td>
                <td>{p.r || p.rol || '—'}</td>
                <td style={{ fontSize:'11.5px', color:'var(--slate-mid)' }}>{p.tel || '—'}</td>
                <td>
                  <span className={`tag ${p.s === 'Aktif' ? 't-green' : p.s === 'İzinde' ? 't-orange' : 't-gray'}`}>{p.s || 'Aktif'}</span>
                </td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => openModal(p.id)}>Detay</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && viewP && (
        <Modal title="Personel Detayı" onClose={() => setModalOpen(false)}>
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:18 }}>
            <div className="avatar" style={{ background:viewP.bg, color:'white', width:48, height:48, fontSize:16 }}>{viewP.av}</div>
            <div>
              <div style={{ fontSize:16, fontWeight:700, color:'var(--slate)' }}>{viewP.n}</div>
              <div style={{ fontSize:12, color:'var(--slate-light)' }}>{viewP.r || viewP.rol || '—'}</div>
            </div>
          </div>
          <div className="fr" style={{ marginBottom:8 }}>
            <div className="fg"><label className="fl">Telefon</label><input className="fi" value={viewP.tel || ''} readOnly/></div>
            <div className="fg"><label className="fl">E-posta</label><input className="fi" value={viewP.email || ''} readOnly/></div>
          </div>
          <div className="fr" style={{ marginBottom:8 }}>
            <div className="fg"><label className="fl">Uzmanlık</label><input className="fi" value={viewP.uzmanlik || viewP.r || ''} readOnly/></div>
            <div className="fg"><label className="fl">Durum</label><input className="fi" value={viewP.s || 'Aktif'} readOnly/></div>
          </div>
          <div style={{ padding:'10px 14px', background:'var(--surface)', borderRadius:8, fontSize:11.5, color:'var(--slate-light)', marginBottom:14 }}>
            Personel bilgileri DB üzerinden yönetilmektedir.
          </div>
          <div className="mf">
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Kapat</button>
          </div>
        </Modal>
      )}
    </>
  );
}
