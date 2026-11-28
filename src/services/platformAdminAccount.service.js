const crypto = require('crypto');
const db     = require('../utils/db');
const { hashPassword, validatePasswordStrength } = require('../utils/password');
const { auditPlatformAdmin } = require('../utils/platformAdminAudit');

// Hesaplar kabul edilen 4 sabit grup — migrations/002_platform_admin.sql'in seed'i ile
// AYNI slug'lar. schemas.js'teki z.enum ile AYNI liste (iki yerde tutuluyor çünkü
// schemas.js zod'a, bu dosya düz bir diziye ihtiyaç duyuyor — zod'un enum'ını buraya
// import etmek servis katmanını validasyon katmanına bağımlı kılardı).
const GROUP_SLUGS = ['super', 'destek', 'finans', 'icerik'];

// API'deki camelCase alan adları → platform_admins kolonları (platformSettings.service.js'in
// AYNI FIELD_MAP deseni). password_hash BİLEREK burada YOK — şifre SADECE createAccount'ta
// (geçici şifre üretimiyle) ve ayrı bir "şifre sıfırla" akışında (bu task'ın kapsamı
// DIŞINDA) değişir, updateAccount üzerinden asla yazılamaz.
const ACCOUNT_FIELD_MAP = {
  email:     'email',
  fullName:  'full_name',
  groupSlug: 'group_slug',
  isActive:  'is_active',
};

// ── GEÇİCİ ŞİFRE ÜRETİMİ ────────────────────────────────────
// institution.service.js'in createInstitution'ındaki `crypto.randomBytes(12).toString('hex')`
// İLE AYNI deseni BİLEREK KULLANMAZ: hex alfabesi sadece 0-9a-f'tir — büyük harf YOK,
// özel karakter YOK — bu yüzden o şifre `validatePasswordStrength`'i (config/security.js'in
// PASSWORD.REQUIRE_UPPERCASE/REQUIRE_SPECIAL) HER ZAMAN başarısız ederdi. O akışta bu
// önemsizdi (ilk hastane kullanıcısı institution.service.js'in kendi akışında, policy
// kontrolünden hiç geçmeden hashleniyor) — ama platform-admin hesapları için bu task
// BİLEREK politikayla TUTARLI bir geçici şifre üretmeyi istiyor (bkz. task-7-brief.md),
// aksi halde insan bir yönetici bu hesabı sonradan manuel sıfırlarken "üretilen şifre
// kuralları karşılamıyordu ama hash'lenmişti" tutarsızlığıyla karşılaşırdı.
//
// Karışabilecek karakterler (I/l/1, O/0) BİLEREK dışarıda tutuldu — bu şifre bir insana
// (yeni platform-admin'e) okunup elle girilecek, OCR/okuma hatası riski azaltılır.
const PWD_UPPER   = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const PWD_LOWER   = 'abcdefghijkmnopqrstuvwxyz';
const PWD_DIGIT   = '23456789';
const PWD_SPECIAL = '!@#$%^&*';
const PWD_ALL     = PWD_UPPER + PWD_LOWER + PWD_DIGIT + PWD_SPECIAL;

function randomIndex(max) {
  // crypto.randomBytes(1)[0] (0-255) % max — max küçük (<=32) olduğu için modulo
  // bias'ı burada göz ardı edilebilir seviyede (bu bir kriptografik anahtar DEĞİL,
  // sadece hashlenmeden önce bir kez kullanılan, politikaya uygun bir geçici şifre).
  return crypto.randomBytes(1)[0] % max;
}

function randomChar(charset) {
  return charset[randomIndex(charset.length)];
}

function generateTemporaryPassword() {
  // 4 zorunlu sınıftan (büyük/küçük harf, rakam, özel karakter) birer karakteri GARANTİ
  // et — bu, `validatePasswordStrength`'in REQUIRE_* kurallarının HER ZAMAN karşılanmasını
  // inşa yoluyla sağlar (rastgele seçim değil). Ardından 16 karaktere tamamla (MIN_LENGTH=8'in
  // iki katından fazla, MAX_LENGTH=128'in çok altı) ve Fisher-Yates ile karıştır — zorunlu
  // karakterler hep ilk 4 pozisyonda kalırsa şifre tahmin edilebilir bir desen izlerdi.
  const chars = [
    randomChar(PWD_UPPER), randomChar(PWD_LOWER), randomChar(PWD_DIGIT), randomChar(PWD_SPECIAL),
  ];
  while (chars.length < 16) chars.push(randomChar(PWD_ALL));

  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  const candidate = chars.join('');

  // Savunma amaçlı ikinci kontrol: yukarıdaki inşa HER ZAMAN 4 sınıfı da içerdiği ve
  // "yaygın zayıf şifreler" listesine (password.js) çarpması istatistiksel olarak imkansız
  // olduğu için bu normalde asla tetiklenmez — ama gerçek politikanın KENDİSİYLE
  // (validatePasswordStrength'i yeniden implemente etmeden) doğrulamak, iki kuralın
  // (burada inşa edilen VE password.js'te tanımlı) birbirinden sessizce sapmasına karşı
  // tek güvenlik ağı. Teorik olarak hiç tetiklenmeyeceği için retry'da sonsuz döngü riski
  // yok (candidate her çağrıda yeni rastgele karakterlerle üretilir).
  if (validatePasswordStrength(candidate).length) return generateTemporaryPassword();
  return candidate;
}

