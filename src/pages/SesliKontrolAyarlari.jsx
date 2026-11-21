import { useState, useEffect } from 'react';
import { useDataStore, useUIStore } from '../store';
import { deviceAPI } from '../services/api.js';

// deviceGroup enum — backend validators/schemas.js deviceCreateSchema ile birebir.
const GROUP_OPTIONS = [
  { value: 'electrosurgery',    label: 'Elektrocerrahi' },
  { value: 'endoscopy_imaging', label: 'Endoskopi / Görüntüleme' },
  { value: 'light',             label: 'Aydınlatma' },
  { value: 'table',             label: 'Ameliyat Masası' },
];

// Şu an backend registry.js'te kayıtlı tek sürücü 'mock'; yeni sürücüler eklendiğinde
// buraya eklenir. Cihazın mevcut driver_key'i listede yoksa seçenek olarak eklenir —
// select kendiliğinden bilinmeyen bir değere geçip cihazı bozmasın.
const KNOWN_DRIVERS = ['mock'];

const EMPTY_FORM = { name: '', deviceGroup: 'electrosurgery', deviceType: '', roomId: '', requiresPhysicalConfirm: false };

function groupLabel(group) {
  return GROUP_OPTIONS.find(o => o.value === group)?.label || group || '—';
}

export default function SesliKontrolAyarlari() {
  const { rooms } = useDataStore();
  const { showToast } = useUIStore();

  const [devices, setDevices]       = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [pending, setPending]       = useState({});
  const [form, setForm]             = useState(EMPTY_FORM);
  const [creating, setCreating]     = useState(false);

  useEffect(() => {
    deviceAPI.list()
      .then(list => setDevices(Array.isArray(list) ? list : []))
      .catch(() => showToast('Cihaz listesi alınamadı'))
      .finally(() => setYukleniyor(false));
  }, []);

  function setBusy(id, busy) {
    setPending(p => ({ ...p, [id]: busy }));
  }

  async function changeConfig(id, patch) {
    setBusy(id, true);
    try {
      const updated = await deviceAPI.updateConfig(id, patch);
      setDevices(prev => prev.map(d => d.id === id ? { ...d, ...updated } : d));
    } catch (e) {
      showToast('Cihaz ayarı güncellenemedi: ' + (e?.message || ''));
    } finally {
      setBusy(id, false);
    }
  }

  function changeMode(id, mode)     { changeConfig(id, { mode }); }
  function changeDriver(id, driverKey) { changeConfig(id, { driverKey }); }

  function f(k, v) { setForm(p => ({ ...p, [k]: v })); }

  async function createDevice(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.deviceType.trim()) {
      showToast('Cihaz adı ve tipi zorunlu');
      return;
    }
    setCreating(true);
    try {
      const body = {
        name: form.name.trim(),
        deviceGroup: form.deviceGroup,
        deviceType: form.deviceType.trim(),
        requiresPhysicalConfirm: form.requiresPhysicalConfirm,
      };
      if (form.roomId) body.roomId = form.roomId;
      const created = await deviceAPI.create(body);
      setDevices(prev => [...prev, created]);
      setForm(EMPTY_FORM);
      showToast('Cihaz eklendi ✓');
    } catch (e) {
      showToast('Cihaz eklenemedi: ' + (e?.message || ''));
    } finally {
      setCreating(false);
    }
  }

  function roomLabel(roomId) {
    const r = rooms.find(x => x.id === roomId);
    return r ? (r.ad || r.name) : '—';
  }

  return (
    <div>
      {/* Başlık */}
      <div className="page-hd" style={{ marginBottom: 16 }}>
        <div>
          <div className="page-hd-title">Sesli Kontrol Ayarları</div>
          <div className="page-hd-sub">
            {yukleniyor ? 'Yükleniyor…' : `${devices.length} cihaz tanımlı`}
          </div>
        </div>
      </div>

      {/* Cihaz tanımlama formu */}
      <div className="panel" style={{ marginBottom: 20, padding: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate)', marginBottom: 12 }}>
          Yeni Cihaz Ekle
        </div>
        <form onSubmit={createDevice}>
          <div className="fr" style={{ marginBottom: 12 }}>
            <div className="fg">
              <label className="fl" htmlFor="sk-name">Cihaz Adı</label>
              <input id="sk-name" className="fi" value={form.name} onChange={e => f('name', e.target.value)} placeholder="Elektrokoter 2" />
            </div>
            <div className="fg">
              <label className="fl" htmlFor="sk-group">Cihaz Grubu</label>
              <select id="sk-group" className="fi" value={form.deviceGroup} onChange={e => f('deviceGroup', e.target.value)}>
                {GROUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="fr" style={{ marginBottom: 12 }}>
            <div className="fg">
              <label className="fl" htmlFor="sk-type">Cihaz Tipi</label>
              <input id="sk-type" className="fi" value={form.deviceType} onChange={e => f('deviceType', e.target.value)} placeholder="cautery, or_light, …" />
            </div>
            <div className="fg">
              <label className="fl" htmlFor="sk-room">Salon</label>
              <select id="sk-room" className="fi" value={form.roomId} onChange={e => f('roomId', e.target.value)}>
                <option value="">Salon seçilmedi</option>
                {rooms.map(r => <option key={r.id} value={r.id}>{r.ad || r.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
            <input
              id="sk-physical-confirm"
              type="checkbox"
              checked={form.requiresPhysicalConfirm}
              onChange={e => f('requiresPhysicalConfirm', e.target.checked)}
              style={{ width: 15, height: 15, accentColor: 'var(--danger)', cursor: 'pointer' }}
            />
            <label htmlFor="sk-physical-confirm" style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate)', cursor: 'pointer' }}>
              Fiziksel onay gerektirir
            </label>
          </div>
          <div className="mf" style={{ justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? 'Ekleniyor…' : '+ Cihaz Ekle'}
            </button>
          </div>
        </form>
      </div>

      {/* Cihaz listesi */}
      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Cihaz</th>
              <th>Grup</th>
              <th>Salon</th>
              <th>Fiziksel Onay</th>
              <th>Sürücü</th>
              <th>Mod</th>
            </tr>
          </thead>
          <tbody>
            {devices.map(d => {
              const busy = !!pending[d.id];
              const driverValue = d.driver_key || 'mock';
              const driverOptions = KNOWN_DRIVERS.includes(driverValue)
                ? KNOWN_DRIVERS
                : [...KNOWN_DRIVERS, driverValue];
              return (
                <tr key={d.id}>
                  <td style={{ fontWeight: 700, fontSize: 13, color: 'var(--slate)' }}>{d.name}</td>
                  <td style={{ fontSize: 12, color: 'var(--slate-mid)' }}>{groupLabel(d.device_group)}</td>
                  <td style={{ fontSize: 12, color: 'var(--slate-mid)' }}>{roomLabel(d.room_id)}</td>
                  <td style={{ fontSize: 12, color: 'var(--slate-mid)' }}>{d.requires_physical_confirm ? 'Evet' : 'Hayır'}</td>
                  <td>
                    <select
                      aria-label={`${d.name} sürücü`}
                      className="fi"
                      value={driverValue}
                      disabled={busy}
                      onChange={e => changeDriver(d.id, e.target.value)}
                      style={{ fontSize: '11.5px', padding: '5px 8px' }}
                    >
                      {driverOptions.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </td>
                  <td>
                    <select
                      aria-label={`${d.name} mod`}
                      className="fi"
                      value={d.mode || 'SIM'}
                      disabled={busy}
                      onChange={e => changeMode(d.id, e.target.value)}
                      style={{ fontSize: '11.5px', padding: '5px 8px' }}
                    >
                      <option value="SIM">SIM</option>
                      <option value="REAL">REAL</option>
                    </select>
                  </td>
                </tr>
              );
            })}

            {!yukleniyor && devices.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '24px 10px', color: 'var(--slate-light)', fontSize: 12, textAlign: 'center' }}>
                  Tanımlı cihaz bulunamadı
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
