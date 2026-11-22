import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Kiosk.jsx'in kendi sesli-kontrol pipeline'ı (Task 15'te zaten test edildi,
// bkz. tests/components/Kiosk.test.jsx) burada gereksiz — bu test SADECE
// App.jsx'in /kiosk/:roomId rotasını guard'sız doğru bağladığını,
// route parametrelerini (roomId + ?token=) Kiosk'a ilettiğini doğruluyor.
vi.mock('../../src/pages/Kiosk.jsx', async () => {
  const { useParams, useSearchParams } = await import('react-router-dom');
  return {
    default: function KioskStub() {
      const { roomId } = useParams();
      const [searchParams] = useSearchParams();
      return (
        <div data-testid="kiosk-stub">
          KIOSK roomId={roomId} token={searchParams.get('token')}
        </div>
      );
    },
  };
});

// ConnectionStatus.jsx mount sırasında kendi health-check fetch'ini atıyor
// (bu görevin kapsamı dışında) — testte gerçek ağ isteği atmasın diye
// global fetch stub'lanıyor (Profil.voiceEnrollment.test.jsx'teki desenle aynı).
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network disabled in tests'))));
  // Kişisel JWT YOK: ne operio_access token'ı ne de operio-auth oturumu.
  localStorage.clear();
  window.history.pushState({}, '', '/kiosk/abc?token=xyz');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  window.history.pushState({}, '', '/');
});

describe('App — /kiosk/:roomId rotası', () => {
  it('kişisel JWT olmadan /kiosk/abc?token=xyz\'e gidildiğinde /giris\'e yönlendirilmez ve Kiosk render edilir', async () => {
    const { default: App } = await import('../../src/App.jsx');
    render(<App />);

    // Login sayfasına düşmedi — guard'dan muaf.
    expect(window.location.pathname).toBe('/kiosk/abc');

    // Kiosk (stub) gerçekten mount edildi ve route parametreleri doğru iletildi.
    const kiosk = await screen.findByTestId('kiosk-stub');
    expect(kiosk).toHaveTextContent('roomId=abc');
    expect(kiosk).toHaveTextContent('token=xyz');
  });
});
