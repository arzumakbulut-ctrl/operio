const crypto = require('crypto');
const db = require('../utils/db');

/**
 * MODEL_VERSION — gerçek embedding modeli ayrı bir araştırma adımı olduğu
 * için placeholder. Tüm enrollment'lar şimdilik bu sürümle kaydedilir.
 */
const MODEL_VERSION = 'mock-v1';

/**
 * hashAudio — base64 kodlu ses verisinden deterministik bir SHA-256 hash
 * üretir. SAF (pure) fonksiyon: yan etkisi yoktur, DB'ye dokunmaz — aynı
 * girdi her zaman aynı Buffer çıktısını verir. enrollVoiceProfile bu hash'i
 * gerçek bir ses embedding'inin placeholder'ı olarak voice_profiles.embedding
 * (BYTEA) sütununa yazar.
 * @param {string} audioBase64
 * @returns {Buffer}
 */
function hashAudio(audioBase64) {
  return crypto.createHash('sha256').update(Buffer.from(audioBase64, 'base64')).digest();
}

/**
 * enrollVoiceProfile — kullanıcının ses profilini kaydeder (ilk kayıtta
 * INSERT, daha sonraki her kayıtta embedding + enrolled_at güncellenerek
 * upsert edilir — kullanıcı başına tek profil, voice_profiles.user_id UNIQUE
 * kısıtlamasıyla garanti edilir). Hash hesaplama hashAudio ile saf tutulur;
 * burada sadece DB upsert'i yapılır (bu kod tabanındaki diğer servislerle
 * aynı "saf hesaplama + thin DB çağrısı" deseni — bkz. kiosk.service.js).
 * @param {string} userId
 * @param {string} audioBase64
 * @returns {Promise<{ modelVersion: string, enrolledAt: Date }>}
 */
async function enrollVoiceProfile(userId, audioBase64) {
  const embedding = hashAudio(audioBase64);
  const { rows } = await db.query(
    `INSERT INTO voice_profiles (user_id, embedding, model_version) VALUES ($1,$2,'mock-v1')
     ON CONFLICT (user_id) DO UPDATE SET embedding=$2, enrolled_at=NOW()
     RETURNING enrolled_at, model_version`,
    [userId, embedding]
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

module.exports = { MODEL_VERSION, hashAudio, enrollVoiceProfile, getVoiceProfile };
