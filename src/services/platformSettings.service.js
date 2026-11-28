const db = require('../utils/db');
const { auditPlatformAdmin } = require('../utils/platformAdminAudit');

// API'deki camelCase alan adları → platform_settings kolonları (snake_case).
// Map'te olmayan anahtarlar sessizce yok sayılır (SQL'e asla girmez).
const FIELD_MAP = {
  platformName:    'platform_name',
  supportEmail:    'support_email',
  billingEmail:    'billing_email',
  trialDays:       'trial_days',
  autoBilling:     'auto_billing',
  maintenanceMode: 'maintenance_mode',
  backupFrequency: 'backup_frequency',
};

/**
 * getSettings — platform_settings tek satırını (id=1) döner. Satır migration'da
 * seed edildiği için her zaman mevcut olmalı; yoksa null döner.
 */
async function getSettings() {
  const { rows } = await db.query('SELECT * FROM platform_settings WHERE id=1');
  return rows[0] ?? null;
}

/**
 * updateSettings — kısmi güncelleme. Güncellenecek alan yoksa (boş body) SQL
 * çalıştırılmadan mevcut ayarlar döner. Yazma yapılırsa audit kaydı oluşur.
 */
async function updateSettings({ data, actorId, req }) {
  const keys = Object.keys(data).filter((k) => FIELD_MAP[k] !== undefined);
  if (!keys.length) return getSettings();

  const old = await getSettings();

  const sets   = [];
  const params = [];
  let pi = 1;
  for (const k of keys) {
    sets.push(`${FIELD_MAP[k]} = $${pi++}`);
    params.push(data[k]);
  }
  sets.push('updated_at = NOW()');

  const { rows } = await db.query(
    `UPDATE platform_settings SET ${sets.join(', ')} WHERE id=1 RETURNING *`,
    params
  );
  const settings = rows[0];

  const newData = Object.fromEntries(keys.map((k) => [k, data[k]]));
  await auditPlatformAdmin({
    adminId: actorId, action: 'UPDATE', resource: 'platform_settings',
    resourceId: 1, oldData: old, newData, req,
  });

  return settings;
}

module.exports = {
  getSettings,
  updateSettings,
};
