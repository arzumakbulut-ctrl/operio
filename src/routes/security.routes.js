const router   = require('express').Router();
const rateLimit = require('express-rate-limit');
const { z }    = require('zod');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ok, created, badRequest, unauthorized, serverError } = require('../utils/response');
const { generateTOTPSecret, verifyTOTPCode, disableTOTP, getTOTPStatus } = require('../utils/totp');
const { changePassword, validatePasswordStrength } = require('../utils/password');
const { logSecurityEvent, getSecuritySummary } = require('../utils/securityLogger');
const db = require('../utils/db');

// TOTP endpoint'leri için sıkı rate limit
const totpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,   // 5 dakika
  max: 5,
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: '5 dakika içinde çok fazla TOTP denemesi' } },
});

// ── TOTP YÖNETİMİ ────────────────────────────────────────────

// GET /api/security/totp/status
router.get('/totp/status', authenticate, async (req, res) => {
  try {
    const status = await getTOTPStatus(req.user.sub);
    return ok(res, {
      enabled:    status.totp_enabled,
      verifiedAt: status.totp_verified_at,
    });
  } catch (err) { return serverError(res, err); }
});

// POST /api/security/totp/setup — Yeni TOTP secret üret + QR kod
router.post('/totp/setup', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT email FROM users WHERE id=$1', [req.user.sub]);
    if (!rows[0]) return unauthorized(res);

    const result = await generateTOTPSecret(req.user.sub, rows[0].email);
    return ok(res, {
      secret:       result.secret,
      qrCodeDataUrl: result.qrCodeDataUrl,
      instructions: [
        '1. Google Authenticator, Authy veya uyumlu bir uygulama açın',
        '2. QR kodu okutun veya secret\'ı manuel girin',
        '3. Uygulama tarafından gösterilen 6 haneli kodu doğrulayın',
      ],
    });
  } catch (err) { return serverError(res, err); }
});

// POST /api/security/totp/verify — Kurulum sırasında ilk kez doğrula (etkinleştirir)
router.post('/totp/verify',
  authenticate,
  totpLimiter,
  validate(z.object({ code: z.string().length(6).regex(/^\d{6}$/, 'Kod 6 haneli rakam olmalı') })),
  async (req, res) => {
    try {
      const { valid } = await verifyTOTPCode({
        userId:  req.user.sub,
        code:    req.body.code,
        req,
        isSetup: true,
      });

      if (!valid) {
        return badRequest(res, 'Geçersiz TOTP kodu — lütfen tekrar deneyin');
      }

      return ok(res, {
        message: '2FA başarıyla etkinleştirildi',
        enabled: true,
      });
    } catch (err) { return serverError(res, err); }
  }
);

// POST /api/security/totp/disable — TOTP'yi devre dışı bırak
router.post('/totp/disable',
  authenticate,
  validate(z.object({ code: z.string().length(6).regex(/^\d{6}$/) })),
  async (req, res) => {
    try {
      await disableTOTP({ userId: req.user.sub, code: req.body.code, req });
      return ok(res, { message: '2FA devre dışı bırakıldı', enabled: false });
    } catch (err) {
      if (err.statusCode === 401) return unauthorized(res, err.message);
      return serverError(res, err);
    }
  }
);

// POST /api/security/totp/authenticate — Giriş sırasında TOTP doğrula
// (Auth flow'da kullanılır — login'den sonra 2FA gerekliyse bu çağrılır)
router.post('/totp/authenticate',
  authenticate,
  totpLimiter,
  validate(z.object({ code: z.string().length(6).regex(/^\d{6}$/) })),
  async (req, res) => {
    try {
      const { valid } = await verifyTOTPCode({
        userId: req.user.sub,
        code:   req.body.code,
        req,
      });

      if (!valid) {
        await logSecurityEvent({
          userId:    req.user.sub,
          eventType: 'TOTP_FAILED',
          req,
        });
        return unauthorized(res, 'Geçersiz TOTP kodu');
      }

      return ok(res, { message: '2FA doğrulama başarılı', authenticated: true });
    } catch (err) { return serverError(res, err); }
  }
);

// ── ŞİFRE YÖNETİMİ ───────────────────────────────────────────

