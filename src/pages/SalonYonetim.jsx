import { useState, useEffect } from 'react';
import { useAuthStore, useUIStore } from '../store';
import Modal from '../components/ui/Modal';
import { listSurgeries } from '../services/surgeriesAdapter';

const BASE = 'http://localhost:4000/api';

const SALON_CFG = {
  active:      { cls:'st-active',      dot:'#059669', txt:'Ameliyatta',  shadow:'0 0 0 3px rgba(5,150,105,0.15)'   },
  idle:        { cls:'st-idle',        dot:'#94A3B8', txt:'Boşta',       shadow:''                                  },
  reserved:    { cls:'st-reserved',    dot:'#7C3AED', txt:'Rezerve',     shadow:'0 0 0 3px rgba(124,58,237,0.12)'  },
  maintenance: { cls:'st-maintenance', dot:'#D97706', txt:'Bakımda',     shadow:''                                  },
  closed:      { cls:'st-closed',      dot:'#DC2626', txt:'Kapalı',      shadow:''                                  },
};

// DB status (backend #1 roomStatusSchema enum) → UI key
// NOT: Dosyada eskiden Türkçe DB değerleri ('Bos','Aktif',...) varsaydı; gerçek
// backend roomStatusSchema'sı 'ACTIVE'|'IDLE'|'RESERVED'|'MAINTENANCE'|'CLOSED'
// enum'unu kullanıyor (bkz. schemas.js) — bu yüzden her iki eşleme tablosu da
// gerçek enum değerlerine güncellendi (Task 6).
const DB_TO_UI = { 'IDLE':'idle', 'ACTIVE':'active', 'RESERVED':'reserved', 'MAINTENANCE':'maintenance', 'CLOSED':'closed' };
// UI key → DB status enum
const UI_TO_DB = { idle:'IDLE', active:'ACTIVE', reserved:'RESERVED', maintenance:'MAINTENANCE', closed:'CLOSED' };

function roomNumSort(name) {
  const m = name.match(/\d+/);
  return m ? parseInt(m[0]) : 999;
}

// NOT: Brief/plan bu okumanın "ham backend alanları" (room.name/status/type/startTime)
// üzerinden yapıldığını varsaymıştı. Gerçek dosyada eski kod zaten (artık var
// olmayan) `/ameliyatlar` ucundan ham veri bekliyordu; `listSurgeries()` ise
// Task 1'in adapter'ından Türkçe anahtarlı (`salon`,`durum`,`op`,`saat`) şekilde
// dönüyor — bu yüzden eşleşme alanları buna göre güncellendi (Task 2'nin
// Sidebar.jsx/Istatistik.jsx'te yaptığı düzeltmeyle aynı tür ayarlama).
function dbRoomToSalon(r, surgeries) {
  const uiStatus = DB_TO_UI[r.status] || 'idle';
  const aktifAmeliyat = surgeries.find(s => s.salon === r.name && s.durum === 'Devam Ediyor');
  const bekleyenAmeliyat = surgeries.find(s => s.salon === r.name && s.durum === 'Bekliyor');
  let op = '—';
  if (aktifAmeliyat) op = aktifAmeliyat.op || 'Ameliyat devam ediyor';
  else if (bekleyenAmeliyat) op = `Sıradaki: ${bekleyenAmeliyat.saat || ''} ${bekleyenAmeliyat.op || ''}`.trim();
  return {
    id: r.id, num: r.name.replace('Salon ', ''), name: r.name,
    status: aktifAmeliyat ? 'active' : uiStatus,
    op, cap: r.capacity || 6, equip: 0,
  };
}

