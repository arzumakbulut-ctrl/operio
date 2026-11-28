import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { useAuthStore, useDataStore } from '../../src/store';

// Final review Finding 2: App.jsx'in global useApiLoader'ı GET /rooms ve
// GET /notifications için {success,data,meta} zarfını hiç açmıyordu (generic
// get() ham json objesini döndürüyor, "r&&r.length" her zaman false'a
// düşüyordu) — bu yüzden global rooms/bildirimler store slice'ları HER ZAMAN
// boş kalıyordu (SalonYonetim.jsx hariç, o kendi bağımsız fetch'ini yapıyor).
// Bu test, düzeltmeden sonra bu iki slice'ın GERÇEKTEN dolduğunu doğruluyor.

function fetchMockFor({ rooms, notifications }) {
  return vi.fn((url) => {
    if (/\/rooms$/.test(url)) {
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: rooms }) });
    }
    if (/\/notifications/.test(url)) {
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: notifications }) });
    }
    // Diğer tüm uçlar (surgeries/patients/sterile-sets/personel/kurumlar/...)
    // bu testin kapsamı dışında — boş-ama-geçerli bir zarf döndürülüyor.
    return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [] }) });
  });
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('operio_access', 'test-token');
  useAuthStore.setState({ isLoggedIn: true, curRole: 0 });
  useDataStore.setState({ rooms: [], bildirimler: [] });
  window.history.pushState({}, '', '/dashboard');
});

afterEach(() => {
  vi.unstubAllGlobals();
  // NOT: Burada vi.resetModules() ÇAĞRILMIYOR — bu test dosyasında App.jsx
  // birden fazla testte dynamic import() ile yükleniyor; resetModules
  // store modülünün taze bir kopyasını zorlar, bu da dynamic import edilen
  // App'in, testin üstte STATIK import ettiği useDataStore/useAuthStore'dan
  // FARKLI bir store instance'ı kullanmasına yol açar (ikinci testin "store
  // hiç güncellenmiyor" şeklinde yanlış pozitif başarısız olmasına sebep
  // oluyordu).
  window.history.pushState({}, '', '/');
  useAuthStore.setState({ isLoggedIn: false });
});

describe('App.jsx useApiLoader — rooms/notifications zarfını açar (Finding 2)', () => {
  it('GET /rooms {success,data} yanıtından store.rooms doldurulur (DB_TO_UI eşlemesiyle)', async () => {
    // Bu test App.jsx'i dynamic import ile yüklüyor (App.kioskRoute.test.jsx'teki
    // AYNI desen) — tüm süitin paralel çalıştığı ortamda bu import App.jsx'in
    // büyük transitive import grafiği (80+ sayfa) yüzünden yavaşlayabiliyor;
    // App.kioskRoute.test.jsx'in de bilinen bir flake olmasının sebebi aynı.
    // Varsayılan 5s test timeout'u bu yükü karşılamayabiliyor.
    global.fetch = fetchMockFor({
      rooms: [{ id: 'r1', name: 'Salon 1', status: 'ACTIVE', capacity: 6 }],
      notifications: [],
    });

    const { default: App } = await import('../../src/App.jsx');
    render(<App />);

    await waitFor(() => {
      expect(useDataStore.getState().rooms.length).toBe(1);
    });
    const room = useDataStore.getState().rooms[0];
    expect(room.ad).toBe('Salon 1');
    // Önceden "Bos" (ölü Türkçe literal) ya da ham "ACTIVE" idi — artık
    // DB_TO_UI üzerinden doğru UI key'i.
    expect(room.durum).toBe('active');
  }, 15000);

  it('GET /notifications {success,data} yanıtından store.bildirimler doldurulur (created_at/is_read okunur)', async () => {
    global.fetch = fetchMockFor({
      rooms: [],
      notifications: [{
        id: 'n1', type: 'info', title: 'Test Bildirim', message: 'Mesaj metni',
        created_at: '2026-11-28T08:00:00.000Z', is_read: true,
      }],
    });

    const { default: App } = await import('../../src/App.jsx');
    render(<App />);

    await waitFor(() => {
      expect(useDataStore.getState().bildirimler.length).toBe(1);
    });
    const n = useDataStore.getState().bildirimler[0];
    expect(n.baslik).toBe('Test Bildirim');
    expect(n.mesaj).toBe('Mesaj metni');
    // Önceden n.createdAt/n.read (hiç var olmayan alanlar) okunuyordu —
    // zaman boş, okundu her zaman false kalıyordu.
    expect(n.zaman).not.toBe('');
    expect(n.okundu).toBe(true);
  }, 15000);
});
