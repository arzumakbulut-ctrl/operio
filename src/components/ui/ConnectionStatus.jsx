import { useState, useEffect } from 'react';

export default function ConnectionStatus() {
  const [online, setOnline] = useState(true);
  const [wsOnline, setWsOnline] = useState(false);

  useEffect(() => {
    function handleOnline() { setOnline(true); }
    function handleOffline() { setOnline(false); }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Socket durumunu kontrol et
    const interval = setInterval(() => {
      fetch('http://localhost:4000/health')
        .then(() => setWsOnline(true))
        .catch(() => setWsOnline(false));
    }, 30000);

    fetch('http://localhost:4000/health').then(() => setWsOnline(true)).catch(() => setWsOnline(false));

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  if (online && wsOnline) return null; // Her sey normal, gosterme

  return (
    <div style={{
      position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
      background: online ? '#D97706' : '#DC2626',
      color: 'white', padding: '8px 16px', borderRadius: 20,
      fontSize: 12, fontWeight: 700, zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 8,
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    }}>
      <div style={{width:8,height:8,borderRadius:'50%',background:'rgba(255,255,255,0.6)',animation:'pulse 1s infinite'}}/>
      {!online ? 'İnternet bağlantısı yok' : 'Sunucu bağlantısı kesildi'}
    </div>
  );
}
