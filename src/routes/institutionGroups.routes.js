const router = require('express').Router();
const { authenticatePlatformAdmin, authorizePlatformAdmin } = require('../middleware/platformAdminAuth');
const { validate } = require('../middleware/validate');
const { institutionGroupCreateSchema } = require('../validators/schemas');
const { ok, created, notFound, badRequest, conflict, forbidden, serverError } = require('../utils/response');

// Servis varsayılan olarak gerçek implementasyonu kullanır
// Test ortamında mock inject edilebilir (bkz. institutions.routes.js'in AYNI deseni)
const registry = require('../services/_registry');
const getService = () => registry.get('institutionGroup', () => require('../services/institutionGroup.service'));
const setService = (svc) => registry.register('institutionGroup', svc);

function mapError(res, err) {
  switch (err.statusCode) {
    case 400: return badRequest(res, err.message);
    case 403: return forbidden(res, err.message);
    case 409: return conflict(res, err.message);
    default:  return serverError(res, err);
  }
}

// Bu konsolun tüm uç noktaları 'super' ile sınırlı — hastane zinciri yapısı
// finans/destek/icerik gruplarının sorumluluk alanı DIŞINDA (bkz. task brief).
router.use(authenticatePlatformAdmin);

router.get('/', authorizePlatformAdmin('super'), async (req, res) => {
  try {
    const groups = await getService().listGroups();
    return ok(res, groups);
  } catch (err) { return mapError(res, err); }
});

router.post('/', authorizePlatformAdmin('super'), validate(institutionGroupCreateSchema), async (req, res) => {
  try {
    const group = await getService().createGroup({
      name: req.body.name, actorId: req.platformAdmin.sub, req,
    });
    return created(res, group);
  } catch (err) { return mapError(res, err); }
});

router.patch('/:id', authorizePlatformAdmin('super'), validate(institutionGroupCreateSchema), async (req, res) => {
  try {
    const group = await getService().updateGroup({
      id: req.params.id, name: req.body.name, actorId: req.platformAdmin.sub, req,
    });
    if (!group) return notFound(res, 'Kurum grubu');
    return ok(res, group);
  } catch (err) { return mapError(res, err); }
});

router.delete('/:id', authorizePlatformAdmin('super'), async (req, res) => {
  try {
    const deleted = await getService().deleteGroup({
      id: req.params.id, actorId: req.platformAdmin.sub, req,
    });
    if (!deleted) return notFound(res, 'Kurum grubu');
    return ok(res, { message: 'Kurum grubu silindi' });
  } catch (err) { return mapError(res, err); }
});

router.post('/:groupId/institutions/:institutionId', authorizePlatformAdmin('super'), async (req, res) => {
  try {
    await getService().assignInstitution({
      groupId: req.params.groupId, institutionId: req.params.institutionId,
      actorId: req.platformAdmin.sub, req,
    });
    return ok(res, { message: 'Kurum gruba atandı' });
  } catch (err) { return mapError(res, err); }
});

router.delete('/:groupId/institutions/:institutionId', authorizePlatformAdmin('super'), async (req, res) => {
  try {
    await getService().removeInstitution({
      institutionId: req.params.institutionId, actorId: req.platformAdmin.sub, req,
    });
    return ok(res, { message: 'Kurum gruptan çıkarıldı' });
  } catch (err) { return mapError(res, err); }
});

module.exports = router;
module.exports.setService = setService;
module.exports.getService = getService;
