const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { requireModule } = require('../middleware/requireModule');
const { validate } = require('../middleware/validate');
const { deviceCreateSchema, deviceCommandSchema, deviceConfigSchema } = require('../validators/schemas');
const { ok, created, notFound, forbidden, badRequest, serverError } = require('../utils/response');

// Servis varsayılan olarak gerçek implementasyonu kullanır
// Test ortamında mock inject edilebilir (surgery.routes.js'teki desenle aynı)
const registry = require('../services/_registry');
const getService = () => registry.get('device', () => require('../services/device.service'));
const setService = (svc) => registry.register('device', svc);

// executeCommand/physicalConfirm'in attığı BİLİNEN reddetme nedenleri (device.service.js'teki
// checkDeviceAuthorization/decideCommand/executeCommand/physicalConfirm'den gelir). Bunlar
// yetkilendirme/iş-kuralı reddini temsil eder → 403. Bu listede olmayan, beklenmeyen bir hata
// (DB hatası, sürücü çökmesi vb.) sessizce 403'e gizlenmez — 500 olarak kalır.
const COMMAND_REJECTION_REASONS = new Set([
  'device_not_found',
  'role_not_allowed',
  'room_mismatch',
  'team_role_required',
  'physical_confirm_required',
  'not_armed',
  'unknown_action',
]);

function handleCommandError(res, err) {
  if (COMMAND_REJECTION_REASONS.has(err.message)) {
    return forbidden(res, err.message);
  }
  return serverError(res, err);
}

// Modül kapısı TÜM rotaların üstünde — admin rotaları da dahil (satın alınmamış
// modülde admin bile cihaz oluşturamaz/yönetemez).
router.use(authenticate, requireModule('voice_control'));

router.get('/', async (req, res) => {
  try {
    const devices = await getService().listDevices({
      institutionId: req.user.institutionId,
      roomId:        req.query.roomId,
    });
    return ok(res, devices);
  } catch (err) { return serverError(res, err); }
});

router.get('/:id', async (req, res) => {
  try {
    const device = await getService().getDevice({
      id: req.params.id, institutionId: req.user.institutionId,
    });
    if (!device) return notFound(res, 'Cihaz');
    return ok(res, device);
  } catch (err) { return serverError(res, err); }
});

router.post('/', authorize(0, 11, 12), validate(deviceCreateSchema), async (req, res) => {
  try {
    const device = await getService().createDevice({
      data: req.body, institutionId: req.user.institutionId, userId: req.user.sub, req,
    });
    return created(res, device);
  } catch (err) { return serverError(res, err); }
});

router.patch('/:id/config', authorize(0, 11, 12), validate(deviceConfigSchema), async (req, res) => {
  try {
    const device = await getService().updateDeviceConfig({
      id: req.params.id, data: req.body, institutionId: req.user.institutionId, userId: req.user.sub, req,
    });
    if (!device) return notFound(res, 'Cihaz');
    return ok(res, device);
  } catch (err) {
    // updateDeviceConfig throws a statusCode:400 error when mode='REAL' is requested
    // without a real, registered driverKey (see device.service.js).
    if (err.statusCode === 400) return badRequest(res, err.message);
    return serverError(res, err);
  }
});

// Asıl yetkilendirme executeCommand içinde yapılır (roleId + aktif oda/ekip rolü).
// Burada authorize() YOK — herhangi bir doğrulanmış kullanıcı deneyebilir, servis reddeder.
router.post('/:id/command', validate(deviceCommandSchema), async (req, res) => {
  try {
    const device = await getService().executeCommand({
      deviceId:      req.params.id,
      institutionId: req.user.institutionId,
      userId:        req.user.sub,
      roleId:        req.user.roleId,
      action:        req.body.action,
      value:         req.body.value,
      req,
    });
    return ok(res, device);
  } catch (err) { return handleCommandError(res, err); }
});

router.post('/:id/physical-confirm', async (req, res) => {
  try {
    const device = await getService().physicalConfirm({
      deviceId:      req.params.id,
      institutionId: req.user.institutionId,
      userId:        req.user.sub,
      roleId:        req.user.roleId,
      req,
    });
    return ok(res, device);
  } catch (err) { return handleCommandError(res, err); }
});

module.exports = router;
module.exports.setService = setService;
module.exports.getService = getService;
