import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SesliKontrolAyarlari from '../../src/pages/SesliKontrolAyarlari.jsx';
import { useDataStore, useUIStore } from '../../src/store';

vi.mock('../../src/services/api.js', () => ({
  deviceAPI: {
    list: vi.fn().mockResolvedValue([]),
    updateConfig: vi.fn().mockResolvedValue({}),
  },
  kioskAdminAPI: {
    createToken:   vi.fn().mockResolvedValue({ token: 'tok-abc123', kioskUrl: '/kiosk/r1' }),
    revokeToken:   vi.fn().mockResolvedValue({ revoked: true }),
    getMockConfig: vi.fn().mockResolvedValue({ mode: 'always_match', cycleIndex: 0 }),
    setMockConfig: vi.fn().mockResolvedValue({ mode: 'cycle', cycleIndex: 0 }),
  },
}));

beforeEach(async () => {
  vi.clearAllMocks();
  const { kioskAdminAPI } = await import('../../src/services/api.js');
  kioskAdminAPI.createToken.mockResolvedValue({ token: 'tok-abc123', kioskUrl: '/kiosk/r1' });
  kioskAdminAPI.revokeToken.mockResolvedValue({ revoked: true });
  kioskAdminAPI.getMockConfig.mockResolvedValue({ mode: 'always_match', cycleIndex: 0 });
  kioskAdminAPI.setMockConfig.mockResolvedValue({ mode: 'cycle', cycleIndex: 0 });
  useDataStore.setState({ rooms: [{ id: 'r1', ad: 'Ameliyathane 1' }] });
  useUIStore.setState({ toastMsg: '', toastVisible: false });
});

describe('SesliKontrolAyarlari — Kiosk Kurulumu', () => {
  it('"Kiosk Token Üret" tıklanınca createToken çağrılır ve token ekranda görünür', async () => {
    const { kioskAdminAPI } = await import('../../src/services/api.js');

    render(<SesliKontrolAyarlari />);

    const button = await screen.findByRole('button', { name: /kiosk token üret/i });
    fireEvent.click(button);

    await waitFor(() => expect(kioskAdminAPI.createToken).toHaveBeenCalledWith('r1'));
    expect(await screen.findByDisplayValue(/tok-abc123/)).toBeInTheDocument();
  });

  it('token üretildikten sonra "Token\'ı İptal Et" tıklanınca revokeToken çağrılır ve görüntü temizlenir', async () => {
    const { kioskAdminAPI } = await import('../../src/services/api.js');

    render(<SesliKontrolAyarlari />);

    fireEvent.click(await screen.findByRole('button', { name: /kiosk token üret/i }));
    await screen.findByDisplayValue(/tok-abc123/);

    fireEvent.click(await screen.findByRole('button', { name: "Token'ı İptal Et" }));

    await waitFor(() => expect(kioskAdminAPI.revokeToken).toHaveBeenCalledWith('r1'));
    await waitFor(() => expect(screen.queryByDisplayValue(/tok-abc123/)).not.toBeInTheDocument());
  });

  it('"Kopyala" tıklanınca kiosk URL panoya kopyalanır', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<SesliKontrolAyarlari />);

    fireEvent.click(await screen.findByRole('button', { name: /kiosk token üret/i }));
    await screen.findByDisplayValue(/tok-abc123/);

    fireEvent.click(await screen.findByRole('button', { name: /kopyala/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toContain('tok-abc123');
    expect(writeText.mock.calls[0][0]).toContain('/kiosk/r1');
  });
});

describe('SesliKontrolAyarlari — Konuşmacı Doğrulama (Demo)', () => {
  it('mount olduğunda getMockConfig çağrılır ve seçici dönen mode değerine ayarlanır', async () => {
    render(<SesliKontrolAyarlari />);

    const select = await screen.findByLabelText(/doğrulama senaryosu/i);
    await waitFor(() => expect(select.value).toBe('always_match'));
  });

  it('seçici değiştirilince setMockConfig doğru mode değeriyle çağrılır', async () => {
    const { kioskAdminAPI } = await import('../../src/services/api.js');

    render(<SesliKontrolAyarlari />);

    const select = await screen.findByLabelText(/doğrulama senaryosu/i);
    await waitFor(() => expect(select.value).toBe('always_match'));

    fireEvent.change(select, { target: { value: 'always_reject_team' } });
    await waitFor(() => expect(kioskAdminAPI.setMockConfig).toHaveBeenCalledWith('always_reject_team'));

    fireEvent.change(select, { target: { value: 'always_unrecognized' } });
    await waitFor(() => expect(kioskAdminAPI.setMockConfig).toHaveBeenCalledWith('always_unrecognized'));

    fireEvent.change(select, { target: { value: 'cycle' } });
    await waitFor(() => expect(kioskAdminAPI.setMockConfig).toHaveBeenCalledWith('cycle'));
  });

  it('doğrulama senaryosu seçicisinde "Gerçek Speaker-ID" seçeneği vardır ve seçildiğinde setMockConfig(\'real\') çağrılır', async () => {
    const { kioskAdminAPI } = await import('../../src/services/api.js');

    render(<SesliKontrolAyarlari />);
    const select = await screen.findByLabelText(/doğrulama senaryosu/i);
    fireEvent.change(select, { target: { value: 'real' } });
    await waitFor(() => expect(kioskAdminAPI.setMockConfig).toHaveBeenCalledWith('real'));
  });
});
