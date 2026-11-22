import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../src/services/api.js', () => ({
  kioskAPI: {
    status: vi.fn(),
    voiceCommand: vi.fn(),
  },
}));

// ── Web Speech / MediaRecorder sahte (mock) altyapısı ────────────────────
// Bu kod tabanında SpeechRecognition/MediaRecorder/speechSynthesis'i
// kullanan ilk özellik bu olduğu için gerçekçi ama basit sahteler kuruyoruz:
// - MockSpeechRecognition: start()/stop() çağrı sayaçları tutar, onresult/onend
//   testten doğrudan tetiklenebilir.
// - MockMediaRecorder: Profil.jsx'teki (Task 12) MediaRecorder mock desenine
//   benziyor ama start(timeslice) argümanını da kaydediyor.
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
    this.started = 0;
    this.stopped = 0;
    recognitionInstances.push(this);
  }
  start() { this.started += 1; }
  stop() { this.stopped += 1; }
}

class MockMediaRecorder {
  constructor(stream) {
    this.stream = stream;
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstop = null;
    this.startedWithTimeslice = null;
    this.stopped = 0;
    mediaRecorderInstances.push(this);
  }
  start(timeslice) { this.state = 'recording'; this.startedWithTimeslice = timeslice; }
  stop() {
    this.state = 'inactive';
    this.stopped += 1;
    // Gerçek MediaRecorder.stop() asenkron olarak 'stop' olayını tetikler;
    // döngü-başı yeniden başlatma mantığı bu callback'e bağlı olduğu için
    // mock da onstop'u çağırmalı (zaten atanmışsa).
    if (this.onstop) this.onstop();
  }
}

// Gerçek bir uzantı (wake-word) tetiklenmiş final SpeechRecognition sonucu üretir.
function finalResult(transcript) {
  const alt = { transcript };
  const result = [alt];
  result.isFinal = true;
  return { results: [result], resultIndex: 0 };
}

function apiError(status, extra = {}) {
  const err = new Error(extra.message || 'hata');
  err.status = status;
  if (extra.code) err.code = extra.code;
  return err;
}

function lastSpokenText() {
  const call = speakMock.mock.calls[speakMock.mock.calls.length - 1];
  return call ? call[0].text : undefined;
}

function spokenTexts() {
  return speakMock.mock.calls.map((c) => c[0].text);
}

let kioskAPI;

beforeEach(async () => {
  vi.clearAllMocks();
  recognitionInstances = [];
  mediaRecorderInstances = [];

  kioskAPI = (await import('../../src/services/api.js')).kioskAPI;
  // clearAllMocks kalıcı mockRejectedValue/mockResolvedValue varsayılanlarını
  // SIFIRLAMAZ — testler arası sızıntıyı önlemek için açıkça reset ediyoruz.
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
  vi.useRealTimers();
});

// Boru hattı artık mount'ta değil, start() ile (Kiosk'taki "Başlat" dokunuşu) başlar.
function renderStartedHook(roomId = 'room1', token = 'tok') {
  const hook = renderHook(() => useVoiceDeviceControlModule.useVoiceDeviceControl(roomId, token));
  act(() => { hook.result.current.start(); });
  return hook;
}

async function renderIdleHook(roomId = 'room1', token = 'kiosk-tok') {
  kioskAPI.status.mockResolvedValueOnce({ active: true, surgeryId: 'surg1' });
  const hook = renderStartedHook(roomId, token);
  await waitFor(() => expect(hook.result.current.state).toBe('idle'));
  await waitFor(() => expect(recognitionInstances.length).toBe(1));
  return hook;
}

let useVoiceDeviceControlModule;

beforeEach(async () => {
  useVoiceDeviceControlModule = await import('../../src/hooks/useVoiceDeviceControl.js');
});

