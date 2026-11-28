const router = require('express').Router();
const { z } = require('zod');
const { authenticatePlatformAdmin, authorizePlatformAdmin } = require('../middleware/platformAdminAuth');
const { validate, validateQuery } = require('../middleware/validate');
const {
  supportTicketUpdateSchema, supportTicketCommentSchema, paginationSchema,
} = require('../validators/schemas');
const { ok, created, notFound, badRequest, conflict, forbidden, serverError } = require('../utils/response');

// Servis varsayılan olarak gerçek implementasyonu kullanır
// Test ortamında mock inject edilebilir (bkz. institutionGroups.routes.js'in AYNI deseni)
const registry = require('../services/_registry');
const getService = () => registry.get('supportTicket', () => require('../services/supportTicket.service'));
const setService = (svc) => registry.register('supportTicket', svc);

function mapError(res, err) {
  switch (err.statusCode) {
    case 400: return badRequest(res, err.message);
    case 403: return forbidden(res, err.message);
    case 409: return conflict(res, err.message);
    default:  return serverError(res, err);
  }
}

// Bu konsolun "Kurum Talepleri" sayfası sadece 'super' + 'destek' kapsamında
// (tasarım dokümanı: Destek Ekibi → Kurum Talepleri tam erişim; Finans/İçerik
// Yöneticileri → erişimi yok) — surgery.routes.js'in GET /'inde status/date
// query'lerinin paylaşılan paginationSchema'ya girmeden inline .extend() ile
// genişletildiği AYNI tercih burada da kullanılıyor.
router.use(authenticatePlatformAdmin);

// status/type/institutionId BİLEREK gerçek DB enum'larına/UUID biçimine karşı
// doğrulanır (Minor Finding B): bare z.string() bir geçersiz değeri (ör.
// ?status=bogus) doğrudan SQL'e geçirirdi — Postgres bunu ham bir 22P02 (invalid
// enum input) ile reddeder, bu da yakalanmamış bir 500 olarak dışa sızar (temiz
// bir 400 DEĞİL). Enum değerleri migrations/002_platform_admin.sql'deki
// ticket_status/ticket_type ile AYNI.
router.get('/', authorizePlatformAdmin('super', 'destek'), validateQuery(paginationSchema.extend({
  status:        z.enum(['OPEN', 'IN_PROGRESS', 'CLOSED']).optional(),
  type:          z.enum(['TECHNICAL', 'FEATURE_REQUEST', 'BILLING', 'SALES']).optional(),
  institutionId: z.string().uuid().optional(),
})), async (req, res) => {
  try {
    const result = await getService().listTickets({
      status: req.query.status, type: req.query.type, institutionId: req.query.institutionId,
      page: req.query.page, limit: req.query.limit,
    });
    return ok(res, result.tickets, {
      total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages,
    });
  } catch (err) { return mapError(res, err); }
});

router.get('/:id', authorizePlatformAdmin('super', 'destek'), async (req, res) => {
  try {
    const ticket = await getService().getTicket({ id: req.params.id });
    if (!ticket) return notFound(res, 'Talep');
    return ok(res, ticket);
  } catch (err) { return mapError(res, err); }
});

router.patch('/:id/status', authorizePlatformAdmin('super', 'destek'), validate(supportTicketUpdateSchema), async (req, res) => {
  try {
    const ticket = await getService().updateStatus({
      id: req.params.id, status: req.body.status, actorId: req.platformAdmin.sub, req,
    });
    if (!ticket) return notFound(res, 'Talep');
    return ok(res, ticket);
  } catch (err) { return mapError(res, err); }
});

router.post('/:id/comments', authorizePlatformAdmin('super', 'destek'), validate(supportTicketCommentSchema), async (req, res) => {
  try {
    const comment = await getService().addComment({
      ticketId: req.params.id, adminId: req.platformAdmin.sub, message: req.body.message, req,
    });
    if (!comment) return notFound(res, 'Talep');
    return created(res, comment);
  } catch (err) { return mapError(res, err); }
});

module.exports = router;
module.exports.setService = setService;
module.exports.getService = getService;
