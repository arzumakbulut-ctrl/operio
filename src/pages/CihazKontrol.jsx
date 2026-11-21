import { useState, useEffect } from 'react';
import { useUIStore } from '../store';
import { deviceAPI } from '../services/api.js';

const GROUP_LABELS = {
  electrosurgery: 'Elektrocerrahi',
  anesthesia:     'Anestezi',
  lighting:       'Aydınlatma',
  imaging:        'Görüntüleme',
  table:          'Ameliyat Masası',
};

function groupLabel(group) {
  return GROUP_LABELS[group] || group || 'Genel';
}

export default function CihazKontrol() {
  const { showToast } = useUIStore();

  const [devices, setDevices]   = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [pending, setPending]   = useState({});

  useEffect(() => {
    deviceAPI.list()
      .then(list => setDevices(Array.isArray(list) ? list : []))
      .catch(() => showToast('Cihaz listesi alınamadı'))
      .finally(() => setYukleniyor(false));
  }, []);

  function setBusy(id, busy) {
    setPending(p => ({ ...p, [id]: busy }));
  }

  async function sendCommand(id, body) {
    setBusy(id, true);
    try {
      const updated = await deviceAPI.command(id, body);
      setDevices(prev => prev.map(d => d.id === id ? { ...d, ...updated } : d));
    } catch (e) {
      showToast('Cihaz komutu gönderilemedi: ' + (e?.message || ''));
    } finally {
      setBusy(id, false);
    }
  }

  function turnOn(id)  { sendCommand(id, { action: 'turn_on' }); }
  function turnOff(id) { sendCommand(id, { action: 'turn_off' }); }
  function setPowerLevel(id, level) { sendCommand(id, { action: 'set_power', power_level: Number(level) }); }

  async function physicalConfirm(id) {
    setBusy(id, true);
    try {
      const updated = await deviceAPI.physicalConfirm(id);
      setDevices(prev => prev.map(d => d.id === id ? { ...d, ...updated } : d));
      showToast('Fiziksel onay kaydedildi ✓');
    } catch (e) {
      showToast('Fiziksel onay başarısız: ' + (e?.message || ''));
    } finally {
      setBusy(id, false);
    }
  }

  const acikSayisi = devices.filter(d => d.power_state === 'ON').length;

  return (
    <div>
      {/* Başlık */}
      <div className="page-hd" style={{ marginBottom: 16 }}>
        <div>
          <div className="page-hd-title">Cihaz Kontrolü</div>
          <div className="page-hd-sub">
            {yukleniyor ? 'Yükleniyor…' : `${devices.length} cihaz — ${acikSayisi} açık`}
          </div>
        </div>
      </div>

      {/* Cihaz grid */}
      <div className="salon-view-grid">
        {devices.map(d => {
          const isSim = d.mode === 'SIM';
          const isOn  = d.power_state === 'ON';
          const busy  = !!pending[d.id];
          return (
            <div key={d.id} className="salon-card-v2">
              <div className="sc2-top">
                <div className="sc2-num">{groupLabel(d.device_group)}</div>
                {isSim && (
                  <span
                    className="tag"
                    style={{ background: 'rgba(217,119,6,0.12)', color: '#D97706', border: '1px solid rgba(217,119,6,0.3)', fontSize: '9.5px', fontWeight: 700 }}
                  >
                    SİMÜLASYON
                  </span>
                )}
              </div>

              <div className="sc2-body">
                <div className="sc2-name">{d.name}</div>
                <div className="sc2-status">
                  <div
                    className="sc2-dot"
                    style={{ background: isOn ? '#059669' : '#94A3B8', boxShadow: isOn ? '0 0 0 3px rgba(5,150,105,0.15)' : '' }}
                  />
                  <span className="sc2-stxt" style={{ color: isOn ? '#059669' : '#94A3B8' }}>
                    {isOn ? 'Açık' : 'Kapalı'}
                  </span>
                </div>

                {'power_level' in d && (
                  <div style={{ marginTop: 10 }}>
                    <label className="fl" style={{ display: 'block', marginBottom: 4 }}>
                      Güç Seviyesi: {d.power_level ?? 0}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={d.power_level ?? 0}
                      disabled={busy}
                      onChange={e => setPowerLevel(d.id, e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>
                )}
              </div>

              <div className="sc2-footer">
                <span className="sc2-cap">{d.device_group ? groupLabel(d.device_group) : ''}</span>
                <div className="sc2-actions">
                  {!isOn && (
                    <button className="sc2-btn purple" disabled={busy} onClick={() => turnOn(d.id)}>Aç</button>
                  )}
                  {isOn && (
                    <button className="sc2-btn danger" disabled={busy} onClick={() => turnOff(d.id)}>Kapat</button>
                  )}
                  {d.requires_physical_confirm && (
                    <button className="sc2-btn" disabled={busy} onClick={() => physicalConfirm(d.id)}>
                      Konsoldan fiziksel onayla
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {!yukleniyor && devices.length === 0 && (
          <div style={{ padding: '24px 10px', color: 'var(--slate-light)', fontSize: 12 }}>
            Bu salon için tanımlı cihaz bulunamadı
          </div>
        )}
      </div>
    </div>
  );
}
