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

module.exports = { hasActiveModule };
