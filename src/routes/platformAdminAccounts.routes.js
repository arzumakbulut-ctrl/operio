const router = require('express').Router();
const { authenticatePlatformAdmin, authorizePlatformAdmin } = require('../middleware/platformAdminAuth');
const { validate } = require('../middleware/validate');
const { platformAdminAccountCreateSchema, platformAdminAccountUpdateSchema } = require('../validators/schemas');
const { ok, created, notFound, badRequest, conflict, forbidden, serverError } = require('../utils/response');

// Servis varsayılan olarak gerçek implementasyonu kullanır
// Test ortamında mock inject edilebilir (bkz. institutionGroups.routes.js'in AYNI deseni)
const registry = require('../services/_registry');
const getService = () => registry.get('platformAdminAccount', () => require('../services/platformAdminAccount.service'));
const setService = (svc) => registry.register('platformAdminAccount', svc);

function mapError(res, err) {
  switch (err.statusCode) {
    case 400: return badRequest(res, err.message);
    case 403: return forbidden(res, err.message);
    case 409: return conflict(res, err.message);
    default:  return serverError(res, err);
  }
}

// Bu konsolun tüm uç noktaları 'super' ile sınırlı — platform-admin hesap/grup
// yönetimi finans/destek/icerik gruplarının sorumluluk alanı DIŞINDA (bkz. task brief).
router.use(authenticatePlatformAdmin);

router.get('/groups', authorizePlatformAdmin('super'), async (req, res) => {
  try {
    const groups = await getService().listGroups();
    return ok(res, groups);
  } catch (err) { return mapError(res, err); }
});

router.get('/', authorizePlatformAdmin('super'), async (req, res) => {
  try {
    const accounts = await getService().listAccounts();
    return ok(res, accounts);
  } catch (err) { return mapError(res, err); }
});

router.post('/', authorizePlatformAdmin('super'), validate(platformAdminAccountCreateSchema), async (req, res) => {
  try {
    const account = await getService().createAccount({
      data: req.body, actorId: req.platformAdmin.sub, req,
    });
    return created(res, account);
  } catch (err) { return mapError(res, err); }
});

router.patch('/:id', authorizePlatformAdmin('super'), validate(platformAdminAccountUpdateSchema), async (req, res) => {
  try {
    const account = await getService().updateAccount({
      id: req.params.id, data: req.body, actorId: req.platformAdmin.sub, req,
    });
    if (!account) return notFound(res, 'Platform-admin hesabı');
    return ok(res, account);
  } catch (err) { return mapError(res, err); }
});

module.exports = router;
module.exports.setService = setService;
module.exports.getService = getService;
