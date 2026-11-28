const db = require('../utils/db');
const { auditPlatformAdmin } = require('../utils/platformAdminAudit');

/**
 * listGroups — her grubu, o gruba ait kurumların listesiyle birlikte döner.
 * N+1 sorgu burada BİLEREK kabul edildi: grup sayısı az (hastane zincirleri),
 * institution.service.js'in listInstitutions'ındaki tek-sorgu + COUNT deseni
 * burada gerekli değil (sayfalama da brief'te istenmiyor).
 */
async function listGroups() {
  const { rows: groups } = await db.query('SELECT * FROM institution_groups ORDER BY created_at DESC');

  return Promise.all(groups.map(async (group) => {
    const { rows: institutions } = await db.query(
      'SELECT * FROM institutions WHERE group_id=$1',
      [group.id]
    );
    return { ...group, institutions };
  }));
}

async function createGroup({ name, actorId, req }) {
  const { rows } = await db.query(
    'INSERT INTO institution_groups (name) VALUES ($1) RETURNING *',
    [name]
  );
  const group = rows[0];

  await auditPlatformAdmin({
    adminId: actorId, action: 'CREATE', resource: 'institution_group',
    resourceId: group.id, newData: { name }, req,
  });

  return group;
}

async function updateGroup({ id, name, actorId, req }) {
  const { rows: oldRows } = await db.query('SELECT * FROM institution_groups WHERE id=$1', [id]);
  const old = oldRows[0];
  if (!old) return null;

  const { rows } = await db.query(
    'UPDATE institution_groups SET name=$1 WHERE id=$2 RETURNING *',
    [name, id]
  );
  const group = rows[0];

  await auditPlatformAdmin({
    adminId: actorId, action: 'UPDATE', resource: 'institution_group',
    resourceId: id, oldData: old, newData: { name }, req,
  });

  return group;
}

/**
 * deleteGroup — tek atomik birim: ÖNCE bu gruptaki TÜM kurumların group_id'si
 * NULL'a çekilir, SONRA grup satırı silinir — aynı `db.transaction` (`fn` =
 * `async (client) => {...}`, `client.query` ile, `db.query` İLE DEĞİL — bkz.
 * institution.service.js'in createInstitution'ındaki AYNI desen) içinde, böylece
 * iki adım arasında bir çökme institutions'ı silinmiş bir gruba işaret eder halde
 * asla bırakamaz.
 */
async function deleteGroup({ id, actorId, req }) {
  const { rows: oldRows } = await db.query('SELECT * FROM institution_groups WHERE id=$1', [id]);
  const old = oldRows[0];
  if (!old) return null;

  await db.transaction(async (client) => {
    await client.query('UPDATE institutions SET group_id=NULL WHERE group_id=$1', [id]);
    await client.query('DELETE FROM institution_groups WHERE id=$1', [id]);
  });

  await auditPlatformAdmin({
    adminId: actorId, action: 'DELETE', resource: 'institution_group',
    resourceId: id, oldData: old, req,
  });

  return old;
}

/**
 * assignInstitution — bir kurumu bir gruba atar. `institutions.group_id` tek bir
 * kolon olduğu için (çoklu-grup üyeliği YOK), kurum zaten başka bir grupta ise bu
 * UPDATE onu otomatik olarak yeni gruba taşır — ayrıca bir "önce çıkar" adımına
 * gerek yok (tek grup kuralı burada, servis katmanında, kolonun kendi şekliyle
 * doğal olarak uygulanıyor).
 */
async function assignInstitution({ groupId, institutionId, actorId, req }) {
  await db.query('UPDATE institutions SET group_id=$1 WHERE id=$2', [groupId, institutionId]);

  await auditPlatformAdmin({
    adminId: actorId, action: 'ASSIGN', resource: 'institution_group',
    resourceId: groupId, newData: { institutionId }, req,
  });
}

async function removeInstitution({ institutionId, actorId, req }) {
  await db.query('UPDATE institutions SET group_id=NULL WHERE id=$1', [institutionId]);

  await auditPlatformAdmin({
    adminId: actorId, action: 'REMOVE', resource: 'institution_group',
    resourceId: null, newData: { institutionId }, req,
  });
}

module.exports = {
  listGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  assignInstitution,
  removeInstitution,
};
