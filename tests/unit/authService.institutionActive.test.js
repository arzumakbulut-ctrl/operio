import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import bcrypt from 'bcryptjs';
import { signRefreshToken } from '../../src/utils/jwt.js';

/**
 * Exercises the REAL `auth.service.js` `login()` / `refreshTokens()` implementation
 * (this task modifies them to gate on `institutions.is_active`) via Node's native
 * `require.cache` injection — NOT `vi.mock`.
 *
 * Empirically verified before writing this file: a plain
 * `vi.mock('../../src/utils/db.js', () => ({ default: { query: vi.fn() } }))` in a
 * scratch probe test, importing `login` from `auth.service.js` exactly as this file
 * does, did NOT intercept `auth.service.js`'s own internal `require('../utils/db')`.
 * The probe's `login()` call fell through to the REAL `db.js` and attempted a REAL
 * Postgres connection (failed with `code: 28P01`, "password authentication failed for
 * user \"test\"" — using `tests/setup.js`'s dummy `DATABASE_URL` — rather than
 * returning the mocked rows). This is the SAME "nested require ignores vi.mock" issue
 * `tests/unit/kioskService.recordTimeoutRead.test.js` documents at length, and matches
 * why EVERY other test in this suite that exercises a real service's real db calls
 * (`kioskService.recordTimeoutRead`, `kioskService.getActiveSurgeryForRoom`,
 * `sterileSetService.visionCount`) uses `require.cache` injection instead — confirmed
 * again here for `auth.service.js` specifically before committing to this approach.
 *
 * `auth.service.js` pulls in `lockout.js`, `securityLogger.js`, `audit.js` and
 * `password.js`, which ALL do their OWN `require('./db')`/`require('../utils/db')` at
 * module-load time and cache that reference. So every dependent module's cache entry
 * (not just `auth.service.js`'s own) is deleted in `beforeEach`/`afterEach` too —
 * otherwise a module cached from a PREVIOUS test in this file would keep holding a
 * stale reference to that earlier test's fake `db`.
 */
const nodeRequire = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const dbPath            = path.resolve(here, '../../src/utils/db.js');
const authServicePath   = path.resolve(here, '../../src/services/auth.service.js');
const lockoutPath       = path.resolve(here, '../../src/utils/lockout.js');
const securityLoggerPath = path.resolve(here, '../../src/utils/securityLogger.js');
const auditPath         = path.resolve(here, '../../src/utils/audit.js');
const passwordPath      = path.resolve(here, '../../src/utils/password.js');
const DEPENDENT_PATHS = [authServicePath, lockoutPath, securityLoggerPath, auditPath, passwordPath];

// Hem login()'in ana SELECT'inin (JOIN roles ...) HEM DE refreshTokens()'ın kullanıcı
// SELECT'inin, kurum aktif değilse satırı dışarıda bırakan aynı şekle sahip olmasını
// bekliyoruz: "... (u.institution_id IS NULL OR i.is_active = TRUE)". Bu regex üretim
// SQL'inde bu koşul YOKSA (düzeltme henüz yapılmadıysa) devre dışı kalır — yani bu dosya
// düzeltme öncesi çalıştırıldığında kurum pasif olsa da kullanıcı satırı HER ZAMAN
// dönderilir (gerçek, düzeltilmemiş davranış) ve aşağıdaki "reddedilir" testleri RED
// (fail) verir; düzeltme eklendiğinde GREEN (pass) olur.
const HAS_INSTITUTION_GATE = /i\.is_active\s*=\s*TRUE/i;

function makeFakeQuery({ userRow, institutionActive }) {
  return vi.fn(async (sql, params) => {
    // checkAccountLockByEmail — email ile ilk bakış
    if (/locked_until, failed_login_attempts FROM users WHERE email/i.test(sql)) {
      if (!userRow) return { rows: [] };
      return { rows: [{ id: userRow.id, locked_until: null, failed_login_attempts: 0 }] };
    }

    // checkAccountLock — id ile kilit durumu
    if (/locked_until, failed_login_attempts FROM users WHERE id/i.test(sql)) {
      return { rows: [{ locked_until: null, failed_login_attempts: 0 }] };
    }

    // login()'in ana SELECT'i (roller JOIN'i login'e özgü, refreshTokens'da yok)
    if (/JOIN roles r/i.test(sql)) {
      if (!userRow) return { rows: [] };
      const gated = HAS_INSTITUTION_GATE.test(sql);
      const institutionOk = !gated || userRow.institution_id == null || institutionActive;
      if (!institutionOk) return { rows: [] };
      return { rows: [{ ...userRow, role_name: 'ust_yonetici', role_display_name: 'Üst Yönetici' }] };
    }

    // refreshTokens() — mevcut refresh token satırı
    if (/FROM refresh_tokens WHERE token/i.test(sql)) {
      return { rows: [{ token: params[0], user_id: userRow?.id, revoked: false }] };
    }

    // refreshTokens() — kullanıcı SELECT'i (roller JOIN'i YOK, id ile)
    if (/FROM users[\s\S]*is_active/i.test(sql) && !/JOIN roles/i.test(sql)) {
      if (!userRow) return { rows: [] };
      const gated = HAS_INSTITUTION_GATE.test(sql);
      const institutionOk = !gated || userRow.institution_id == null || institutionActive;
      if (!institutionOk) return { rows: [] };
      return { rows: [userRow] };
    }

    // resetFailedLogins / refresh_tokens INSERT|UPDATE / audit_logs / security_events vb.
    return { rows: [] };
  });
}

