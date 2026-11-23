/**
 * speakerIdClient — speaker-id-service (Python, POST /embed) için ince HTTP istemcisi.
 *
 * getEmbedding asla fırlatmaz. Ses/konuşma yoksa (voice_detected:false), servis
 * hatası (non-2xx), ağ hatası, timeout veya decode hatası durumunda null döner;
 * çağıranlar null'u "ses/konuşma yok" olarak ele alır (bkz. dosya başı — bu
 * sözleşme bilerek DEĞİŞTİRİLMEDİ, sadece bu dosyanın içinde ayrıntılı loglama
 * ve bir timeout eklendi).
 *
 * DEFAULT_TIMEOUT_MS / SPEAKER_ID_TIMEOUT_MS — final whole-branch review finding
 * #1: timeout YOKTU. Python servisi bağlantıyı kabul edip (CPU-bound model
 * yükü, wedged bir bağımlılık altında) TAKILIRSA, fetch Node'un varsayılan
 * (dakikalarca sürebilen) soket timeout'una kadar asılı kalırdı. Frontend,
 * bir istek `executing` durumundayken TÜM yeni sesli komutları (Time-Out
 * checklist'i DAHİL — ki o speaker-id'ye hiç ihtiyaç duymaz) düşürdüğünden,
 * takılan TEK bir çağrı kiosk sesli asistanının TAMAMINI susturabilirdi. Bu
 * yüzden `AbortSignal.timeout(...)` ile sınırlı bir süre sonra çağrı iptal
 * edilir; süre `SPEAKER_ID_TIMEOUT_MS` ortam değişkeninden okunur, yoksa/
 * geçersizse 3000ms (3sn) varsayılanı kullanılır.
 *
 * Loglama (final review finding #3) — her başarısızlık YOLUNDA sadece
 * başarısızlığın TÜRÜ loglanır (örn. "timeout", "network error", "non-2xx:
 * 500") — SES VERİSİ, EMBEDDING veya başka bir istek/yanıt gövdesi İÇERİĞİ
 * ASLA loglanmaz. `voice_detected:false` bir hata DEĞİLDİR (sadece "konuşma
 * tespit edilemedi" normal bir sonuçtur) — bu yol için log YAZILMAZ.
 */

const DEFAULT_TIMEOUT_MS = 3000;

/**
 * getTimeoutMs — SPEAKER_ID_TIMEOUT_MS ortam değişkenini okur; tanımsız veya
 * geçerli bir pozitif sayı değilse DEFAULT_TIMEOUT_MS'e düşer.
 * @returns {number}
 */
function getTimeoutMs() {
  const parsed = Number(process.env.SPEAKER_ID_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

/**
 * @param {string} audioBase64Str base64 kodlu ses verisi
 * @param {string} [mimeType='audio/webm']
 * @returns {Promise<number[] | null>} embedding vektörü veya null
 */
async function getEmbedding(audioBase64Str, mimeType = 'audio/webm') {
  try {
    const res = await fetch(`${process.env.SPEAKER_ID_SERVICE_URL}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio_base64: audioBase64Str, mime_type: mimeType }),
      signal: AbortSignal.timeout(getTimeoutMs()),
    });
    if (!res.ok) {
      console.warn(`speakerIdClient.getEmbedding: non-2xx response (status ${res.status})`);
      return null;
    }
    const data = await res.json();
    return data.voice_detected ? data.embedding : null;
  } catch (err) {
    // AbortSignal.timeout'un tetiklediği abort, fetch'i bir TimeoutError (Node
    // 18+/undici) ile reddeder — normal bir rejection'dır, bu catch tarafından
    // diğer ağ hatalarıyla aynı şekilde yakalanır (fırlatmaz, null döner).
    const kind = err && err.name === 'TimeoutError' ? 'timeout' : 'network error';
    console.warn(`speakerIdClient.getEmbedding: ${kind}`);
    return null;
  }
}

module.exports = { getEmbedding, getTimeoutMs, DEFAULT_TIMEOUT_MS };