/**
 * listGroups — sabit 4 grubu, her birinin aktif üye sayısıyla (`kullaniciSayisi`) birlikte
 * döner. N+1 sorgu BİLEREK kabul edildi: grup sayısı sabit ve küçük (4) — AYNI
 * institutionGroup.service.js'in listGroups'undaki gerekçe (sayfalama brief'te istenmiyor,
 * tek-sorgu + COUNT optimizasyonu burada gerekli değil).
 */
async function listGroups() {
  const { rows: groups } = await db.query('SELECT * FROM platform_admin_groups ORDER BY slug');

  return Promise.all(groups.map(async (group) => {
    const { rows: countRows } = await db.query(
      'SELECT COUNT(*) FROM platform_admins WHERE group_slug=$1 AND is_active=TRUE',
      [group.slug]
    );
    return { ...group, kullaniciSayisi: parseInt(countRows[0].count, 10) };
  }));
}

/**
 * listAccounts — password_hash HARİÇ tüm hesapları döner (SELECT kolon listesi hash'i
 * hiç çekmez — response'tan sonradan `delete`/destructure etmeye güvenmek yerine, hash
 * en baştan sorgu sonucuna hiç girmez).
 */
async function listAccounts() {
  const { rows } = await db.query(
    `SELECT id, email, full_name, group_slug, is_active, created_at
     FROM platform_admins ORDER BY created_at DESC`
  );
  return rows;
}

/**
 * createAccount — yeni platform-admin hesabı oluşturur, `crypto.randomBytes` tabanlı
 * (`generateTemporaryPassword`) politikaya-uygun bir geçici şifre üretir.
 *
 * GÜVENLİK: Düz-metin şifre SADECE bu fonksiyonun döndürdüğü response nesnesinde BİR KEZ
 * yer alır (`temporaryPassword`). DB'ye SADECE `hashPassword` çıktısı (`password_hash`)
 * yazılır — düz metin hiçbir satıra, hiçbir audit kaydına (`auditPlatformAdmin`'in
 * `newData`'sı aşağıda email/fullName/groupSlug ile SINIRLI, şifre YOK) ve hiçbir log
 * satırına asla yazılmaz.
 */