// POST /api/security/password/change
router.post('/password/change',
  authenticate,
  validate(z.object({
    currentPassword: z.string().min(1, 'Mevcut şifre gerekli'),
    newPassword:     z.string().min(8),
    confirmPassword: z.string(),
  }).refine(d => d.newPassword === d.confirmPassword, {
    message: 'Şifreler eşleşmiyor',
    path: ['confirmPassword'],
  })),
  async (req, res) => {
    try {
      const errors = validatePasswordStrength(req.body.newPassword);
      if (errors.length) return badRequest(res, errors.join('; '));

      await changePassword({
        userId:          req.user.sub,
        currentPassword: req.body.currentPassword,
        newPassword:     req.body.newPassword,
      });

      await logSecurityEvent({
        userId:    req.user.sub,
        eventType: 'PASSWORD_CHANGED',
        req,
      });

      return ok(res, { message: 'Şifre başarıyla güncellendi' });
    } catch (err) {
      if (err.statusCode === 400) return badRequest(res, err.message);
      return serverError(res, err);
    }
  }
);

// GET /api/security/password/strength?password=... — Şifre gücü kontrolü
router.get('/password/strength', async (req, res) => {
  const { password } = req.query;
  if (!password) return badRequest(res, 'password parametresi gerekli');

  const errors = validatePasswordStrength(password);
  const score  = Math.max(0, 4 - errors.length);
  const labels = ['Çok Zayıf', 'Zayıf', 'Orta', 'İyi', 'Güçlü'];

  return ok(res, {
    valid:  errors.length === 0,
    score,
    label:  labels[score],
    errors,
  });
});

// ── GÜVENLİK PANELİ (Üst Yönetici) ──────────────────────────

// GET /api/security/events — Son güvenlik olayları
router.get('/events',
  authenticate,
  authorize(0),
  async (req, res) => {
    try {
      const { page = 1, limit = 50, eventType } = req.query;
      const conditions = [];
      const params = [];
      let pi = 1;

      if (eventType) {
        conditions.push(`e.event_type = $${pi++}`);
        params.push(eventType);
      }

      const where  = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
      const offset = (page - 1) * limit;

      const [{ rows: events }, { rows: countRows }] = await Promise.all([
        db.query(
          `SELECT e.*, u.email, u.full_name
           FROM security_events e
           LEFT JOIN users u ON e.user_id = u.id
           ${where}
           ORDER BY e.created_at DESC
           LIMIT $${pi} OFFSET $${pi + 1}`,
          [...params, limit, offset]
        ),
        db.query(`SELECT COUNT(*) FROM security_events e ${where}`, params),
      ]);

      const total = parseInt(countRows[0].count);
      return ok(res, events, { total, page: Number(page), totalPages: Math.ceil(total / limit) });
    } catch (err) { return serverError(res, err); }
  }
);

// GET /api/security/summary — 24 saatlik güvenlik özeti
router.get('/summary',
  authenticate,
  authorize(0),
  async (req, res) => {
    try {
      const [summary, lockedUsers, recentFailedIPs] = await Promise.all([
        getSecuritySummary(),
        // Şu an kilitli hesaplar
        db.query(
          `SELECT id, email, full_name, failed_login_attempts, locked_until
           FROM users WHERE locked_until > NOW()
           ORDER BY locked_until DESC`
        ),
        // En çok başarısız giriş yapan IP'ler (son 1 saat)
        db.query(
          `SELECT ip_address, COUNT(*) AS attempt_count
           FROM security_events
           WHERE event_type = 'LOGIN_FAILED'
             AND created_at > NOW() - INTERVAL '1 hour'
             AND ip_address IS NOT NULL
           GROUP BY ip_address
           ORDER BY attempt_count DESC
           LIMIT 10`
        ),
      ]);

      return ok(res, {
        eventSummary:    summary,
        lockedAccounts:  lockedUsers.rows,
        suspiciousIPs:   recentFailedIPs.rows,
        generatedAt:     new Date().toISOString(),
      });
    } catch (err) { return serverError(res, err); }
  }
);

// POST /api/security/unlock/:userId — Kilitli hesabı aç (Admin)
router.post('/unlock/:userId',
  authenticate,
  authorize(0),
  async (req, res) => {
    try {
      const { rows } = await db.query(
        `UPDATE users
         SET locked_until = NULL, failed_login_attempts = 0
         WHERE id = $1
         RETURNING id, email, full_name`,
        [req.params.userId]
      );

      if (!rows[0]) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Kullanıcı bulunamadı' } });

      await logSecurityEvent({
        userId:    req.user.sub,
        eventType: 'ACCOUNT_UNLOCKED',
        details:   { unlockedUserId: req.params.userId, unlockedUserEmail: rows[0].email },
        req,
      });

      return ok(res, { message: `${rows[0].full_name} hesabı açıldı`, user: rows[0] });
    } catch (err) { return serverError(res, err); }
  }
);

module.exports = router;
