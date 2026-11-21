const { verifyKioskToken } = require('../utils/kioskJwt');
const { unauthorized, forbidden } = require('../utils/response');
const registry = require('../services/_registry');

const getKioskService  = () => registry.get('kiosk', () => require('../services/kiosk.service'));
const getModuleService = () => registry.get('module', () => require('../services/module.service'));

/**
 * kioskRoomAuth — kiosk cihazlarının `Authorization: Bearer <kioskToken>` ile
 * kimlik doğrulaması. Kişisel kullanıcı JWT'si değil, kiosk'a özgü bir token
 * kullanır, bu yüzden mevcut authenticate/requireModule middleware'leri
 * yerine kendi kontrol zincirini uygular:
 *
 *   1. Token yoksa / okunamazsa          → 401
 *   2. kiosk_tokens'ta revoke edilmişse  → 403
 *   3. Token'ın roomId'si URL'deki       → 403
 *      :roomId ile uyuşmuyorsa
 *   4. 'voice_control' modülü aktif      → 403 { code: 'module_not_purchased' }
 *      değilse
 *   5. Odada IN_PROGRESS ameliyat yoksa  → 409 { code: 'no_active_surgery' }
 *   6. Her şey geçerliyse                → req.kiosk / req.activeSurgery + next()
 *
 * Sonraki tüm kiosk route'ları bu middleware'i kullanır.
 */
async function kioskRoomAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return unauthorized(res);
  }

  const token = header.slice(7);
  let payload;
  try {
    payload = verifyKioskToken(token);
  } catch {
    return unauthorized(res, 'Geçersiz kiosk token');
  }

  const { institutionId, roomId, jti } = payload;

  try {
    const revoked = await getKioskService().isTokenRevoked(jti);
    if (revoked) {
      return forbidden(res, 'Kiosk token iptal edilmiş');
    }

    // Review Focus #1: token'ın oda bilgisi URL'deki odayla eşleşmeli — başka bir
    // odanın token'ıyla bu odaya erişilememeli.
    if (roomId !== req.params.roomId) {
      return forbidden(res, 'Token bu oda için geçerli değil');
    }

    const moduleActive = await getModuleService().hasActiveModule({
      institutionId,
      slug: 'voice_control',
    });
    if (!moduleActive) {
      return res.status(403).json({ success: false, error: { code: 'module_not_purchased', message: 'Bu modül satın alınmamış' } });
    }

    const activeSurgery = await getKioskService().getActiveSurgeryForRoom(roomId);
    if (!activeSurgery) {
      return res.status(409).json({ success: false, error: { code: 'no_active_surgery', message: 'Bu odada devam eden bir ameliyat yok' } });
    }

    req.kiosk = { institutionId, roomId };
    req.activeSurgery = activeSurgery;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { kioskRoomAuth };
