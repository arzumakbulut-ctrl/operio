const crypto = require('crypto');
const db     = require('../utils/db');
const { hashPassword } = require('../utils/password');
const { auditPlatformAdmin } = require('../utils/platformAdminAudit');
const { startTrial, getSubscription } = require('./subscription.service');

async function listInstitutions({ page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;

  const [{ rows: institutions }, { rows: countRows }] = await Promise.all([
    db.query(
      `SELECT * FROM institutions ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    ),
    db.query('SELECT COUNT(*) FROM institutions'),
  ]);

  const total = parseInt(countRows[0].count);
  return { institutions, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function getInstitution({ id }) {
  const { rows } = await db.query('SELECT * FROM institutions WHERE id=$1', [id]);
  const institution = rows[0];
  if (!institution) return null;

  const subscription = await getSubscription(id);
  return { ...institution, subscription };
}

/**
 * createInstitution — kurum + ilk kullanıcı (role_id=0, Üst Yönetici) + 14 günlük trial
 * aboneliği oluşturur.
 *
 * E-posta çarpışması: `users.email` UNIQUE'tir ve ilk kullanıcı TAM OLARAK data.email
 * ile oluşturulur. Çarpışma, transaction BAŞLAMADAN ÖNCE kontrol edilir — normal akışta
 * (çarpışma varsa) hiçbir INSERT çalışmaz, yarım kalmış bir kurum/kullanıcı asla
 * oluşmaz. Eşzamanlı (race) bir çarpışma ihtimaline karşı da transaction içindeki
 * `users` INSERT'i Postgres'in UNIQUE ihlali hatasını (23505) aynı 409'a çevirir — ilk
 * kontrolün kaçırabileceği nadir durum için ikinci bir güvenlik ağı.
 *
 * `startTrial(...)` BİLEREK transaction'ın DIŞINDA, transaction COMMIT olduktan SONRA
 * çağrılır: `subscription.service.js` kendi `db.query`'sini kullanır (transaction'ın
 * `client`'ını DEĞİL) — pool'dan AYRI bir bağlantı alır. Transaction henüz COMMIT
 * olmadan bu ayrı bağlantıdan `institution_id`'ye FK ile INSERT denemek, institutions
 * satırı o bağlantının snapshot'ında henüz "yok" olduğu için (Postgres READ COMMITTED
 * altında başka bir bağlantı commit edilmemiş satırları göremez) foreign-key ihlaliyle
 * HER ZAMAN başarısız olurdu. Bu yüzden kurum+kullanıcı transaction'ı commit olduktan
 * SONRA startTrial çağrılır: institution+user arasındaki atomiklik (asıl "yarım kalmış
 * kurum" riski) korunur, trial'ın kendisi ise bu ikisine göre best-effort bir sonraki
 * adımdır (subscription.service.js'i bir transaction client'ı kabul edecek şekilde
 * yeniden yazmak bu görevin kapsamı DIŞINDA — "gerçek fonksiyon, don't reimplement its
 * logic").
 */
async function createInstitution({ data, actorId, req }) {
  const normalizedEmail = data.email.toLowerCase().trim();

  const { rows: existing } = await db.query('SELECT id FROM users WHERE email=$1', [normalizedEmail]);
  if (existing.length) {
    throw Object.assign(new Error('Bu e-posta zaten kayıtlı'), { statusCode: 409 });
  }

  const temporaryPassword = crypto.randomBytes(12).toString('hex');
  const passwordHash = await hashPassword(temporaryPassword);

  const { institution, user } = await db.transaction(async (client) => {
    const { rows: instRows } = await client.query(
      `INSERT INTO institutions (name, type, address, phone, email, bed_count, city, district, contact_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        data.name,
        // type kolonunun DEFAULT 'Devlet Hastanesi' değeri var (migrations/001_init.sql) —
        // bu INSERT type'ı kolon listesinde EXPLICIT geçtiği için, boş bırakılırsa NULL
        // DEĞİL, tablonun kendi varsayılanı uygulanacak şekilde burada da aynı değer
        // tekrarlanıyor (açık NULL geçmek DB varsayılanını ezerdi).
        data.type ?? 'Devlet Hastanesi',
        data.address ?? null,
        data.phone ?? null,
        normalizedEmail,
        data.bedCount ?? null,
        data.city ?? null,
        data.district ?? null,
        data.contactName,
      ]
    );
    const institution = instRows[0];

    let user;
    try {
      const { rows: userRows } = await client.query(
        `INSERT INTO users (email, password_hash, full_name, role_id, institution_id)
         VALUES ($1,$2,$3,0,$4)
         RETURNING id, email, full_name, role_id, institution_id, created_at`,
        [normalizedEmail, passwordHash, data.contactName, institution.id]
      );
      user = userRows[0];
    } catch (err) {
      // 23505 = unique_violation — ön kontrolü kaçıran eşzamanlı bir çarpışma.
      if (err.code === '23505') {
        throw Object.assign(new Error('Bu e-posta zaten kayıtlı'), { statusCode: 409 });
      }
      throw err;
    }

    return { institution, user };
  });

  await startTrial({ institutionId: institution.id, planSlug: 'pro', trialDays: 14 });

  await auditPlatformAdmin({
    adminId:    actorId,
    action:     'CREATE',
    resource:   'institution',
    resourceId: institution.id,
    newData:    { ...data, email: normalizedEmail },
    req,
  });

  return {
    ...institution,
    firstUser: { ...user, temporaryPassword },
  };
}

// institutionUpdateSchema alanı → institutions tablosu kolonu
const INSTITUTION_FIELD_MAP = {
  name: 'name', type: 'type', address: 'address', phone: 'phone', email: 'email',
  bedCount: 'bed_count', city: 'city', district: 'district', contactName: 'contact_name',
};

/**
 * updateInstitution — 'finans' grubu SADECE `data.planSlug` gönderebilir (başka bir
 * alan varsa 400 fırlatılır); `planSlug` `institutions`'ın bir kolonu DEĞİL, bu
 * kurumun EN SON aboneliğinin (`subscriptions.plan_slug`) değerini günceller. 'super'
 * grubu tüm kurum alanlarını VE `planSlug`'ı aynı çağrıda değiştirebilir.
 *
 * NOT: `institutions` tablosunda `updated_at` kolonu YOK (sadece `created_at`,
 * bkz. migrations/001_init.sql) — surgery.service.js'in updateSurgery'sindeki gibi
 * `updated_at = NOW()` eklemek "column does not exist" hatası verirdi, BİLEREK
 * eklenmedi.
 */
async function updateInstitution({ id, data, actorGroupSlug, actorId, req }) {
  const keys = Object.keys(data);

  if (actorGroupSlug === 'finans') {
    const onlyPlanSlug = keys.every((k) => k === 'planSlug');
    if (!onlyPlanSlug) {
      throw Object.assign(
        new Error('Finans ekibi sadece planSlug alanını güncelleyebilir'),
        { statusCode: 400 }
      );
    }
  }

  const { rows: oldRows } = await db.query('SELECT * FROM institutions WHERE id=$1', [id]);
  const old = oldRows[0];
  if (!old) return null;

  const { planSlug, ...institutionData } = data;
  let institutionId = old.id;

  const institutionKeys = Object.keys(institutionData).filter((k) => INSTITUTION_FIELD_MAP[k] !== undefined);
  if (institutionKeys.length) {
    const sets   = [];
    const params = [];
    let pi = 1;
    for (const k of institutionKeys) {
      sets.push(`${INSTITUTION_FIELD_MAP[k]} = $${pi++}`);
      params.push(institutionData[k]);
    }
    params.push(id);
    const { rows } = await db.query(
      `UPDATE institutions SET ${sets.join(', ')} WHERE id = $${pi} RETURNING *`,
      params
    );
    institutionId = rows[0].id;
  }

  if (planSlug !== undefined) {
    const currentSub = await getSubscription(id);
    if (currentSub) {
      await db.query(
        'UPDATE subscriptions SET plan_slug=$1, updated_at=NOW() WHERE id=$2',
        [planSlug, currentSub.id]
      );
    }
  }

  await auditPlatformAdmin({
    adminId: actorId, action: 'UPDATE', resource: 'institution',
    resourceId: id, oldData: old, newData: data, req,
  });

  return getInstitution({ id: institutionId });
}

async function setInstitutionStatus({ id, isActive, actorId, req }) {
  const { rows } = await db.query(
    'UPDATE institutions SET is_active=$1 WHERE id=$2 RETURNING *',
    [isActive, id]
  );
  const institution = rows[0];
  if (!institution) return null;

  await auditPlatformAdmin({
    adminId: actorId, action: isActive ? 'ACTIVATE' : 'SUSPEND', resource: 'institution',
    resourceId: id, newData: { isActive }, req,
  });

  return institution;
}

module.exports = {
  listInstitutions,
  getInstitution,
  createInstitution,
  updateInstitution,
  setInstitutionStatus,
};
