const db = require('./db');

async function audit(opts) {
  try {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, resource, resource_id, surgery_id, old_data, new_data, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        opts.userId     ?? null,
        opts.action,
        opts.resource,
        opts.resourceId ?? null,
        opts.surgeryId  ?? null,
        opts.oldData    ? JSON.stringify(opts.oldData) : null,
        opts.newData    ? JSON.stringify(opts.newData) : null,
        opts.req?.ip    ?? null,
        opts.req?.headers?.['user-agent'] ?? null,
      ]
    );
  } catch (err) {
    console.error('[AUDIT ERROR]', err.message);
  }
}

module.exports = { audit };
