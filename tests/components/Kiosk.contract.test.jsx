import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Kiosk from '../../src/pages/Kiosk.jsx';

// ──────────────────────────────────────────────────────────────
// Uçtan uca SÖZLEŞME testi: Kiosk.jsx → GERÇEK useVoiceDeviceControl →
// GERÇEK kioskAPI (src/services/api.js, mock'lanmadan) → kioskRequest →
// sadece global.fetch stub'lanır. Yanıtlar backend'in gerçek zarfıyla
// ({ success, data } — operio-backend utils/response.js ok()) ve kiosk.routes.js
// / kioskRoomAuth.js'teki gövde şekilleriyle aynıdır. kioskAPI.* `.then(r => r.data)`
// ile zarfı açtığı için hook'a `data` içeriği ulaşır.
//
// Diğer Kiosk/hook testleri kioskAPI modülünü tamamen mock'ladığı için bu
// katmanlar arası boşluk (hook'un ürettiği gövde → fetch'e giden JSON) hiç
// test edilmiyordu.
// ──────────────────────────────────────────────────────────────

let recognitionInstances = [];
let speakMock;

class MockSpeechRecognition {
  constructor() {
    this.continuous = false;
    this.lang = '';
    this.interimResults = true;
    this.onresult = null;
    this.onend = null;
    recognitionInstances.push(this);
  }
  start() {}
  stop() {}
}

class MockMediaRecorder {
  constructor(stream) {
    this.stream = stream;
    this.state = 'inactive';
    this.ondataavailable = null;
  }
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; }
}

function finalResult(transcript) {
  const alt = { transcript };
  const result = [alt];
  result.isFinal = true;
  return { results: [result], resultIndex: 0 };
}

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

let fetchMock;

beforeEach(() => {
  recognitionInstances = [];
  localStorage.clear();

  vi.stubGlobal('SpeechRecognition', MockSpeechRecognition);
  vi.stubGlobal('MediaRecorder', MockMediaRecorder);
  speakMock = vi.fn();
  vi.stubGlobal('speechSynthesis', { speak: speakMock });
  vi.stubGlobal('SpeechSynthesisUtterance', function SpeechSynthesisUtterance(text) { this.text = text; });
  const fakeStream = { getTracks: () => [{ stop: vi.fn() }] };
  vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream) } });

  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderAndTapStart(path = '/kiosk/room1?token=kiosk-tok') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/kiosk/:roomId" element={<Kiosk />} />
      </Routes>
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Başlat' }));
}

function voiceCommandCalls() {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes('/voice-command'));
}

describe('Kiosk sözleşme testi (yalnızca fetch stub\'lı)', () => {
  it('cihaz komutu → pending_confirmation → onay ifadesi: İKİNCİ voice-command isteğinin gövdesi confirmationAnswer içerir', async () => {
    fetchMock.mockImplementation(async (url, opts) => {
      if (String(url).endsWith('/kiosk/rooms/room1/status')) {
        return jsonResponse(200, { success: true, data: { active: true, surgeryId: 'surg-1' } });
      }
      if (String(url).endsWith('/kiosk/rooms/room1/voice-command')) {
        const body = JSON.parse(opts.body);
        if (!body.confirmationAnswer) {
          return jsonResponse(200, {
            success: true,
            data: {
              type: 'DEVICE_COMMAND',
              status: 'pending_confirmation',
              say: 'Koteri açmak istediğinize eminmisiniz?',
            },
          });
        }
        return jsonResponse(200, {
          success: true,
          data: { type: 'DEVICE_COMMAND', say: 'Komut uygulandı.', device: { id: 'dev-1' } },
        });
      }
      throw new Error(`beklenmeyen istek: ${url}`);
    });

    renderAndTapStart();

    // status isteği kiosk token'ıyla gitmeli ve hook idle'a geçip dinlemeye başlamalı.
    await waitFor(() => expect(recognitionInstances.length).toBe(1));
    const [statusUrl, statusOpts] = fetchMock.mock.calls[0];
    expect(statusUrl).toMatch(/\/kiosk\/rooms\/room1\/status$/);
    expect(statusOpts.method).toBe('GET');
    expect(statusOpts.headers.Authorization).toBe('Bearer kiosk-tok');

    // 1) Uyandırma kelimesi + cihaz komutu.
    act(() => { recognitionInstances[0].onresult(finalResult('Operio koteri aç')); });

    await waitFor(() => expect(voiceCommandCalls().length).toBe(1));
    const firstBody = JSON.parse(voiceCommandCalls()[0][1].body);
    expect(voiceCommandCalls()[0][1].method).toBe('POST');
    expect(voiceCommandCalls()[0][1].headers.Authorization).toBe('Bearer kiosk-tok');
    expect(firstBody.transcript).toBe('koteri aç');
    expect(firstBody.confirmationAnswer).toBeUndefined();

    // Zarf ({success,data}) doğru açıldı mı: pending_confirmation say metni okunur + ekranda görünür.
    await waitFor(() => expect(speakMock.mock.calls.map((c) => c[0].text))
      .toContain('Koteri açmak istediğinize eminmisiniz?'));
    expect(await screen.findByText(/awaiting_confirmation/)).toBeInTheDocument();

    // 2) Onay ifadesi (uyandırma kelimesiyle birlikte söylenir).
    act(() => { recognitionInstances[0].onresult(finalResult('Operio evet')); });

    await waitFor(() => expect(voiceCommandCalls().length).toBe(2));
    const secondBody = JSON.parse(voiceCommandCalls()[1][1].body);
    // NOT: `transcript` içeriği bilinçli olarak sabitlenmiyor — backend,
    // confirmationAnswer varken transcript'i yok sayacak şekilde düzeltiliyor.
    expect(secondBody).toHaveProperty('confirmationAnswer', 'evet');

    // Final yanıt okunur ve hook idle'a döner.
    await waitFor(() => expect(speakMock.mock.calls.map((c) => c[0].text)).toContain('Komut uygulandı.'));
    expect(await screen.findByText(/Durum: idle/)).toBeInTheDocument();
  });

  it('status 401 (backend hata zarfı) → kioskRequest err.status=401 → "Kiosk bağlantısı geçersiz" ekranı', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, {
      success: false, error: { code: 'invalid_kiosk_token', message: 'Geçersiz kiosk token' },
    }));

    renderAndTapStart();

    expect(await screen.findByText(/Kiosk bağlantısı geçersiz/)).toBeInTheDocument();
  });

  it('status 409 no_active_surgery (backend hata zarfı) → "aktif ameliyat yok" ekranı', async () => {
    fetchMock.mockResolvedValue(jsonResponse(409, {
      success: false, error: { code: 'no_active_surgery', message: 'Bu odada devam eden bir ameliyat yok' },
    }));

    renderAndTapStart();

    expect(await screen.findByText(/aktif ameliyat yok, sesli kontrol kapalı/i)).toBeInTheDocument();
  });
});
