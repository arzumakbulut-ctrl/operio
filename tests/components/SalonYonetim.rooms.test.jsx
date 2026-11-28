import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SalonYonetim from '../../src/pages/SalonYonetim.jsx';
import Toast from '../../src/components/ui/Toast.jsx';
import { useUIStore } from '../../src/store';

// NOT: Brief'in test iskeleti `screen.getByText(/Salon Ekle|Yeni Salon/i)` ile
// "Salon Ekle" butonuna tıklamayı öneriyordu, ancak gerçek dosyada HEM üst
// "Salon Ekle" butonu HEM DE grid'deki "Yeni Salon Ekle" kartı aynı anda DOM'da
// bulunuyor (canManage true olduğunda) — bu regex ikisiyle de eşleşip
// getByText'in "birden fazla eleman bulundu" hatasıyla patlamasına yol açardı.
// Bu yüzden üst butonu `getByRole('button', { name: /salon ekle/i })` ile,
// modal içindeki gönder butonunu ise tam metin 'Ekle' ile hedefliyoruz.
//
// Form alanları `getByLabelText` ile bulunamıyor: <label> ile <input> arasında
// htmlFor/id bağı yok (sadece görsel kardeş elemanlar). Bunun yerine gerçek
// placeholder metinleri ("1" ve "Genel Cerrahi Salonu") kullanılıyor.
//
// Toast mesajı SalonYonetim.jsx içinde render edilmiyor — ayrı bir <Toast/>
// bileşeni var ve showToast() sadece useUIStore state'ini güncelliyor. Üçüncü
// testte hata mesajının DOM'da görünmesi için <Toast/> da birlikte render
// ediliyor (gerçek App.jsx'te olduğu gibi ikisi birlikte monte edilir).

function flexibleFetchMock(handlers) {
  return vi.fn((url, opts = {}) => {
    const method = opts.method || 'GET';
    for (const h of handlers) {
      if (h.test(url, method)) return h.respond(url, method, opts);
    }
    return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [] }) });
  });
}

beforeEach(() => {
  localStorage.setItem('operio_access', 'test-token');
  useUIStore.setState({ toastMsg: '', toastVisible: false });
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [] }) });
});