async function createAccount({ data, actorId, req }) {
  const normalizedEmail = data.email.toLowerCase().trim();

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  let account;
  try {
    const { rows } = await db.query(
      `INSERT INTO platform_admins (email, password_hash, full_name, group_slug)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [normalizedEmail, passwordHash, data.fullName, data.groupSlug]
    );
    account = rows[0];
  } catch (err) {
    // 23505 = unique_violation (email) — createInstitution'ın AYNI deseni.
    if (err.code === '23505') {
      throw Object.assign(new Error('Bu e-posta zaten kayıtlı'), { statusCode: 409 });
    }
    throw err;
  }

  await auditPlatformAdmin({
    adminId: actorId, action: 'CREATE', resource: 'platform_admin',
    resourceId: account.id,
    newData: { email: normalizedEmail, fullName: data.fullName, groupSlug: data.groupSlug },
    req,
  });

  const { password_hash, ...safe } = account;
  // temporaryPassword BURADA ve SADECE BURADA — bu fonksiyonun geri döndüğü andan sonra
  // düz metin hiçbir değişkende/satırda tutulmaz.
  return { ...safe, temporaryPassword };
}

/**
 * updateAccount — kısmi güncelleme (email/fullName/groupSlug/isActive).
 *
 * SON AKTİF SÜPER YÖNETİCİ KİLİDİ (Review Focus — task-7-brief.md'nin "safety-critical
 * requirement"i): `data.isActive===false` istendiğinde, güncelleme AYNI transaction
 * içinde şu sırayla yapılır:
 *   1. Hedef satır `SELECT ... FOR UPDATE` ile KİLİTLENİR — group_slug/is_active'i
 *      transaction BAŞLAMADAN ÖNCE (bayat olabilecek) okunmuş bir değer değil, kilitli/
 *      güncel haliyle görürüz (bu, aynı satırı aynı anda değiştirmeye çalışan başka bir
 *      isteği de bloke eder).
 *   2. Hedef `group_slug==='super'` VE şu an `is_active===true` ise: TÜM aktif süper
 *      yönetici satırları `SELECT ... FOR UPDATE` ile KİLİTLENİR (hedef de bu kümenin
 *      içinde, çünkü hâlâ aktif). Bu küme <=1 ise (yani hedef TEK aktif süper ise) 409
 *      fırlatılır — UPDATE'e HİÇ gidilmez.
 *   3. Guard geçerse, UPDATE AYNI transaction/client ile çalışır.
 *
 * NEDEN "SELECT COUNT + sonra UPDATE" (iki ayrı statement, kilit YOK) YETERSİZ: Postgres'in
 * varsayılan READ COMMITTED izolasyonunda her statement kendi (o anki) commit edilmiş
 * veri üzerinden bir snapshot alır — ama bir `SELECT COUNT(*)` FOR UPDATE'SİZ hiçbir satırı
 * kilitlemez. İki eşzamanlı istek (aynı anda FARKLI iki süper hesabı pasife almaya çalışan)
 * şu sırayla çarpışabilir: Request A "aktif süper sayısı=2, >1, devam" der; Request B
 * (A henüz COMMIT OLMADAN) AYNI sayımı yapar, O DA "2, >1, devam" der (A'nın henüz commit
 * edilmemiş değişikliğini GÖREMEZ); ikisi de kendi UPDATE'ini çalıştırıp COMMIT eder →
 * sonuç 0 aktif süper. `db.transaction` içine sarmak TEK BAŞINA bunu çözmez — izolasyon
 * seviyesini değiştirmediği ya da satırları KİLİTLEMEDİĞİ sürece aynı iki-snapshot açığı
 * kalır. Bu yüzden burada SADECE transaction'a sarmakla YETİNİLMEDİ: `FOR UPDATE`, ikinci
 * isteğin sayım SELECT'ini birincisi COMMIT/ROLLBACK olana kadar fiilen BLOKE eder; birinci
 * COMMIT olduktan sonra ikincisinin kilidi açılır ve artık GÜNCEL (azalmış) sayıyı görür —
 * bu da gerçek sırayla (race değil) doğru kararı garantiler.
 *
 * Task 4'ün `removeInstitution`'ındaki "WHERE id=$1 AND group_id=$2" deseni burada
 * KULLANILAMADI: o desende kontrol VE güncelleme AYNI satırın AYNI kolonuna bakıyordu (tek
 * satırın kendi kilidi yeterliydi). Buradaki kontrol ise birden FAZLA satır üzerinde bir
 * AGREGAT (COUNT) — agregatın kendisini race-safe yapmak için o satırların HEPSİNİN
 * kilitlenmesi gerekiyor, bu da `FOR UPDATE`'i (tek bir WHERE eşitliğinden daha fazlasını)
 * gerektiriyor. Ayrıntılı gerekçe: task-7-report.md.
 */
async function updateAccount({ id, data, actorId, req }) {
  const keys = Object.keys(data).filter((k) => ACCOUNT_FIELD_MAP[k] !== undefined);

  if (!keys.length) {
    const { rows } = await db.query('SELECT * FROM platform_admins WHERE id=$1', [id]);
    if (!rows[0]) return null;
    const { password_hash, ...safe } = rows[0];
    return safe;
  }

  const sets   = [];
  const params = [];
  let pi = 1;
  for (const k of keys) {
    sets.push(`${ACCOUNT_FIELD_MAP[k]} = $${pi++}`);
    params.push(k === 'email' ? String(data[k]).toLowerCase().trim() : data[k]);
  }
  params.push(id);
  const updateSql = `UPDATE platform_admins SET ${sets.join(', ')} WHERE id=$${pi} RETURNING *`;

  const willDeactivate = data.isActive === false;

  let old;
  let account;
  try {
    if (willDeactivate) {
      const result = await db.transaction(async (client) => {
        const { rows: targetRows } = await client.query(
          'SELECT * FROM platform_admins WHERE id=$1 FOR UPDATE', [id]
        );
        const target = targetRows[0];
        if (!target) return { old: null, account: null };

        if (target.group_slug === 'super' && target.is_active === true) {
          const { rows: lockedActiveSupers } = await client.query(
            `SELECT id FROM platform_admins WHERE group_slug='super' AND is_active=TRUE FOR UPDATE`
          );
          if (lockedActiveSupers.length <= 1) {
            throw Object.assign(
              new Error('Son aktif süper yönetici pasife alınamaz'),
              { statusCode: 409 }
            );
          }
        }

        const { rows } = await client.query(updateSql, params);
        return { old: target, account: rows[0] };
      });
      old = result.old;
      account = result.account;
    } else {
      const { rows: targetRows } = await db.query('SELECT * FROM platform_admins WHERE id=$1', [id]);
      old = targetRows[0];
      if (!old) return null;
      const { rows } = await db.query(updateSql, params);
      account = rows[0];
    }
  } catch (err) {
    if (err.code === '23505') {
      throw Object.assign(new Error('Bu e-posta zaten kayıtlı'), { statusCode: 409 });
    }
    throw err;
  }

  if (!old) return null;

  await auditPlatformAdmin({
    adminId: actorId, action: 'UPDATE', resource: 'platform_admin',
    resourceId: id,
    oldData: { email: old.email, fullName: old.full_name, groupSlug: old.group_slug, isActive: old.is_active },
    newData: data,
    req,
  });

  const { password_hash, ...safe } = account;
  return safe;
}

module.exports = {
  GROUP_SLUGS,
  listGroups,
  listAccounts,
  createAccount,
  updateAccount,
  // Test-only export — platformAdminAccountService.updateAccount.test.js'in gerçek
  // politika kontrolüyle (validatePasswordStrength) tutarlılığı doğrulaması için.
  generateTemporaryPassword,
};
