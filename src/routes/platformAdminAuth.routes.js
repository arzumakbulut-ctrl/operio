const router   = require('express').Router();
const rateLimit = require('express-rate-limit');
const { validate }      = require('../middleware/validate');
const { authenticatePlatformAdmin } = require('../middleware/platformAdminAuth');
const { platformAdminLoginSchema, refreshSchema } = require('../validators/schemas');
const registry = require('../services/_registry');
const getPlatformAdminAuthService = () => registry.get('platformAdminAuth', () => require('../services/platformAdminAuth.service'));
const setPlatformAdminAuthService = (svc) => registry.register('platformAdminAuth', svc);
const { ok, unauthorized, serverError } = require('../utils/response');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  message: { success:false, error:{ code:'TOO_MANY_REQUESTS', message:'Çok fazla deneme, 15 dk sonra tekrar deneyin' } },
  standardHeaders: true, legacyHeaders: false,
});

// POST /api/platform-admin/auth/login
router.post('/login', authLimiter, validate(platformAdminLoginSchema), async (req,res) => {
  try {
    const result = await getPlatformAdminAuthService().login({ ...req.body, req });
    return ok(res, result);
  } catch(err) {
    if(err.statusCode === 401) return unauthorized(res, err.message);
    return serverError(res,err);
  }
});

// POST /api/platform-admin/auth/refresh
router.post('/refresh', validate(refreshSchema), async (req,res) => {
  try {
    const tokens = await getPlatformAdminAuthService().refreshTokens({ refreshToken:req.body.refreshToken, req });
    return ok(res, tokens);
  } catch(err) {
    if(err.statusCode === 401) return unauthorized(res, err.message);
    return serverError(res,err);
  }
});

// POST /api/platform-admin/auth/logout
router.post('/logout', authenticatePlatformAdmin, async (req,res) => {
  try {
    await getPlatformAdminAuthService().logout({ refreshToken:req.body.refreshToken, adminId:req.platformAdmin.sub, req });
    return ok(res, { message:'Çıkış yapıldı' });
  } catch(err) { return serverError(res,err); }
});

// GET /api/platform-admin/auth/me
router.get('/me', authenticatePlatformAdmin, async (req,res) => {
  try {
    return ok(res, req.platformAdmin);
  } catch(err) { return serverError(res,err); }
});

module.exports = router;
module.exports.setPlatformAdminAuthService = setPlatformAdminAuthService;
