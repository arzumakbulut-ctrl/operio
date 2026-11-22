import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useVoiceDeviceControl } from '../hooks/useVoiceDeviceControl.js';

// Kiosk ekranı — odaya sabit, kişisel girişi OLMAYAN, tamamen sesle
// yönlendirilen bir tarayıcı sekmesi. roomId route parametresinden,
// kiosk token'ı ise ?token= query string'inden okunur (Task 16, App.jsx
// rotayı bağlayacak — bu dosya o rotanın :roomId parametresiyle
// mount edileceğini varsayar).

// Tarayıcıların otomatik oynatma politikası: speechSynthesis.speak() ve mikrofon
// bir kullanıcı etkileşimi olmadan sessizce engellenir. Boş bir utterance'ı
// DOKUNMA İŞLEYİCİSİNİN İÇİNDE konuşturmak, bu sekmenin ömrü boyunca sonraki
// tüm speak() çağrılarının kilidini açar.
function unlockSpeechSynthesis() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(''));
  } catch { /* desteklenmiyorsa yoksay */ }
}

const centeredStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', textAlign: 'center', padding: 24 };
const messageStyle = { fontSize: 20, fontWeight: 600, color: 'var(--slate, #334155)' };

export default function Kiosk() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const kioskToken = searchParams.get('token');

  const { state, lastResponse, start } = useVoiceDeviceControl(roomId, kioskToken);
  const [tapped, setTapped] = useState(false);

  function handleStart() {
    unlockSpeechSynthesis();
    setTapped(true);
    start();
  }

  if (!tapped) {
    return (
      <div style={{ ...centeredStyle, flexDirection: 'column', gap: 24 }}>
        <p style={messageStyle}>Sesli asistanı başlatmak için dokunun.</p>
        <button
          type="button"
          onClick={handleStart}
          style={{
            fontSize: 28, fontWeight: 700, padding: '24px 64px', borderRadius: 16,
            border: 'none', cursor: 'pointer', color: '#fff',
            background: 'var(--teal, #0F766E)',
          }}
        >
          Başlat
        </button>
      </div>
    );
  }

  if (state === 'setup_error') {
    return (
      <div style={centeredStyle}>
        <p style={messageStyle}>
          Kiosk bağlantısı geçersiz, lütfen yöneticinize başvurun.
        </p>
      </div>
    );
  }

  if (state === 'no_surgery') {
    return (
      <div style={centeredStyle}>
        <p style={messageStyle}>
          Bu odada aktif ameliyat yok, sesli kontrol kapalı.
        </p>
      </div>
    );
  }

  const sayText = Array.isArray(lastResponse?.say)
    ? lastResponse.say.join(' ')
    : (lastResponse?.say || '');

  return (
    <div style={{ ...centeredStyle, flexDirection: 'column', gap: 16 }}>
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
