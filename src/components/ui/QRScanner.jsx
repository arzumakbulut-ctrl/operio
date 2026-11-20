import { useState, useEffect } from 'react';
import { useQRScanner } from '../../hooks/useQRScanner';

/**
 * QRScanner — Tam özellikli QR kod tarayıcı bileşeni
 *
 * Props:
 *   onScan(text)     — başarılı okuma callback'i
 *   onClose()        — kapatma callback'i
 *   title            — modal başlığı
 *   hint             — ipucu metni
 *   expectedPrefix   — beklenen QR prefix (ör. "OPER-SET-") — validasyon için
 */
export default function QRScanner({ onScan, onClose, title = 'QR Kod Tara', hint, expectedPrefix }) {
  const [lastScan, setLastScan]     = useState(null);
  const [scanError, setScanError]   = useState(null);
  const [cooldown, setCooldown]     = useState(false); // çift tetiklemeyi engelle
  const [permDenied, setPermDenied] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [showManual, setShowManual] = useState(false);

  function handleResult(text) {
    if (cooldown) return;

    // Prefix doğrulama
    if (expectedPrefix && !text.startsWith(expectedPrefix)) {
      setScanError(`Beklenen format: ${expectedPrefix}... — Okunan: ${text.slice(0, 20)}`);
      setTimeout(() => setScanError(null), 3000);
      return;
    }

    setScanError(null);
    setLastScan(text);
    setCooldown(true);

    // 2 sn cooldown — aynı kodu tekrar okumayı engelle
    setTimeout(() => setCooldown(false), 2000);

    onScan(text);
  }

  function handleError(err) {
    if (err.message.includes('izni reddedildi') || err.message.includes('NotAllowed')) {
      setPermDenied(true);
    } else {
      setScanError(err.message);
    }
  }

  const { videoRef, devices, selectedDevice, setSelectedDevice, torchOn, toggleTorch, status } =
    useQRScanner({ enabled: !permDenied && !showManual, onResult: handleResult, onError: handleError });

  function handleManualSubmit(e) {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleResult(manualCode.trim());
    setManualCode('');
  }

  const statusLabel = {
    idle:       'Hazırlanıyor…',
    requesting: 'Kamera izni bekleniyor…',
    scanning:   'Taranıyor',
    error:      'Kamera hatası',
  }[status] || '';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3000,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => e.target === e.currentTarget && onClose()}>

      <div style={{
        width: 420, maxWidth: '96vw',
        background: 'var(--card-bg)',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* Başlık */}
        <div style={{
          padding: '14px 18px',
          background: 'linear-gradient(135deg, var(--teal-dark), #0369A1)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
              <path d="M14 14h3v3M17 17h3M14 20h3"/>
            </svg>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>{title}</span>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8,
            width: 28, height: 28, cursor: 'pointer', color: 'white', fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* Kamera alanı */}
        {!showManual && (
          <div style={{ position: 'relative', background: '#0F172A', minHeight: 280 }}>
            {/* Video */}
            <video
              ref={videoRef}
              style={{
                width: '100%', height: 280, objectFit: 'cover',
                display: permDenied ? 'none' : 'block',
              }}
              playsInline
              muted
            />

            {/* Tarama çerçevesi */}
            {status === 'scanning' && !permDenied && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none',
              }}>
                {/* Köşe çizgileri */}
                <div style={{ position: 'relative', width: 180, height: 180 }}>
                  {/* Tarama çizgisi animasyonu */}
                  <div style={{
                    position: 'absolute', left: 0, right: 0, height: 2,
                    background: 'linear-gradient(90deg, transparent, #14B8A6, transparent)',
                    animation: 'scanLine 2s linear infinite',
                    top: '50%',
                  }}/>
                  {/* 4 köşe */}
                  {[
                    { top: 0, left: 0, borderTop: '3px solid #14B8A6', borderLeft: '3px solid #14B8A6', borderRadius: '4px 0 0 0' },
                    { top: 0, right: 0, borderTop: '3px solid #14B8A6', borderRight: '3px solid #14B8A6', borderRadius: '0 4px 0 0' },
                    { bottom: 0, left: 0, borderBottom: '3px solid #14B8A6', borderLeft: '3px solid #14B8A6', borderRadius: '0 0 0 4px' },
                    { bottom: 0, right: 0, borderBottom: '3px solid #14B8A6', borderRight: '3px solid #14B8A6', borderRadius: '0 0 4px 0' },
                  ].map((s, i) => (
                    <div key={i} style={{ position: 'absolute', width: 24, height: 24, ...s }}/>
                  ))}
                </div>
              </div>
            )}

            {/* Kamera izni reddedildi */}
            {permDenied && (
              <div style={{
                height: 280, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24,
              }}>
                <div style={{ fontSize: 40 }}>📷</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'white', textAlign: 'center' }}>
                  Kamera izni reddedildi
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 1.6 }}>
                  Tarayıcı adres çubuğundan kamera iznini etkinleştirin veya QR kodunu manuel girin.
                </div>
              </div>
            )}

            {/* Hazırlanıyor */}
            {(status === 'idle' || status === 'requesting') && !permDenied && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: 10,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  border: '3px solid rgba(20,184,166,0.3)',
                  borderTopColor: '#14B8A6',
                  animation: 'spin 0.8s linear infinite',
                }}/>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{statusLabel}</div>
              </div>
            )}

            {/* Son başarılı okuma */}
            {lastScan && (
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'rgba(5,150,105,0.9)', backdropFilter: 'blur(4px)',
                padding: '8px 14px',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 16 }}>✅</span>
                <span style={{ fontSize: 12, color: 'white', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {lastScan}
                </span>
              </div>
            )}

            {/* Hata */}
            {scanError && (
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'rgba(220,38,38,0.9)', backdropFilter: 'blur(4px)',
                padding: '8px 14px',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 16 }}>⚠️</span>
                <span style={{ fontSize: 12, color: 'white', fontWeight: 500 }}>{scanError}</span>
              </div>
            )}

            {/* El feneri + kamera seçimi */}
            <div style={{
              position: 'absolute', top: 10, right: 10,
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              {devices.length > 1 && (
                <select
                  value={selectedDevice || ''}
                  onChange={e => setSelectedDevice(e.target.value)}
                  style={{
                    background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)',
                    color: 'white', fontSize: 10, padding: '4px 6px', borderRadius: 6,
                    cursor: 'pointer', maxWidth: 120,
                  }}
                >
                  {devices.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Kamera ${d.deviceId.slice(0,4)}`}</option>
                  ))}
                </select>
              )}
              <button onClick={toggleTorch} title="El feneri"
                style={{
                  background: torchOn ? 'rgba(250,204,21,0.8)' : 'rgba(0,0,0,0.6)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'white', borderRadius: 6, width: 32, height: 32, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                }}>
                🔦
              </button>
            </div>

            <style>{`
              @keyframes scanLine { 0%{top:10%} 100%{top:90%} }
              @keyframes spin { to{transform:rotate(360deg)} }
            `}</style>
          </div>
        )}

        {/* Alt panel */}
        <div style={{ padding: '14px 18px' }}>
          {hint && (
            <div style={{ fontSize: 12, color: 'var(--slate-light)', marginBottom: 12, textAlign: 'center', lineHeight: 1.5 }}>
              {hint}
            </div>
          )}

          {/* Durum göstergesi */}
          {!showManual && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', background: 'var(--surface)',
              borderRadius: 8, marginBottom: 12, border: '1px solid var(--border)',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: status === 'scanning' ? '#059669' : status === 'error' ? '#DC2626' : '#D97706',
                boxShadow: status === 'scanning' ? '0 0 0 2px rgba(5,150,105,0.25)' : 'none',
                animation: status === 'scanning' ? 'pulse 2s infinite' : 'none',
              }}/>
              <span style={{ fontSize: 12, color: 'var(--slate-mid)', flex: 1 }}>
                {permDenied ? 'Kamera erişimi yok' : statusLabel}
              </span>
              {status === 'scanning' && (
                <span style={{ fontSize: 10, color: 'var(--teal)', fontWeight: 700 }}>AKTİF</span>
              )}
              <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
            </div>
          )}

          {/* Manuel giriş toggle */}
          <button
            onClick={() => setShowManual(!showManual)}
            style={{
              width: '100%', padding: '8px', fontSize: 12, fontWeight: 600,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 8, cursor: 'pointer', color: 'var(--slate-mid)',
              marginBottom: showManual ? 10 : 0,
            }}>
            {showManual ? '← Kameraya Dön' : '⌨️ Manuel QR Kodu Gir'}
          </button>

          {/* Manuel giriş formu */}
          {showManual && (
            <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: 8 }}>
              <input
                className="fi"
                style={{ flex: 1, fontSize: 13 }}
                placeholder={expectedPrefix ? `${expectedPrefix}...` : 'QR kod içeriğini girin'}
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                autoFocus
              />
              <button type="submit" className="btn btn-primary" style={{ flexShrink: 0 }}>
                Onayla
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