describe('useVoiceDeviceControl — start() kapısı (kullanıcı etkileşimi)', () => {
  it('start() çağrılmadan status() çağrılmaz ve recognition/mikrofon başlamaz', async () => {
    kioskAPI.status.mockResolvedValue({ active: true, surgeryId: 's1' });

    renderHook(() => useVoiceDeviceControlModule.useVoiceDeviceControl('room1', 'tok'));
    await new Promise((r) => setTimeout(r, 0));

    expect(kioskAPI.status).not.toHaveBeenCalled();
    expect(recognitionInstances.length).toBe(0);
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  it('start() iki kez çağrılsa bile pipeline bir kez başlar (idempotent)', async () => {
    const { result } = await renderIdleHook();
    act(() => { result.current.start(); });
    await new Promise((r) => setTimeout(r, 0));

    expect(kioskAPI.status).toHaveBeenCalledTimes(1);
    expect(recognitionInstances.length).toBe(1);
  });
});

describe('useVoiceDeviceControl — mount / no_surgery', () => {
  it('status() 409 ile reddederse state="no_surgery" olur ve recognition pipeline BAŞLAMAZ', async () => {
    kioskAPI.status.mockRejectedValueOnce(apiError(409, { code: 'no_active_surgery' }));

    const { result } = renderStartedHook();

    await waitFor(() => expect(result.current.state).toBe('no_surgery'));
    expect(recognitionInstances.length).toBe(0);
  });

  it.each([
    ['401 (geçersiz/iptal edilmiş token)', () => apiError(401, { code: 'invalid_kiosk_token' })],
    ['403 (modül satın alınmamış)', () => apiError(403, { code: 'module_not_purchased' })],
    ['ağ hatası (status yok)', () => new TypeError('Failed to fetch')],
  ])('status() %s ile reddederse state="setup_error" olur, pipeline başlamaz ve polling YAPILMAZ', async (_label, makeErr) => {
    vi.useFakeTimers();
    kioskAPI.status.mockRejectedValue(makeErr());

    const { result } = renderStartedHook();

    await vi.waitFor(() => expect(result.current.state).toBe('setup_error'));
    expect(recognitionInstances.length).toBe(0);
    expect(kioskAPI.status).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60000);
    expect(kioskAPI.status).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe('setup_error');
  });

  it('no_surgery polling sırasında status() 409 DIŞI bir hata verirse setup_error\'a geçilir ve polling durur', async () => {
    vi.useFakeTimers();
    kioskAPI.status.mockRejectedValueOnce(apiError(409));

    const { result } = renderStartedHook();
    await vi.waitFor(() => expect(result.current.state).toBe('no_surgery'));

    kioskAPI.status.mockRejectedValue(apiError(401));
    await vi.advanceTimersByTimeAsync(15000);
    await vi.waitFor(() => expect(result.current.state).toBe('setup_error'));
    const callsAfterSwitch = kioskAPI.status.mock.calls.length;

    await vi.advanceTimersByTimeAsync(60000);
    expect(kioskAPI.status.mock.calls.length).toBe(callsAfterSwitch);
  });

  it('status() başarılı olursa state="idle" olur ve recognition + MediaRecorder pipeline başlar', async () => {
    const { result } = await renderIdleHook();

    expect(kioskAPI.status).toHaveBeenCalledWith('room1', 'kiosk-tok');
    expect(result.current.state).toBe('idle');
    expect(recognitionInstances[0].started).toBe(1);
    expect(recognitionInstances[0].continuous).toBe(true);
    expect(recognitionInstances[0].lang).toBe('tr-TR');
    expect(recognitionInstances[0].interimResults).toBe(false);

    await waitFor(() => expect(mediaRecorderInstances.length).toBe(1));
    // Task 1 (döngü-başı taze MediaRecorder): recorder artık timeslice ile
    // değil, kendi döngüsünü kendi yöneten setTimeout ile çalışıyor —
    // bkz. 'ses yakalama — döngü-başı taze MediaRecorder' describe bloğu.
    expect(mediaRecorderInstances[0].state).toBe('recording');
  });

  it('no_surgery iken 15 saniyede bir status tekrar denenir, başarılı olunca idle\'a döner', async () => {
    vi.useFakeTimers();
    kioskAPI.status.mockRejectedValueOnce(apiError(409));

    const { result } = renderStartedHook();

    await vi.waitFor(() => expect(result.current.state).toBe('no_surgery'));
    expect(kioskAPI.status).toHaveBeenCalledTimes(1);

    kioskAPI.status.mockResolvedValueOnce({ active: true, surgeryId: 's1' });
    await vi.advanceTimersByTimeAsync(15000);

    await vi.waitFor(() => expect(result.current.state).toBe('idle'));
    expect(kioskAPI.status).toHaveBeenCalledTimes(2);
  });

  it('unmount olduğunda no_surgery polling interval temizlenir (sızıntı yok)', async () => {
    vi.useFakeTimers();
    kioskAPI.status.mockRejectedValue(apiError(409));

    const { result, unmount } = renderStartedHook();
    await vi.waitFor(() => expect(result.current.state).toBe('no_surgery'));

    const callsBeforeUnmount = kioskAPI.status.mock.calls.length;
    unmount();

    await vi.advanceTimersByTimeAsync(60000);
    expect(kioskAPI.status.mock.calls.length).toBe(callsBeforeUnmount);
  });
});

describe('useVoiceDeviceControl — uyandırma kelimesi ("operio") çıkarımı', () => {
  it('"operio" içermeyen bir cümle yok sayılır, voiceCommand çağrılmaz', async () => {
    const { result } = await renderIdleHook();
    act(() => { recognitionInstances[0].onresult(finalResult('bugün hava çok güzel')); });

    await new Promise((r) => setTimeout(r, 0));
    expect(kioskAPI.voiceCommand).not.toHaveBeenCalled();
    expect(result.current.state).toBe('idle');
  });

  it('sadece "operio" (komut kalmıyor) yok sayılır, bir sonraki ifade beklenir', async () => {
    await renderIdleHook();
    act(() => { recognitionInstances[0].onresult(finalResult('Operio')); });

    await new Promise((r) => setTimeout(r, 0));
    expect(kioskAPI.voiceCommand).not.toHaveBeenCalled();
  });

  it('"Operio, koteri aç" -> "koteri aç" komut metni olarak voiceCommand\'a gönderilir', async () => {
    kioskAPI.voiceCommand.mockResolvedValueOnce({ type: 'DEVICE_COMMAND', say: 'Koter açılıyor' });
    const { result } = await renderIdleHook();

    act(() => { recognitionInstances[0].onresult(finalResult('Operio, koteri aç')); });

    await waitFor(() => expect(kioskAPI.voiceCommand).toHaveBeenCalledTimes(1));
    expect(kioskAPI.voiceCommand).toHaveBeenCalledWith(
      'room1', 'kiosk-tok',
      expect.objectContaining({ transcript: 'koteri aç' })
    );
    await waitFor(() => expect(result.current.state).toBe('idle'));
  });
});

describe('ses yakalama — döngü-başı taze MediaRecorder', () => {
  it('her AUDIO_TIMESLICE_MS periyodunda YENİ bir MediaRecorder örneği oluşturulur (tek sürekli örnek değil)', async () => {
    vi.useFakeTimers();
    kioskAPI.status.mockResolvedValueOnce({ active: true, surgeryId: 'surg1' });

    renderStartedHook();
    await vi.waitFor(() => expect(mediaRecorderInstances.length).toBe(1));

    await vi.advanceTimersByTimeAsync(3000);
    await vi.waitFor(() => expect(mediaRecorderInstances.length).toBe(2));

    await vi.advanceTimersByTimeAsync(3000);
    await vi.waitFor(() => expect(mediaRecorderInstances.length).toBe(3));

    // Üç farklı (ayrı) MediaRecorder örneği — tek sürekli örnek üzerinde
    // tekrar start() çağrılmış değil.
    expect(mediaRecorderInstances[0]).not.toBe(mediaRecorderInstances[1]);
    expect(mediaRecorderInstances[1]).not.toBe(mediaRecorderInstances[2]);
  });

  it('getUserMedia audio kısıtlarına noiseSuppression ve echoCancellation ister', async () => {
    await renderIdleHook();
    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1));

    const [constraints] = navigator.mediaDevices.getUserMedia.mock.calls[0];
    expect(constraints.audio.noiseSuppression).toBe(true);
    expect(constraints.audio.echoCancellation).toBe(true);
  });

  it('her döngünün bitmiş blob\'u latestAudioChunkRef\'e (dolaylı: sendVoiceCommand\'a) eşdeğer şekilde ulaşır', async () => {
    vi.useFakeTimers();
    kioskAPI.voiceCommand.mockResolvedValueOnce({ type: 'DEVICE_COMMAND', say: 'Koter açıldı' });
    kioskAPI.status.mockResolvedValueOnce({ active: true, surgeryId: 'surg1' });

    renderStartedHook();
    await vi.waitFor(() => expect(mediaRecorderInstances.length).toBe(1));
    await vi.waitFor(() => expect(recognitionInstances.length).toBe(1));

    const firstCycleRecorder = mediaRecorderInstances[0];
    act(() => {
      firstCycleRecorder.ondataavailable({ data: new Blob(['dongu-parcasi'], { type: 'audio/webm' }) });
    });

    // Döngüyü bitir: setTimeout(AUDIO_TIMESLICE_MS) recorder.stop()'u tetikler,
    // mock'un stop()'u onstop'u çağırır, onstop yeni bir recordCycle başlatır.
    await vi.advanceTimersByTimeAsync(3000);
    await vi.waitFor(() => expect(mediaRecorderInstances.length).toBe(2));

    // İkinci döngü zaten başlamış olsa da, henüz hiç ondataavailable almadı —
    // bu noktada bir wake-word ifadesi tetiklenirse gönderilen ses BİRİNCİ
    // döngünün (tamamlanmış) blob'undan türemeli.
    act(() => { recognitionInstances[0].onresult(finalResult('Operio koteri aç')); });

    await vi.waitFor(() => expect(kioskAPI.voiceCommand).toHaveBeenCalledTimes(1));
    const [, , body] = kioskAPI.voiceCommand.mock.calls[0];
    expect(atob(body.audio)).toBe('dongu-parcasi');
  });

  it('unmount olunca veya no_surgery\'ye geçince döngü yeniden başlamaz', async () => {
    vi.useFakeTimers();
    kioskAPI.status.mockResolvedValueOnce({ active: true, surgeryId: 'surg1' });

    const { unmount } = renderStartedHook();
    await vi.waitFor(() => expect(mediaRecorderInstances.length).toBe(1));

    const countBeforeUnmount = mediaRecorderInstances.length;
    unmount();

    // Döngünün zamanlanmış setTimeout'u yine de ateşlenir (temizlenmiyor),
    // ama onstop içindeki unmountedRef kontrolü yeni bir MediaRecorder
    // OLUŞTURULMASINI engellemeli.
    await vi.advanceTimersByTimeAsync(3000);
    expect(mediaRecorderInstances.length).toBe(countBeforeUnmount);
  });

  it('mikrofon izni reddedilirse (getUserMedia reject) ses hattı sessizce audio:null ile çalışmaya devam eder', async () => {
    navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(new Error('NotAllowedError'));
    kioskAPI.voiceCommand.mockResolvedValueOnce({ type: 'DEVICE_COMMAND', say: 'Koter açıldı' });
    const { result } = await renderIdleHook();

    expect(mediaRecorderInstances.length).toBe(0);

    act(() => { recognitionInstances[0].onresult(finalResult('Operio koteri aç')); });

    await waitFor(() => expect(kioskAPI.voiceCommand).toHaveBeenCalledTimes(1));
    const [, , body] = kioskAPI.voiceCommand.mock.calls[0];
    expect(body.audio).toBeNull();

    await waitFor(() => expect(result.current.state).toBe('idle'));
  });
});

