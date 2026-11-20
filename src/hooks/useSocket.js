import { useEffect, useRef } from 'react';
import { useAuthStore, useDataStore } from '../store';

export function useSocket() {
  const isLoggedIn = useAuthStore(s => s.isLoggedIn);
  const { loadSurgeries, loadBildirimler, bildirimler, addBildirim } = useDataStore();
  const socketRef = useRef(null);
  const token = localStorage.getItem('operio_access');

  useEffect(() => {
    if (!isLoggedIn) return;

    // Socket.io script yukle
    function initSocket() {
      if (!window.io) return;
      if (socketRef.current) return;

      const socket = window.io('http://localhost:4000', {
        auth: { token },
        reconnection: true,
        reconnectionDelay: 2000,
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('[Socket] Baglandi:', socket.id);
        // Kullanici odasina katil
        const user = JSON.parse(localStorage.getItem('operio-auth') || '{}')?.state?.user;
        if (user?.id) socket.emit('join:user', user.id);
      });

      socket.on('disconnect', () => {
        console.log('[Socket] Baglanti kesildi');
      });

      // Gercek zamanli ameliyat guncelleme
      socket.on('surgery:updated', (data) => {
        console.log('[Socket] Ameliyat guncellendi:', data);
        // Store'u guncelle
        const { updateSurgery } = useDataStore.getState();
        if (data.id) updateSurgery(data.id, { durum: data.status, st: data.status === 'Devam Ediyor' ? 'dot-active' : data.status === 'Tamamlandi' ? 'dot-done' : 'dot-wait' });
      });

      // Yeni bildirim
      socket.on('notification:new', (notif) => {
        addBildirim({
          tip: notif.type || 'sistem',
          baslik: notif.title || '',
          mesaj: notif.message || '',
          zaman: 'Az once',
          okundu: false,
          kategori: 'sistem',
        });
      });

      // Mesaj
      socket.on('message:new', (msg) => {
        console.log('[Socket] Yeni mesaj:', msg.content);
      });

      return socket;
    }

    // Socket.io CDN'den yukle
    if (window.io) {
      initSocket();
    } else {
      const existing = document.querySelector('script[src*="socket.io"]');
      if (!existing) {
        const script = document.createElement('script');
        script.src = 'http://localhost:4000/socket.io/socket.io.js';
        script.onload = () => initSocket();
        document.head.appendChild(script);
      } else {
        existing.addEventListener('load', initSocket);
      }
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [isLoggedIn]);

  return socketRef;
}
