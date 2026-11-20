import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * useQRScanner — Kamera erişimi + QR/barkod okuma hook'u
 * ZXing dinamik import ile lazy load edilir (bundle boyutu optimizasyonu)
 */
export function useQRScanner({ enabled = false, onResult, onError, deviceId } = {}) {
  const videoRef          = useRef(null);
  const readerRef         = useRef(null);
  const [devices, setDevices]               = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(deviceId || null);
  const [torchOn, setTorchOn]               = useState(false);
  const [status, setStatus]                 = useState('idle');

  // Kamera listesi — ZXing lazy load
  useEffect(() => {
    let cancelled = false;
    import('@zxing/library').then(({ BrowserMultiFormatReader }) => {
      if (cancelled) return;
      BrowserMultiFormatReader.listVideoInputDevices()
        .then(devs => {
          if (cancelled) return;
          setDevices(devs);
          if (!selectedDevice && devs.length > 0) {
            const back = devs.find(d =>
              /back|arka|environment/i.test(d.label)
            );
            setSelectedDevice((back || devs[0]).deviceId);
          }
        })
        .catch(err => onError?.(new Error('Kamera listesi alınamadı: ' + err.message)));
    });
    return () => { cancelled = true; };
  }, []);

  // Tarayıcı başlat / durdur
  useEffect(() => {
    if (!enabled || !videoRef.current) return;
    let cancelled = false;

    setStatus('requesting');

    import('@zxing/library').then(({ BrowserMultiFormatReader, NotFoundException }) => {
      if (cancelled) return;
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      reader.decodeFromVideoDevice(
        selectedDevice || undefined,
        videoRef.current,
        (result, err) => {
          if (cancelled) return;
          if (result) {
            setStatus('scanning');
            onResult?.(result.getText());
          }
          if (err && !(err instanceof NotFoundException)) {
            console.warn('[QR] Decode:', err.message);
          }
        }
      )
        .then(() => { if (!cancelled) setStatus('scanning'); })
        .catch(err => {
          if (cancelled) return;
          setStatus('error');
          if (err.name === 'NotAllowedError') {
            onError?.(new Error('Kamera izni reddedildi. Tarayıcı ayarlarından izin verin.'));
          } else if (err.name === 'NotFoundError') {
            onError?.(new Error('Kamera bulunamadı.'));
          } else {
            onError?.(err);
          }
        });
    });

    return () => {
      cancelled = true;
      readerRef.current?.reset();
      setStatus('idle');
    };
  }, [enabled, selectedDevice]);

  // El feneri
  const toggleTorch = useCallback(async () => {
    try {
      const track = videoRef.current?.srcObject?.getVideoTracks?.()?.[0];
      if (!track) return;
      const capabilities = track.getCapabilities?.();
      if (!capabilities?.torch) return;
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch { /* desteklenmiyor */ }
  }, [torchOn]);

  return { videoRef, devices, selectedDevice, setSelectedDevice, torchOn, toggleTorch, status };
}
