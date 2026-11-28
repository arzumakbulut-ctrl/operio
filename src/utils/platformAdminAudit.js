const db = require('./db');

/**
 * auditPlatformAdmin — platform_admin_audit_logs'a yazar.
 * Task 3-7'nin TÜM yazma işlemlerinde kullanılacak denetim-kaydı fonksiyonu.
 * opts.adminId → admin_id, diğer alanlar mevcut audit() ile aynı isimler.
 */
async function auditPlatformAdmin(opts) {
  try {
    await db.query(
      `INSERT INTO platform_admin_audit_logs (admin_id, action, resource, resource_id, old_data, new_data, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        opts.adminId    ?? null,
        opts.action,
        opts.resource,
        opts.resourceId ?? null,
        opts.oldData    ? JSON.stringify(opts.oldData) : null,
        opts.newData    ? JSON.stringify(opts.newData) : null,
        opts.req?.ip    ?? null,
        opts.req?.headers?.['user-agent'] ?? null,
      ]
    );
  } catch (err) {
    console.error('[PLATFORM ADMIN AUDIT ERROR]', err.message);
  }
}

module.exports = { auditPlatformAdmin };