export default function SalonYonetim() {
  const { curRole } = useAuthStore();
  const { showToast } = useUIStore();
  const token = localStorage.getItem('operio_access');
  const h = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };

  const [salons, setSalons] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [openDrop, setOpenDrop] = useState(null);
  const [modal, setModal] = useState(null);
  const [rezModal, setRezModal] = useState(null);
  const [form, setForm] = useState({ num:'', name:'', status:'idle', cap:6, equip:8 });
  const f = (k,v) => setForm(p=>({...p,[k]:v}));

  const canManage = curRole === 0 || curRole === 1;

  // DB'den yükle
  useEffect(() => {
    Promise.all([
      fetch(`${BASE}/rooms`, { headers: h }).then(r => r.ok ? r.json() : []),
      listSurgeries(),
    ]).then(([rooms, ameliyatlar]) => {
      const mapped = rooms
        .map(r => dbRoomToSalon(r, ameliyatlar))
        .sort((a, b) => roomNumSort(a.name) - roomNumSort(b.name));
      setSalons(mapped);
    }).catch(() => {}).finally(() => setYukleniyor(false));
  }, []);

  const aktivSalonlar = salons;
  const aktif   = salons.filter(s => s.status === 'active').length;
  const bos     = salons.filter(s => s.status === 'idle').length;
  const rezerve = salons.filter(s => s.status === 'reserved').length;
  const bakim   = salons.filter(s => s.status === 'maintenance' || s.status === 'closed').length;

  // Dışa tıklayınca dropdown kapat
  useEffect(() => {
    function handler(e) { if (!e.target.closest('.sc2-menu-btn') && !e.target.closest('.sc2-dropdown')) setOpenDrop(null); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function openSalonModal(s=null) {
    if (s) { setForm({ num:s.num, name:s.name, status:s.status, cap:s.cap, equip:s.equip }); setModal(s); }
    else   { setForm({ num:'', name:'', status:'idle', cap:6, equip:8 }); setModal('yeni'); }
    setOpenDrop(null);
  }

  async function saveSalon() {
    if (modal === 'yeni') {
      // Gerçek backend #1 uç noktası: POST /api/rooms (roomCreateSchema).
      // roomNumber/capacity backend'de z.number() — form alanları string
      // geldiği için Number(...) dönüşümü şart, aksi halde 400 döner.
      try {
        const res = await fetch(`${BASE}/rooms`, {
          method: 'POST', headers: h,
          body: JSON.stringify({
            name:       form.name,
            roomNumber: Number(form.num),
            capacity:   Number(form.cap) || 6,
          }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          showToast(json?.error?.message || 'Salon eklenemedi');
          return;
        }
        // Savunmacı kontrol: beklenmeyen/şekli bozuk bir "success" yanıtı
        // (örn. salon nesnesi yerine başka bir şey) sayfayı çökertmesin.
        const created = json.data;
        if (created && typeof created === 'object' && !Array.isArray(created) && created.name) {
          setSalons(p => [...p, dbRoomToSalon(created, [])]
            .sort((a, b) => roomNumSort(a.name) - roomNumSort(b.name)));
        }
        showToast('Salon eklendi ✓');
      } catch (_) {
        showToast('Salon eklenemedi');
        return;
      }
    } else {
      // Durum değişikliği — gerçek backend #1 uç noktası:
      // PATCH /api/rooms/:id/status (roomStatusSchema), body sadece {status}.
      const dbStatus = UI_TO_DB[form.status] || 'IDLE';
      try {
        const res = await fetch(`${BASE}/rooms/${modal.id}/status`, {
          method: 'PATCH', headers: h,
          body: JSON.stringify({ status: dbStatus }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          showToast(json?.error?.message || 'Salon güncellenemedi');
          return;
        }
        setSalons(p => p.map(s => s.id === modal.id
          ? { ...s, status: form.status, cap: Number(form.cap) }
          : s
        ));
        showToast('Salon güncellendi ✓');
      } catch (_) {
        showToast('Salon güncellenemedi');
        return;
      }
    }
    setModal(null);
  }

  async function changeStatus(id, newStatus) {
    const prev = aktivSalonlar.find(s => s.id === id);
    const dbStatus = UI_TO_DB[newStatus] || 'IDLE';
    setSalons(p => p.map(s => s.id === id ? { ...s, status: newStatus } : s));
    setOpenDrop(null);
    try {
      const res = await fetch(`${BASE}/rooms/${id}/status`, {
        method: 'PATCH', headers: h,
        body: JSON.stringify({ status: dbStatus }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        if (prev) setSalons(p => p.map(s => s.id === id ? { ...s, status: prev.status } : s));
        showToast(json?.error?.message || 'Salon durumu güncellenemedi');
        return;
      }
      showToast('Salon durumu güncellendi');
    } catch (_) {
      if (prev) setSalons(p => p.map(s => s.id === id ? { ...s, status: prev.status } : s));
      showToast('Salon durumu güncellenemedi');
    }
  }

  function deleteSalon(id) {
    const s = aktivSalonlar.find(x => x.id === id);
    if (s && (s.status === 'active' || s.status === 'maintenance')) { showToast('Aktif/bakımdaki salon silinemez'); return; }
    setSalons(p => p.filter(x => x.id !== id));
    showToast('Salon silindi');
    setOpenDrop(null);
  }

  return (
    <div>
      {/* Başlık */}
      <div className="page-hd" style={{ marginBottom:16 }}>
        <div>
          <div className="page-hd-title">Salon Yönetimi</div>
          <div className="page-hd-sub">
            {aktivSalonlar.length} salon kayıtlı — {aktif} aktif{bakim ? `, ${bakim} bakımda` : ''}{rezerve ? `, ${rezerve} rezerve` : ''}
          </div>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => openSalonModal()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:13,height:13}}>
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Salon Ekle
          </button>
        )}
      </div>

      {/* Stat row */}
      <div className="salon-stat-row">
        <div className="salon-stat">
          <div className="salon-stat-icon si-teal">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <div>
            <div className="salon-stat-val">{aktif}</div>
            <div className="salon-stat-lbl">Aktif Ameliyatta</div>
          </div>
        </div>
        <div className="salon-stat">
          <div className="salon-stat-icon si-blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div>
            <div className="salon-stat-val">{bos}</div>
            <div className="salon-stat-lbl">Boşta</div>
          </div>
        </div>
        <div className="salon-stat">
          <div className="salon-stat-icon si-purple">
            <svg viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div>
            <div className="salon-stat-val">{rezerve}</div>
            <div className="salon-stat-lbl">Rezerve</div>
          </div>
        </div>
        <div className="salon-stat">
          <div className="salon-stat-icon si-orange">
            <svg viewBox="0 0 24 24" fill="none" stroke="#EA580C" strokeWidth="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
          </div>
          <div>
            <div className="salon-stat-val">{bakim}</div>
            <div className="salon-stat-lbl">Bakım / Kapalı</div>
          </div>
        </div>
      </div>

      {/* Salon grid */}
      <div className="salon-view-grid">
        {aktivSalonlar.map(s => {
          const cfg = SALON_CFG[s.status] || SALON_CFG.idle;
          return (
            <div key={s.id} className={`salon-card-v2 ${cfg.cls}`}>
              <div className="sc2-top">
                <div className="sc2-num">{s.num}</div>
                {canManage && (
                  <div style={{ position:'relative' }}>
                    <div className="sc2-menu-btn" onClick={e => { e.stopPropagation(); setOpenDrop(openDrop === s.id ? null : s.id); }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--slate-light)" strokeWidth="2">
                        <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
                      </svg>
                    </div>
                    <div className={`sc2-dropdown${openDrop === s.id ? ' open' : ''}`}>
                      <div className="sc2-ditem" onClick={() => openSalonModal(s)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Düzenle
                      </div>
                      <div className="sc2-ditem" onClick={() => { setRezModal(s); setOpenDrop(null); }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        Rezerve Et
                      </div>
                      <div className="sc2-ditem" onClick={() => changeStatus(s.id, 'idle')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        Boşta Olarak İşaretle
                      </div>
                      <div className="sc2-ditem" onClick={() => changeStatus(s.id, 'maintenance')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
                        Bakıma Al
                      </div>
                      <div className="sc2-sep"/>
                      <div className="sc2-ditem d-danger" onClick={() => deleteSalon(s.id)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                        Salonu Sil
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="sc2-body">
                <div className="sc2-name">{s.name}</div>
                <div className="sc2-status">
                  <div className="sc2-dot" style={{ background:cfg.dot, boxShadow:cfg.shadow||'' }}/>
                  <span className="sc2-stxt" style={{ color:cfg.dot }}>{cfg.txt}</span>
                </div>
                <div className="sc2-op">{s.op}</div>
              </div>

              <div className="sc2-footer">
                <span className="sc2-cap">👤 {s.cap} Kişi · 🖥 {s.equip} Cihaz</span>
                <div className="sc2-actions">
                  {canManage && s.status === 'idle' && (
                    <button className="sc2-btn purple" onClick={() => { setRezModal(s); setOpenDrop(null); }}>Rezerve</button>
                  )}
                  {canManage && s.status !== 'active' && s.status !== 'maintenance' && (
                    <button className="sc2-btn danger" onClick={() => deleteSalon(s.id)}>Sil</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Ekle kartı */}
        {canManage && (
          <div className="sc2-add" onClick={() => openSalonModal()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span style={{ fontSize:12, fontWeight:600 }}>Yeni Salon Ekle</span>
          </div>
        )}
      </div>

      {/* Salon ekle/düzenle modal */}
      {modal && (
        <Modal title={modal === 'yeni' ? 'Yeni Salon Ekle' : 'Salonu Düzenle'} onClose={() => setModal(null)} width={440}>
          <div className="fr" style={{ marginBottom:12 }}>
            <div className="fg"><label className="fl">Salon No</label><input className="fi" value={form.num} onChange={e=>f('num',e.target.value)} placeholder="1"/></div>
            <div className="fg"><label className="fl">Salon Adı</label><input className="fi" value={form.name} onChange={e=>f('name',e.target.value)} placeholder="Genel Cerrahi Salonu" autoFocus/></div>
          </div>
          <div className="fr" style={{ marginBottom:12 }}>
            <div className="fg">
              <label className="fl">Durum</label>
              <select className="fi" value={form.status} onChange={e=>f('status',e.target.value)}>
                <option value="active">Ameliyatta</option>
                <option value="idle">Boşta</option>
                <option value="reserved">Rezerve</option>
                <option value="maintenance">Bakımda</option>
                <option value="closed">Kapalı</option>
              </select>
            </div>
            <div className="fg"><label className="fl">Kapasite</label><input className="fi" type="number" value={form.cap} onChange={e=>f('cap',e.target.value)} min="1"/></div>
            <div className="fg"><label className="fl">Cihaz Sayısı</label><input className="fi" type="number" value={form.equip} onChange={e=>f('equip',e.target.value)} min="0"/></div>
          </div>
          <div className="mf">
            <button className="btn btn-secondary" onClick={() => setModal(null)}>İptal</button>
            <button className="btn btn-primary" onClick={saveSalon}>{modal === 'yeni' ? 'Ekle' : 'Güncelle'}</button>
          </div>
        </Modal>
      )}

      {/* Rezerve modal */}
      {rezModal && (
        <Modal title={`Rezerve Et — Salon ${rezModal.num}`} onClose={() => setRezModal(null)} width={400}>
          <div style={{ background:'var(--surface)', borderRadius:10, padding:'11px 14px', marginBottom:14, fontSize:'12.5px', fontWeight:600, color:'var(--slate)' }}>
            Salon {rezModal.num} — {rezModal.name}
          </div>
          <div className="fr" style={{ marginBottom:12 }}>
            <div className="fg"><label className="fl">Başlangıç Tarihi</label><input className="fi" type="date" defaultValue={new Date().toISOString().split('T')[0]}/></div>
            <div className="fg"><label className="fl">Bitiş Tarihi</label><input className="fi" type="date" defaultValue={new Date().toISOString().split('T')[0]}/></div>
          </div>
          <div className="fg" style={{ marginBottom:14 }}>
            <label className="fl">Rezervasyon Notu</label>
            <input className="fi" placeholder="Eğitim programı, bakım, vb."/>
          </div>
          <div className="mf">
            <button className="btn btn-secondary" onClick={() => setRezModal(null)}>İptal</button>
            <button className="btn btn-primary" onClick={() => {
              changeStatus(rezModal.id, 'reserved');
              showToast(`Salon ${rezModal.num} rezerve edildi ✓`);
              setRezModal(null);
            }}>Rezerve Et</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
