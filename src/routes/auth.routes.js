const router   = require('express').Router();
const rateLimit = require('express-rate-limit');
const { validate }      = require('../middleware/validate');
const { authenticate }  = require('../middleware/auth');
const { loginSchema, registerSchema, refreshSchema } = require('../validators/schemas');
const registry = require('../services/_registry');
const getAuthService = () => registry.get('auth', () => require('../services/auth.service'));
const setAuthService = (svc) => registry.register('auth', svc);
const db = require('../utils/db');
const { ok, created, unauthorized, serverError } = require('../utils/response');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  message: { success:false, error:{ code:'TOO_MANY_REQUESTS', message:'Çok fazla deneme, 15 dk sonra tekrar deneyin' } },
  standardHeaders: true, legacyHeaders: false,
});

// POST /api/auth/login
router.post('/login', authLimiter, validate(loginSchema), async (req,res) => {
  try {
    const result = await getAuthService().login({ ...req.body, req });
    return ok(res, result);
  } catch(err) {
    if(err.statusCode === 401) return unauthorized(res, err.message);
    if(err.statusCode === 423) return res.status(423).json({ success:false, error:{ code:'ACCOUNT_LOCKED', message:err.message } });
    return serverError(res,err);
  }
});

// POST /api/auth/register
router.post('/register', validate(registerSchema), async (req,res) => {
  try {
    const user = await getAuthService().register(req.body);
    return created(res, { user });
  } catch(err) {
    if(err.statusCode === 409) return res.status(409).json({ success:false, error:{ code:'CONFLICT', message:err.message } });
    return serverError(res,err);
  }
});

// POST /api/auth/refresh
router.post('/refresh', validate(refreshSchema), async (req,res) => {
  try {
    const tokens = await getAuthService().refreshTokens({ refreshToken:req.body.refreshToken, req });
    return ok(res, tokens);
  } catch(err) {
    if(err.statusCode === 401) return unauthorized(res, err.message);
    if(err.statusCode === 423) return res.status(423).json({ success:false, error:{ code:'ACCOUNT_LOCKED', message:err.message } });
    return serverError(res,err);
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req,res) => {
  try {
    await getAuthService().logout({ refreshToken:req.body.refreshToken, userId:req.user.sub, req });
    return ok(res, { message:'Çıkış yapıldı' });
  } catch(err) { return serverError(res,err); }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req,res) => {
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.email, u.full_name, u.role_id, u.institution_id, u.is_active, u.created_at,
              r.name AS role_name, r.display_name AS role_display_name,
              i.name AS institution_name, i.type AS institution_type
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN institutions i ON u.institution_id = i.id
       WHERE u.id = $1`,
      [req.user.sub]
    );
    if(!rows[0]) return unauthorized(res, 'Kullanıcı bulunamadı');
    return ok(res, rows[0]);
  } catch(err) { return serverError(res,err); }
});

module.exports = router;
module.exports.setAuthService = setAuthService;
