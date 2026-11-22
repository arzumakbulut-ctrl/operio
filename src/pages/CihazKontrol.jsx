import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore, useAuthStore } from '../store';
import { deviceAPI } from '../services/api.js';
import { deviceGroupLabel, deviceGroupAbbr } from '../data/deviceGroups.js';

export default function CihazKontrol() {
  const { showToast } = useUIStore();
  const { curRole }   = useAuthStore();
  const navigate       = useNavigate();

  const [devices, setDevices]   = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [moduleInactive, setModuleInactive] = useState(false);
  const [pending, setPending]   = useState({});
  // Slider sürüklenirken gösterilen yerel değer — sunucuya sadece sürükleme
  // bitince (onMouseUp/onTouchEnd/onKeyUp) tek bir komut olarak gönderilir;
  // onChange her tick'te tetiklenir ama burada sadece görünümü günceller.
  const [sliderValues, setSliderValues] = useState({});

  useEffect(() => {
    deviceAPI.list()
      .then(list => setDevices(Array.isArray(list) ? list : []))
      .catch(e => {
        if (e?.status === 403) {
          setModuleInactive(true);
        } else {
          showToast('Cihaz listesi alınamadı');
        }
      })
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
      // Not: backend reddedilme sebeplerini (room_mismatch, team_role_required,
      // not_armed, surgery_ended…) artık doğrudan Türkçe, kullanıcıya gösterilebilir
      // bir mesaj olarak döndürüyor — burada kendi sebep-kodu → Türkçe eşlemesi
      // kurmuyoruz, sadece err.message'ı gösteriyoruz.
      showToast('Cihaz komutu gönderilemedi: ' + (e?.message || ''));
    } finally {
      setBusy(id, false);
    }
  }

  function turnOn(id)  { sendCommand(id, { action: 'turn_on' }); }
  function turnOff(id) { sendCommand(id, { action: 'turn_off' }); }
  function armMove(id) { sendCommand(id, { action: 'arm_move' }); }

  function handleSliderChange(id, value) {
    setSliderValues(v => ({ ...v, [id]: value }));
  }

  async function commitSlider(id) {
    const value = sliderValues[id];
    if (value === undefined) return;
    await sendCommand(id, { action: 'set_power', value: Number(value) });
    // Sürükleme sonucu (başarı/başarısız) ne olursa olsun, görünen değeri
    // tekrar sunucunun otoriter power_level'ına bırak.
    setSliderValues(v => {
      const next = { ...v };
      delete next[id];
      return next;
    });
  }

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
            {yukleniyor ? 'Yükleniyor…' : moduleInactive ? 'Modül aktif değil' : `${devices.length} cihaz — ${acikSayisi} açık`}
          </div>
        </div>
      </div>

      {moduleInactive ? (
        <div className="empty">
          <div className="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 22, height: 22 }}>
              <rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
          </div>
          <div className="empty-text">Sesli Kontrol modülü bu kurum için aktif değil.</div>
          {curRole === 0 && (
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/abonelik')}>
              Abonelik sayfasına git →
            </button>
          )}
        </div>
      ) : (
        <div className="salon-view-grid">
          {devices.map(d => {
            const isSim   = d.mode === 'SIM';
            const isOn    = d.power_state === 'ON';
            const isArmed = d.power_state === 'ARMED';
            const isTable = !!d.requires_physical_confirm;
            const busy    = !!pending[d.id];

            const statusMeta = isArmed
              ? { color: '#D97706', label: 'Onay bekliyor' }
              : isOn
                ? { color: '#059669', label: 'Açık' }
                : { color: '#94A3B8', label: 'Kapalı' };

            return (
              <div key={d.id} className="salon-card-v2">
                <div className="sc2-top">
                  <div className="sc2-num">{deviceGroupAbbr(d.device_group)}</div>
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
                      style={{ background: statusMeta.color, boxShadow: (isOn || isArmed) ? `0 0 0 3px ${statusMeta.color}26` : '' }}
                    />
                    <span className="sc2-stxt" style={{ color: statusMeta.color }}>
                      {statusMeta.label}
                    </span>
                  </div>

                  {/* Güç slider'ı fiziksel-onay gerektiren cihazlarda hiç anlamlı değil
                      (masa/ışık hareketi güç seviyesiyle değil arm/confirm ile kontrol
                      edilir) — bu yüzden tamamen gizli. Diğer cihazlarda da sadece
                      cihaz gerçekten ON iken gösterilir/etkin olur. */}
                  {!isTable && isOn && (
                    <div style={{ marginTop: 10 }}>
                      <label className="fl" style={{ display: 'block', marginBottom: 4 }}>
                        Güç Seviyesi: {sliderValues[d.id] ?? d.power_level ?? 0}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={sliderValues[d.id] ?? d.power_level ?? 0}
                        disabled={busy}
                        onChange={e => handleSliderChange(d.id, e.target.value)}
                        onMouseUp={() => commitSlider(d.id)}
                        onTouchEnd={() => commitSlider(d.id)}
                        onKeyUp={() => commitSlider(d.id)}
                        style={{ width: '100%' }}
                      />
                    </div>
                  )}
                </div>

                <div className="sc2-footer">
                  <span className="sc2-cap">{d.device_group ? deviceGroupLabel(d.device_group) : ''}</span>
                  <div className="sc2-actions">
                    {isTable ? (
                      <>
                        {!isOn && !isArmed && (
                          <button className="sc2-btn purple" disabled={busy} onClick={() => armMove(d.id)}>Hazırla</button>
                        )}
                        {(isOn || isArmed) && (
                          <button className="sc2-btn danger" disabled={busy} onClick={() => turnOff(d.id)}>Kapat</button>
                        )}
                        <button
                          className="sc2-btn"
                          disabled={busy || !isArmed}
                          style={{ opacity: isArmed ? 1 : 0.5 }}
                          title={isArmed ? undefined : 'Önce "Hazırla" ile onay bekleyen duruma alın'}
                          onClick={() => physicalConfirm(d.id)}
                        >
                          Konsoldan fiziksel onayla
                        </button>
                      </>
                    ) : (
                      <>
                        {!isOn && (
                          <button className="sc2-btn purple" disabled={busy} onClick={() => turnOn(d.id)}>Aç</button>
                        )}
                        {isOn && (
                          <button className="sc2-btn danger" disabled={busy} onClick={() => turnOff(d.id)}>Kapat</button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {!yukleniyor && devices.length === 0 && (
            <div style={{ padding: '24px 10px', color: 'var(--slate-light)', fontSize: 12 }}>
              Tanımlı cihaz bulunamadı
            </div>
          )}
        </div>
      )}
    </div>
  );
}