describe('useVoiceDeviceControl — yanıt tipleri', () => {
  it('TIMEOUT yanıtındaki iki cümle sırayla speechSynthesis ile okunur, state idle\'a döner', async () => {
    kioskAPI.voiceCommand.mockResolvedValueOnce({ type: 'TIMEOUT', say: ['Sizi dinleyemedim.', 'Tekrar deneyin.'] });
    const { result } = await renderIdleHook();

    act(() => { recognitionInstances[0].onresult(finalResult('Operio ışıkları aç')); });

    await waitFor(() => expect(result.current.state).toBe('idle'));
    expect(spokenTexts()).toEqual(['Sizi dinleyemedim.', 'Tekrar deneyin.']);
    expect(result.current.lastResponse).toEqual({ type: 'TIMEOUT', say: ['Sizi dinleyemedim.', 'Tekrar deneyin.'] });
  });

  it('pending_confirmation yanıtı: state="awaiting_confirmation", say okunur', async () => {
    kioskAPI.voiceCommand.mockResolvedValueOnce({
      type: 'DEVICE_COMMAND', status: 'pending_confirmation', say: 'Koteri açmak istediğinize eminmisiniz?',
    });
    const { result } = await renderIdleHook();

    act(() => { recognitionInstances[0].onresult(finalResult('Operio koteri aç')); });

    await waitFor(() => expect(result.current.state).toBe('awaiting_confirmation'));
    expect(lastSpokenText()).toBe('Koteri açmak istediğinize eminmisiniz?');
  });

  it('awaiting_confirmation sırasında bir sonraki uyandırma-komutu confirmationAnswer ile İKİNCİ voiceCommand çağrısını tetikler', async () => {
    kioskAPI.voiceCommand.mockResolvedValueOnce({
      type: 'DEVICE_COMMAND', status: 'pending_confirmation', say: 'Koteri açmak istediğinize eminmisiniz?',
    });
    const { result } = await renderIdleHook();

    act(() => { recognitionInstances[0].onresult(finalResult('Operio koteri aç')); });
    await waitFor(() => expect(result.current.state).toBe('awaiting_confirmation'));

    kioskAPI.voiceCommand.mockResolvedValueOnce({ type: 'DEVICE_COMMAND', say: 'Koter açıldı', device: { id: 'd1' } });
    act(() => { recognitionInstances[0].onresult(finalResult('Operio evet')); });

    await waitFor(() => expect(kioskAPI.voiceCommand).toHaveBeenCalledTimes(2));
    expect(kioskAPI.voiceCommand).toHaveBeenNthCalledWith(
      2, 'room1', 'kiosk-tok',
      expect.objectContaining({ transcript: 'evet', confirmationAnswer: 'evet' })
    );

    await waitFor(() => expect(result.current.state).toBe('idle'));
    expect(lastSpokenText()).toBe('Koter açıldı');
  });

  it('backend say:null ile pending_confirmation dönerse hiçbir şey seslendirilmez, awaiting_confirmation\'da kalınır', async () => {
    kioskAPI.voiceCommand.mockResolvedValueOnce({
      type: 'DEVICE_COMMAND', status: 'pending_confirmation', say: null,
    });
    const { result } = await renderIdleHook();

    act(() => { recognitionInstances[0].onresult(finalResult('Operio koteri aç')); });

    await waitFor(() => expect(result.current.state).toBe('awaiting_confirmation'));
    expect(speakMock).not.toHaveBeenCalled();
  });

  it('backend "Komut iptal edildi." ile normal (status\'suz) yanıt dönerse idle\'a geçilir ve mesaj seslendirilir', async () => {
    kioskAPI.voiceCommand.mockResolvedValueOnce({
      type: 'DEVICE_COMMAND', status: 'pending_confirmation', say: 'Koteri açmak istediğinize eminmisiniz?',
    });
    const { result } = await renderIdleHook();

    act(() => { recognitionInstances[0].onresult(finalResult('Operio koteri aç')); });
    await waitFor(() => expect(result.current.state).toBe('awaiting_confirmation'));

    kioskAPI.voiceCommand.mockResolvedValueOnce({ type: 'DEVICE_COMMAND', say: 'Komut iptal edildi.' });
    act(() => { recognitionInstances[0].onresult(finalResult('Operio hayır')); });

    await waitFor(() => expect(result.current.state).toBe('idle'));
    expect(lastSpokenText()).toBe('Komut iptal edildi.');
  });

  it('ikinci çağrı confirmation_mismatch (400) ile reddederse hata mesajı okunur, state idle\'a döner', async () => {
    kioskAPI.voiceCommand.mockResolvedValueOnce({
      type: 'DEVICE_COMMAND', status: 'pending_confirmation', say: 'Koteri açmak istediğinize eminmisiniz?',
    });
    const { result } = await renderIdleHook();

    act(() => { recognitionInstances[0].onresult(finalResult('Operio koteri aç')); });
    await waitFor(() => expect(result.current.state).toBe('awaiting_confirmation'));

    kioskAPI.voiceCommand.mockRejectedValueOnce(apiError(400, { code: 'confirmation_mismatch', message: 'Onay cümlesi hatalı veya süresi geçti.' }));
    act(() => { recognitionInstances[0].onresult(finalResult('Operio yanlış cümle')); });

    await waitFor(() => expect(result.current.state).toBe('idle'));
    expect(lastSpokenText()).toBe('Onay cümlesi hatalı veya süresi geçti.');
  });

  it('say-only yanıtlar (SPOTIFY_PLAY/WEB_SEARCH/UNKNOWN/status\'suz DEVICE_COMMAND) için say okunur ve state idle\'a döner', async () => {
    kioskAPI.voiceCommand.mockResolvedValueOnce({ type: 'WEB_SEARCH', say: 'İşte bulduğum sonuç.' });
    const { result } = await renderIdleHook();

    act(() => { recognitionInstances[0].onresult(finalResult('Operio hava durumu nedir')); });

    await waitFor(() => expect(result.current.state).toBe('idle'));
    expect(lastSpokenText()).toBe('İşte bulduğum sonuç.');
    expect(result.current.lastResponse).toEqual({ type: 'WEB_SEARCH', say: 'İşte bulduğum sonuç.' });
  });

  it('403 (konuşmacı reddedildi) atılırsa err.message okunur, state idle\'a döner', async () => {
    kioskAPI.voiceCommand.mockRejectedValueOnce(apiError(403, { code: 'unrecognized', message: 'Üzgünüm, sesinizi tanıyamadım.' }));
    const { result } = await renderIdleHook();

    act(() => { recognitionInstances[0].onresult(finalResult('Operio koteri aç')); });

    await waitFor(() => expect(result.current.state).toBe('idle'));
    expect(lastSpokenText()).toBe('Üzgünüm, sesinizi tanıyamadım.');
  });

  it('409 (ameliyat bitti) atılırsa sabit mesaj okunur, state="no_surgery" olur (ve recognition pipeline durur)', async () => {
    kioskAPI.voiceCommand.mockRejectedValueOnce(apiError(409));
    const { result } = await renderIdleHook();
    const rec = recognitionInstances[0];
    const startsBefore = rec.started;

    act(() => { recognitionInstances[0].onresult(finalResult('Operio koteri aç')); });

    await waitFor(() => expect(result.current.state).toBe('no_surgery'));
    expect(lastSpokenText()).toBe('Bu ameliyat sona erdi, sesli kontrol artık kapalı.');

    // Pipeline temizliği: recognition durdurulmuş olmalı, yeniden start() ÇAĞRILMAMIŞ olmalı.
    expect(rec.stopped).toBeGreaterThan(0);
    expect(rec.started).toBe(startsBefore);

    // onend daha sonra (gerçek tarayıcıda asenkron) tetiklenirse bile tekrar başlamamalı.
    act(() => { rec.onend && rec.onend(); });
    expect(rec.started).toBe(startsBefore);
  });

  it('diğer (genel) hatalarda sabit genel hata mesajı okunur, state idle\'a döner', async () => {
    kioskAPI.voiceCommand.mockRejectedValueOnce(new Error('beklenmeyen ağ hatası'));
    const { result } = await renderIdleHook();

    act(() => { recognitionInstances[0].onresult(finalResult('Operio koteri aç')); });

    await waitFor(() => expect(result.current.state).toBe('idle'));
    expect(lastSpokenText()).toBe('Bir hata oluştu, lütfen tekrar deneyin.');
  });
});

describe('useVoiceDeviceControl — unmount temizliği', () => {
  it('unmount sonrası recognition onend tetiklense bile tekrar start() çağrılmaz', async () => {
    const { unmount } = await renderIdleHook();
    const rec = recognitionInstances[0];
    const startsBefore = rec.started;

    unmount();
    act(() => { rec.onend && rec.onend(); });

    expect(rec.started).toBe(startsBefore);
  });
});
