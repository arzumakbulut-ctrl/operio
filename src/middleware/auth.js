const { verifyAccessToken } = require('../utils/jwt');
const { unauthorized, forbidden } = require('../utils/response');

/**
 * authenticate — Authorization: Bearer <token> başlığını doğrular.
 * Başarılı olursa req.user = { sub, email, roleId, institutionId } atar.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return unauthorized(res);
  }

  const token = header.slice(7);
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return unauthorized(res, 'Oturum süresi doldu, yenileyin');
    }
    return unauthorized(res, 'Geçersiz token');
  }
}

/**
 * authorize(...roleIds) — authenticate'den sonra kullanılır.
 * Belirtilen rollerden birine sahip değilse 403 döner.
 *
 * Rol ID'leri:
 *   0 Üst Yönetici  1 Sorumlu Hemşire  2 Anestezi Sorumlusu
 *   3 Ane. Teknisyeni  4 Hemşire  5 Aml. Personeli
 *   6 Doktor  7 Sekreterlik  8 Sterilizasyon Sorumlusu
 *   9 Sterilizasyon Personeli  10 Misafir Hekim
 */
function authorize(...roleIds) {
  return (req, res, next) => {
    if (!req.user) return unauthorized(res);
    if (!roleIds.includes(req.user.roleId)) {
      return forbidden(res);
    }
    next();
  };
}

/**
 * optionalAuth — token varsa req.user'ı doldurur, yoksa devam eder.
 * Public + auth opsiyonel endpoint'ler için.
 */
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = verifyAccessToken(header.slice(7));
    } catch {}
  }
  next();
}

module.exports = { authenticate, authorize, optionalAuth };
