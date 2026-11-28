import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import Kurum from '../../src/pages/Kurum.jsx';
import AktiviteLoglari from '../../src/pages/AktiviteLoglari.jsx';
import Raporlar from '../../src/pages/Raporlar.jsx';
import { useUIStore } from '../../src/store';

// Final review Finding 5: GET /api/audit backend tarafında authorize(0) ile
// korunuyor (sadece Üst Yönetici) — diğer roller için 403/FORBIDDEN döner.
// Bu, gerçek bir hata değil rol bazlı bir görünürlük kısıtı; Kurum.jsx,
// AktiviteLoglari.jsx ve Raporlar.jsx bu durumda artık sessizce boş liste
// göstermeli (toast GÖSTERMEMELİ), ama diğer hata türlerinde (ör. 500) hâlâ
// toast göstermeli.

function forbiddenFetch() {
  return vi.fn(() => Promise.resolve({
    ok: false, status: 403,
    json: async () => ({ success: false, error: { code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok' } }),
  }));
}
function serverErrorFetch() {
  return vi.fn(() => Promise.resolve({
    ok: false, status: 500,
    json: async () => ({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Sunucu hatası' } }),
  }));
}

beforeEach(() => {
  localStorage.setItem('operio_access', 'test-token');
  useUIStore.setState({ toastMsg: '', toastVisible: false });
});

describe('GET /api/audit — 403/FORBIDDEN sessizce boş liste gösterir, toast göstermez (Finding 5)', () => {
  it('Kurum.jsx: 403 FORBIDDEN -> toast yok', async () => {
    global.fetch = forbiddenFetch();
    render(<Kurum />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    await new Promise(r => setTimeout(r, 0));
    expect(useUIStore.getState().toastMsg).toBe('');
  });

  it('Kurum.jsx: 500 (gerçek hata) -> toast gösterilir', async () => {
    global.fetch = serverErrorFetch();
    render(<Kurum />);
    await waitFor(() => expect(useUIStore.getState().toastMsg).not.toBe(''));
  });

  it('AktiviteLoglari.jsx: 403 FORBIDDEN -> toast yok', async () => {
    global.fetch = forbiddenFetch();
    render(<AktiviteLoglari />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    await new Promise(r => setTimeout(r, 0));
    expect(useUIStore.getState().toastMsg).toBe('');
  });

  it('AktiviteLoglari.jsx: 500 (gerçek hata) -> toast gösterilir', async () => {
    global.fetch = serverErrorFetch();
    render(<AktiviteLoglari />);
    await waitFor(() => expect(useUIStore.getState().toastMsg).not.toBe(''));
  });

  it('Raporlar.jsx: 403 FORBIDDEN -> toast yok', async () => {
    global.fetch = forbiddenFetch();
    render(<Raporlar />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    await new Promise(r => setTimeout(r, 0));
    expect(useUIStore.getState().toastMsg).toBe('');
  });

  it('Raporlar.jsx: 500 (gerçek hata) -> toast gösterilir', async () => {
    global.fetch = serverErrorFetch();
    render(<Raporlar />);
    await waitFor(() => expect(useUIStore.getState().toastMsg).not.toBe(''));
  });
});
