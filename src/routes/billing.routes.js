const router  = require('express').Router();
const { z }   = require('zod');
const { authenticate, authorize } = require('../middleware/auth');
const { validate, validateQuery } = require('../middleware/validate');
const { ok, created, badRequest, serverError } = require('../utils/response');
const subService = require('../services/subscription.service');

// ── PLANLAR (public) ──────────────────────────────────────────

// GET /api/billing/plans
router.get('/plans', async (req, res) => {
  try {
    const plans = await subService.getPlans();
    return ok(res, plans);
  } catch (err) { return serverError(res, err); }
});

// ── ABONELİK ─────────────────────────────────────────────────

// GET /api/billing/subscription
router.get('/subscription', authenticate, async (req, res) => {
  try {
    const sub = await subService.getSubscription(req.user.institutionId);
    if (!sub) {
      // Trial başlat
      const trial = await subService.startTrial({ institutionId: req.user.institutionId });
      return ok(res, { ...trial, isTrial: true });
    }

    const daysLeft = sub.trial_ends_at
      ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at) - Date.now()) / 86400000))
      : null;

    return ok(res, { ...sub, trialDaysLeft: daysLeft });
  } catch (err) { return serverError(res, err); }
});

// POST /api/billing/subscription/cancel
router.post('/subscription/cancel', authenticate, authorize(0), async (req, res) => {
  try {
    const result = await subService.cancelSubscription({
      institutionId: req.user.institutionId,
      userId:        req.user.sub,
      req,
    });
    return ok(res, result);
  } catch (err) {
    if (err.message.includes('bulunamadı')) return badRequest(res, err.message);
    return serverError(res, err);
  }
});

// ── KUPON DOĞRULAMA ───────────────────────────────────────────

// POST /api/billing/coupon/validate
router.post('/coupon/validate',
  authenticate,
  validate(z.object({
    code:     z.string().min(3).max(30),
    planSlug: z.enum(['starter','pro','enterprise']),
  })),
  async (req, res) => {
    try {
      const result = await subService.validateCoupon(req.body);
      if (!result.valid) return badRequest(res, result.error);

      const { coupon } = result;
      return ok(res, {
        valid:         true,
        discountType:  coupon.discount_type,
        discountValue: coupon.discount_value,
        code:          coupon.code,
      });
    } catch (err) { return serverError(res, err); }
  }
);

// ── İYZİCO AKIŞI ─────────────────────────────────────────────

// POST /api/billing/iyzico/checkout
router.post('/iyzico/checkout',
  authenticate,
  authorize(0),
  validate(z.object({
    planSlug:   z.enum(['starter','pro']),
    seatCount:  z.number().int().min(1).max(500).default(10),
    couponCode: z.string().optional(),
    buyer: z.object({
      name:    z.string().min(1),
      surname: z.string().min(1),
      email:   z.string().email(),
      phone:   z.string().optional(),
      address: z.string().optional(),
      city:    z.string().optional(),
    }),
  })),
  async (req, res) => {
    try {
      const result = await subService.initiateIyzicoCheckout({
        institutionId: req.user.institutionId,
        ...req.body,
        ip: req.ip,
      });
      return ok(res, result);
    } catch (err) {
      if (err.statusCode === 400) return badRequest(res, err.message);
      return serverError(res, err);
    }
  }
);

// POST /api/billing/iyzico/callback — İyzico ödeme sonucu (POST redirect)
router.post('/iyzico/callback', async (req, res) => {
  try {
    const { token, conversationId } = req.body;
    // conversationId'den institution ID'yi çöz: OPR-{instId8}-{ts}
    const institutionIdPrefix = conversationId?.split('-')[1];
    if (!institutionIdPrefix) return res.redirect(process.env.PAYMENT_FAIL_URL);

    // institution ID'yi tam haliyle bul
    const { rows } = await require('../utils/db').query(
      'SELECT id FROM institutions WHERE id::text LIKE $1 LIMIT 1',
      [institutionIdPrefix + '%']
    );
    const institutionId = rows[0]?.id;
    if (!institutionId) return res.redirect(process.env.PAYMENT_FAIL_URL);

    const result = await subService.verifyIyzicoPayment({ token, institutionId });

    if (result.success) {
      return res.redirect(`${process.env.PAYMENT_SUCCESS_URL}?plan=${result.subscription?.plan_slug}`);
    } else {
      return res.redirect(process.env.PAYMENT_FAIL_URL);
    }
  } catch (err) {
    console.error('[Payment] İyzico callback hatası:', err.message);
    return res.redirect(process.env.PAYMENT_FAIL_URL || '/odeme/basarisiz');
  }
});

// ── STRIPE AKIŞI ─────────────────────────────────────────────

// POST /api/billing/stripe/checkout
router.post('/stripe/checkout',
  authenticate,
  authorize(0),
  validate(z.object({
    planSlug:   z.enum(['starter','pro']),
    seatCount:  z.number().int().min(1).max(500).default(10),
    couponCode: z.string().optional(),
    trialDays:  z.number().int().min(0).max(30).default(14),
  })),
  async (req, res) => {
    try {
      const result = await subService.initiateStripeCheckout({
        institutionId: req.user.institutionId,
        customerEmail: req.user.email,
        ...req.body,
      });
      return ok(res, result);
    } catch (err) {
      if (err.statusCode === 400) return badRequest(res, err.message);
      return serverError(res, err);
    }
  }
);

// POST /api/billing/stripe/webhook — Stripe webhook (raw body gerekli)
router.post('/stripe/webhook',
  // Raw body — JSON parser bypass
  (req, res, next) => {
    if (req.headers['stripe-signature']) {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => { req.rawBody = data; next(); });
    } else {
      next();
    }
  },
  async (req, res) => {
    try {
      await subService.handleStripeWebhook({
        rawBody:   req.rawBody,
        signature: req.headers['stripe-signature'],
      });
      return res.json({ received: true });
    } catch (err) {
      console.error('[Payment] Stripe webhook hatası:', err.message);
      return res.status(400).json({ error: err.message });
    }
  }
);

// ── FATURALAR ─────────────────────────────────────────────────

// GET /api/billing/invoices
router.get('/invoices', authenticate, authorize(0), async (req, res) => {
  try {
    const invoices = await subService.getInvoices(req.user.institutionId);
    return ok(res, invoices);
  } catch (err) { return serverError(res, err); }
});

// ── PLAN LİMİT KONTROLÜ ───────────────────────────────────────

// GET /api/billing/limits
router.get('/limits', authenticate, async (req, res) => {
  try {
    const sub = await subService.getSubscription(req.user.institutionId);
    if (!sub) return ok(res, { status: 'no_subscription' });

    const db = require('../utils/db');
    const [roomsRes, usersRes] = await Promise.all([
      db.query('SELECT COUNT(*) FROM operating_rooms WHERE institution_id=$1', [req.user.institutionId]),
      db.query('SELECT COUNT(*) FROM users WHERE institution_id=$1 AND is_active=TRUE', [req.user.institutionId]),
    ]);

    return ok(res, {
      plan:        sub.plan_slug,
      status:      sub.status,
      trialEndsAt: sub.trial_ends_at,
      limits: {
        rooms: { used: parseInt(roomsRes.rows[0].count), max: sub.max_rooms },
        users: { used: parseInt(usersRes.rows[0].count), max: sub.max_users },
      },
    });
  } catch (err) { return serverError(res, err); }
});

module.exports = router;
