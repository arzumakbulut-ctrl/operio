const db = require('./db');

/**
 * Güvenlik olayı kaydet.
 * audit.js'den farklı olarak sadece güvenlik olaylarını izler.
 * Hata fırlatmaz — sessizce loglanır.
 *
 * @param {object} opts
 * @param {string|null} opts.userId
 * @param {string}      opts.eventType  LOGIN_FAILED | ACCOUNT_LOCKED | TOTP_FAILED | PASSWORD_CHANGED | SUSPICIOUS_IP | TOTP_ENABLED | TOTP_DISABLED
 * @param {string|null} opts.ipAddress
 * @param {string|null} opts.userAgent
 * @param {object|null} opts.details    - Ek bağlam (email, attemptCount vb.)
 * @param {object|null} opts.req        - Express request nesnesi
 */
async function logSecurityEvent({ userId = null, eventType, ipAddress = null, userAgent = null, details = null, req = null }) {
  try {
    const ip = ipAddress ?? req?.ip ?? null;
    const ua = userAgent ?? req?.headers?.['user-agent'] ?? null;

    await db.query(
      `INSERT INTO security_events (user_id, event_type, ip_address, user_agent, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, eventType, ip, ua, details ? JSON.stringify(details) : null]
    );

    // Kritik olayları konsola da yaz
    const CRITICAL = ['ACCOUNT_LOCKED', 'SUSPICIOUS_IP'];
    if (CRITICAL.includes(eventType)) {
      console.warn(`[SECURITY] ${eventType} | user=${userId ?? 'unknown'} | ip=${ip} | ${JSON.stringify(details)}`);
    }
  } catch (err) {
    console.error('[SECURITY LOG ERROR]', err.message);
  }
}

/**
 * Belirli bir IP'nin son süredeki başarısız giriş sayısını döndür.
 */
async function getFailedLoginsFromIP(ipAddress, windowMinutes = 60) {
  const { rows } = await db.query(
    `SELECT COUNT(*) FROM security_events
     WHERE ip_address = $1
       AND event_type = 'LOGIN_FAILED'
       AND created_at > NOW() - INTERVAL '${windowMinutes} minutes'`,
    [ipAddress]
  );
  return parseInt(rows[0].count);
}

/**
 * Son 24 saatin güvenlik özeti (dashboard için)
 */
async function getSecuritySummary() {
  const { rows } = await db.query(
    `SELECT event_type, COUNT(*) AS count
     FROM security_events
     WHERE created_at > NOW() - INTERVAL '24 hours'
     GROUP BY event_type
     ORDER BY count DESC`
  );
  return rows;
}

module.exports = { logSecurityEvent, getFailedLoginsFromIP, getSecuritySummary };
