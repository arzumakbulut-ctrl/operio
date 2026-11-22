const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { ok, serverError } = require('../utils/response');

// Servis varsayılan olarak gerçek implementasyonu kullanır
// Test ortamında mock inject edilebilir (diğer route dosyalarıyla aynı desen
// — bkz. voiceProfile.routes.js, kioskAdmin.routes.js)
const registry = require('../services/_registry');
const getService = () => registry.get('spotify', () => require('../services/spotify.service'));
const setService = (svc) => registry.register('spotify', svc);

/**
 * GET /connect — kişisel JWT ile korunur (authenticate), rol kısıtlaması
 * YOK: giriş yapmış herhangi bir kullanıcı kendi Spotify hesabını bağlayabilir.
 * Kiosk token sistemiyle ilgisi yoktur — req.user.sub, kullanıcının kendi
 * id'sidir ve state parametresine gömülür (bkz. spotify.service.js).
 */
router.get('/connect', authenticate, async (req, res) => {
  try {
    const url = getService().getAuthorizeUrl(req.user.sub);
    return ok(res, { url });
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * GET /callback — PUBLIC. Spotify, kullanıcının tarayıcısını doğrudan buraya
 * yönlendirir; bu istekte bearer token YOKTUR (authenticate kullanılamaz).
 * userId, state parametresindeki imzalı JWT'den çözülür (verifyState).
 * Her durumda (başarı ya da hata) frontend'e redirect edilir — bu bir
 * tarayıcı hedefi, JSON gösterecek biri yok; dolayısıyla hatalar 400/500
 * JSON yerine ?spotify=error redirect'i ile iletilir. access_token/
 * refresh_token hiçbir şekilde redirect URL'ine veya loga yazılmaz.
 */
router.get('/callback', async (req, res) => {
  const frontendBase = process.env.CORS_ORIGIN || 'http://localhost:5173';
  const { code, state } = req.query;

  if (!code || !state) {
    return res.redirect(`${frontendBase}/profil?spotify=error`);
  }

  try {
    const { userId } = getService().verifyState(state);
    const tokenData = await getService().exchangeCodeForToken(code);
    await getService().saveConnection(userId, tokenData);
    return res.redirect(`${frontendBase}/profil?spotify=connected`);
  } catch {
    return res.redirect(`${frontendBase}/profil?spotify=error`);
  }
});

/**
 * POST /disconnect — kişisel JWT ile korunur. Kullanıcı kendi Spotify
 * bağlantısını kaldırır.
 */
router.post('/disconnect', authenticate, async (req, res) => {
  try {
    await getService().disconnect(req.user.sub);
    return ok(res, { disconnected: true });
  } catch (err) {
    return serverError(res, err);
  }
});

module.exports = router;
module.exports.setService = setService;
module.exports.getService = getService;
