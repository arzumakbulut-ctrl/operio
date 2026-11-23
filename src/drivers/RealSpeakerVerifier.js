const { SpeakerVerifier } = require('./SpeakerVerifier');
const speakerIdClient = require('../services/speakerIdClient');
const voiceProfileService = require('../services/voiceProfile.service');

/**
 * MATCH_THRESHOLD — bir sorgu embedding'inin kayıtlı bir profille "eşleşti"
 * sayılması için gereken minimum cosine-similarity skoru (aralık: [-1, 1]).
 *
 * PLACEHOLDER: bu değer gerçek enrollment/ECAPA-TDNN verisiyle kalibre
 * edilmemiştir, sadece sağduyulu bir varsayılan olarak seçilmiştir (bkz. plan
 * Global Constraints). 0.75, cosine-similarity tabanlı speaker-verification
 * sistemlerinde yaygın görülen "muhafazakâr" bir eşik aralığının (genellikle
 * 0.6–0.85) üst-orta bandındadır: amaç, bu özelliğin anti-goal'üne uygun
 * olarak belirsiz durumda YANLIŞ-KABUL (false-accept) yerine
 * null ("tanınamadı") döndürmeyi tercih etmektir. Gerçek speaker-id-service
 * ile üretilen embedding'ler üzerinde (enroll edilmiş kullanıcıların
 * kendi-kendine skorları vs. farklı kullanıcılar arası skorların dağılımına
 * bakılarak) kalibre edilmelidir — bu task'ın kapsamı dışındadır.
 */
const MATCH_THRESHOLD = 0.75;

/**
 * dot — iki vektörün nokta çarpımı. SAF (pure) fonksiyon.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * norm — bir vektörün Öklid (L2) normu. SAF (pure) fonksiyon.
 * @param {number[]} a
 * @returns {number}
 */
function norm(a) {
  return Math.sqrt(dot(a, a));
}

/**
 * cosineSimilarity — iki vektör arasındaki cosine-similarity skoru
 * (dot(a,b) / (norm(a) * norm(b))). SAF (pure) fonksiyon.
 *
 * İki güvenlik koruması vardır (her ikisi de "belirsizse eşleşme yok"
 * ilkesiyle, bu dosyanın anti-false-accept amacına uygun):
 *  - Uzunluk uyuşmazlığı (örn. bir model-version yükseltmesi sonrası
 *    yeniden enroll edilmemiş eski bir profil — bkz.
 *    voiceProfile.service.js'teki MODEL_VERSION) `dot()`'un kısa vektörün
 *    sonundan sonra `undefined` ile çarpıp NaN üretmesine yol açabilir; bu
 *    durum burada 0 (eşleşme yok) olarak ele alınır, NaN'ın
 *    `identify()`'daki eşik karşılaştırmasını (`NaN < threshold === false`)
 *    atlatıp sahte bir "eşleşme" üretmesi ÖNLENİR.
 *  - Sıfır-vektör (norm 0) durumunda bölme-by-zero'ya düşmemek için de 0
 *    döner — pratikte gerçek embedding'lerde beklenmeyen dejenere bir
 *    durumdur.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  const denominator = norm(a) * norm(b);
  if (denominator === 0) return 0;
  return dot(a, b) / denominator;
}

/**
 * RealSpeakerVerifier — speaker-id-service'ten (ECAPA-TDNN tabanlı) alınan
 * gerçek embedding'lerle, aday havuzundaki kayıtlı (enroll edilmiş)
 * kullanıcıların embedding'lerini cosine-similarity ile karşılaştırarak
 * konuşmacıyı tanımlayan sürücü.
 *
 * Tasarım ilkesi (bu özelliğin anti-goal'ü): bir false-accept (yanlış
 * kullanıcıyla güvenle eşleşme) kabul edilemez bir hata modudur. Bu yüzden
 * her belirsiz/eksik/hatalı veri durumunda (ses yok, aday yok, kimse enroll
 * olmamış, en yüksek skor eşik altında, bağımlılıklardan biri fırlatırsa —
 * örn. DB bağlantısı düşerse) `identify` kesinlikle FIRLATMADAN null
 * ("tanınamadı") döner — asla düşük-güvenli bir tahminle yanıt vermez.
 * `speakerIdClient.getEmbedding` zaten kendi içinde asla fırlamaz (bkz. o
 * dosyanın kendi dokümantasyonu); buradaki try/catch savunma-derinliği
 * içindir. `voiceProfile.service.getEmbeddingsForUsers` ise kendi içinde
 * `db.query`'yi try/catch'siz çağırır — bir bağlantı hatası/timeout onun
 * promise'ini reddeder (reject) — bu yüzden buradaki try/catch bu dosyanın
 * "asla fırlatmaz" garantisini korumak için GEREKLİDİR, sadece savunma
 * amaçlı değildir.
 */
class RealSpeakerVerifier extends SpeakerVerifier {
  async identify(audioBuffer, candidateUserIds, config) {
    if (!audioBuffer || !candidateUserIds || candidateUserIds.length === 0) {
      return null;
    }

    let queryEmbedding;
    try {
      queryEmbedding = await speakerIdClient.getEmbedding(audioBuffer);
    } catch {
      return null;
    }
    if (!queryEmbedding) {
      return null;
    }

    let enrolled;
    try {
      enrolled = await voiceProfileService.getEmbeddingsForUsers(candidateUserIds);
    } catch {
      return null;
    }
    if (!enrolled || enrolled.length === 0) {
      return null;
    }

    let best = null;
    for (const { userId, embedding } of enrolled) {
      const score = cosineSimilarity(queryEmbedding, embedding);
      // Final whole-branch review finding #7: cosineSimilarity uzunluk-
      // uyuşmazlığı/sıfır-norm'u zaten 0'a indirger, ama BOZUK kayıtlı veri
      // (örn. embedding içinde bir NaN elemanı — uzunluk EŞİT olduğu için
      // yukarıdaki korumalardan hiçbirine çarpmaz) hâlâ NaN bir skor
      // üretebilir. Bu aday listede İLK sıradaysa, `score > best.score`
      // karşılaştırması `best.score` NaN olduğu için HER ZAMAN false
      // değerlendirilir — yani best, bu bozuk adaydan bir SONRAKİ (geçerli/
      // eşleşen) adaya asla güncellenmezdi. Bu adayı `continue` ile
      // tamamen ATLAYARAK, bozuk bir ilk aday sonraki meşru bir eşleşmeyi
      // asla bloke edemez.
      if (!Number.isFinite(score)) continue;
      if (!best || score > best.score) {
        best = { userId, score };
      }
    }

    // Number.isNaN: savunma-derinliği. cosineSimilarity kendi içinde
    // uzunluk-uyuşmazlığı/sıfır-norm durumlarını zaten 0'a indirger, ama bu
    // ek kontrol NaN'ın (hangi yoldan gelirse gelsin) "NaN < threshold"
    // false değerlendirmesiyle eşik kontrolünü atlatıp sahte bir eşleşme
    // üretmesine karşı son bir güvenlik ağıdır (bkz. anti-false-accept
    // amacı).
    if (!best || Number.isNaN(best.score) || best.score < MATCH_THRESHOLD) {
      return null;
    }

    return { userId: best.userId, confidence: best.score };
  }
}

module.exports = { RealSpeakerVerifier, MATCH_THRESHOLD };
