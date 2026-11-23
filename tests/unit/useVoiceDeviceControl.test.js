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
    // Gerçek MediaRecorder: state zaten 'inactive' iken stop() çağrılırsa
    // InvalidStateError FIRLATIR (onstop'u İKİNCİ kez TETİKLEMEZ) — bu, Finding 2/5
    // fix'lerinin dayandığı try/catch'li çağrı yerlerinin (recordCycle'ın periyodik
    // setTimeout'u, flushCurrentRecording) doğru test edilebilmesi için önemli:
    // bir döngü zaten manuel flush ile bitirildiyse, daha sonra ateşlenen "doğal"
    // 3s zaman aşımı onstop'u TEKRAR çağırmamalı.
    if (this.state !== 'recording') {
      throw new DOMException('The MediaRecorder is inactive.', 'InvalidStateError');
    }
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

describe('useVoiceDeviceControl — wake-word flush (final review Finding 1)', () => {
  it('wake-word tetiklendiğinde AKTİF kayıttaki döngü flush edilir — gönderilen ses, bir önceki TAMAMLANMIŞ (bayat) döngünün değil, o anki konuşmanın verisidir', async () => {
    kioskAPI.status.mockResolvedValueOnce({ active: true, surgeryId: 'surg1' });
    kioskAPI.voiceCommand.mockResolvedValueOnce({ type: 'DEVICE_COMMAND', say: 'Koter açıldı' });

    const { unmount } = renderStartedHook();
    await waitFor(() => expect(mediaRecorderInstances.length).toBe(1));
    await waitFor(() => expect(recognitionInstances.length).toBe(1));

    // 1. döngü "eski-veri" ile tamamlanır (stop() -> onstop senkron tetiklenir,
    // yeni döngü #2 hemen başlar — bu, gerçek kodun kendi kendini yeniden
    // başlatan rolling-recorder davranışı).
    mediaRecorderInstances[0].ondataavailable({ data: new Blob(['eski-veri'], { type: 'audio/webm' }) });
    mediaRecorderInstances[0].stop();
    await waitFor(() => expect(mediaRecorderInstances.length).toBe(2));

    // 2. döngü (ŞU AN kayıtta) wake-word'ün gerçek konuşmasını alır ama kendi
    // 3 saniyelik döngüsü HENÜZ bitmedi (hiç stop() edilmedi) — SpeechRecognition'ın
    // final transcript'i konuşma bittikten sonra geldiği için bu normal.
    mediaRecorderInstances[1].ondataavailable({ data: new Blob(['wake-word-sesi'], { type: 'audio/webm' }) });
    expect(mediaRecorderInstances[1].state).toBe('recording');

    act(() => { recognitionInstances[0].onresult(finalResult('Operio koteri aç')); });

    // Flush: handleWakeWordUtterance 2. döngüyü (hâlâ kayıtta olanı) durdurmuş
    // olmalı — bu da kendi onstop'u üzerinden 3. döngüyü başlatmış olmalı.
    await waitFor(() => expect(mediaRecorderInstances[1].stopped).toBe(1));
    await waitFor(() => expect(mediaRecorderInstances.length).toBe(3));

    await waitFor(() => expect(kioskAPI.voiceCommand).toHaveBeenCalledTimes(1));
    const [, , body] = kioskAPI.voiceCommand.mock.calls[0];
    // Bayat ("eski-veri") DEĞİL, flush edilen 2. döngünün ("wake-word-sesi") verisi gönderilmeli.
    expect(atob(body.audio)).toBe('wake-word-sesi');

    // Testler arası sızıntı olmasın: 3. döngünün gerçek (fake olmayan) 3s'lik
    // setTimeout'u hâlâ bekliyor olurdu — unmount ile pipeline'ı hemen durdur.
    unmount();
  });

  it('wake-word anında kayıtta hiçbir döngü yoksa (mikrofon izni yok) flush sonsuza dek beklemez, audio:null ile devam eder', async () => {
    navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(new Error('NotAllowedError'));
    kioskAPI.voiceCommand.mockResolvedValueOnce({ type: 'DEVICE_COMMAND', say: 'Koter açıldı' });
    const { result, unmount } = await renderIdleHook();

    expect(mediaRecorderInstances.length).toBe(0);
    act(() => { recognitionInstances[0].onresult(finalResult('Operio koteri aç')); });

    // Flush'ın "aktif döngü yok -> hemen çözül" dalı tetiklenmeli; aksi halde
    // bu test asla çözülmeyen bir promise'de asılı kalır ve timeout ile FAIL eder.
    await waitFor(() => expect(kioskAPI.voiceCommand).toHaveBeenCalledTimes(1));
    expect(kioskAPI.voiceCommand.mock.calls[0][2].audio).toBeNull();
    await waitFor(() => expect(result.current.state).toBe('idle'));
    unmount();
  });
});

