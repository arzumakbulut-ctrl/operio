const { verifyPlatformAdminAccessToken } = require('../utils/platformAdminJwt');
const { unauthorized, forbidden } = require('../utils/response');
const registry = require('../services/_registry');

const getAccountService = () => registry.get('platformAdminAccount', () => require('../services/platformAdminAccount.service'));

/**
 * authenticatePlatformAdmin — Authorization: Bearer <token> başlığını doğrular.
 * Başarılı olursa req.platformAdmin = { sub, email, groupSlug } atar.
 * DİKKAT: req.user DEĞİL — hastane auth'unun (middleware/auth.js) req.user'ıyla
 * ASLA çakışmaz, aynı request'te ikisi de çalışsa bile birbirinin kimliğini ezmez.
 *
 * ANLIK HESAP DURUMU KONTROLÜ (Review Focus — Finding 5): JWT doğrulaması TEK
 * BAŞINA, hesabın HÂLÂ aktif olduğunu ya da token'daki `groupSlug`'ın HÂLÂ GEÇERLİ
 * olduğunu garanti ETMEZ — JWT sadece imzalandığı ANDAKİ payload'ı taşır. Bir
 * 'super' hesap deaktif edilse ya da başka bir gruba taşınsa, eski kod bunu bir
 * sonraki `refreshTokens` çağrısına kadar (access-token TTL'i, varsayılan 15 dk,
 * boyunca) FARK ETMEZDİ — bu pencerede deaktif/terfi-indirgenmiş hesap kendini
 * yeniden aktifleştirebilir ya da yeni bir hesabı 'super'e terfi ettirebilirdi,
 * deaktivasyonun TÜM amacını boşa çıkarırdı. `platformAdminAuth.service.js`'in
 * `refreshTokens`'ı BUNU ZATEN yapıyordu (is_active + GÜNCEL group'u yeniden okur) —
 * burada eksik olan, SADECE erişim-token penceresiydi.
 *
 * Bu yüzden JWT doğrulandıktan SONRA `platform_admins`'e karşı ucuz bir
 * `SELECT is_active, group_slug` çalıştırılır (platform-admin trafiği doğası
 * gereği düşük hacimli — bir avuç hesap, binlerce istek/sn DEĞİL — bu ekstra
 * sorgu burada kabul edilebilir bir maliyettir) ve:
 *   - hesap artık yoksa/is_active=FALSE ise → 401 (token'ın kalan TTL'i ÖNEMSİZ).
 *   - `req.platformAdmin.groupSlug`, DB'nin GÜNCEL değeriyle DOLAR — token'ın
 *     KENDİ (olası bayat) `groupSlug` iddiasıyla DEĞİL. Sonraki `authorizePlatformAdmin`
 *     kontrolleri bu alanı DEĞİŞTİRMEDEN okur, bu yüzden otomatik olarak GÜNCEL
 *     değere göre karar verir — demotion durumu da böylece AYRI bir kod yolu
 *     olmadan kapanır.
 *
 * hastane auth'u (middleware/auth.js) BUNUN EŞDEĞERİNİ yapmıyor — bu KASITLI
 * olarak buraya kopyalanmadı (brief SADECE platform-admin için bu pencereyi
 * kapatmayı istiyor; hastane tarafının AYNI eksikliği AYRI, bu turun kapsamı
 * DIŞINDA bir bulgu).
 */
async function authenticatePlatformAdmin(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return unauthorized(res);
  }

  const token = header.slice(7);
  let payload;
  try {
    payload = verifyPlatformAdminAccessToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return unauthorized(res, 'Oturum süresi doldu, yenileyin');
    }
    return unauthorized(res, 'Geçersiz token');
  }

  try {
    const account = await getAccountService().getActiveAccountById(payload.sub);
    if (!account || !account.is_active) {
      return unauthorized(res, 'Hesap devre dışı veya bulunamadı');
    }
    req.platformAdmin = { ...payload, groupSlug: account.group_slug };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * authorizePlatformAdmin(...groupSlugs) — authenticatePlatformAdmin'den sonra kullanılır.
 * Belirtilen gruplardan birine sahip değilse 403 döner.
 */
function authorizePlatformAdmin(...groupSlugs) {
  return (req, res, next) => {
    if (!req.platformAdmin) return unauthorized(res);
    if (!groupSlugs.includes(req.platformAdmin.groupSlug)) {
      return forbidden(res);
    }
    next();
  };
}

module.exports = { authenticatePlatformAdmin, authorizePlatformAdmin };