describe('SalonYonetim — gerçek backend #1 uç noktaları', () => {
  it('"Salon Ekle" artık sabit toast DEĞİL, gerçek POST /api/rooms atar (doğru tipte body ile)', async () => {
    render(<SalonYonetim />);

    fireEvent.click(screen.getByRole('button', { name: /salon ekle/i }));

    fireEvent.change(screen.getByPlaceholderText('1'), { target: { value: '7' } });
    fireEvent.change(screen.getByPlaceholderText('Genel Cerrahi Salonu'), { target: { value: 'Test Salonu' } });

    fireEvent.click(screen.getByText('Ekle'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/rooms'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    const call = global.fetch.mock.calls.find(c => c[1]?.method === 'POST');
    const body = JSON.parse(call[1].body);
    expect(body.roomNumber).toBe(7);
    expect(typeof body.roomNumber).toBe('number');
    expect(body.name).toBe('Test Salonu');
    expect(typeof body.capacity).toBe('number');
  });

  it('durum güncelleme artık PATCH /api/rooms/:id/status atar (PUT /api/rooms/:id DEĞİL)', async () => {
    global.fetch = flexibleFetchMock([
      {
        test: (url, method) => method === 'GET' && /\/rooms$/.test(url),
        respond: () => Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [{ id: 'room-1', name: 'Salon 1', status: 'IDLE', capacity: 6 }] }),
        }),
      },
      {
        test: (url, method) => method === 'GET' && /\/surgeries/.test(url),
        respond: () => Promise.resolve({ ok: true, json: async () => ({ success: true, data: [] }) }),
      },
      {
        test: (url, method) => method === 'PATCH',
        respond: () => Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: { id: 'room-1', name: 'Salon 1', status: 'MAINTENANCE', capacity: 6 } }),
        }),
      },
    ]);

    const { container } = render(<SalonYonetim />);

    await screen.findByText('Salon 1');

    fireEvent.click(container.querySelector('.sc2-menu-btn'));
    fireEvent.click(screen.getByText('Bakıma Al'));

    await waitFor(() => {
      const calls = global.fetch.mock.calls.filter(c => c[1]?.method === 'PATCH');
      expect(calls.some(c => /\/api\/rooms\/.+\/status/.test(c[0]))).toBe(true);
    });

    // Eski yanlış uç nokta hiç kullanılmamalı
    expect(global.fetch.mock.calls.some(c => c[1]?.method === 'PUT')).toBe(false);
  });

  it('roomNumber boş/geçersiz girilip backend 400 döndürdüğünde sayfa çökmez, hata toast ile gösterilir (Review Focus)', async () => {
    global.fetch = flexibleFetchMock([
      {
        test: (url, method) => method === 'POST' && /\/rooms$/.test(url),
        respond: () => Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({ success: false, error: { code: 'BAD_REQUEST', message: 'roomNumber geçersiz' } }),
        }),
      },
    ]);

    render(<><SalonYonetim /><Toast /></>);

    fireEvent.click(screen.getByRole('button', { name: /salon ekle/i }));
    // roomNumber (Salon No) BOŞ bırakılıyor — sadece isim dolduruluyor.
    fireEvent.change(screen.getByPlaceholderText('Genel Cerrahi Salonu'), { target: { value: 'Geçersiz Salon' } });
    fireEvent.click(screen.getByText('Ekle'));

    await waitFor(() => {
      expect(screen.queryByText(/roomNumber geçersiz/i)).toBeInTheDocument();
    });

    // Sayfa hâlâ render edilmiş durumda olmalı (çökmedi).
    expect(screen.getByRole('button', { name: /salon ekle/i })).toBeInTheDocument();
  });

  // Task 6 — sonradan eklenen düzeltme: ilk salon-listesi fetch'i de gerçek
  // backend #1'in {success,data} zarfını artık soyuyor. Önceden bu çağrı
  // r.json()'ı doğrudan diziymiş gibi .map() ediyordu — gerçek backend'e karşı
  // {success,data:[...]} objesi döndüğü için rooms.map fırlıyor, mevcut
  // .catch(()=>{}) bunu yutup salon listesini sessizce boş bırakıyordu
  // (kullanıcının "salonlarım görünmüyor" şikayetinin kök nedeni).
  it('gerçek backend #1 zarfıyla ({success,data}) GET /api/rooms yanıtı salon listesini doğru render eder', async () => {
    global.fetch = flexibleFetchMock([
      {
        test: (url, method) => method === 'GET' && /\/rooms$/.test(url),
        respond: () => Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              { id: 'room-1', name: 'Salon 1', status: 'IDLE', capacity: 6 },
              { id: 'room-2', name: 'Salon 2', status: 'ACTIVE', capacity: 8 },
            ],
          }),
        }),
      },
      {
        test: (url, method) => method === 'GET' && /\/surgeries/.test(url),
        respond: () => Promise.resolve({ ok: true, json: async () => ({ success: true, data: [] }) }),
      },
    ]);

    render(<SalonYonetim />);

    expect(await screen.findByText('Salon 1')).toBeInTheDocument();
    expect(screen.getByText('Salon 2')).toBeInTheDocument();
  });

  it('GET /api/rooms backend hatasıyla (success:false) dönerse sayfa çökmez, salon listesi boş kalır ve hata toast\'ı gösterilir', async () => {
    global.fetch = flexibleFetchMock([
      {
        test: (url, method) => method === 'GET' && /\/rooms$/.test(url),
        respond: () => Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Salonlar alınamadı' } }),
        }),
      },
      {
        test: (url, method) => method === 'GET' && /\/surgeries/.test(url),
        respond: () => Promise.resolve({ ok: true, json: async () => ({ success: true, data: [] }) }),
      },
    ]);

    render(<><SalonYonetim /><Toast /></>);

    await waitFor(() => {
      expect(screen.queryByText(/Salonlar alınamadı/i)).toBeInTheDocument();
    });
    // Sayfa çökmedi — üst "Salon Ekle" butonu hâlâ DOM'da.
    expect(screen.getByRole('button', { name: /salon ekle/i })).toBeInTheDocument();
  });
});
