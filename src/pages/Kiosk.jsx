import { useParams, useSearchParams } from 'react-router-dom';
import { useVoiceDeviceControl } from '../hooks/useVoiceDeviceControl.js';

// Kiosk ekranı — odaya sabit, kişisel girişi OLMAYAN, tamamen sesle
// yönlendirilen bir tarayıcı sekmesi. roomId route parametresinden,
// kiosk token'ı ise ?token= query string'inden okunur (Task 16, App.jsx
// rotayı bağlayacak — bu dosya o rotanın :roomId parametresiyle
// mount edileceğini varsayar).
export default function Kiosk() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const kioskToken = searchParams.get('token');

  const { state, lastResponse } = useVoiceDeviceControl(roomId, kioskToken);

  if (state === 'no_surgery') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', textAlign: 'center', padding: 24 }}>
        <p style={{ fontSize: 20, fontWeight: 600, color: 'var(--slate, #334155)' }}>
          Bu odada aktif ameliyat yok, sesli kontrol kapalı.
        </p>
      </div>
    );
  }

  const sayText = Array.isArray(lastResponse?.say)
    ? lastResponse.say.join(' ')
    : (lastResponse?.say || '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', textAlign: 'center', padding: 24, gap: 16 }}>
      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--slate-light, #64748b)', textTransform: 'uppercase', letterSpacing: 1 }}>
        Durum: {state}
      </p>
      {sayText && (
        <p style={{ fontSize: 22, fontWeight: 600, color: 'var(--slate, #334155)', maxWidth: 640 }}>
          {sayText}
        </p>
      )}
    </div>
  );
}
