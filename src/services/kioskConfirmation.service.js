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
 *   - Konuşmacı uyuşmazlığı (payload.initiatingUserId tanımlı ve onaylayan
 *     konuşmacının userId'si bununla aynı DEĞİL) → yanlış phrase ile AYNI
 *     muamele: entry SİLİNMEZ (komutu başlatan kişi TTL içinde hâlâ
 *     onaylayabilsin), null döner. Böylece bir ekip üyesi başka birinin
 *     başlattığı bekleyen komutu tamamlayamaz (audit log'un yanlış kişiyi
 *     göstermesi de engellenir).
 *
 * Phrase karşılaştırması SADECE rakamlar üzerinden yapılır (normalizeDigits):
 * saklanan/sesli okunan format "4-7-2" olarak KALIR, ama gelen ifade konuşma
 * tanımadan "4 7 2", "472", "4-7-2." vb. hangi biçimde gelirse gelsin, iki
 * taraftaki rakam-dışı tüm karakterler atılıp karşılaştırılır.
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

/** Rakam olmayan her karakteri atar ("4-7-2" / "4 7 2" / "472" → "472"). */
function normalizeDigits(value) {
  return typeof value === 'string' ? value.replace(/\D/g, '') : '';
}

/**
 * @param {string} roomId
 * @param {string} saidPhrase — onaylayanın söylediği rakamlar (biçim serbest, bkz. normalizeDigits)
 * @param {string} [confirmingUserId] — onay çağrısında tanımlanan konuşmacı. Bekleyen
 *   payload bir initiatingUserId taşıyorsa bununla birebir eşleşmek ZORUNDADIR.
 */
function resolvePendingConfirmation(roomId, saidPhrase, confirmingUserId) {
  const entry = PENDING.get(roomId);
  if (!entry) {
    return null;
  }

  if (Date.now() >= entry.expiresAt) {
    PENDING.delete(roomId);
    return null;
  }

  const said = normalizeDigits(saidPhrase);
  if (said.length === 0 || said !== normalizeDigits(entry.phrase)) {
    return null;
  }

  const initiator = entry.payload && entry.payload.initiatingUserId;
  if (initiator !== undefined && initiator !== confirmingUserId) {
    return null;
  }

  PENDING.delete(roomId);
  return entry.payload;
}

module.exports = { createPendingConfirmation, resolvePendingConfirmation };