describe('auth.service login/refreshTokens — kurum is_active kontrolü (require.cache ile db enjeksiyonu)', () => {
  afterEach(() => {
    delete nodeRequire.cache[dbPath];
    DEPENDENT_PATHS.forEach((p) => delete nodeRequire.cache[p]);
  });

  function loadAuthService(fakeQuery) {
    nodeRequire.cache[dbPath] = {
      id: dbPath, filename: dbPath, loaded: true,
      exports: { query: fakeQuery, transaction: vi.fn() },
    };
    DEPENDENT_PATHS.forEach((p) => delete nodeRequire.cache[p]);
    return nodeRequire(authServicePath);
  }

  it('kurum pasifse login reddedilir (401)', async () => {
    // password_hash BİLEREK GERÇEK bir bcrypt hash'i ve login'e GERÇEKTEN eşleşen bir
    // şifre kullanılıyor — aksi halde (örn. sahte bir password_hash string'i) test,
    // kurum kontrolünden değil, şifre doğrulamasının her koşulda başarısız olmasından
    // dolayı "yanlışlıkla" 401 alıp YANLIŞ SEBEPTEN geçebilir (ilk yazımda tam da bu
    // hataya düşüldü — bkz. commit geçmişi/rapor). Gerçek hash ile: düzeltme ÖNCESİ bu
    // test FAIL verir (login kurum pasif olsa da başarıyla biter), düzeltme SONRASI
    // PASS verir — gerçek RED→GREEN kanıtı.
    const plainPassword = 'SuspendedInst123!';
    const passwordHash  = await bcrypt.hash(plainPassword, 4);
    const userRow = {
      id: 'user-1', email: 'suspended@test-hastane.tr', password_hash: passwordHash,
      full_name: 'Kurum Pasif Kullanıcı', role_id: 0, institution_id: 'inst-suspended',
      is_active: true, totp_enabled: false,
    };
    const fakeQuery = makeFakeQuery({ userRow, institutionActive: false });
    const { login } = loadAuthService(fakeQuery);

    await expect(login({ email: userRow.email, password: plainPassword, req: {} }))
      .rejects.toMatchObject({ statusCode: 401 });
  });

  it('kurum pasifse MEVCUT refresh token da reddedilir (401)', async () => {
    const userRow = {
      id: 'user-2', email: 'suspended2@test-hastane.tr', password_hash: 'irrelevant',
      full_name: 'Kurum Pasif Kullanıcı 2', role_id: 0, institution_id: 'inst-suspended',
      is_active: true, totp_enabled: false,
    };
    const fakeQuery = makeFakeQuery({ userRow, institutionActive: false });
    const { refreshTokens } = loadAuthService(fakeQuery);

    const validRefreshToken = signRefreshToken(userRow.id);

    await expect(refreshTokens({ refreshToken: validRefreshToken, req: {} }))
      .rejects.toMatchObject({ statusCode: 401 });
  });

  it('kullanıcının institution_id değeri yoksa (misafir hekim gibi) etkilenmez', async () => {
    const plainPassword = 'GuestDoctor123!';
    const passwordHash  = await bcrypt.hash(plainPassword, 4); // test'te ucuz cost yeterli
    const userRow = {
      id: 'user-3', email: 'misafir@test-hastane.tr', password_hash: passwordHash,
      full_name: 'Misafir Hekim', role_id: 10, institution_id: null,
      is_active: true, totp_enabled: false,
    };
    // institutionActive:false OLSA BİLE institution_id null olduğu için etkilenmemeli
    const fakeQuery = makeFakeQuery({ userRow, institutionActive: false });
    const { login } = loadAuthService(fakeQuery);

    const result = await login({ email: userRow.email, password: plainPassword, req: {} });
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.user.id).toBe('user-3');
  });
});
