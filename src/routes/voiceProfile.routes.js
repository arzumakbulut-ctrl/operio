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
router.post('/voice-enrollment', authenticate, async (req, res) => {
  try {
    const audio = req.body && req.body.audio;
    if (!audio || typeof audio !== 'string') {
      return badRequest(res, "'audio' (base64) alanı gerekli");
    }
    const result = await getService().enrollVoiceProfile(req.user.sub, audio);
    return ok(res, result);
  } catch (err) {
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