describe('useVoiceDeviceControl — bayat ses korumaları (final review Finding 2)', () => {
  it('sendVoiceCommand sonrası latestAudioChunkRef temizlenir — bir SONRAKİ komutta yeni chunk yoksa audio:null gönderilir (bayat ses yeniden gönderilmez)', async () => {
    kioskAPI.status.mockResolvedValueOnce({ active: true, surgeryId: 'surg1' });
    kioskAPI.voiceCommand.mockResolvedValueOnce({ type: 'DEVICE_COMMAND', say: 'Koter açıldı' });

    const { unmount } = renderStartedHook();
    await waitFor(() => expect(mediaRecorderInstances.length).toBe(1));
    await waitFor(() => expect(recognitionInstances.length).toBe(1));

    mediaRecorderInstances[0].ondataavailable({ data: new Blob(['eski-ses'], { type: 'audio/webm' }) });

    act(() => { recognitionInstances[0].onresult(finalResult('Operio koteri aç')); });
    await waitFor(() => expect(kioskAPI.voiceCommand).toHaveBeenCalledTimes(1));
    expect(atob(kioskAPI.voiceCommand.mock.calls[0][2].audio)).toBe('eski-ses');
    await waitFor(() => expect(mediaRecorderInstances.length).toBe(2));

    // İkinci bir wake-word: yeni döngü (#2) flush edilir ama hiç veri almadı
    // (chunks.length===0) — bu yüzden latestAudioChunkRef GÜNCELLENMEZ. Eğer
    // ref birinci gönderimden sonra temizlenmemiş olsaydı, burada YANLIŞLIKLA
    // "eski-ses" tekrar gönderilirdi (bayat/başka birine ait ses riski).
    kioskAPI.voiceCommand.mockResolvedValueOnce({ type: 'DEVICE_COMMAND', say: 'Tanınamadı' });
    act(() => { recognitionInstances[0].onresult(finalResult('Operio ışıkları aç')); });

    await waitFor(() => expect(kioskAPI.voiceCommand).toHaveBeenCalledTimes(2));
    expect(kioskAPI.voiceCommand.mock.calls[1][2].audio).toBeNull();
    unmount();
  });

  it('recordCycle MediaRecorder oluşturma/start sırasında hata verirse (ör. track bitti) döngü SESSİZCE durur, hata fırlatmaz ve latestAudioChunkRef temizlenir', async () => {
    kioskAPI.status.mockResolvedValueOnce({ active: true, surgeryId: 'surg1' });

    let constructCount = 0;
    class FailingSecondMediaRecorder extends MockMediaRecorder {
      constructor(stream) {
        constructCount += 1;
        if (constructCount === 2) throw new DOMException('Track ended', 'InvalidStateError');
        super(stream);
      }
    }
    vi.stubGlobal('MediaRecorder', FailingSecondMediaRecorder);

    const { unmount } = renderStartedHook();
    await waitFor(() => expect(mediaRecorderInstances.length).toBe(1));
    await waitFor(() => expect(recognitionInstances.length).toBe(1));

    mediaRecorderInstances[0].ondataavailable({ data: new Blob(['ses-once'], { type: 'audio/webm' }) });

    // Birinci döngüyü bitir: onstop içinde recordCycle(stream) ÇAĞRILIR, bu da
    // 2. MediaRecorder'ı oluşturmaya çalışır ve FailingSecondMediaRecorder throw eder —
    // recordCycle'ın kendi try/catch'i bunu yakalamalı, dışa (buraya) hiçbir şey sızmamalı.
    expect(() => mediaRecorderInstances[0].stop()).not.toThrow();

    // constructor throw ettiğinde super() çağrılmadığı için push() çalışmaz —
    // döngü burada durmuş olmalı (yeni bir instance YOK).
    expect(mediaRecorderInstances.length).toBe(1);

    // latestAudioChunkRef'in catch bloğunda temizlendiğini doğrula: bir sonraki
    // wake-word'ün gönderdiği ses audio:null olmalı (ne "ses-once" ne başka bir şey).
    kioskAPI.voiceCommand.mockResolvedValueOnce({ type: 'DEVICE_COMMAND', say: 'Tanınamadı' });
    act(() => { recognitionInstances[0].onresult(finalResult('Operio koteri aç')); });

    await waitFor(() => expect(kioskAPI.voiceCommand).toHaveBeenCalledTimes(1));
    expect(kioskAPI.voiceCommand.mock.calls[0][2].audio).toBeNull();
    unmount();
  });
});

