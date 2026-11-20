const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validate, validateQuery } = require('../middleware/validate');
const { surgeryCreateSchema, surgeryUpdateSchema, paginationSchema } = require('../validators/schemas');
const { z } = require('zod');
const { ok, created, notFound, serverError } = require('../utils/response');

// Servis varsayılan olarak gerçek implementasyonu kullanır
// Test ortamında mock inject edilebilir
const registry = require('../services/_registry');
const getService = () => registry.get('surgery', () => require('../services/surgery.service'));
const setService = (svc) => registry.register('surgery', svc);

router.use(authenticate);

router.get('/', validateQuery(paginationSchema.extend({
  status: z.string().optional(),
  date:   z.string().optional(),
})), async (req, res) => {
  try {
    const result = await getService().listSurgeries({
      institutionId: req.user.institutionId,
      userId:        req.user.sub,
      roleId:        req.user.roleId,
      status:        req.query.status,
      date:          req.query.date,
      page:          req.query.page,
      limit:         req.query.limit,
    });
    return ok(res, result.surgeries, {
      total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages,
    });
  } catch (err) { return serverError(res, err); }
});

router.get('/:id', async (req, res) => {
  try {
    const surgery = await getService().getSurgery({ id: req.params.id, institutionId: req.user.institutionId });
    if (!surgery) return notFound(res, 'Ameliyat');
    return ok(res, surgery);
  } catch (err) { return serverError(res, err); }
});

router.post('/', authorize(0, 1, 7), validate(surgeryCreateSchema), async (req, res) => {
  try {
    const surgery = await getService().createSurgery({
      data: req.body, institutionId: req.user.institutionId,
      userId: req.user.sub, req,
    });
    return created(res, surgery);
  } catch (err) { return serverError(res, err); }
});

router.patch('/:id', authorize(0, 1, 2, 7), validate(surgeryUpdateSchema), async (req, res) => {
  try {
    const surgery = await getService().updateSurgery({
      id: req.params.id, data: req.body,
      institutionId: req.user.institutionId, userId: req.user.sub, req,
    });
    if (!surgery) return notFound(res, 'Ameliyat');
    return ok(res, surgery);
  } catch (err) { return serverError(res, err); }
});

router.delete('/:id', authorize(0), async (req, res) => {
  try {
    const deleted = await getService().deleteSurgery({
      id: req.params.id, institutionId: req.user.institutionId,
      userId: req.user.sub, req,
    });
    if (!deleted) return notFound(res, 'Ameliyat');
    return ok(res, { message: 'Ameliyat silindi' });
  } catch (err) { return serverError(res, err); }
});

router.post('/:id/team', authorize(0, 1, 2), async (req, res) => {
  try {
    const { userId, teamRole } = req.body;
    await getService().assignTeamMember({ surgeryId: req.params.id, userId, teamRole, actorId: req.user.sub, req });
    return ok(res, { message: 'Ekip üyesi atandı' });
  } catch (err) { return serverError(res, err); }
});

router.delete('/:id/team/:userId', authorize(0, 1, 2), async (req, res) => {
  try {
    await getService().removeTeamMember({ surgeryId: req.params.id, userId: req.params.userId, actorId: req.user.sub, req });
    return ok(res, { message: 'Ekip üyesi kaldırıldı' });
  } catch (err) { return serverError(res, err); }
});

module.exports = router;
module.exports.setService = setService;
module.exports.getService = getService;
