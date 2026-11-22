const jwt = require('jsonwebtoken');

const KIOSK_SECRET = process.env.KIOSK_JWT_SECRET || 'operio-kiosk-secret-degistir';
const KIOSK_EXP    = '3650d';

/**
 * Kiosk token üret (uzun ömürlü: 10 yıl — admin panelinden revoke edilebilir)
 * Payload: { institutionId, roomId, jti }
 */
function signKioskToken({ institutionId, roomId, jti }) {
  return jwt.sign({ institutionId, roomId, jti }, KIOSK_SECRET, { expiresIn: KIOSK_EXP });
}

/**
 * Kiosk token doğrula
 * @returns {{ institutionId, roomId, jti }}
 */
function verifyKioskToken(token) {
  return jwt.verify(token, KIOSK_SECRET);
}

module.exports = { signKioskToken, verifyKioskToken };
