/**
 * kioskConfirmation.service — kiosk sesli cihaz komutları için kısa ömürlü,
 * BELLEK-İÇİ onay-kodu eşleştirmesi. DB YOK, registry YOK, saf JS — bu
 * projenin diğer servislerindeki CJS/db-mock kısıtlarından tamamen muaf.
 *
 * Akış: cihaz komutu ilk söylendiğinde (confirmationPhrase henüz yok) route
 * createPendingConfirmation ile 3 rakamlı bir phrase üretir ve kiosk bunu
 * kullanıcıya okur ("onaylamak için şunu söyleyin: 4-7-2"); kullanıcı phrase'i
 * tekrarlar, kiosk ikinci çağrıda bunu confirmationPhrase olarak gönderir;
 * route resolvePendingConfirmation ile orijinal payload'ı (deviceId/action/
 * value) geri alır.
 *
 * Bir roomId için TEK bekleyen onay tutulur — aynı oda için yeni bir
 * createPendingConfirmation çağrısı eskisinin üzerine yazar (Map.set).
 *
 * Silme kuralı (bilinçli tasarım kararı — brief bunu pinlememişti):
 *   - Doğru phrase + süresi geçmemiş  → entry SİLİNİR, payload döner (tek
 *     kullanımlık onay — aynı phrase ikinci kez kullanılamaz).
 *   - Süresi geçmiş (phrase doğru olsa bile) → entry SİLİNİR (bayat kayıt,
 *     saklamanın bir anlamı yok), null döner.
 *   - Yanlış phrase, süresi GEÇMEMİŞ → entry SİLİNMEZ — kullanıcı aynı TTL
 *     penceresi içinde tekrar deneyebilsin (yanlış söyleyiş/ASR hatası tüm
 *     akışı sıfırlamamalı), null döner.
 */

const PENDING = new Map();
const TTL_MS = 10000;

function randomDigit() {
  return Math.floor(Math.random() * 10);
}

function createPendingConfirmation(roomId, payload) {
  const phrase = `${randomDigit()}-${randomDigit()}-${randomDigit()}`;
  PENDING.set(roomId, { phrase, payload, expiresAt: Date.now() + TTL_MS });
  return { phrase };
}

function resolvePendingConfirmation(roomId, saidPhrase) {
  const entry = PENDING.get(roomId);
  if (!entry) {
    return null;
  }

  if (Date.now() >= entry.expiresAt) {
    PENDING.delete(roomId);
    return null;
  }

  if (saidPhrase !== entry.phrase) {
    return null;
  }

  PENDING.delete(roomId);
  return entry.payload;
}

module.exports = { createPendingConfirmation, resolvePendingConfirmation };
