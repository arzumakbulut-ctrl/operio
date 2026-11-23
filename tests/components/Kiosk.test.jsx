import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Kiosk from '../../src/pages/Kiosk.jsx';

vi.mock('../../src/services/api.js', () => ({
  kioskAPI: {
    status: vi.fn(),
    voiceCommand: vi.fn(),
  },
}));

// Aynı sahte (mock) SpeechRecognition/MediaRecorder deseni
// tests/unit/useVoiceDeviceControl.test.js'te kullanılanla aynı —
// burada useVoiceDeviceControl gerçek haliyle (mock'lanmadan) çalışıyor,
// amaç Kiosk.jsx'in hook çıktısını doğru render ettiğini VE hook'un
// speechSynthesis'i gerçekten tetiklediğini uçtan uca doğrulamak.
let recognitionInstances = [];
let mediaRecorderInstances = [];
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
    this.onstop = null;
    mediaRecorderInstances.push(this);
  }
  start() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    // Gerçek MediaRecorder.stop() 'stop' olayını tetikler; Task 1'deki
    // döngü-başı taze MediaRecorder mantığı bu callback'e bağlı.
    if (this.onstop) this.onstop();
  }
}

function finalResult(transcript) {
  const alt = { transcript };
  const result = [alt];
  result.isFinal = true;
  return { results: [result], resultIndex: 0 };
}

let kioskAPI;

beforeEach(async () => {
  vi.clearAllMocks();
  recognitionInstances = [];
  mediaRecorderInstances = [];

  kioskAPI = (await import('../../src/services/api.js')).kioskAPI;
  kioskAPI.status.mockReset();
  kioskAPI.voiceCommand.mockReset();

  vi.stubGlobal('SpeechRecognition', MockSpeechRecognition);
  vi.stubGlobal('MediaRecorder', MockMediaRecorder);

  speakMock = vi.fn();
  vi.stubGlobal('speechSynthesis', { speak: speakMock });
  vi.stubGlobal('SpeechSynthesisUtterance', function SpeechSynthesisUtterance(text) { this.text = text; });

  const fakeStream = { getTracks: () => [{ stop: vi.fn() }] };
  const getUserMedia = vi.fn().mockResolvedValue(fakeStream);
  vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderKioskUntapped(path = '/kiosk/room1?token=tok-abc') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/kiosk/:roomId" element={<Kiosk />} />
      </Routes>
    </MemoryRouter>
  );
}

// Varsayılan: "Başlat" dokunuşu yapılmış kiosk (boru hattı dokunuşla başlar).
function renderKiosk(path) {
  const view = renderKioskUntapped(path);
  fireEvent.click(screen.getByRole('button', { name: 'Başlat' }));
  return view;
}

describe('Kiosk sayfası — "Başlat" dokunuşu (tarayıcı kullanıcı-etkileşimi politikası)', () => {
  it('dokunuştan önce yalnızca Başlat ekranı görünür; status/recognition/speak HİÇ tetiklenmez', async () => {
    kioskAPI.status.mockResolvedValue({ active: true, surgeryId: 's1' });

    renderKioskUntapped();
    await new Promise((r) => setTimeout(r, 0));

    expect(screen.getByRole('button', { name: 'Başlat' })).toBeInTheDocument();
    expect(kioskAPI.status).not.toHaveBeenCalled();
    expect(recognitionInstances.length).toBe(0);
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(speakMock).not.toHaveBeenCalled();
  });

  it('dokunuş: boş bir utterance ile speechSynthesis kilidi açılır, overlay kapanır ve boru hattı başlar; sonraki yanıtlar okunur', async () => {
    kioskAPI.status.mockResolvedValueOnce({ active: true, surgeryId: 's1' });
    kioskAPI.voiceCommand.mockResolvedValueOnce({ type: 'WEB_SEARCH', say: 'Sonuç bu.' });

    renderKioskUntapped();
    fireEvent.click(screen.getByRole('button', { name: 'Başlat' }));

    // Kilit açma: dokunuş işleyicisinin içinde, senkron olarak boş utterance.
    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock.mock.calls[0][0].text).toBe('');
    expect(screen.queryByRole('button', { name: 'Başlat' })).not.toBeInTheDocument();

    await waitFor(() => expect(kioskAPI.status).toHaveBeenCalledWith('room1', 'tok-abc'));
    await waitFor(() => expect(recognitionInstances.length).toBe(1));
    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled());

    act(() => { recognitionInstances[0].onresult(finalResult('Operio hava durumu nedir')); });
    await waitFor(() => expect(speakMock).toHaveBeenCalledTimes(2));
    expect(speakMock.mock.calls[1][0].text).toBe('Sonuç bu.');
  });
});

