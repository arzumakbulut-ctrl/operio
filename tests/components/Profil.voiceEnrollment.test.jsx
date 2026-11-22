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

  it('"Kayda Başla" tıklanınca mikrofon izni istenir, kayıt başlar ve kayıt bitince enroll() çağrılıp başarı toast\'ı gösterilir', async () => {
    const { voiceProfileAPI } = await import('../../src/services/api.js');
    voiceProfileAPI.get.mockResolvedValueOnce(null);

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
    const getUserMedia = vi.fn().mockResolvedValue(fakeStream);
    vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia } });

    render(<Profil />);
    fireEvent.click(await screen.findByRole('button', { name: /kayda başla/i }));

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledWith({ audio: true }));
    await waitFor(() => expect(recorderInstances.length).toBe(1));
    expect(recorderInstances[0].state).toBe('recording');

    // Kaydın (sabit süreli ya da elle durdurulan) bittiğini simüle et.
    recorderInstances[0].stop();

    await waitFor(() => expect(voiceProfileAPI.enroll).toHaveBeenCalledTimes(1));
    expect(voiceProfileAPI.enroll).toHaveBeenCalledWith(expect.any(String));

    await waitFor(() => expect(screen.getByRole('button', { name: /yeniden kaydet/i })).toBeInTheDocument());
    expect(await screen.findByText(/ses profiliniz oluşturuldu/i)).toBeInTheDocument();
    expect(useUIStore.getState().toastVisible).toBe(true);
  });

  it('mikrofon izni reddedilirse çökmeden hata toast\'ı gösterilir ve "Kayda Başla" tekrar kullanılabilir olur', async () => {
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
