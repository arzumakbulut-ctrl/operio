/**
 * kioskConfirmation.service — kiosk sesli cihaz komutları için kısa ömürlü,
 * BELLEK-İÇİ onay mekanizması. DB YOK, registry YOK, saf JS.
 *
 * Akış: cihaz komutu ilk söylendiğinde route createPendingConfirmation ile
 * bekleyen payload'ı kaydeder; kiosk kullanıcıya konuşmacı adı + eylem
 * açıklamasından kurulan bir soru sorar ("...yapayım mı? evet/hayır").
 * Kullanıcının cevabı resolvePendingConfirmation ile üç sonuçtan birine
 * bağlanır (bkz. aşağıdaki dönüş sözleşmesi).
 *
 * Bir roomId için TEK bekleyen onay tutulur — aynı oda için yeni bir
 * createPendingConfirmation çağrısı eskisinin üzerine yazar (Map.set).
 *
 * Dönüş sözleşmesi (resolvePendingConfirmation):
 *   - null                          → bekleyen onay yok veya süresi geçmiş
 *                                     (süresi geçmişse entry silinir).
 *   - {status:'unresolved'}         → anlaşılmayan metin VEYA yanlış konuşmacı.
 *                                     Entry SİLİNMEZ; TTL içinde tekrar denenebilir.
 *   - {status:'cancelled'}          → açık "hayır". Entry silinir.
 *   - {status:'confirmed', payload} → açık "evet", doğru konuşmacı. Entry silinir
 *                                     (tek kullanımlık).
 *
 * Konuşmacı bağlama: payload.initiatingUserId tanımlıysa onaylayan konuşmacının
 * userId'si bununla birebir eşleşmek zorundadır; aksi halde unresolved döner.
 */

const PENDING = new Map();
const TTL_MS = 20000;

// Tüm cevap tek bir yes/no kelimesi olmalı (başta VE sonda anchor). "evet değil"
// veya "evet lütfen" gibi çok kelimeli ifadeler unresolved döner: yanlış bir
// confirmed gerçek bir cihaz eylemini çalıştırır, yanlış unresolved ise sadece
// kullanıcıdan tekrar istenir.
const YES_RE = /^(evet|tamam|onaylıyorum|olur)$/i;
const NO_RE = /^(hayır|hayir|yok|istemiyorum|iptal)$/i;

// Final whole-branch review finding #5: konuşma tanıma bazen sondaki
// noktalamayı da döndürür ("evet." / "hayır,") — bu tek fark, anchor'lı
// YES_RE/NO_RE'nin tam eşleşmesini bozup komutu sessizce TTL'e kadar
// unresolved'da bırakıyordu. Sadece SONDAKİ noktalama (tekrarlanabilir)
// kırpılır, ardından yeniden trim edilir — "evet değil." gibi olumsuzlanmış
// bir ifadenin ortasındaki/ÖNCESİNDEKİ kelimeler ETKİLENMEZ, dolayısıyla o
// hâlâ YES_RE/NO_RE'yle eşleşmez (unresolved kalır) — anchor'lı
// tam-eşleşme güvenlik özelliği KORUNUR.
const TRAILING_PUNCTUATION_RE = /[.!?,;:]+$/;

function createPendingConfirmation(roomId, payload) {
  PENDING.set(roomId, { payload, expiresAt: Date.now() + TTL_MS });
  return {};
}

/**
 * @param {string} roomId
 * @param {string} answerText — onaylayanın söylediği metin (serbest biçim)
 * @param {string} [confirmingUserId] — onaylayan konuşmacı. Bekleyen payload bir
 *   initiatingUserId taşıyorsa bununla birebir eşleşmek ZORUNDADIR.
 */
function resolvePendingConfirmation(roomId, answerText, confirmingUserId) {
  const entry = PENDING.get(roomId);
  if (!entry) {
    return null;
  }

  if (Date.now() >= entry.expiresAt) {
    PENDING.delete(roomId);
    return null;
  }

  const initiator = entry.payload && entry.payload.initiatingUserId;
  if (initiator !== undefined && initiator !== confirmingUserId) {
    return { status: 'unresolved' };
  }

  const text = typeof answerText === 'string'
    ? answerText.trim().toLowerCase().replace(TRAILING_PUNCTUATION_RE, '').trim()
    : '';

  if (YES_RE.test(text)) {
    PENDING.delete(roomId);
    return { status: 'confirmed', payload: entry.payload };
  }

  if (NO_RE.test(text)) {
    PENDING.delete(roomId);
    return { status: 'cancelled' };
  }

  return { status: 'unresolved' };
}

module.exports = { createPendingConfirmation, resolvePendingConfirmation };
