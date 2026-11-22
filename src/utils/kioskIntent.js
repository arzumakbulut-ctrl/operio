/**
 * parseIntent — kiosk'tan gelen transcript'i (uyandırma kelimesi client tarafında
 * zaten ayıklanmış metin) basit anahtar-kelime/regex sınıflandırmasıyla bir
 * intent tipine eşler. Saf (pure) fonksiyon — DB/servis çağrısı yapmaz.
 *
 * Sınıflandırma sırası (ilk eşleşen kazanır):
 *   1. çok kısa transcript (< 3 karakter, boşluk kırpıldıktan sonra) → UNKNOWN
 *      (Review Focus #5 — boş/anlamsız sesli girişler erken elenir)
 *   2. TIMEOUT      — "time-out" / "time out" / "zaman aşımı" (SKS Time-Out)
 *   3. SPOTIFY_PLAY — "spotify" geçen her şey
 *   4. WEB_SEARCH   — "ara" veya "bul" ile BAŞLAYAN komutlar ("ara:" / "ara " / "bul ")
 *   5. DEVICE_COMMAND — bilinen cihaz-grubu anahtar kelimeleri (koter, ligasure,
 *      ışık, lamba, masa). `ışı[kğ]` deseni Türkçe ünsüz yumuşamasını da kapsar
 *      (ışık → ışığı gibi büküm hallerinde "k" harfi "ğ"ya döner).
 *   6. hiçbiri eşleşmezse → UNKNOWN
 *
 * DEVICE_COMMAND için params.deviceGroup, eşleşen kanonik anahtar kelimeyi taşır;
 * transcript içinde bir rakam dizisi (\d+) varsa params.value'ya sayı olarak konur
 * (yazıyla yazılan sayılar — "yirmi" vb. — kasıtlı olarak ayrıştırılmaz, bu basit
 * regex sınıflandırmasının kapsamı dışında).
 */

const TIMEOUT_RE = /time.?out|zaman aşımı/i;
const SPOTIFY_RE = /spotify/i;
const WEB_SEARCH_RE = /^(ara|bul)[:\s]/i;
const NUMBER_RE = /\d+/;

const DEVICE_GROUPS = [
  { keyword: 'koter', re: /koter/i },
  { keyword: 'ligasure', re: /ligasure/i },
  { keyword: 'ışık', re: /ışı[kğ]/i },
  { keyword: 'lamba', re: /lamba/i },
  { keyword: 'masa', re: /masa/i },
];

function parseIntent(transcript) {
  const text = (transcript ?? '').trim();

  if (text.length < 3) {
    return { type: 'UNKNOWN', params: {} };
  }

  if (TIMEOUT_RE.test(text)) {
    return { type: 'TIMEOUT', params: {} };
  }

  if (SPOTIFY_RE.test(text)) {
    return { type: 'SPOTIFY_PLAY', params: {} };
  }

  if (WEB_SEARCH_RE.test(text)) {
    return { type: 'WEB_SEARCH', params: {} };
  }

  const deviceGroup = DEVICE_GROUPS.find(group => group.re.test(text));
  if (deviceGroup) {
    const params = { deviceGroup: deviceGroup.keyword };
    const numberMatch = text.match(NUMBER_RE);
    if (numberMatch) {
      params.value = Number(numberMatch[0]);
    }
    return { type: 'DEVICE_COMMAND', params };
  }

  return { type: 'UNKNOWN', params: {} };
}

module.exports = { parseIntent };
