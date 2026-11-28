const jwt = require('jsonwebtoken');

// DİKKAT: Hastane auth'undan (utils/jwt.js) TAMAMEN AYRI secret'lar — token'lar
// birbirinin sınırını asla geçemez (bkz. middleware/platformAdminAuth.js).
const ACCESS_SECRET  = process.env.PLATFORM_ADMIN_ACCESS_SECRET  || 'operio-platform-admin-access-secret';
const REFRESH_SECRET = process.env.PLATFORM_ADMIN_REFRESH_SECRET || 'operio-platform-admin-refresh-secret';
const ACCESS_EXP     = process.env.JWT_ACCESS_EXPIRES_IN  || '15m';
const REFRESH_EXP    = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/**
 * Access token üret (kısa ömürlü: 15 dk)
 * Payload: { sub, email, groupSlug } — ASLA roleId/institutionId İÇERMEZ
 */
function signPlatformAdminAccessToken(payload) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXP });
}

/**
 * Refresh token üret (uzun ömürlü: 7 gün)
 * Payload: sadece { sub }
 */
function signPlatformAdminRefreshToken(adminId) {
  return jwt.sign({ sub: adminId }, REFRESH_SECRET, { expiresIn: REFRESH_EXP });
}

/**
 * Access token doğrula
 * @returns {{ sub, email, groupSlug }}
 */
function verifyPlatformAdminAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

/**
 * Refresh token doğrula
 * @returns {{ sub }}
 */
function verifyPlatformAdminRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET);
}

/**
 * Refresh token'ın veritabanına kaydedileceği tarih
 */
function platformAdminRefreshTokenExpiresAt() {
  const ms = parseDuration(REFRESH_EXP);
  return new Date(Date.now() + ms);
}

function parseDuration(str) {
  const map = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  const n = parseInt(str);
  const unit = str.slice(-1);
  return n * (map[unit] || 1000);
}

module.exports = {
  signPlatformAdminAccessToken,
  signPlatformAdminRefreshToken,
  verifyPlatformAdminAccessToken,
  verifyPlatformAdminRefreshToken,
  platformAdminRefreshTokenExpiresAt,
};
