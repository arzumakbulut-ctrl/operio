const { verifyPlatformAdminAccessToken } = require('../utils/platformAdminJwt');
const { unauthorized, forbidden } = require('../utils/response');

/**
 * authenticatePlatformAdmin — Authorization: Bearer <token> başlığını doğrular.
 * Başarılı olursa req.platformAdmin = { sub, email, groupSlug } atar.
 * DİKKAT: req.user DEĞİL — hastane auth'unun (middleware/auth.js) req.user'ıyla
 * ASLA çakışmaz, aynı request'te ikisi de çalışsa bile birbirinin kimliğini ezmez.
 */
function authenticatePlatformAdmin(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return unauthorized(res);
  }

  const token = header.slice(7);
  try {
    const payload = verifyPlatformAdminAccessToken(token);
    req.platformAdmin = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return unauthorized(res, 'Oturum süresi doldu, yenileyin');
    }
    return unauthorized(res, 'Geçersiz token');
  }
}

/**
 * authorizePlatformAdmin(...groupSlugs) — authenticatePlatformAdmin'den sonra kullanılır.
 * Belirtilen gruplardan birine sahip değilse 403 döner.
 */
function authorizePlatformAdmin(...groupSlugs) {
  return (req, res, next) => {
    if (!req.platformAdmin) return unauthorized(res);
    if (!groupSlugs.includes(req.platformAdmin.groupSlug)) {
      return forbidden(res);
    }
    next();
  };
}

module.exports = { authenticatePlatformAdmin, authorizePlatformAdmin };
