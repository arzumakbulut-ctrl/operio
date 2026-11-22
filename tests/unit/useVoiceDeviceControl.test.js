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
    this.startedWithTimeslice = null;
    this.stopped = 0;
    mediaRecorderInstances.push(this);
  }
  start(timeslice) { this.state = 'recording'; this.startedWithTimeslice = timeslice; }
  stop() { this.state = 'inactive'; this.stopped += 1; }
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
    expect(mediaRecorderInstances[0].startedWithTimeslice).toBe(3000);
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

describe('useVoiceDeviceControl — dönen (rolling) MediaRecorder ses tamponu', () => {
  it('ondataavailable İKİ KEZ tetiklenirse tampon sadece SON chunk\'ı tutar (biriktirmez); bu chunk base64\'e kodlanıp voiceCommand\'a "audio" olarak gönderilir', async () => {
    kioskAPI.voiceCommand.mockResolvedValueOnce({ type: 'DEVICE_COMMAND', say: 'Koter açıldı' });
    const { result } = await renderIdleHook();
    await waitFor(() => expect(mediaRecorderInstances.length).toBe(1));

    const recorder = mediaRecorderInstances[0];
    // İlk 3 saniyelik parça — tampon bunu tutar...
    act(() => { recorder.ondataavailable({ data: new Blob(['ilk-parca'], { type: 'audio/webm' }) }); });
    // ...ama ikinci parça gelince ÜZERİNE YAZMALI, biriktirmemeli (ring buffer, tek chunk).
    act(() => { recorder.ondataavailable({ data: new Blob(['son-parca'], { type: 'audio/webm' }) }); });

    act(() => { recognitionInstances[0].onresult(finalResult('Operio koteri aç')); });

    await waitFor(() => expect(kioskAPI.voiceCommand).toHaveBeenCalledTimes(1));
    const [, , body] = kioskAPI.voiceCommand.mock.calls[0];

    expect(typeof body.audio).toBe('string');
    expect(body.audio.length).toBeGreaterThan(0);
    // blobToBase64 (FileReader.readAsDataURL + prefix temizleme) doğru çalışıyor mu —
    // decode edilince SADECE en son chunk'ın içeriği çıkmalı, ilkiyle birleşmiş olmamalı.
    expect(atob(body.audio)).toBe('son-parca');

    await waitFor(() => expect(result.current.state).toBe('idle'));
  });

  it('ondataavailable boş (size:0) veri ile tetiklenirse tampon güncellenmez (önceki chunk korunur)', async () => {
    kioskAPI.voiceCommand.mockResolvedValueOnce({ type: 'DEVICE_COMMAND', say: 'Koter açıldı' });
    const { result } = await renderIdleHook();
    await waitFor(() => expect(mediaRecorderInstances.length).toBe(1));

    const recorder = mediaRecorderInstances[0];
    act(() => { recorder.ondataavailable({ data: new Blob(['gercek-parca'], { type: 'audio/webm' }) }); });
    // Boş bir chunk (bazı tarayıcılarda sessizlik için size:0 Blob gelebilir) tamponu silmemeli.
    act(() => { recorder.ondataavailable({ data: new Blob([], { type: 'audio/webm' }) }); });

    act(() => { recognitionInstances[0].onresult(finalResult('Operio koteri aç')); });

    await waitFor(() => expect(kioskAPI.voiceCommand).toHaveBeenCalledTimes(1));
    const [, , body] = kioskAPI.voiceCommand.mock.calls[0];
    expect(atob(body.audio)).toBe('gercek-parca');

    await waitFor(() => expect(result.current.state).toBe('idle'));
  });

  it('hiç ondataavailable tetiklenmemişse (tampon boş) voiceCommand audio:null ile çağrılır (çökmez)', async () => {
    kioskAPI.voiceCommand.mockResolvedValueOnce({ type: 'DEVICE_COMMAND', say: 'Koter açıldı' });
    const { result } = await renderIdleHook();
    await waitFor(() => expect(mediaRecorderInstances.length).toBe(1));

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

  it('pending_confirmation yanıtı: state="awaiting_confirmation", pendingPhrase dolu, say okunur', async () => {
    kioskAPI.voiceCommand.mockResolvedValueOnce({
      type: 'DEVICE_COMMAND', status: 'pending_confirmation', phrase: '4-7-2', say: 'Onaylamak için 4-7-2 deyin',
    });
    const { result } = await renderIdleHook();

    act(() => { recognitionInstances[0].onresult(finalResult('Operio koteri aç')); });

    await waitFor(() => expect(result.current.state).toBe('awaiting_confirmation'));
    expect(result.current.pendingPhrase).toBe('4-7-2');
    expect(lastSpokenText()).toBe('Onaylamak için 4-7-2 deyin');
  });

  it('awaiting_confirmation sırasında bir sonraki uyandırma-komutu confirmationPhrase ile İKİNCİ voiceCommand çağrısını tetikler', async () => {
    kioskAPI.voiceCommand.mockResolvedValueOnce({
      type: 'DEVICE_COMMAND', status: 'pending_confirmation', phrase: '4-7-2', say: 'Onaylamak için 4-7-2 deyin',
    });
    const { result } = await renderIdleHook();

    act(() => { recognitionInstances[0].onresult(finalResult('Operio koteri aç')); });
    await waitFor(() => expect(result.current.state).toBe('awaiting_confirmation'));

    kioskAPI.voiceCommand.mockResolvedValueOnce({ type: 'DEVICE_COMMAND', say: 'Koter açıldı', device: { id: 'd1' } });
    act(() => { recognitionInstances[0].onresult(finalResult('Operio 4 7 2')); });

    await waitFor(() => expect(kioskAPI.voiceCommand).toHaveBeenCalledTimes(2));
    expect(kioskAPI.voiceCommand).toHaveBeenNthCalledWith(
      2, 'room1', 'kiosk-tok',
      expect.objectContaining({ transcript: '4 7 2', confirmationPhrase: '4 7 2' })
    );

    await waitFor(() => expect(result.current.state).toBe('idle'));
    expect(lastSpokenText()).toBe('Koter açıldı');
  });

  it('ikinci çağrı confirmation_mismatch (400) ile reddederse hata mesajı okunur, state idle, pendingPhrase temizlenir', async () => {
    kioskAPI.voiceCommand.mockResolvedValueOnce({
      type: 'DEVICE_COMMAND', status: 'pending_confirmation', phrase: '4-7-2', say: 'Onaylamak için 4-7-2 deyin',
    });
    const { result } = await renderIdleHook();

    act(() => { recognitionInstances[0].onresult(finalResult('Operio koteri aç')); });
    await waitFor(() => expect(result.current.state).toBe('awaiting_confirmation'));

    kioskAPI.voiceCommand.mockRejectedValueOnce(apiError(400, { code: 'confirmation_mismatch', message: 'Onay cümlesi hatalı veya süresi geçti.' }));
    act(() => { recognitionInstances[0].onresult(finalResult('Operio yanlış cümle')); });

    await waitFor(() => expect(result.current.state).toBe('idle'));
    expect(result.current.pendingPhrase).toBeNull();
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
