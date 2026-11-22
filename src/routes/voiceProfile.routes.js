const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { ok, badRequest, notFound, serverError } = require('../utils/response');

// Servis varsayılan olarak gerçek implementasyonu kullanır
// Test ortamında mock inject edilebilir (kioskAdmin.routes.js'teki desenle aynı)
const registry = require('../services/_registry');
const getService = () => registry.get('voiceProfile', () => require('../services/voiceProfile.service'));
const setService = (svc) => registry.register('voiceProfile', svc);

// Kişisel JWT ile korunur (authenticate) — kiosk token sistemiyle ilgisi yok.
// req.user.sub, giriş yapmış kullanıcının kendi id'sidir (bkz. middleware/auth.js).
// Servis, bir örnekten embedding çıkarılamayınca bu mesajla Error fırlatır
// (bkz. voiceProfile.service.js enrollVoiceProfile). Bu bir kullanıcı/ses
// kalitesi hatasıdır, sunucu hatası değil → 400.
const EMBEDDING_FAILED_RE = /embedding çıkarılamadı/;

router.post('/voice-enrollment', authenticate, async (req, res) => {
  const audioSamples = req.body && req.body.audioSamples;
  if (!Array.isArray(audioSamples) || audioSamples.length !== 3) {
    return badRequest(res, "'audioSamples' tam olarak 3 elemanlı bir base64 dizisi olmalı");
  }
  try {
    const result = await getService().enrollVoiceProfile(req.user.sub, audioSamples);
    return ok(res, result);
  } catch (err) {
    if (err && EMBEDDING_FAILED_RE.test(err.message)) {
      return badRequest(res, err.message);
    }
    return serverError(res, err);
  }
});

router.get('/voice-enrollment', authenticate, async (req, res) => {
  try {
    const profile = await getService().getVoiceProfile(req.user.sub);
    if (!profile) return notFound(res, 'Ses profili');
    return ok(res, profile);
  } catch (err) {
    return serverError(res, err);
  }
});

module.exports = router;
module.exports.setService = setService;
module.exports.getService = getService;
