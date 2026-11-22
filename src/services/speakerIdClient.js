/**
 * speakerIdClient — speaker-id-service (Python, POST /embed) için ince HTTP istemcisi.
 *
 * getEmbedding asla fırlatmaz. Ses/konuşma yoksa (voice_detected:false), servis
 * hatası (non-2xx), ağ hatası veya decode hatası durumunda null döner; çağıranlar
 * null'u "ses/konuşma yok" olarak ele alır.
 */

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
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.voice_detected ? data.embedding : null;
  } catch {
    return null;
  }
}

module.exports = { getEmbedding };
