import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

/**
 * Exercises the REAL `platformAdminAccount.service.js` (`updateAccount`'s last-active-
 * super-admin guard, via its `runGuardedUpdate` helper, and `generateTemporaryPassword`'s
 * policy compliance) — this is the task-7-brief.md "safety-critical requirement": a
 * platform-admin account in the `super` group being deactivated OR reassigned away from
 * `super` must be REJECTED if it is the LAST active `super` account.
 *
 * Fix-report context (task-7-report.md "Fix report"): a reviewer pass found two issues
 * in the first version of this guard, both covered below:
 *   - Critical: `{ groupSlug: 'destek' }` on the sole active super (isActive untouched)
 *     bypassed the guard entirely — same catastrophic/irrecoverable outcome as
 *     `isActive:false`, just a different trigger spelling.
 *   - Important: locking the target row and the active-super set via TWO SEPARATE
 *     `FOR UPDATE` statements (even inside one transaction) opened an AB-BA deadlock
 *     between two concurrent requests deactivating two different active supers.
 * `runGuardedUpdate` now locks both in ONE statement and retries once on `40P01`
 * (deadlock_detected) as a belt-and-suspenders safety net.
 *
 * `require.cache` injection for `utils/db.js`, same technique as
 * `institutionGroupService.removeInstitution.test.js` (Task 4's sibling for its own
 * atomic-guard fix) and `institutionService.updatePlanSlug.test.js` — needed because
 * `platformAdminAccount.service.js` does a plain `require('../utils/db')` at module-load
 * time, which `vi.mock` doesn't reach.
 *
 * The fake `transaction` here calls `fn({ query: fakeQuery })` (not a bare `vi.fn()`
 * no-op) because the guard's race-safety depends on `db.transaction` actually invoking
 * its callback with a locking client.
 */
const nodeRequire = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const dbPath                       = path.resolve(here, '../../src/utils/db.js');
const platformAdminAccountSvcPath  = path.resolve(here, '../../src/services/platformAdminAccount.service.js');
const platformAdminAuditPath       = path.resolve(here, '../../src/utils/platformAdminAudit.js');
const DEPENDENT_PATHS = [platformAdminAccountSvcPath, platformAdminAuditPath];

// Her iki fix'in de (Critical + Important) hedeflediği, gerçek üretim SQL'i:
// hedef satırı VE (varsa) tüm aktif süper satırlarını TEK bir FOR UPDATE'te kilitler.
const LOCK_QUERY_RE = /WHERE id=\$1 OR \(group_slug='super' AND is_active=TRUE\)[\s\S]*FOR UPDATE/i;

