const db         = require('../utils/db');
const { verifyPassword } = require('../utils/password');
const {
  signPlatformAdminAccessToken,
  signPlatformAdminRefreshToken,
  verifyPlatformAdminRefreshToken,
  platformAdminRefreshTokenExpiresAt,
} = require('../utils/platformAdminJwt');
const { auditPlatformAdmin } = require('../utils/platformAdminAudit');

// NOT: Lockout/2FA bu turda BİLEREK dahil edilmedi (bkz. task-2-brief.md Step 6) —
// platform-admin login akışı hastane auth.service.js'teki checkAccountLockByEmail /
// recordFailedLogin / TOTP mantığını içermez.
async function login({ email, password, req }) {
  const normalizedEmail = email.toLowerCase().trim();

  const { rows } = await db.query(
    `SELECT * FROM platform_admins WHERE email = $1 AND is_active = TRUE`,
    [normalizedEmail]
  );
  const admin = rows[0];

  // Yönetici yok veya şifre yanlış — aynı mesaj (enumeration engeli)
  if (!admin) {
    throw Object.assign(new Error('E-posta veya şifre hatalı'), { statusCode: 401 });
  }

  const valid = await verifyPassword(password, admin.password_hash);
  if (!valid) {
    throw Object.assign(new Error('E-posta veya şifre hatalı'), { statusCode: 401 });
  }

  const payload = {
    sub:       admin.id,
    email:     admin.email,
    groupSlug: admin.group_slug,
  };

  const accessToken  = signPlatformAdminAccessToken(payload);
  const refreshToken = signPlatformAdminRefreshToken(admin.id);

  await db.query(
    'INSERT INTO platform_admin_refresh_tokens (token, admin_id, expires_at) VALUES ($1,$2,$3)',
    [refreshToken, admin.id, platformAdminRefreshTokenExpiresAt()]
  );

  await auditPlatformAdmin({ adminId: admin.id, action: 'LOGIN', resource: 'platform_admin', resourceId: admin.id, req });

  const { password_hash, ...safe } = admin;

  return {
    accessToken,
    refreshToken,
    admin: safe,
  };
}

async function refreshTokens({ refreshToken, req }) {
  let payload;
  try { payload = verifyPlatformAdminRefreshToken(refreshToken); }
  catch { throw Object.assign(new Error('Geçersiz refresh token'), { statusCode: 401 }); }

  const { rows } = await db.query(
    'SELECT * FROM platform_admin_refresh_tokens WHERE token=$1 AND revoked=FALSE AND expires_at > NOW()',
    [refreshToken]
  );
  if (!rows.length) throw Object.assign(new Error('Refresh token geçersiz'), { statusCode: 401 });

  const { rows: admins } = await db.query(
    'SELECT * FROM platform_admins WHERE id=$1 AND is_active=TRUE', [payload.sub]
  );
  if (!admins.length) throw Object.assign(new Error('Yönetici bulunamadı'), { statusCode: 401 });
  const admin = admins[0];

  // Eski token'ı iptal et (rotation)
  await db.query('UPDATE platform_admin_refresh_tokens SET revoked=TRUE WHERE token=$1', [refreshToken]);

  const newAccessToken  = signPlatformAdminAccessToken({
    sub: admin.id, email: admin.email, groupSlug: admin.group_slug,
  });
  const newRefreshToken = signPlatformAdminRefreshToken(admin.id);

  await db.query(
    'INSERT INTO platform_admin_refresh_tokens (token, admin_id, expires_at) VALUES ($1,$2,$3)',
    [newRefreshToken, admin.id, platformAdminRefreshTokenExpiresAt()]
  );

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

async function logout({ refreshToken, adminId, req }) {
  if (refreshToken) {
    await db.query('UPDATE platform_admin_refresh_tokens SET revoked=TRUE WHERE token=$1 AND admin_id=$2',
      [refreshToken, adminId]).catch(() => {});
  }
  await auditPlatformAdmin({ adminId, action: 'LOGOUT', resource: 'platform_admin', resourceId: adminId, req });
}

module.exports = { login, refreshTokens, logout };
