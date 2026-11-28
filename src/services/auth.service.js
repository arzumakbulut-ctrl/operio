const db         = require('../utils/db');
const { hashPassword, verifyPassword, savePasswordHistory, validatePasswordStrength } = require('../utils/password');
const { recordFailedLogin, resetFailedLogins, checkAccountLockByEmail } = require('../utils/lockout');
const { signAccessToken, signRefreshToken, verifyRefreshToken, refreshTokenExpiresAt } = require('../utils/jwt');
const { logSecurityEvent } = require('../utils/securityLogger');
const { audit } = require('../utils/audit');

async function login({ email, password, req }) {
  const normalizedEmail = email.toLowerCase().trim();

  // Kullanıcı var mı + kilitli mi?
  const lockCheck = await checkAccountLockByEmail(normalizedEmail);

  if (lockCheck.exists && lockCheck.isLocked) {
    await logSecurityEvent({
      userId:    lockCheck.userId,
      eventType: 'LOGIN_BLOCKED_LOCKED',
      details:   { email: normalizedEmail, minutesLeft: lockCheck.minutesLeft },
      req,
    });
    throw Object.assign(
      new Error(`Hesap ${lockCheck.minutesLeft} dakika kilitli. Lütfen bekleyin.`),
      { statusCode: 423 }
    );
  }

  // Kullanıcıyı getir — kurumu SUSPEND edilmiş (institutions.is_active=FALSE) bir
  // kullanıcı giriş yapamaz. `institution_id` nullable'dır (misafir hekim gibi hiçbir
  // kuruma bağlı olmayan kullanıcılar bundan ETKİLENMEZ — bkz. migrations/001_init.sql
  // users.institution_id: FK ama NOT NULL değil), bu yüzden koşul institution_id NULL
  // olduğunda otomatik olarak geçerli sayılır.
  const { rows } = await db.query(
    `SELECT u.*, r.name AS role_name, r.display_name AS role_display_name
     FROM users u
     JOIN roles r ON u.role_id = r.id
     LEFT JOIN institutions i ON u.institution_id = i.id
     WHERE u.email = $1 AND u.is_active = TRUE
       AND (u.institution_id IS NULL OR i.is_active = TRUE)`,
    [normalizedEmail]
  );
  const user = rows[0];

  // Kullanıcı yok veya şifre yanlış — aynı mesaj (enumeration engeli)
  if (!user) {
    await logSecurityEvent({ eventType: 'LOGIN_FAILED', details: { email: normalizedEmail }, req });
    throw Object.assign(new Error('E-posta veya şifre hatalı'), { statusCode: 401 });
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    await recordFailedLogin({ userId: user.id, email: normalizedEmail, ipAddress: req?.ip, req });
    throw Object.assign(new Error('E-posta veya şifre hatalı'), { statusCode: 401 });
  }

  // Başarılı giriş — sayacı sıfırla
  await resetFailedLogins(user.id);

  const payload = {
    sub:           user.id,
    email:         user.email,
    roleId:        user.role_id,
    institutionId: user.institution_id,
    totpEnabled:   user.totp_enabled,
  };

  const accessToken  = signAccessToken(payload);
  const refreshToken = signRefreshToken(user.id);

  await db.query(
    'INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES ($1,$2,$3)',
    [refreshToken, user.id, refreshTokenExpiresAt()]
  );

  await audit({ userId: user.id, action: 'LOGIN', resource: 'user', resourceId: user.id, req });

  const { password_hash, totp_secret, ...safe } = user;

  return {
    accessToken,
    refreshToken,
    user: safe,
    // 2FA etkinse frontend'e bildir, TOTP doğrulama gerekli
    requiresTOTP: user.totp_enabled,
  };
}

async function register({ email, password, fullName, roleId, institutionId }) {
  const normalizedEmail = email.toLowerCase().trim();

  // E-posta var mı?
  const { rows: exists } = await db.query('SELECT id FROM users WHERE email=$1', [normalizedEmail]);
  if (exists.length) throw Object.assign(new Error('Bu e-posta zaten kayıtlı'), { statusCode: 409 });

  // Şifre politikası
  const errors = validatePasswordStrength(password);
  if (errors.length) throw Object.assign(new Error(errors.join('; ')), { statusCode: 400 });

  const passwordHash = await hashPassword(password);

  const { rows } = await db.query(
    `INSERT INTO users (email, password_hash, full_name, role_id, institution_id)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id, email, full_name, role_id, institution_id, created_at`,
    [normalizedEmail, passwordHash, fullName, roleId, institutionId ?? null]
  );

  const user = rows[0];

  // İlk şifreyi geçmişe kaydet
  await savePasswordHistory(user.id, passwordHash);
  await audit({ userId: user.id, action: 'CREATE', resource: 'user', resourceId: user.id,
    newData: { email: normalizedEmail, fullName, roleId } });

  return user;
}

async function refreshTokens({ refreshToken, req }) {
  let payload;
  try { payload = verifyRefreshToken(refreshToken); }
  catch { throw Object.assign(new Error('Geçersiz refresh token'), { statusCode: 401 }); }

  const { rows } = await db.query(
    'SELECT * FROM refresh_tokens WHERE token=$1 AND revoked=FALSE AND expires_at > NOW()',
    [refreshToken]
  );
  if (!rows.length) throw Object.assign(new Error('Refresh token geçersiz'), { statusCode: 401 });

  // login()'deki AYNI kurum-pasif kontrolü: zaten elde bir refresh token olsa bile,
  // kurum bu süre içinde suspend edildiyse yenileme reddedilir.
  const { rows: users } = await db.query(
    `SELECT u.* FROM users u
     LEFT JOIN institutions i ON u.institution_id = i.id
     WHERE u.id=$1 AND u.is_active=TRUE
       AND (u.institution_id IS NULL OR i.is_active = TRUE)`,
    [payload.sub]
  );
  if (!users.length) throw Object.assign(new Error('Kullanıcı bulunamadı'), { statusCode: 401 });
  const user = users[0];

  // Eski token'ı iptal et (rotation)
  await db.query('UPDATE refresh_tokens SET revoked=TRUE WHERE token=$1', [refreshToken]);

  const newAccessToken  = signAccessToken({
    sub: user.id, email: user.email, roleId: user.role_id,
    institutionId: user.institution_id, totpEnabled: user.totp_enabled,
  });
  const newRefreshToken = signRefreshToken(user.id);

  await db.query(
    'INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES ($1,$2,$3)',
    [newRefreshToken, user.id, refreshTokenExpiresAt()]
  );

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

async function logout({ refreshToken, userId, req }) {
  if (refreshToken) {
    await db.query('UPDATE refresh_tokens SET revoked=TRUE WHERE token=$1 AND user_id=$2',
      [refreshToken, userId]).catch(() => {});
  }
  await audit({ userId, action: 'LOGOUT', resource: 'user', resourceId: userId, req });
}

module.exports = { login, register, refreshTokens, logout };
