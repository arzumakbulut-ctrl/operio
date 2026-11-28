const router = require('express').Router();
const { authenticatePlatformAdmin, authorizePlatformAdmin } = require('../middleware/platformAdminAuth');
const { validate, validateQuery } = require('../middleware/validate');
const {
  institutionCreateSchema, institutionUpdateSchema, institutionStatusSchema, paginationSchema,
} = require('../validators/schemas');
const { ok, created, notFound, badRequest, conflict, forbidden, serverError } = require('../utils/response');

// Servis varsayılan olarak gerçek implementasyonu kullanır
// Test ortamında mock inject edilebilir (bkz. surgery.routes.js'in AYNI deseni)
const registry = require('../services/_registry');
const getService = () => registry.get('institution', () => require('../services/institution.service'));
const setService = (svc) => registry.register('institution', svc);

function mapError(res, err) {
  switch (err.statusCode) {
    case 400: return badRequest(res, err.message);
    case 403: return forbidden(res, err.message);
    case 409: return conflict(res, err.message);
    default:  return serverError(res, err);
  }
}

router.use(authenticatePlatformAdmin);

router.get('/', authorizePlatformAdmin('super', 'destek', 'finans'), validateQuery(paginationSchema), async (req, res) => {
  try {
    const result = await getService().listInstitutions({ page: req.query.page, limit: req.query.limit });
    return ok(res, result.institutions, {
      total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages,
    });
  } catch (err) { return mapError(res, err); }
});

router.get('/:id', authorizePlatformAdmin('super', 'destek', 'finans'), async (req, res) => {
  try {
    const institution = await getService().getInstitution({ id: req.params.id });
    if (!institution) return notFound(res, 'Kurum');
    return ok(res, institution);
  } catch (err) { return mapError(res, err); }
});

router.post('/', authorizePlatformAdmin('super'), validate(institutionCreateSchema), async (req, res) => {
  try {
    const institution = await getService().createInstitution({
      data: req.body, actorId: req.platformAdmin.sub, req,
    });
    return created(res, institution);
  } catch (err) { return mapError(res, err); }
});

router.patch('/:id', authorizePlatformAdmin('super', 'finans'), validate(institutionUpdateSchema), async (req, res) => {
  try {
    const institution = await getService().updateInstitution({
      id: req.params.id, data: req.body,
      actorGroupSlug: req.platformAdmin.groupSlug, actorId: req.platformAdmin.sub, req,
    });
    if (!institution) return notFound(res, 'Kurum');
    return ok(res, institution);
  } catch (err) { return mapError(res, err); }
});

router.patch('/:id/status', authorizePlatformAdmin('super'), validate(institutionStatusSchema), async (req, res) => {
  try {
    const institution = await getService().setInstitutionStatus({
      id: req.params.id, isActive: req.body.isActive, actorId: req.platformAdmin.sub, req,
    });
    if (!institution) return notFound(res, 'Kurum');
    return ok(res, institution);
  } catch (err) { return mapError(res, err); }
});

module.exports = router;
module.exports.setService = setService;
module.exports.getService = getService;
