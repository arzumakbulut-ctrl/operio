const db = require('../utils/db');
const speakerIdClient = require('./speakerIdClient');

/**
 * MODEL_VERSION — gerçek embedding modelinin (ECAPA-TDNN tabanlı
 * speaker-id-service) sürüm etiketi. enrollVoiceProfile tüm yeni
 * enrollment'ları bu sürümle kaydeder.
 */
const MODEL_VERSION = 'ecapa-tdnn-v1';

const ENROLLMENT_SAMPLE_COUNT = 3;

/**
 * EMBEDDING_FAILED_MESSAGE — enrollVoiceProfile bir örnekten embedding
 * çıkaramadığında fırlattığı hata mesajı. Route bu sabiti eşleştirip 400'e
 * çevirir; mesaj değişirse route ve testler birlikte kırılır.
 */
const EMBEDDING_FAILED_MESSAGE = 'Ses örneklerinden biri için embedding çıkarılamadı (konuşma tespit edilemedi)';

/**
 * serializeEmbedding — bir embedding vektörünü (number[]) BYTEA sütununda
 * saklanabilecek bir Buffer'a çevirir.
 *
 * Serileştirme formatı: her eleman IEEE-754 single-precision (4 byte,
 * little-endian) float olarak art arda yazılır (toplam uzunluk = vector.length * 4
 * byte). Buffer'ın kendi writeFloatLE/readFloatLE erişimcileri kullanılır —
 * bir Float32Array view'ı doğrudan pg'den dönen Buffer üzerinde oluşturmak
 * yerine, çünkü pg'den dönen Buffer'ın altındaki ArrayBuffer'daki byteOffset'i
 * 4'e bölünebilir olmak zorunda değildir; bu durumda `new Float32Array(buf.buffer,
 * buf.byteOffset, ...)` hizalama hatasıyla (RangeError) patlayabilir. Buffer'ın
 * kendi float accessor'ları hizalama kısıtı olmadan çalışır, bu yüzden bu yol
 * tercih edildi.
 * @param {number[]} vector
 * @returns {Buffer}
 */
function serializeEmbedding(vector) {
  const buffer = Buffer.alloc(vector.length * 4);
  for (let i = 0; i < vector.length; i++) {
    buffer.writeFloatLE(vector[i], i * 4);
  }
  return buffer;
}

/**
 * deserializeEmbedding — serializeEmbedding'in tersi: BYTEA'dan okunan bir
 * Buffer'ı sayı dizisine çevirir.
 * @param {Buffer} buffer
 * @returns {number[]}
 */
function deserializeEmbedding(buffer) {
  const floatCount = Math.floor(buffer.length / 4);
  const vector = new Array(floatCount);
  for (let i = 0; i < floatCount; i++) {
    vector[i] = buffer.readFloatLE(i * 4);
  }
  return vector;
}

/**
 * averageEmbeddings — birden fazla embedding vektörünün eleman-bazlı
 * ortalamasını (centroid) hesaplar. SAF (pure) fonksiyon.
 * @param {number[][]} embeddings
 * @returns {number[]}
 */
function averageEmbeddings(embeddings) {
  const length = embeddings[0].length;
  const centroid = new Array(length).fill(0);
  for (const embedding of embeddings) {
    for (let i = 0; i < length; i++) {
      centroid[i] += embedding[i];
    }
  }
  for (let i = 0; i < length; i++) {
    centroid[i] /= embeddings.length;
  }
  return centroid;
}

