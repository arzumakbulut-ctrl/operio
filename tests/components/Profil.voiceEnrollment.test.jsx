import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Profil from '../../src/pages/Profil.jsx';
import { useUIStore } from '../../src/store';

vi.mock('../../src/services/api.js', () => ({
  voiceProfileAPI: {
    get:    vi.fn().mockResolvedValue(null),
    enroll: vi.fn().mockResolvedValue({ modelVersion: 'v1', enrolledAt: '2026-11-20T10:00:00Z' }),
  },
}));

// Profil.jsx mount sırasında kendi /api/auth/me fetch'ini yapıyor (bu görevin kapsamı dışında) —
// testte gerçek ağ isteği atmasın diye global fetch stub'lanıyor.
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  useUIStore.setState({ toastMsg: '', toastVisible: false });
});

// Ortak MediaRecorder/getUserMedia mock kurulumu — her testte aynı sahte kayıt
// mekanizmasını kurmak için tekrar yazılmasın diye paylaşılan yardımcı.
function mockMediaKayit({ getUserMediaImpl } = {}) {
  const recorderInstances = [];
  class MockMediaRecorder {
    constructor(stream) {
      this.stream = stream;
      this.state = 'inactive';
      recorderInstances.push(this);
    }
    start() { this.state = 'recording'; }
    stop() {
      if (this.state !== 'recording') return;
      this.state = 'inactive';
      this.ondataavailable && this.ondataavailable({ data: new Blob(['x'], { type: 'audio/webm' }) });
      this.onstop && this.onstop();
    }
  }
  vi.stubGlobal('MediaRecorder', MockMediaRecorder);

  const fakeStream = { getTracks: () => [{ stop: vi.fn() }] };
  const getUserMedia = getUserMediaImpl || vi.fn().mockResolvedValue(fakeStream);
  vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia } });

  return { recorderInstances, getUserMedia };
}

describe('Profil — Ses Profili bölümü', () => {
  it('kayıt yoksa (get() null) "Kayda Başla" butonu ve sabit pasaj metni görünür, "Yeniden Kaydet" görünmez', async () => {
    const { voiceProfileAPI } = await import('../../src/services/api.js');
    voiceProfileAPI.get.mockResolvedValueOnce(null);

    render(<Profil />);

    expect(await screen.findByRole('button', { name: /kayda başla/i })).toBeInTheDocument();
    expect(screen.getByText(/Operio ses profilimi oluşturuyorum, bu cümleyi kendi doğal konuşma hızımla okuyorum\./i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /yeniden kaydet/i })).not.toBeInTheDocument();
  });

  it('get() enrolled profil döndürürse "Ses profiliniz oluşturuldu" + "Yeniden Kaydet" görünür, "Kayda Başla" görünmez', async () => {
    const { voiceProfileAPI } = await import('../../src/services/api.js');
    voiceProfileAPI.get.mockResolvedValueOnce({ modelVersion: 'v1', enrolledAt: '2026-11-20T10:00:00Z' });

    render(<Profil />);

    expect(await screen.findByText(/ses profiliniz oluşturuldu/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /yeniden kaydet/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^kayda başla$/i })).not.toBeInTheDocument();
  });

  it('"Kayda Başla" tıklanınca 3 ardışık kayıt yapar ve tek bir enroll çağrısında 3 elemanlı dizi gönderir', async () => {
    const { voiceProfileAPI } = await import('../../src/services/api.js');
    voiceProfileAPI.get.mockResolvedValueOnce(null);

    const { recorderInstances, getUserMedia } = mockMediaKayit();

    render(<Profil />);
    fireEvent.click(await screen.findByRole('button', { name: /kayda başla/i }));

    for (let i = 1; i <= 3; i++) {
      await waitFor(() => expect(recorderInstances.length).toBe(i));
      expect(recorderInstances[i - 1].state).toBe('recording');
      recorderInstances[i - 1].stop();
    }

    await waitFor(() => expect(voiceProfileAPI.enroll).toHaveBeenCalledTimes(1));
    expect(voiceProfileAPI.enroll).toHaveBeenCalledWith([
      expect.any(String), expect.any(String), expect.any(String),
    ]);
    expect(getUserMedia).toHaveBeenCalledTimes(3);

    await waitFor(() => expect(screen.getByRole('button', { name: /yeniden kaydet/i })).toBeInTheDocument());
    expect(await screen.findByText(/ses profiliniz oluşturuldu/i)).toBeInTheDocument();
    expect(useUIStore.getState().toastVisible).toBe(true);
  });

  it('kayıt sırasında "Kayıt N/3" ilerleme göstergesi render edilir', async () => {
    const { voiceProfileAPI } = await import('../../src/services/api.js');
    voiceProfileAPI.get.mockResolvedValueOnce(null);

    const { recorderInstances } = mockMediaKayit();

    render(<Profil />);
    fireEvent.click(await screen.findByRole('button', { name: /kayda başla/i }));

    await waitFor(() => expect(recorderInstances.length).toBe(1));
    expect(await screen.findByRole('button', { name: /1\/3/ })).toBeInTheDocument();
    recorderInstances[0].stop();

    await waitFor(() => expect(recorderInstances.length).toBe(2));
    expect(await screen.findByRole('button', { name: /2\/3/ })).toBeInTheDocument();
    recorderInstances[1].stop();

    await waitFor(() => expect(recorderInstances.length).toBe(3));
    recorderInstances[2].stop();

    await waitFor(() => expect(voiceProfileAPI.enroll).toHaveBeenCalledTimes(1));
  });

  it('3 kayıttan biri sırasında mikrofon hatası olursa süreç baştan başlar, kısmi dizi gönderilmez', async () => {
    const { voiceProfileAPI } = await import('../../src/services/api.js');
    voiceProfileAPI.get.mockResolvedValueOnce(null);

    const fakeStream = { getTracks: () => [{ stop: vi.fn() }] };
    const getUserMediaImpl = vi.fn()
      .mockResolvedValueOnce(fakeStream)
      .mockRejectedValueOnce(new DOMException('Permission denied', 'NotAllowedError'));
    const { recorderInstances } = mockMediaKayit({ getUserMediaImpl });

    render(<Profil />);
    const btn = await screen.findByRole('button', { name: /kayda başla/i });
    fireEvent.click(btn);

    await waitFor(() => expect(recorderInstances.length).toBe(1));
    recorderInstances[0].stop();

    await waitFor(() => expect(getUserMediaImpl).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(useUIStore.getState().toastVisible).toBe(true));

    expect(voiceProfileAPI.enroll).not.toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: /kayda başla/i })).not.toBeDisabled();
  });

  it('mikrofon izni ilk kayıtta reddedilirse çökmeden hata toast\'ı gösterilir ve "Kayda Başla" tekrar kullanılabilir olur', async () => {
    const { voiceProfileAPI } = await import('../../src/services/api.js');
    voiceProfileAPI.get.mockResolvedValueOnce(null);

    const getUserMedia = vi.fn().mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'));
    vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia } });

    render(<Profil />);
    const btn = await screen.findByRole('button', { name: /kayda başla/i });
    fireEvent.click(btn);

    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());
    await waitFor(() => expect(useUIStore.getState().toastVisible).toBe(true));
    expect(voiceProfileAPI.enroll).not.toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: /kayda başla/i })).not.toBeDisabled();
  });
});
