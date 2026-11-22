const db = require('../utils/db');

/**
 * hasActiveModule — kurum, modülü aktif olarak satın almış mı?
 */
async function hasActiveModule({ institutionId, slug }) {
  const { rows } = await db.query(
    "SELECT 1 FROM institution_modules WHERE institution_id = $1 AND module_slug = $2 AND status = 'active'",
    [institutionId, slug]
  );
  return rows.length > 0;
}

/**
 * getModules — satın alınabilir tüm modüllerin (aktif) kataloğu. Public.
 */
async function getModules() {
  const { rows } = await db.query('SELECT * FROM modules WHERE is_active = TRUE ORDER BY name');
  return rows;
}

/**
 * getInstitutionModules — kurumun satın aldığı (aktif) modüller.
 */
async function getInstitutionModules(institutionId) {
  const { rows } = await db.query(
    `SELECT m.*, im.status, im.purchased_at, im.cancelled_at
     FROM institution_modules im
     JOIN modules m ON m.slug = im.module_slug
     WHERE im.institution_id = $1 AND im.status = 'active'
     ORDER BY m.name`,
    [institutionId]
  );
  return rows;
}

/**
 * purchaseModule — kurum için modülü satın alır (idempotent — yeniden satın alma
 * da aynı satırı 'active' durumuna geri döndürür).
 */
async function purchaseModule({ institutionId, slug }) {
  const { rows } = await db.query(
    `INSERT INTO institution_modules (institution_id, module_slug, status)
     VALUES ($1, $2, 'active')
     ON CONFLICT (institution_id, module_slug)
     DO UPDATE SET status = 'active', cancelled_at = NULL
     RETURNING *`,
    [institutionId, slug]
  );
  return rows[0];
}

module.exports = { hasActiveModule, getModules, getInstitutionModules, purchaseModule };