describe('useVoiceDeviceControl — awaiting_confirmation istemci TTL\'i (final review Finding 3)', () => {
  it('20 saniye içinde yanıt gelmezse awaiting_confirmation kendiliğinden idle\'a döner', async () => {
    vi.useFakeTimers();
    kioskAPI.status.mockResolvedValueOnce({ active: true, surgeryId: 'surg1' });
    kioskAPI.voiceCommand.mockResolvedValueOnce({
      type: 'DEVICE_COMMAND', status: 'pending_confirmation', say: 'Koteri açmak istediğinize eminmisiniz?',
    });

    const { result, unmount } = renderStartedHook();
    await vi.waitFor(() => expect(result.current.state).toBe('idle'));

    act(() => { recognitionInstances[0].onresult(finalResult('Operio koteri aç')); });
    await vi.waitFor(() => expect(result.current.state).toBe('awaiting_confirmation'));

    await vi.advanceTimersByTimeAsync(19999);
    expect(result.current.state).toBe('awaiting_confirmation');

    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(() => expect(result.current.state).toBe('idle'));
    unmount();
  });

  it('onay süresi dolmadan cevaplanırsa TTL zamanlayıcısı iptal edilir — daha sonra başlayan YENİ bir onayı yanlışlıkla kesmez', async () => {
    vi.useFakeTimers();
    kioskAPI.status.mockResolvedValueOnce({ active: true, surgeryId: 'surg1' });
    kioskAPI.voiceCommand.mockResolvedValueOnce({
      type: 'DEVICE_COMMAND', status: 'pending_confirmation', say: 'Koteri açmak istediğinize eminmisiniz?',
    });

    const { result, unmount } = renderStartedHook();
    await vi.waitFor(() => expect(result.current.state).toBe('idle'));

    act(() => { recognitionInstances[0].onresult(finalResult('Operio koteri aç')); });
    await vi.waitFor(() => expect(result.current.state).toBe('awaiting_confirmation'));

    // TTL dolmadan (5s) cevaplanır.
    await vi.advanceTimersByTimeAsync(5000);
    kioskAPI.voiceCommand.mockResolvedValueOnce({ type: 'DEVICE_COMMAND', say: 'Koter açıldı' });
    act(() => { recognitionInstances[0].onresult(finalResult('Operio evet')); });
    await vi.waitFor(() => expect(result.current.state).toBe('idle'));

    // YENİ bir onay başlatılır.
    kioskAPI.voiceCommand.mockResolvedValueOnce({
      type: 'DEVICE_COMMAND', status: 'pending_confirmation', say: 'Masayı 10 derece eğmemi istiyorsunuz, doğru mu?',
    });
    act(() => { recognitionInstances[0].onresult(finalResult('Operio masayı eğ')); });
    await vi.waitFor(() => expect(result.current.state).toBe('awaiting_confirmation'));

    // Toplam geçen süre ilk onaydan beri 5s + 16s = 21s > 20s'lik orijinal pencere.
    // ESKİ zamanlayıcı temizlenmediyse, bu YENİ onayı erken (süresi dolmuş gibi) keserdi.
    await vi.advanceTimersByTimeAsync(16000);
    expect(result.current.state).toBe('awaiting_confirmation');
    unmount();
  });

  it('unmount olduğunda awaiting_confirmation TTL zamanlayıcısı da temizlenir (unmount sonrası setState çağrılmaz)', async () => {
    vi.useFakeTimers();
    kioskAPI.status.mockResolvedValueOnce({ active: true, surgeryId: 'surg1' });
    kioskAPI.voiceCommand.mockResolvedValueOnce({
      type: 'DEVICE_COMMAND', status: 'pending_confirmation', say: 'Koteri açmak istediğinize eminmisiniz?',
    });

    const { result, unmount } = renderStartedHook();
    await vi.waitFor(() => expect(result.current.state).toBe('idle'));

    act(() => { recognitionInstances[0].onresult(finalResult('Operio koteri aç')); });
    await vi.waitFor(() => expect(result.current.state).toBe('awaiting_confirmation'));

    const callsBeforeUnmount = kioskAPI.voiceCommand.mock.calls.length;
    unmount();

    // TTL zamanlayıcısı stopPipeline() -> clearConfirmationTimeout() ile iptal
    // edilmiş olmalı: zamanlayıcının normalde ateşleyeceği an GEÇTİKTEN sonra bile
    // hiçbir hata fırlatılmamalı VE unmount edilmiş hook yeni bir voiceCommand
    // çağrısı tetiklememeli (temizlenmemiş olsaydı setPhase('idle') unmount
    // sonrası bir state update'i denerdi — bu da en azından bir React uyarısına
    // yol açardı, ama bir yan etkisi/isteği OLMAMALI).
    await expect(vi.advanceTimersByTimeAsync(20000)).resolves.not.toThrow();
    expect(kioskAPI.voiceCommand.mock.calls.length).toBe(callsBeforeUnmount);
  });
});

