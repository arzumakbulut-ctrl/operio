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
 *
 * İKİ HATA DURUMU (Review Focus — Finding 4): önceki sürüm çıplak bir `UPDATE ...
 * WHERE id=$2` idi, satır sayısı HİÇ kontrol edilmiyordu:
 *   (a) `institutionId` hiç yoksa UPDATE 0 satır değiştirir ama sorgu kendisi hata
 *       FIRLATMAZ — eski kod 200 "başarı" dönerdi VE asla gerçekleşmemiş bir ASSIGN
 *       audit kaydı yazardı. Şimdi `RETURNING id` eklenir; 0 satır → 404.
 *   (b) `groupId` hiç yoksa `institutions.group_id`'nin FK kısıtlaması (migrations/
 *       002_platform_admin.sql: `group_id UUID REFERENCES institution_groups(id)`)
 *       ihlal edilir ve ham bir Postgres 23503 (foreign_key_violation) yakalanmamış
 *       bir 500 olarak dışarı sızardı. Şimdi bu kod yakalanıp temiz bir 404'e çevrilir.
 *
 * 404 vs 409 (removeInstitution'ın KENDİ 409'u İLE KARŞILAŞTIRMA): removeInstitution'ın
 * 409'u BAŞKA bir anlam taşıyor — kurum VAR ama (groupId, institutionId) kombinasyonu
 * tutmuyor (kurum var, sadece BU grupta değil) — bu bir "durum çakışması"dır. Buradaki
 * 0-satır durumu ise `WHERE id=$2`'nin TEK koşulu institutionId olduğu için institutionId
 * doğrudan HİÇ VAR OLMUYOR demektir — bu, kod tabanının HER YERDE (institutions.routes.js,
 * platformAdminAccounts.routes.js, device.routes.js, surgery.routes.js, vb. — ~10+ yerde)
 * "varlık yok" için kullandığı dominant `notFound`/404 kuralıyla AYNI semantik kategori,
 * removeInstitution'ın dar "yanlış/eski groupId" senaryosuyla DEĞİL. Bu yüzden 404 seçildi;
 * bu da bu dosyadaki (ve SADECE bu dosyadaki) `mapError`'a yeni bir `case 404` eklemeyi
 * gerektirdi (institutionGroups.routes.js) — notFound zaten o dosyada import edilmiş ve
 * kullanılıyor (updateGroup/deleteGroup'ta), sadece throw+mapError yoluna da bağlandı.
 */
async function assignInstitution({ groupId, institutionId, actorId, req }) {
  let rows;
  try {
    ({ rows } = await db.query(
      'UPDATE institutions SET group_id=$1 WHERE id=$2 RETURNING id',
      [groupId, institutionId]
    ));
  } catch (err) {
    if (err.code === '23503') { // foreign_key_violation — groupId institution_groups'ta yok
      throw Object.assign(new Error('Kurum grubu bulunamadı'), { statusCode: 404 });
    }
    throw err;
  }
  if (!rows.length) {
    throw Object.assign(new Error('Kurum bulunamadı'), { statusCode: 404 });
  }

  await auditPlatformAdmin({
    adminId: actorId, action: 'ASSIGN', resource: 'institution_group',
    resourceId: groupId, newData: { institutionId }, req,
  });
}

/**
 * removeInstitution — URL'deki `groupId` (DELETE /:groupId/institutions/:institutionId)
 * kurumun GERÇEK `group_id`'i ile eşleşmezse (kurum zaten o grupta değil, groupId
 * eski/yanlış, ya da grup hiç yok) sessizce başarıya dönmez: `WHERE id=$1 AND
 * group_id=$2` ile tek bir atomik UPDATE hem "bu kurum bu grupta mı" kontrolünü hem
 * de çıkarma işlemini aynı sorguda yapar (check-then-update iki adımındaki race'i
 * önler) — 0 satır dönerse 409 fırlatılır, institutions'ta HİÇBİR satır değişmez.
 * Audit'in `resourceId`'i `groupId` (kapsam/parent id) — `surgery.service.js`'in
 * `removeTeamMember`'ının `resourceId: surgeryId` kullandığı AYNI emsal (review
 * finding: önceki sürüm `resourceId: null` ile hangi gruptan çıkarıldığını
 * kalıcı olarak kaybediyordu).
 */
async function removeInstitution({ groupId, institutionId, actorId, req }) {
  const { rows } = await db.query(
    'UPDATE institutions SET group_id=NULL WHERE id=$1 AND group_id=$2 RETURNING id',
    [institutionId, groupId]
  );
  if (!rows.length) {
    throw Object.assign(
      new Error('Kurum bu grupta değil'),
      { statusCode: 409 }
    );
  }

  await auditPlatformAdmin({
    adminId: actorId, action: 'REMOVE', resource: 'institution_group',
    resourceId: groupId, newData: { institutionId }, req,
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
