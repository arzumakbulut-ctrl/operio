const db = require('./db');
const { LOCKOUT } = require('../config/security');
const { logSecurityEvent } = require('./securityLogger');

/**
 * Başarısız giriş kaydı.
 * Eşik aşılırsa hesabı kilitle.
 *
 * @returns {{ locked: boolean, attemptsLeft: number }}
 */
async function recordFailedLogin({ userId, email, ipAddress, req }) {
  // Mevcut sayacı artır
  const { rows } = await db.query(
    `UPDATE users
     SET failed_login_attempts = failed_login_attempts + 1
     WHERE id = $1
     RETURNING failed_login_attempts, locked_until`,
    [userId]
  );

  const user = rows[0];
  if (!user) return { locked: false, attemptsLeft: LOCKOUT.MAX_ATTEMPTS };

  const attempts     = user.failed_login_attempts;
  const attemptsLeft = Math.max(0, LOCKOUT.MAX_ATTEMPTS - attempts);

  await logSecurityEvent({
    userId, eventType: 'LOGIN_FAILED',
    details: { email, attempt: attempts, attemptsLeft },
    req,
  });

  // Eşik aşıldı → kilitle
  if (attempts >= LOCKOUT.MAX_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + LOCKOUT.LOCKOUT_DURATION_MIN * 60 * 1000);

    await db.query(
      `UPDATE users SET locked_until = $1 WHERE id = $2`,
      [lockedUntil, userId]
    );

    await logSecurityEvent({
      userId, eventType: 'ACCOUNT_LOCKED',
      details: { email, lockedUntilISO: lockedUntil.toISOString(), ipAddress },
      req,
    });

    return { locked: true, lockedUntil, attemptsLeft: 0 };
  }

  return { locked: false, attemptsLeft };
}

/**
 * Başarılı giriş sonrası sayacı sıfırla.
 */
async function resetFailedLogins(userId) {
  await db.query(
    `UPDATE users
     SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW()
     WHERE id = $1`,
    [userId]
  );
}

/**
 * Hesap kilitli mi?
 * @returns {{ isLocked: boolean, lockedUntil?: Date, minutesLeft?: number }}
 */
async function checkAccountLock(userId) {
  const { rows } = await db.query(
    'SELECT locked_until, failed_login_attempts FROM users WHERE id = $1',
    [userId]
  );

  const user = rows[0];
  if (!user || !user.locked_until) return { isLocked: false };

  const lockedUntil = new Date(user.locked_until);
  if (lockedUntil <= new Date()) {
    // Kilit süresi dolmuş — otomatik aç
    await db.query(
      `UPDATE users SET locked_until = NULL, failed_login_attempts = 0 WHERE id = $1`,
      [userId]
    );
    return { isLocked: false };
  }

  const minutesLeft = Math.ceil((lockedUntil - Date.now()) / 60000);
  return { isLocked: true, lockedUntil, minutesLeft };
}

/**
 * Email'e göre hesap durumunu kontrol et (giriş öncesi).
 */
async function checkAccountLockByEmail(email) {
  const { rows } = await db.query(
    'SELECT id, locked_until, failed_login_attempts FROM users WHERE email = $1',
    [email.toLowerCase().trim()]
  );

  if (!rows[0]) return { exists: false };

  const user = rows[0];
  const lockStatus = await checkAccountLock(user.id);
  return { exists: true, userId: user.id, ...lockStatus };
}

module.exports = { recordFailedLogin, resetFailedLogins, checkAccountLock, checkAccountLockByEmail };
