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
 * (dot(a,b) / (norm(a) * norm(b))). SAF (pure) fonksiyon. Sıfır-vektör
 * (norm 0) durumunda bölme-by-zero'ya düşmemek için 0 döner — bu, pratikte
 * gerçek embedding'lerde beklenmeyen dejenere bir durumdur ve "eşleşme yok"
 * olarak ele alınması güvenli tarafta kalır.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
function cosineSimilarity(a, b) {
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
 * her belirsiz/eksik veri durumunda (ses yok, aday yok, kimse enroll
 * olmamış, en yüksek skor eşik altında) `identify` kesinlikle FIRLATMADAN
 * null ("tanınamadı") döner — asla düşük-güvenli bir tahminle yanıt vermez.
 */
class RealSpeakerVerifier extends SpeakerVerifier {
  async identify(audioBuffer, candidateUserIds, config) {
    if (!audioBuffer || !candidateUserIds || candidateUserIds.length === 0) {
      return null;
    }

    const queryEmbedding = await speakerIdClient.getEmbedding(audioBuffer);
    if (!queryEmbedding) {
      return null;
    }

    const enrolled = await voiceProfileService.getEmbeddingsForUsers(candidateUserIds);
    if (!enrolled || enrolled.length === 0) {
      return null;
    }

    let best = null;
    for (const { userId, embedding } of enrolled) {
      const score = cosineSimilarity(queryEmbedding, embedding);
      if (!best || score > best.score) {
        best = { userId, score };
      }
    }

    if (!best || best.score < MATCH_THRESHOLD) {
      return null;
    }

    return { userId: best.userId, confidence: best.score };
  }
}

module.exports = { RealSpeakerVerifier, MATCH_THRESHOLD };
