import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Profil from '../../src/pages/Profil.jsx';
import { useUIStore } from '../../src/store';

vi.mock('../../src/services/api.js', () => ({
  voiceProfileAPI: {
    get:    vi.fn().mockResolvedValue(null),
    enroll: vi.fn().mockResolvedValue({ modelVersion: 'v1', enrolledAt: '2026-11-20T10:00:00Z' }),
  },
  spotifyAPI: {
    connect:    vi.fn().mockResolvedValue({ url: 'https://accounts.spotify.com/authorize?client_id=abc' }),
    disconnect: vi.fn().mockResolvedValue({ disconnected: true }),
  },
}));

const originalLocation = window.location;

// Backend OAuth akışı tam sayfa yönlendirmesiyle çalışıyor (window.location.href) ve
// callback dönüşünde URL'e ?spotify=connected|error query param'ı ekliyor — bu yüzden
// jsdom'un gerçek window.location'ını her testte kontrollü bir mock ile değiştiriyoruz.
function mockLocation(search = '') {
  delete window.location;
  window.location = {
    ...originalLocation,
    pathname: '/profil',
    search,
    hash: '',
    href: `http://localhost/profil${search}`,
  };
}

// Profil.jsx mount sırasında kendi /api/auth/me fetch'ini yapıyor (bu görevin kapsamı dışında) —
// testte gerçek ağ isteği atmasın diye global fetch stub'lanıyor.
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  useUIStore.setState({ toastMsg: '', toastVisible: false });
  mockLocation('');
});

afterEach(() => {
  window.location = originalLocation;
});

describe('Profil — Spotify Hesabı bölümü', () => {
  it('bağlı değilken "Spotify Hesabımı Bağla" butonu görünür, "Bağlantıyı Kaldır" görünmez', async () => {
    render(<Profil />);

    expect(await screen.findByRole('button', { name: /spotify hesabımı bağla/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /bağlantıyı kaldır/i })).not.toBeInTheDocument();
  });

  it('"Spotify Hesabımı Bağla" tıklanınca connect() çağrılır ve dönen url\'e yönlendirilir', async () => {
    const { spotifyAPI } = await import('../../src/services/api.js');

    render(<Profil />);
    fireEvent.click(await screen.findByRole('button', { name: /spotify hesabımı bağla/i }));

    await waitFor(() => expect(spotifyAPI.connect).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(window.location.href).toBe('https://accounts.spotify.com/authorize?client_id=abc'));
  });

  it('?spotify=connected varsa bağlı gösterilir, başarı toast\'ı gösterilir ve query param URL\'den silinir', async () => {
    mockLocation('?spotify=connected');
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    render(<Profil />);

    expect(await screen.findByRole('button', { name: /bağlantıyı kaldır/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /spotify hesabımı bağla/i })).not.toBeInTheDocument();
    expect(useUIStore.getState().toastVisible).toBe(true);

    await waitFor(() => expect(replaceStateSpy).toHaveBeenCalledTimes(1));
    const strippedUrl = String(replaceStateSpy.mock.calls[0][2]);
    expect(strippedUrl).not.toContain('spotify');
  });

  it('?spotify=error varsa bağlı değil durumu kalır, hata toast\'ı gösterilir ve query param silinir', async () => {
    mockLocation('?spotify=error');
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    render(<Profil />);

    expect(await screen.findByRole('button', { name: /spotify hesabımı bağla/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /bağlantıyı kaldır/i })).not.toBeInTheDocument();
    expect(useUIStore.getState().toastVisible).toBe(true);

    await waitFor(() => expect(replaceStateSpy).toHaveBeenCalledTimes(1));
    const strippedUrl = String(replaceStateSpy.mock.calls[0][2]);
    expect(strippedUrl).not.toContain('spotify');
  });

  it('bağlıyken "Bağlantıyı Kaldır" tıklanınca disconnect() çağrılır ve bağlı değil durumuna geri döner', async () => {
    mockLocation('?spotify=connected');
    const { spotifyAPI } = await import('../../src/services/api.js');

    render(<Profil />);
    fireEvent.click(await screen.findByRole('button', { name: /bağlantıyı kaldır/i }));

    await waitFor(() => expect(spotifyAPI.disconnect).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('button', { name: /spotify hesabımı bağla/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /bağlantıyı kaldır/i })).not.toBeInTheDocument();
  });
});