describe('Kiosk sayfası', () => {
  it('aktif ameliyat yoksa (status() 409) "aktif ameliyat yok" mesajı gösterilir', async () => {
    kioskAPI.status.mockRejectedValueOnce(Object.assign(new Error('no_active_surgery'), { status: 409 }));

    renderKiosk();

    expect(await screen.findByText(/aktif ameliyat yok, sesli kontrol kapalı/i)).toBeInTheDocument();
  });

  it.each([401, 403])('status() %i ile reddederse "Kiosk bağlantısı geçersiz" mesajı gösterilir (no_surgery mesajı DEĞİL)', async (code) => {
    kioskAPI.status.mockRejectedValueOnce(Object.assign(new Error('auth'), { status: code }));

    renderKiosk();

    expect(await screen.findByText(/Kiosk bağlantısı geçersiz, lütfen yöneticinize başvurun\./)).toBeInTheDocument();
    expect(screen.queryByText(/aktif ameliyat yok/i)).not.toBeInTheDocument();
  });

  it('ameliyat aktifse route\'tan roomId/token okunur ve kioskAPI.status doğru parametrelerle çağrılır', async () => {
    kioskAPI.status.mockResolvedValueOnce({ active: true, surgeryId: 's1' });

    renderKiosk('/kiosk/room42?token=tok-xyz');

    await waitFor(() => expect(kioskAPI.status).toHaveBeenCalledWith('room42', 'tok-xyz'));
    expect(screen.queryByText(/aktif ameliyat yok/i)).not.toBeInTheDocument();
  });

  it('bir komut yanıtı geldiğinde ekranda say metni görünür VE speechSynthesis.speak çağrılır (TTS)', async () => {
    kioskAPI.status.mockResolvedValueOnce({ active: true, surgeryId: 's1' });
    kioskAPI.voiceCommand.mockResolvedValueOnce({ type: 'WEB_SEARCH', say: 'İşte bulduğum sonuç.' });

    renderKiosk();

    await waitFor(() => expect(recognitionInstances.length).toBe(1));
    act(() => { recognitionInstances[0].onresult(finalResult('Operio hava durumu nedir')); });

    // Not: "İ" (Türkçe büyük noktalı I) JS'in varsayılan /i bayrağıyla düz
    // "i"ye eşleşmiyor (Unicode case-folding kuralı) — bu yüzden eşleşme
    // dizesi baştaki "İ"yi içermiyor, bu bir uygulama hatası değil.
    expect(await screen.findByText(/bulduğum sonuç\./i)).toBeInTheDocument();
    // 1. çağrı: "Başlat" dokunuşundaki boş kilit-açma utterance'ı; 2.: gerçek yanıt.
    await waitFor(() => expect(speakMock).toHaveBeenCalledTimes(2));
    expect(speakMock.mock.calls[1][0].text).toBe('İşte bulduğum sonuç.');
  });

  it('TIMEOUT yanıtının iki cümlesi de ekranda birleşik olarak gösterilir', async () => {
    kioskAPI.status.mockResolvedValueOnce({ active: true, surgeryId: 's1' });
    kioskAPI.voiceCommand.mockResolvedValueOnce({ type: 'TIMEOUT', say: ['Sizi dinleyemedim.', 'Tekrar deneyin.'] });

    renderKiosk();

    await waitFor(() => expect(recognitionInstances.length).toBe(1));
    act(() => { recognitionInstances[0].onresult(finalResult('Operio ışıkları aç')); });

    expect(await screen.findByText(/Sizi dinleyemedim\..*Tekrar deneyin\./)).toBeInTheDocument();
  });

  it('bir döngünün tamamlanmış (biriktirilmiş) MediaRecorder chunk\'ları base64\'e kodlanıp voiceCommand\'a "audio" olarak uçtan uca iletilir', async () => {
    kioskAPI.status.mockResolvedValueOnce({ active: true, surgeryId: 's1' });
    kioskAPI.voiceCommand.mockResolvedValueOnce({ type: 'DEVICE_COMMAND', say: 'Koter açıldı' });

    renderKiosk();

    await waitFor(() => expect(recognitionInstances.length).toBe(1));
    await waitFor(() => expect(mediaRecorderInstances.length).toBe(1));

    const recorder = mediaRecorderInstances[0];
    // Task 1 (döngü-başı taze MediaRecorder): aynı döngü içindeki chunk'lar
    // BİRİKTİRİLİR (overwrite edilmez) ve döngü recorder.stop()/onstop ile
    // bittiğinde tek bir blob'a birleştirilir.
    act(() => { recorder.ondataavailable({ data: new Blob(['ilk-parca'], { type: 'audio/webm' }) }); });
    act(() => { recorder.ondataavailable({ data: new Blob(['son-parca'], { type: 'audio/webm' }) }); });
    act(() => { recorder.stop(); });

    act(() => { recognitionInstances[0].onresult(finalResult('Operio koteri aç')); });

    await waitFor(() => expect(kioskAPI.voiceCommand).toHaveBeenCalledTimes(1));
    const [, , body] = kioskAPI.voiceCommand.mock.calls[0];
    expect(typeof body.audio).toBe('string');
    expect(atob(body.audio)).toBe('ilk-parcason-parca');
  });
});