describe('useVoiceDeviceControl — final review Finding 5 (ufak düzeltmeler)', () => {
  it('say:null pending_confirmation yanıtı lastResponse\'u EZMEZ — ekrandaki asıl onay sorusu görünür kalır', async () => {
    kioskAPI.voiceCommand.mockResolvedValueOnce({
      type: 'DEVICE_COMMAND', status: 'pending_confirmation', say: 'Koteri açmak istediğinize eminmisiniz?',
    });
    const { result, unmount } = await renderIdleHook();

    act(() => { recognitionInstances[0].onresult(finalResult('Operio koteri aç')); });
    await waitFor(() => expect(result.current.state).toBe('awaiting_confirmation'));
    const firstResponse = result.current.lastResponse;
    expect(firstResponse.say).toBe('Koteri açmak istediğinize eminmisiniz?');

    // Belirsiz (say:null) bir ASR sonucu — backend hâlâ bekliyor, hiçbir şey okunmuyor.
    kioskAPI.voiceCommand.mockResolvedValueOnce({ type: 'DEVICE_COMMAND', status: 'pending_confirmation', say: null });
    act(() => { recognitionInstances[0].onresult(finalResult('Operio mmm')); });

    await waitFor(() => expect(kioskAPI.voiceCommand).toHaveBeenCalledTimes(2));
    // lastResponse AYNI referans kalmalı — say:null yanıtı onu EZMEMİŞ olmalı.
    expect(result.current.lastResponse).toBe(firstResponse);
    expect(result.current.state).toBe('awaiting_confirmation');
    unmount();
  });

  it('efekt roomId değişimiyle yeniden kurulduğunda, eski (ölü) döngünün GEÇ gelen onstop\'u yeni akışı bozmaz (stale-cycle guard)', async () => {
    kioskAPI.status.mockResolvedValue({ active: true, surgeryId: 'surg1' });

    // Varsayılan beforeEach mock'u HER çağrıda AYNI fakeStream nesnesini döndürür
    // (mockResolvedValue, Once değil) — bu testte roomId değişimiyle gerçekten
    // FARKLI bir stream alındığını simüle etmek için her çağrıda yeni bir nesne
    // döndüren bir implementasyon kullanıyoruz.
    let streamSeq = 0;
    navigator.mediaDevices.getUserMedia = vi.fn().mockImplementation(
      () => Promise.resolve({ getTracks: () => [{ stop: vi.fn() }], seq: streamSeq++ }),
    );

    const hook = renderHook(
      ({ roomId, token }) => useVoiceDeviceControlModule.useVoiceDeviceControl(roomId, token),
      { initialProps: { roomId: 'room-A', token: 'tok-A' } },
    );
    act(() => { hook.result.current.start(); });
    await waitFor(() => expect(hook.result.current.state).toBe('idle'));
    await waitFor(() => expect(mediaRecorderInstances.length).toBe(1));
    const oldCycleRecorder = mediaRecorderInstances[0];
    const oldStream = oldCycleRecorder.stream;

    hook.rerender({ roomId: 'room-B', token: 'tok-A' });
    await waitFor(() => expect(mediaRecorderInstances.length).toBe(2));
    const newCycleRecorder = mediaRecorderInstances[1];
    expect(newCycleRecorder.stream).not.toBe(oldStream);
    expect(newCycleRecorder.state).toBe('recording');

    // Gerçek bir tarayıcıda eski recorder'ın 'stop' olayı ASENKRON gelir; burada
    // bunu doğrudan tetikleyerek, yeni efekt mediaRecorderRef'i zaten YENİ stream'e
    // taşıdıktan SONRA bu geç olayın geldiğini simüle ediyoruz.
    expect(() => oldCycleRecorder.onstop()).not.toThrow();

    // Guard tetiklenmeli: ölü (eski) stream için YENİ bir MediaRecorder OLUŞTURULMAMALI.
    expect(mediaRecorderInstances.length).toBe(2);
    expect(newCycleRecorder.state).toBe('recording');
    hook.unmount();
  });
});

