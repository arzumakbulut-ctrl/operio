const speakeasy = require('speakeasy');
const QRCode    = require('qrcode');
const db        = require('./db');
const { TOTP }  = require('../config/security');
const { logSecurityEvent } = require('./securityLogger');

/**
 * Kullanıcı için yeni TOTP secret üret.
 * Henüz etkinleştirilmez — kullanıcı kodu doğrulayana kadar bekler.
 *
 * @returns {{ secret, otpauthUrl, qrCodeDataUrl }}
 */
async function generateTOTPSecret(userId, userEmail) {
  const secret = speakeasy.generateSecret({
    issuer: TOTP.ISSUER,
    name:   `${TOTP.ISSUER} (${userEmail})`,
    length: 32,
  });

  // Secret'ı DB'ye kaydet (henüz etkin değil)
  await db.query(
    `UPDATE users SET totp_secret = $1, totp_enabled = FALSE WHERE id = $2`,
    [secret.base32, userId]
  );

  // QR kodu üret (kullanıcı authenticator uygulamasıyla okur)
  const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

  return {
    secret:       secret.base32,
    otpauthUrl:   secret.otpauth_url,
    qrCodeDataUrl,
  };
}

/**
 * TOTP kodunu doğrula.
 * İlk kez doğrulanıyorsa (setup sırasında) totp_enabled = TRUE yapılır.
 *
 * @returns {{ valid: boolean }}
 */
async function verifyTOTPCode({ userId, code, req, isSetup = false }) {
  const { rows } = await db.query(
    'SELECT totp_secret, totp_enabled FROM users WHERE id = $1',
    [userId]
  );

  const user = rows[0];
  if (!user?.totp_secret) {
    throw Object.assign(new Error('TOTP kurulmamış'), { statusCode: 400 });
  }

  const valid = speakeasy.totp.verify({
    secret:   user.totp_secret,
    encoding: 'base32',
    token:    String(code).replace(/\s/g, ''),
    window:   TOTP.WINDOW,
  });

  if (!valid) {
    await logSecurityEvent({ userId, eventType: 'TOTP_FAILED', details: { isSetup }, req });
    return { valid: false };
  }

  // Setup sırasında ilk başarılı doğrulama → etkinleştir
  if (isSetup && !user.totp_enabled) {
    await db.query(
      `UPDATE users SET totp_enabled = TRUE, totp_verified_at = NOW() WHERE id = $1`,
      [userId]
    );
    await logSecurityEvent({ userId, eventType: 'TOTP_ENABLED', req });
  }

  return { valid: true };
}

/**
 * TOTP'yi devre dışı bırak.
 * Mevcut şifre + geçerli TOTP kodu gerektirir.
 */
async function disableTOTP({ userId, code, req }) {
  const { valid } = await verifyTOTPCode({ userId, code, req });
  if (!valid) throw Object.assign(new Error('Geçersiz TOTP kodu'), { statusCode: 401 });

  await db.query(
    `UPDATE users SET totp_secret = NULL, totp_enabled = FALSE, totp_verified_at = NULL WHERE id = $1`,
    [userId]
  );

  await logSecurityEvent({ userId, eventType: 'TOTP_DISABLED', req });
  return true;
}

/**
 * Kullanıcının TOTP durumunu döndür.
 */
async function getTOTPStatus(userId) {
  const { rows } = await db.query(
    'SELECT totp_enabled, totp_verified_at FROM users WHERE id = $1',
    [userId]
  );
  return rows[0] ?? { totp_enabled: false, totp_verified_at: null };
}

module.exports = { generateTOTPSecret, verifyTOTPCode, disableTOTP, getTOTPStatus };
