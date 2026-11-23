describe('speakerIdClient.getEmbedding', () => {
  const ORIGINAL_TIMEOUT_MS = process.env.SPEAKER_ID_TIMEOUT_MS;

  afterEach(() => {
    if (ORIGINAL_TIMEOUT_MS === undefined) {
      delete process.env.SPEAKER_ID_TIMEOUT_MS;
    } else {
      process.env.SPEAKER_ID_TIMEOUT_MS = ORIGINAL_TIMEOUT_MS;
    }
  });

  it('voice_detected:true dönerse embedding dizisini döner', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ voice_detected: true, embedding: [0.1, 0.2, 0.3] }),
    });
    const { getEmbedding } = require('../../src/services/speakerIdClient');
    const result = await getEmbedding('base64data');
    expect(result).toEqual([0.1, 0.2, 0.3]);
  });

  it('voice_detected:false dönerse null döner', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ voice_detected: false }),
    });
    const { getEmbedding } = require('../../src/services/speakerIdClient');
    expect(await getEmbedding('base64data')).toBeNull();
  });

  it('servis 400/500 dönerse veya ağ hatası olursa fırlatmaz, null döner', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'));
    const { getEmbedding } = require('../../src/services/speakerIdClient');
    expect(await getEmbedding('base64data')).toBeNull();
  });

  it('non-2xx yanıtta null döner', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ voice_detected: true, embedding: [0.1, 0.2, 0.3] }),
    });
    const { getEmbedding } = require('../../src/services/speakerIdClient');
    expect(await getEmbedding('base64data')).toBeNull();
  });

  // Final whole-branch review finding #1: fetch'e hiçbir timeout verilmiyordu.
  // Servis bağlantıyı kabul edip takılırsa (CPU-bound model yükü vb.) çağrı
  // Node'un varsayılan (dakikalarca sürebilen) soket timeout'una kadar asılı
  // kalırdı — frontend `executing` sırasında TÜM yeni sesli komutları
  // düşürdüğünden, bu TEK çağrı kiosk sesli asistanının tamamını susturabilirdi.
  it('fetch asla çözülmezse, SPEAKER_ID_TIMEOUT_MS içinde null döner — Node\'un çok daha uzun varsayılanını BEKLEMEZ', async () => {
    process.env.SPEAKER_ID_TIMEOUT_MS = '50';

    // Gerçek fetch, verilen AbortSignal abort olduğunda reddeder; bu mock
    // SADECE bu davranışı taklit eder (kendiliğinden hiçbir zaman çözülmez/
    // reddetmez) — böylece test, speakerIdClient.js'in kurduğu GERÇEK
    // AbortSignal.timeout(...) zamanlayıcısını (gerçek Node zamanlayıcısı
    // üzerinden) exercise eder.
    global.fetch = vi.fn((url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(options.signal.reason));
    }));

    const { getEmbedding } = require('../../src/services/speakerIdClient');
    const start = Date.now();
    const result = await getEmbedding('base64data');
    const elapsedMs = Date.now() - start;

    expect(result).toBeNull();
    // Node'un varsayılan fetch soket timeout'u dakikalarca sürer — 50ms'lik
    // configured timeout'un çok altında ama yine de gevşek bırakılmış bir üst
    // sınırla, "varsayılanı beklemediğini" doğruluyoruz.
    expect(elapsedMs).toBeLessThan(2000);
  }, 5000);
});