describe('useVoiceDeviceControl — yanıt tipleri', () => {
  it('TIMEOUT yanıtındaki iki cümle sırayla speechSynthesis ile okunur, state idle\'a döner', async () => {
    kioskAPI.voiceCommand.mockResolvedValueOnce({ type: 'TIMEOUT', say: ['Sizi dinleyemedim.', 'Tekrar deneyin.'] });
    const { result } = await renderIdleHook();

    act(() => { recognitionInstances[0].onresult(finalResult('Operio ışıkları aç')); });

    // Not: Finding 1'in flush-on-wake-word'ü handleWakeWordUtterance'ı ASENKRON
    // yaptı (await flushCurrentRecording() öncesi) — bu, sendVoiceCommand'ın artık
    // SENKRON olarak act() içinde ÇAĞRILMADIĞI anlamına gelir. Tetikleme ÖNCESİ
    // state ZATEN 'idle' olduğundan (renderIdleHook), state===idle'ı DOĞRUDAN
    // beklemek YARIŞ durumu yaratır: waitFor'un İLK (senkron) kontrolü, gerçek
    // yanıt turu henüz BAŞLAMADAN, hâlâ eski/bayat 'idle' değerini görüp
    // YANLIŞLIKLA hemen başarılı olabilir. Bunu önlemek için önce voiceCommand'ın
    // GERÇEKTEN çağrıldığını (tetikleme öncesi KESİNLİKLE yanlış olan bir koşul)
    // bekliyoruz — bu, gerçek turun başladığından emin olmanın güvenilir yolu.
    await waitFor(() => expect(kioskAPI.voiceCommand).toHaveBeenCalledTimes(1));
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

    // Not: Finding 1 (flush-on-wake-word) handleWakeWordUtterance'ı ASENKRON yaptı;
    // tetikleme öncesi state ZATEN 'idle' olduğundan, doğrudan state===idle beklemek
    // yarış durumu yaratır (waitFor'un ilk senkron kontrolü bayat 'idle'yi görüp
    // yanıt turu hiç başlamadan başarılı olabilir) — önce gerçek turun başladığını
    // garantiye alıyoruz.
    await waitFor(() => expect(kioskAPI.voiceCommand).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.state).toBe('idle'));
    expect(lastSpokenText()).toBe('İşte bulduğum sonuç.');
    expect(result.current.lastResponse).toEqual({ type: 'WEB_SEARCH', say: 'İşte bulduğum sonuç.' });
  });

  it('403 (konuşmacı reddedildi) atılırsa err.message okunur, state idle\'a döner', async () => {
    kioskAPI.voiceCommand.mockRejectedValueOnce(apiError(403, { code: 'unrecognized', message: 'Üzgünüm, sesinizi tanıyamadım.' }));
    const { result } = await renderIdleHook();

    act(() => { recognitionInstances[0].onresult(finalResult('Operio koteri aç')); });

    // Not: bkz. yukarıdaki "say-only yanıtlar" testindeki açıklama — aynı yarış
    // durumu, tetikleme ÖNCESİ de 'idle' olan bir state için geçerli.
    await waitFor(() => expect(kioskAPI.voiceCommand).toHaveBeenCalledTimes(1));
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

    // Not: bkz. "say-only yanıtlar" testindeki açıklama — aynı yarış durumu.
    await waitFor(() => expect(kioskAPI.voiceCommand).toHaveBeenCalledTimes(1));
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
