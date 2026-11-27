import { useState, useEffect, useMemo } from 'react';
import { useAuthStore, useUIStore, useDataStore } from '../store';
import { listSurgeries } from '../services/surgeriesAdapter.js';

const BASE = 'http://localhost:4000/api';
const AV_RENKLER = ['#EA580C','#0284C7','#F59E0B','#7C3AED','#059669','#DC2626','#14B8A6'];
function avRenk(ad) { let h=0; for(let c of (ad||'')) h=(h*31+c.charCodeAt(0))&0xffff; return AV_RENKLER[h%AV_RENKLER.length]; }

const ST_RENK = {
  'dot-active': '#059669',
  'dot-wait':   '#D97706',
  'dot-done':   '#94A3B8',
  'dot-prep':   '#0284C7',
};
const ST_LBL = {
  'dot-active': 'Aktif',
  'dot-wait':   'Bekliyor',
  'dot-done':   'Tamamlandı',
  'dot-prep':   'Hazırlanıyor',
};


function EkipAv({ ad }) {
  if (!ad || ad === '—') {
    return <span style={{ fontSize:11, color:'var(--warning)', fontWeight:600 }}>Atanmadı</span>;
  }
  const av = ad.split(' ').filter(w => w.length > 1).map(w => w[0]).join('').substring(0, 2);
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      <div style={{ width:26, height:26, borderRadius:'50%', background:avRenk(ad), color:'white', fontSize:9, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        {av}
      </div>
      <span style={{ fontSize:12, color:'var(--slate)', fontWeight:500 }}>
        {ad.replace('Hem. ','').replace('Syl. ','').replace('Dr. ','')}
      </span>
    </div>
  );
}

function EkipSecGroup({ label, secilenKey, selected, onChange, listeler }) {

  return (
    <div style={{ marginBottom:16 }}>
      <label className="fl" style={{ marginBottom:8, display:'block' }}>{label}</label>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
        {/* Atanmadı seçeneği */}
        <div
          onClick={() => onChange(secilenKey, null)}
          style={{
            padding:'6px 12px', borderRadius:8, cursor:'pointer', fontSize:11.5,
            border: `1.5px solid ${!selected ? 'var(--teal)' : 'var(--border)'}`,
            background: !selected ? 'rgba(20,184,166,0.08)' : 'var(--surface)',
            color: !selected ? 'var(--teal)' : 'var(--slate-light)',
          }}>
          Atanmadı
        </div>
        {/* Hemşire seçenekleri */}
        {listeler.map(h => (
          <div
            key={h.ad}
            onClick={() => onChange(secilenKey, h.ad)}
            style={{
              display:'flex', alignItems:'center', gap:6,
              padding:'6px 12px', borderRadius:8, cursor:'pointer',
              border: `1.5px solid ${selected === h.ad ? 'var(--teal)' : 'var(--border)'}`,
              background: selected === h.ad ? 'rgba(20,184,166,0.08)' : 'var(--surface)',
              transition:'all 0.12s',
            }}>
            <div style={{ width:22, height:22, borderRadius:'50%', background:avRenk(h.ad), color:'white', fontSize:8, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              {h.ad.split(' ').filter(w=>w.length>1).map(w=>w[0]).join('').substring(0,2)}
            </div>
            <span style={{ fontSize:11.5, fontWeight:500, color: selected === h.ad ? 'var(--teal)' : 'var(--slate)' }}>
              {h.ad.replace('Hem. ','').replace('Syl. ','').replace('Dr. ','')}
            </span>
            {selected === h.ad && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EkipPlani() {
  const { curRole } = useAuthStore();
  const { showToast } = useUIStore();
  const { personel: personelStore } = useDataStore();

  const hemsireler = useMemo(() => (personelStore || [])
    .filter(p => p.aktif !== false)
    .filter(p => {
      const u = (p.uzmanlik || '').toLowerCase();
      return u.includes('hemşire') || u.includes('teknikeri') || u.includes('personel') || u === 'teknik servis';
    })
    .map(p => ({ ad: p.ad, uzmanlik: p.uzmanlik || '' })), [personelStore]);

  const anesteziler = useMemo(() => (personelStore || [])
    .filter(p => p.aktif !== false)
    .filter(p => (p.uzmanlik || '').toLowerCase().includes('anestezi teknisyeni'))
    .map(p => ({ ad: p.ad, uzmanlik: p.uzmanlik || '' })), [personelStore]);

  const [surgeries, setSurgeries]   = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [modalOpen, setModalOpen]   = useState(false);
  const [modalId, setModalId]       = useState(null);
  const [secilenEkip, setSecilenEkip] = useState({ scrub1:null, scrub2:null, sirkule:null, personel:null, anesteknik:null });

  useEffect(() => {
    const token = localStorage.getItem('operio_access');
    if (!token) { setYukleniyor(false); return; }
    listSurgeries()
      .then(list => setSurgeries(list))
      .catch(() => {})
      .finally(() => setYukleniyor(false));
  }, []);

  function openModal(id) {
    const s    = surgeries.find(x => x.id === id);
    if (!s) return;
    const ekip = s.ekip || {};
    setModalId(id);
    setSecilenEkip({
      scrub1:     ekip.scrub      || null,
      scrub2:     ekip.scrub2     || null,
      sirkule:    ekip.sirkule    || null,
      personel:   ekip.yardimci && ekip.yardimci !== '—' ? ekip.yardimci : null,
      anesteknik: ekip.anesteknik && ekip.anesteknik !== '—' ? ekip.anesteknik : null,
    });
    setModalOpen(true);
  }

  function handleChange(key, val) {
    setSecilenEkip(prev => ({ ...prev, [key]: val }));
  }

  async function saveEkip() {
    const s = surgeries.find(x => x.id === modalId);
    if (!s) return;
    const yeniEkip = {
      ...s.ekip,
      scrub:      secilenEkip.scrub1     || '—',
      scrub2:     secilenEkip.scrub2     || '—',
      sirkule:    secilenEkip.sirkule    || '—',
      yardimci:   secilenEkip.personel   || '—',
      anesteknik: secilenEkip.anesteknik || '—',
    };

    // Optimistic local update
    setSurgeries(prev => prev.map(x => x.id === modalId ? { ...x, ekip: yeniEkip } : x));
    setModalOpen(false);
    showToast('Ekip ataması kaydedildi ✓');

    // DB'ye kaydet
    const token = localStorage.getItem('operio_access');
    try {
      await fetch(`${BASE}/ameliyatlar/${modalId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ekip: yeniEkip }),
      });
    } catch (_) {}
  }

  const modalSurgery = modalId ? surgeries.find(x => x.id === modalId) : null;

  return (
    <div>
      {/* Başlık */}
      <div className="page-hd" style={{ marginBottom:18 }}>
        <div>
          <div className="page-hd-title">Ameliyat Planı</div>
          <div className="page-hd-sub">
            {surgeries.length} ameliyat · Hemşire & Ekip Atamaları
          </div>
        </div>
      </div>

      {/* Tablo */}
      <div className="panel" style={{ overflowX:'auto' }}>
        {yukleniyor ? (
          <div className="empty" style={{ padding:'40px 20px' }}>
            <div className="empty-text" style={{ color:'var(--slate-light)' }}>Yükleniyor...</div>
          </div>
        ) : surgeries.length === 0 ? (
          <div className="empty" style={{ padding:'40px 20px' }}>
            <div className="empty-text">Ameliyat bulunamadı</div>
          </div>
        ) : (
        <table className="data-table" style={{ minWidth:1100 }}>
          <thead>
            <tr>
              <th>Saat</th>
              <th>Ameliyat</th>
              <th>Cerrah</th>
              <th>Salon</th>
              <th>Scrub Hemşire 1</th>
              <th>Scrub Hemşire 2</th>
              <th>Sirküle Hemşire</th>
              <th>Amel. Personeli</th>
              <th>Durum</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {surgeries.map((s) => {
              const renk       = ST_RENK[s.st] || '#94A3B8';
              const ekip       = s.ekip || {};
              const scrub1     = ekip.scrub    || null;
              const scrub2     = ekip.scrub2   || null;
              const sirkule    = ekip.sirkule  || null;
              const personel   = ekip.yardimci && ekip.yardimci !== '—' ? ekip.yardimci : null;
              const ekipAtandi = scrub1 || scrub2 || sirkule || personel;

              return (
                <tr key={s.id}>
                  {/* Saat */}
                  <td>
                    <div style={{ fontSize:14, fontWeight:800, color:'var(--slate)', fontFamily:"'Outfit',sans-serif" }}>
                      {s.saat}
                    </div>
                    <div style={{ fontSize:'10.5px', color:'var(--slate-light)' }}>{s.bitis}</div>
                  </td>

                  {/* Ameliyat */}
                  <td>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--slate)' }}>{s.op}</div>
                    <div style={{ fontSize:11, color:'var(--slate-light)', marginTop:2 }}>{s.hasta}</div>
                  </td>

                  {/* Cerrah */}
                  <td style={{ fontSize:13, color:'var(--slate-mid)' }}>{s.dr}</td>

                  {/* Salon */}
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background:renk, flexShrink:0 }}/>
                      <span style={{ fontSize:13, fontWeight:600, color:'var(--slate)' }}>{s.salon}</span>
                    </div>
                  </td>

                  {/* Ekip */}
                  <td><EkipAv ad={scrub1}/></td>
                  <td><EkipAv ad={scrub2}/></td>
                  <td><EkipAv ad={sirkule}/></td>
                  <td><EkipAv ad={personel}/></td>

                  {/* Durum */}
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background:renk, boxShadow:`0 0 0 3px ${renk}25`, flexShrink:0 }}/>
                      <span style={{ fontSize:'12.5px', fontWeight:600, color:renk }}>
                        {ST_LBL[s.st] || s.st}
                      </span>
                    </div>
                  </td>

                  {/* Ekip Ata butonu */}
                  <td>
                    <button
                      className={`btn ${ekipAtandi ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                      onClick={() => openModal(s.id)}
                      style={{ whiteSpace:'nowrap' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:12, height:12 }}>
                        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                      </svg>
                      {ekipAtandi ? 'Ekibi Değiştir' : 'Ekip Ata'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        )}
      </div>

      {/* Ekip Atama Modal */}
      {modalOpen && modalSurgery && (
        <div className="modal-bg open" onClick={() => setModalOpen(false)}>
          <div className="modal" style={{ width:580, maxWidth:'92vw' }} onClick={e => e.stopPropagation()}>

            {/* Modal başlık */}
            <div style={{ marginBottom:20 }}>
              <div className="modal-title" style={{ marginBottom:4 }}>
                {modalSurgery.op} — Ekip Ataması
              </div>
              <div style={{ fontSize:'11.5px', color:'var(--slate-light)' }}>
                {modalSurgery.saat}–{modalSurgery.bitis} · {modalSurgery.salon} · {modalSurgery.dr}
              </div>
            </div>

            {/* Seçim grupları */}
            {curRole !== 2 && <>
              <EkipSecGroup label="Scrub Hemşire 1"        secilenKey="scrub1"   selected={secilenEkip.scrub1}   onChange={handleChange} listeler={hemsireler} />
              <EkipSecGroup label="Scrub Hemşire 2"        secilenKey="scrub2"   selected={secilenEkip.scrub2}   onChange={handleChange} listeler={hemsireler} />
              <EkipSecGroup label="Sirküle Hemşire"        secilenKey="sirkule"  selected={secilenEkip.sirkule}  onChange={handleChange} listeler={hemsireler} />
              <EkipSecGroup label="Ameliyathane Personeli" secilenKey="personel" selected={secilenEkip.personel} onChange={handleChange} listeler={hemsireler} />
            </>}
            {curRole === 2 && (
              <EkipSecGroup label="Anestezi Teknisyeni" secilenKey="anesteknik" selected={secilenEkip.anesteknik} onChange={handleChange} listeler={anesteziler} />
            )}

            {/* Butonlar */}
            <div className="mf">
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>İptal</button>
              <button className="btn btn-primary"   onClick={saveEkip}>Ekip Atamasını Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