describe('platformAdminAccount.service — updateAccount: son aktif süper yönetici kilidi', () => {
  afterEach(() => {
    delete nodeRequire.cache[dbPath];
    DEPENDENT_PATHS.forEach((p) => delete nodeRequire.cache[p]);
  });

  function loadWithFakeDb(fakeQueryImpl) {
    const fakeQuery = vi.fn(fakeQueryImpl);
    const fakeTransaction = vi.fn(async (fn) => fn({ query: fakeQuery }));
    nodeRequire.cache[dbPath] = {
      id: dbPath, filename: dbPath, loaded: true,
      exports: { query: fakeQuery, transaction: fakeTransaction },
    };
    DEPENDENT_PATHS.forEach((p) => delete nodeRequire.cache[p]);
    const service = nodeRequire(platformAdminAccountSvcPath);
    return { service, fakeQuery, fakeTransaction };
  }

  it('hedef TEK aktif süper yönetici ise (isActive:false) → 409 fırlatılır, UPDATE HİÇ çalışmaz, audit yazılmaz', async () => {
    const callLog = [];
    const { service, fakeTransaction } = loadWithFakeDb(async (sql) => {
      if (LOCK_QUERY_RE.test(sql)) {
        callLog.push('lock');
        return { rows: [{ id: 'super-1', group_slug: 'super', is_active: true, email: 's@operio.com', full_name: 'Süper' }] }; // SADECE hedef
      }
      if (/UPDATE platform_admins SET/i.test(sql)) {
        callLog.push('update-account');
        return { rows: [{ id: 'super-1', is_active: false }] };
      }
      if (/INSERT INTO platform_admin_audit_logs/i.test(sql)) {
        callLog.push('audit');
        return { rows: [] };
      }
      callLog.push(`other:${sql.slice(0, 40)}`);
      return { rows: [] };
    });

    await expect(service.updateAccount({
      id: 'super-1', data: { isActive: false }, actorId: 'admin-x', req: {},
    })).rejects.toMatchObject({ statusCode: 409 });

    expect(fakeTransaction).toHaveBeenCalledOnce();
    expect(callLog).toContain('lock');
    expect(callLog).not.toContain('update-account');
    expect(callLog).not.toContain('audit');
  });

  it('(Review Focus — Critical fix) hedef TEK aktif süper yönetici, groupSlug BAŞKA bir gruba taşınıyor (isActive\'e dokunulmuyor) → 409 fırlatılır, hesap DEĞİŞMEZ', async () => {
    const callLog = [];
    const { service } = loadWithFakeDb(async (sql) => {
      if (LOCK_QUERY_RE.test(sql)) {
        callLog.push('lock');
        return { rows: [{ id: 'super-1', group_slug: 'super', is_active: true, email: 's@operio.com', full_name: 'Süper' }] };
      }
      if (/UPDATE platform_admins SET/i.test(sql)) {
        callLog.push('update-account');
        return { rows: [{ id: 'super-1', group_slug: 'destek' }] };
      }
      if (/INSERT INTO platform_admin_audit_logs/i.test(sql)) {
        callLog.push('audit');
        return { rows: [] };
      }
      callLog.push(`other:${sql.slice(0, 40)}`);
      return { rows: [] };
    });

    // isActive YOK — SADECE groupSlug değişiyor. Önceki (hatalı) sürüm bunu hiç
    // guard'lamıyordu çünkü tetikleyici SADECE `data.isActive===false`'tı.
    await expect(service.updateAccount({
      id: 'super-1', data: { groupSlug: 'destek' }, actorId: 'admin-x', req: {},
    })).rejects.toMatchObject({ statusCode: 409 });

    expect(callLog).toContain('lock');
    expect(callLog).not.toContain('update-account');
    expect(callLog).not.toContain('audit');
  });

  it('hedef 2 aktif süperden biri ise (isActive:false) → pasife alınır, audit yazılır', async () => {
    const callLog = [];
    const { service } = loadWithFakeDb(async (sql) => {
      if (LOCK_QUERY_RE.test(sql)) {
        callLog.push('lock');
        return { rows: [
          { id: 'super-1', group_slug: 'super', is_active: true, email: 's@operio.com', full_name: 'Süper' },
          { id: 'super-2', group_slug: 'super', is_active: true, email: 's2@operio.com', full_name: 'Süper 2' },
        ] };
      }
      if (/UPDATE platform_admins SET/i.test(sql)) {
        callLog.push('update-account');
        return { rows: [{ id: 'super-1', is_active: false, email: 's@operio.com', full_name: 'Süper', group_slug: 'super' }] };
      }
      if (/INSERT INTO platform_admin_audit_logs/i.test(sql)) {
        callLog.push('audit');
        return { rows: [] };
      }
      callLog.push(`other:${sql.slice(0, 40)}`);
      return { rows: [] };
    });

    const result = await service.updateAccount({
      id: 'super-1', data: { isActive: false }, actorId: 'admin-x', req: {},
    });

    expect(result).toMatchObject({ id: 'super-1', is_active: false });
    expect(callLog).toContain('lock');
    expect(callLog).toContain('update-account');
    expect(callLog).toContain('audit');
  });

  it('(Review Focus — Critical fix, izin verilen taraf) hedef 2 aktif süperden biri, groupSlug başka bir gruba taşınıyor → İZİN VERİLİR', async () => {
    const callLog = [];
    const { service } = loadWithFakeDb(async (sql) => {
      if (LOCK_QUERY_RE.test(sql)) {
        callLog.push('lock');
        return { rows: [
          { id: 'super-1', group_slug: 'super', is_active: true, email: 's@operio.com', full_name: 'Süper' },
          { id: 'super-2', group_slug: 'super', is_active: true, email: 's2@operio.com', full_name: 'Süper 2' },
        ] };
      }
      if (/UPDATE platform_admins SET/i.test(sql)) {
        callLog.push('update-account');
        return { rows: [{ id: 'super-1', group_slug: 'destek', email: 's@operio.com', full_name: 'Süper', is_active: true }] };
      }
      if (/INSERT INTO platform_admin_audit_logs/i.test(sql)) {
        callLog.push('audit');
        return { rows: [] };
      }
      callLog.push(`other:${sql.slice(0, 40)}`);
      return { rows: [] };
    });

    const result = await service.updateAccount({
      id: 'super-1', data: { groupSlug: 'destek' }, actorId: 'admin-x', req: {},
    });

    expect(result).toMatchObject({ id: 'super-1', group_slug: 'destek' });
    expect(callLog).toContain('update-account');
    expect(callLog).toContain('audit');
  });

  it('hedef süper GRUBUNDA değilse (örn. destek) isActive:false → aktif-süper sayımı hiç engel olmaz, direkt güncellenir', async () => {
    const callLog = [];
    const { service } = loadWithFakeDb(async (sql) => {
      if (LOCK_QUERY_RE.test(sql)) {
        callLog.push('lock');
        return { rows: [{ id: 'destek-1', group_slug: 'destek', is_active: true, email: 'd@operio.com', full_name: 'Destek' }] };
      }
      if (/UPDATE platform_admins SET/i.test(sql)) {
        callLog.push('update-account');
        return { rows: [{ id: 'destek-1', is_active: false, email: 'd@operio.com', full_name: 'Destek', group_slug: 'destek' }] };
      }
      if (/INSERT INTO platform_admin_audit_logs/i.test(sql)) {
        callLog.push('audit');
        return { rows: [] };
      }
      callLog.push(`other:${sql.slice(0, 40)}`);
      return { rows: [] };
    });

    const result = await service.updateAccount({
      id: 'destek-1', data: { isActive: false }, actorId: 'admin-x', req: {},
    });

    expect(result).toMatchObject({ id: 'destek-1', is_active: false });
    expect(callLog).toContain('update-account');
  });

  it('isActive/groupSlug hiç gönderilmezse (sadece email/fullName) → guard hiç tetiklenmez, kilitleme sorgusu HİÇ çalışmaz', async () => {
    const callLog = [];
    const { service, fakeTransaction } = loadWithFakeDb(async (sql) => {
      if (/SELECT \* FROM platform_admins WHERE id=\$1$/i.test(sql.trim())) {
        callLog.push('plain-select');
        return { rows: [{ id: 'destek-1', group_slug: 'destek', is_active: true, email: 'd@operio.com', full_name: 'Destek' }] };
      }
      if (/UPDATE platform_admins SET/i.test(sql)) {
        callLog.push('update-account');
        return { rows: [{ id: 'destek-1', full_name: 'Yeni Ad', email: 'd@operio.com', group_slug: 'destek', is_active: true }] };
      }
      if (/INSERT INTO platform_admin_audit_logs/i.test(sql)) {
        callLog.push('audit');
        return { rows: [] };
      }
      callLog.push(`other:${sql.slice(0, 40)}`);
      return { rows: [] };
    });

    const result = await service.updateAccount({
      id: 'destek-1', data: { fullName: 'Yeni Ad' }, actorId: 'admin-x', req: {},
    });

    expect(result).toMatchObject({ full_name: 'Yeni Ad' });
    expect(fakeTransaction).not.toHaveBeenCalled();
    expect(callLog).toContain('plain-select');
    expect(callLog).toContain('update-account');
  });

  it('bulunamayan hesap (isActive:false) → null döner, UPDATE çalışmaz', async () => {
    const callLog = [];
    const { service } = loadWithFakeDb(async (sql) => {
      if (LOCK_QUERY_RE.test(sql)) {
        callLog.push('lock');
        return { rows: [] }; // hesap yok
      }
      callLog.push(`other:${sql.slice(0, 40)}`);
      return { rows: [] };
    });

    const result = await service.updateAccount({
      id: 'yok', data: { isActive: false }, actorId: 'admin-x', req: {},
    });

    expect(result).toBeNull();
    expect(callLog).not.toContain('update-account');
  });

  it('(Review Focus — Important fix) transaction 40P01 (deadlock_detected) ile başarısız olursa BİR KEZ retry edilir, ikinci denemede başarır', async () => {
    const callLog = [];
    const fakeQuery = vi.fn(async (sql) => {
      if (LOCK_QUERY_RE.test(sql)) {
        callLog.push('lock');
        return { rows: [
          { id: 'super-1', group_slug: 'super', is_active: true, email: 's@operio.com', full_name: 'Süper' },
          { id: 'super-2', group_slug: 'super', is_active: true, email: 's2@operio.com', full_name: 'Süper 2' },
        ] };
      }
      if (/UPDATE platform_admins SET/i.test(sql)) {
        callLog.push('update-account');
        return { rows: [{ id: 'super-1', is_active: false, email: 's@operio.com', full_name: 'Süper', group_slug: 'super' }] };
      }
      if (/INSERT INTO platform_admin_audit_logs/i.test(sql)) {
        callLog.push('audit');
        return { rows: [] };
      }
      return { rows: [] };
    });

    let transactionCalls = 0;
    const fakeTransaction = vi.fn(async (fn) => {
      transactionCalls += 1;
      if (transactionCalls === 1) {
        throw Object.assign(new Error('deadlock detected'), { code: '40P01' });
      }
      return fn({ query: fakeQuery });
    });

    nodeRequire.cache[dbPath] = {
      id: dbPath, filename: dbPath, loaded: true,
      exports: { query: fakeQuery, transaction: fakeTransaction },
    };
    DEPENDENT_PATHS.forEach((p) => delete nodeRequire.cache[p]);
    const service = nodeRequire(platformAdminAccountSvcPath);

    const result = await service.updateAccount({
      id: 'super-1', data: { isActive: false }, actorId: 'admin-x', req: {},
    });

    expect(result).toMatchObject({ id: 'super-1', is_active: false });
    expect(fakeTransaction).toHaveBeenCalledTimes(2); // 1 başarısız + 1 retry
    expect(callLog).toContain('update-account');
  });

  it('(Review Focus — Important fix) 40P01 İKİNCİ denemede de tekrarlanırsa artık retry edilmez, hata olduğu gibi fırlatılır', async () => {
    const fakeTransaction = vi.fn(async () => {
      throw Object.assign(new Error('deadlock detected'), { code: '40P01' });
    });
    nodeRequire.cache[dbPath] = {
      id: dbPath, filename: dbPath, loaded: true,
      exports: { query: vi.fn(), transaction: fakeTransaction },
    };
    DEPENDENT_PATHS.forEach((p) => delete nodeRequire.cache[p]);
    const service = nodeRequire(platformAdminAccountSvcPath);

    await expect(service.updateAccount({
      id: 'super-1', data: { isActive: false }, actorId: 'admin-x', req: {},
    })).rejects.toMatchObject({ code: '40P01' });

    expect(fakeTransaction).toHaveBeenCalledTimes(2); // 1 ilk deneme + 1 retry, sonra DURUR
  });
});

describe('platformAdminAccount.service — generateTemporaryPassword: üretilen şifre mevcut güç politikasını karşılar', () => {
  afterEach(() => {
    delete nodeRequire.cache[dbPath];
    DEPENDENT_PATHS.forEach((p) => delete nodeRequire.cache[p]);
  });

  it('100 ardışık üretimin HİÇBİRİ validatePasswordStrength\'i başarısız etmez (büyük/küçük harf, rakam, özel karakter, uzunluk)', async () => {
    nodeRequire.cache[dbPath] = {
      id: dbPath, filename: dbPath, loaded: true,
      exports: { query: vi.fn(), transaction: vi.fn() },
    };
    DEPENDENT_PATHS.forEach((p) => delete nodeRequire.cache[p]);
    const { generateTemporaryPassword } = nodeRequire(platformAdminAccountSvcPath);
    const { validatePasswordStrength } = nodeRequire(path.resolve(here, '../../src/utils/password.js'));

    for (let i = 0; i < 100; i++) {
      const pwd = generateTemporaryPassword();
      expect(validatePasswordStrength(pwd)).toEqual([]);
      expect(pwd.length).toBeGreaterThanOrEqual(8);
      expect(pwd.length).toBeLessThanOrEqual(128);
    }
  });
});
