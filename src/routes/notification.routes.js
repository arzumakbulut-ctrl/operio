const router = require('express').Router();
const { z }  = require('zod');
const { authenticate, authorize } = require('../middleware/auth');
const { validate, validateQuery } = require('../middleware/validate');
const { paginationSchema, notificationCreateSchema } = require('../validators/schemas');
const { pushNotification, getConnectedUsers, getConnectedCount, EVENTS, emitToInstitution } = require('../socket');
const db = require('../utils/db');
const { ok, created, serverError } = require('../utils/response');

// ── BİLDİRİMLER ──────────────────────────────────────────────

// GET /api/notifications — kullanıcının bildirimleri
router.get('/', authenticate, validateQuery(paginationSchema), async (req, res) => {
  try {
    const { page=1, limit=30 } = req.query;
    const offset = (page-1)*limit;

    const [{ rows: notifs }, { rows: countRows }] = await Promise.all([
      db.query(
        `SELECT * FROM notifications
         WHERE (target_user_id = $1 OR target_user_id IS NULL)
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [req.user.sub, limit, offset]
      ),
      db.query(
        `SELECT COUNT(*) FROM notifications
         WHERE target_user_id = $1 OR target_user_id IS NULL`,
        [req.user.sub]
      ),
    ]);

    const total = parseInt(countRows[0].count);
    const unread = notifs.filter(n => !n.is_read).length;

    return ok(res, notifs, { total, page, totalPages: Math.ceil(total/limit), unread });
  } catch(err) { return serverError(res,err); }
});

// GET /api/notifications/unread-count
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT COUNT(*) FROM notifications
       WHERE (target_user_id=$1 OR target_user_id IS NULL) AND is_read=FALSE`,
      [req.user.sub]
    );
    return ok(res, { count: parseInt(rows[0].count) });
  } catch(err) { return serverError(res,err); }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read=TRUE WHERE id=$1', [req.params.id]
    );
    return ok(res, { message: 'Okundu' });
  } catch(err) { return serverError(res,err); }
});

// PATCH /api/notifications/read-all
router.patch('/read-all', authenticate, async (req, res) => {
  try {
    await db.query(
      `UPDATE notifications SET is_read=TRUE
       WHERE target_user_id=$1 OR target_user_id IS NULL`,
      [req.user.sub]
    );
    return ok(res, { message: 'Tümü okundu' });
  } catch(err) { return serverError(res,err); }
});

// POST /api/notifications — Admin: manuel bildirim gönder
router.post('/', authenticate, authorize(0,1), validate(notificationCreateSchema), async (req, res) => {
  try {
    await pushNotification({
      institutionId:  req.user.institutionId,
      targetUserId:   req.body.targetUserId ?? null,
      type:           req.body.type,
      title:          req.body.title,
      message:        req.body.message,
    });
    return created(res, { message: 'Bildirim gönderildi' });
  } catch(err) { return serverError(res,err); }
});

// ── WEBSOCKET YÖNETİMİ ────────────────────────────────────────

// GET /api/ws/status — bağlı kullanıcılar (Admin)
router.get('/ws/status', authenticate, authorize(0), async (req, res) => {
  try {
    const users = getConnectedUsers(req.user.institutionId);
    const count = getConnectedCount(req.user.institutionId);
    return ok(res, { connectedUsers: users, count });
  } catch(err) { return serverError(res,err); }
});

// POST /api/ws/broadcast — kuruma sistem mesajı yolla (Admin)
router.post('/ws/broadcast',
  authenticate,
  authorize(0),
  validate(z.object({
    title:   z.string().min(1).max(200),
    message: z.string().min(1).max(1000),
    type:    z.enum(['sistem','uyari','tamamlandi']).default('sistem'),
  })),
  async (req, res) => {
    try {
      await pushNotification({
        institutionId: req.user.institutionId,
        type:          req.body.type,
        title:         req.body.title,
        message:       req.body.message,
      });
      return ok(res, { message: 'Yayın gönderildi' });
    } catch(err) { return serverError(res,err); }
  }
);

// POST /api/ws/test — WebSocket bağlantısını test et (Admin)
router.post('/ws/test', authenticate, authorize(0), async (req, res) => {
  try {
    emitToInstitution(req.user.institutionId, EVENTS.SYSTEM_ALERT, {
      message: '🔌 WebSocket test mesajı — bağlantınız çalışıyor!',
    });
    return ok(res, { message: 'Test mesajı gönderildi' });
  } catch(err) { return serverError(res,err); }
});

module.exports = router;
