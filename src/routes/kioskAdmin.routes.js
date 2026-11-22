const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { mockConfigSchema } = require('../validators/schemas');
const { ok, notFound, serverError } = require('../utils/response');

// Servis varsayılan olarak gerçek implementasyonu kullanır
// Test ortamında mock inject edilebilir (device.routes.js'teki desenle aynı)
const registry = require('../services/_registry');
const getService = () => registry.get('kiosk', () => require('../services/kiosk.service'));
const setService = (svc) => registry.register('kiosk', svc);

// Tüm kiosk-admin endpoint'leri yalnızca Üst Yönetici(0) + billing admin
// rolleri(11,12) içindir — device.routes.js'teki admin rotalarıyla aynı
// roleId seti (bkz. device.routes.js:82).
router.post('/rooms/:roomId/token', authenticate, authorize(0, 11, 12), async (req, res) => {
  try {
    const result = await getService().createKioskToken(req.user.institutionId, req.params.roomId);
    return ok(res, result);
  } catch (err) {
    // createKioskToken, roomId institutionId'ye ait değilse statusCode:404 ile
    // reddeder (cross-tenant koruması — bkz. kiosk.service.js).
    if (err.statusCode === 404) return notFound(res, 'Oda');
    return serverError(res, err);
  }
});

router.post('/rooms/:roomId/token/revoke', authenticate, authorize(0, 11, 12), async (req, res) => {
  try {
    await getService().revokeKioskToken(req.user.institutionId, req.params.roomId);
    return ok(res, { revoked: true });
  } catch (err) {
    if (err.statusCode === 404) return notFound(res, 'Oda');
    return serverError(res, err);
  }
});

router.get('/mock-config', authenticate, authorize(0, 11, 12), async (req, res) => {
  try {
    const config = await getService().getMockConfig(req.user.institutionId);
    return ok(res, config);
  } catch (err) { return serverError(res, err); }
});

router.put('/mock-config', authenticate, authorize(0, 11, 12), validate(mockConfigSchema), async (req, res) => {
  try {
    const config = await getService().setMockConfig(req.user.institutionId, req.body.mode);
    return ok(res, config);
  } catch (err) { return serverError(res, err); }
});

module.exports = router;
module.exports.setService = setService;
module.exports.getService = getService;