/**
 * enrollVoiceProfile — kullanıcının ses profilini, 3 ayrı ses örneğinden
 * çıkarılan gerçek embedding'lerin ortalamasını (centroid) alarak kaydeder
 * (ilk kayıtta INSERT, daha sonraki her kayıtta embedding + enrolled_at +
 * model_version güncellenerek upsert edilir — kullanıcı başına tek profil,
 * voice_profiles.user_id UNIQUE kısıtlamasıyla garanti edilir). model_version
 * da SET'e dahildir ki bir model yükseltmesi sonrası yeniden enroll eden bir
 * kullanıcının kaydı, yeni embedding'le birlikte doğru (güncel) model_version'ı
 * da yansıtsın — aksi halde embedding güncellenir ama model_version eski
 * değerde "stale" kalırdı.
 *
 * Neden 3 örnek: tek bir kayıttan çıkarılan embedding, o anki ses
 * koşullarına (mikrofon mesafesi, arka plan gürültüsü, ton) fazla hassas
 * olabilir; 3 örneğin ortalaması daha kararlı/temsili bir profil üretir.
 *
 * @param {string} userId
 * @param {string[]} audioSamples — tam olarak 3 elemanlı base64 ses dizisi
 * @returns {Promise<{ modelVersion: string, enrolledAt: Date }>}
 * @throws {Error} audioSamples 3 elemanlı değilse, veya örneklerden biri
 *   için embedding çıkarılamazsa (speakerIdClient.getEmbedding null döner —
 *   ses/konuşma tespit edilememiştir)
 */
async function enrollVoiceProfile(userId, audioSamples) {
  if (!Array.isArray(audioSamples) || audioSamples.length !== ENROLLMENT_SAMPLE_COUNT) {
    throw new Error(`enrollVoiceProfile tam olarak ${ENROLLMENT_SAMPLE_COUNT} ses örneği gerektirir`);
  }

  const embeddings = await Promise.all(
    audioSamples.map((sample) => speakerIdClient.getEmbedding(sample))
  );
  if (embeddings.some((embedding) => embedding === null)) {
    throw new Error(EMBEDDING_FAILED_MESSAGE);
  }

  const centroid = averageEmbeddings(embeddings);
  const embeddingBuffer = serializeEmbedding(centroid);

  const { rows } = await db.query(
    `INSERT INTO voice_profiles (user_id, embedding, model_version) VALUES ($1,$2,$3)
     ON CONFLICT (user_id) DO UPDATE SET embedding=$2, enrolled_at=NOW(), model_version=$3
     RETURNING enrolled_at, model_version`,
    [userId, embeddingBuffer, MODEL_VERSION]
  );
  return { modelVersion: rows[0].model_version, enrolledAt: rows[0].enrolled_at };
}

/**
 * getVoiceProfile — kullanıcının kayıtlı ses profili bilgisini getirir.
 * Kullanıcı henüz enroll edilmemişse null döner (route bunu 404'e çevirir).
 * @param {string} userId
 * @returns {Promise<{ enrolledAt: Date, modelVersion: string } | null>}
 */
async function getVoiceProfile(userId) {
  const { rows } = await db.query(
    'SELECT enrolled_at, model_version FROM voice_profiles WHERE user_id=$1',
    [userId]
  );
  if (rows.length === 0) return null;
  return { enrolledAt: rows[0].enrolled_at, modelVersion: rows[0].model_version };
}

/**
 * getEmbeddingsForUsers — verilen userId listesi için kayıtlı embedding'leri
 * getirir (RealSpeakerVerifier'ın karşılaştırma adımında kullanılması için).
 * Enrollment'ı olmayan userId'ler dönen dizide YOKTUR — dizi sadece kayıtlı
 * (enroll edilmiş) kullanıcıları içerir.
 * @param {string[]} userIds
 * @returns {Promise<Array<{ userId: string, embedding: number[] }>>}
 */
async function getEmbeddingsForUsers(userIds) {
  const { rows } = await db.query(
    'SELECT user_id, embedding FROM voice_profiles WHERE user_id = ANY($1)',
    [userIds]
  );
  return rows.map((row) => ({
    userId: row.user_id,
    embedding: deserializeEmbedding(row.embedding),
  }));
}

module.exports = {
  MODEL_VERSION,
  EMBEDDING_FAILED_MESSAGE,
  serializeEmbedding,
  deserializeEmbedding,
  enrollVoiceProfile,
  getVoiceProfile,
  getEmbeddingsForUsers,
};
