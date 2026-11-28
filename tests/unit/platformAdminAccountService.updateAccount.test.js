import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

/**
 * Exercises the REAL `platformAdminAccount.service.js` (`updateAccount`'s last-active-
 * super-admin guard, and `generateTemporaryPassword`'s policy compliance) — this is the
 * task-7-brief.md "safety-critical requirement": a platform-admin account in the `super`
 * group being deactivated must be REJECTED if it is the LAST active `super` account.
 *
 * `require.cache` injection for `utils/db.js`, same technique as
 * `institutionGroupService.removeInstitution.test.js` (Task 4's sibling for its own
 * atomic-guard fix) and `institutionService.updatePlanSlug.test.js` — needed because
 * `platformAdminAccount.service.js` does a plain `require('../utils/db')` at module-load
 * time, which `vi.mock` doesn't reach.
 *
 * Unlike those two siblings, this guard's race-safety depends on `db.transaction`
 * ACTUALLY invoking its callback with a client whose `query` locks rows (`FOR UPDATE`) —
 * so the fake `transaction` here calls `fn({ query: fakeQuery })` instead of being a bare
 * `vi.fn()` no-op.
 */
const nodeRequire = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const dbPath                       = path.resolve(here, '../../src/utils/db.js');
const platformAdminAccountSvcPath  = path.resolve(here, '../../src/services/platformAdminAccount.service.js');
const platformAdminAuditPath       = path.resolve(here, '../../src/utils/platformAdminAudit.js');
const DEPENDENT_PATHS = [platformAdminAccountSvcPath, platformAdminAuditPath];

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

  it('hedef TEK aktif süper yönetici ise → 409 fırlatılır, UPDATE HİÇ çalışmaz, audit yazılmaz', async () => {
    const callLog = [];
    const { service, fakeTransaction } = loadWithFakeDb(async (sql) => {
      if (/SELECT \* FROM platform_admins WHERE id=\$1 FOR UPDATE/i.test(sql)) {
        callLog.push('lock-target');
        return { rows: [{ id: 'super-1', group_slug: 'super', is_active: true, email: 's@operio.com', full_name: 'Süper' }] };
      }
      if (/SELECT id FROM platform_admins WHERE group_slug='super' AND is_active=TRUE FOR UPDATE/i.test(sql)) {
        callLog.push('lock-active-supers');
        return { rows: [{ id: 'super-1' }] }; // SADECE hedef — başka aktif süper YOK
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
    expect(callLog).toContain('lock-target');
    expect(callLog).toContain('lock-active-supers');
    expect(callLog).not.toContain('update-account');
    expect(callLog).not.toContain('audit');
  });

  it('hedef 2 aktif süperden biri ise → pasife alınır, audit yazılır', async () => {
    const callLog = [];
    const { service } = loadWithFakeDb(async (sql) => {
      if (/SELECT \* FROM platform_admins WHERE id=\$1 FOR UPDATE/i.test(sql)) {
        callLog.push('lock-target');
        return { rows: [{ id: 'super-1', group_slug: 'super', is_active: true, email: 's@operio.com', full_name: 'Süper' }] };
      }
      if (/SELECT id FROM platform_admins WHERE group_slug='super' AND is_active=TRUE FOR UPDATE/i.test(sql)) {
        callLog.push('lock-active-supers');
        return { rows: [{ id: 'super-1' }, { id: 'super-2' }] }; // 2 aktif süper var
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
    expect(callLog).toContain('lock-active-supers');
    expect(callLog).toContain('update-account');
    expect(callLog).toContain('audit');
  });

  it('hedef süper GRUBUNDA değilse (örn. destek) → aktif-süper kilidi hiç çalışmaz, direkt güncellenir', async () => {
    const callLog = [];
    const { service } = loadWithFakeDb(async (sql) => {
      if (/SELECT \* FROM platform_admins WHERE id=\$1 FOR UPDATE/i.test(sql)) {
        callLog.push('lock-target');
        return { rows: [{ id: 'destek-1', group_slug: 'destek', is_active: true, email: 'd@operio.com', full_name: 'Destek' }] };
      }
      if (/SELECT id FROM platform_admins WHERE group_slug='super'/i.test(sql)) {
        callLog.push('lock-active-supers'); // BURAYA HİÇ GİRİLMEMELİ
        return { rows: [] };
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
    expect(callLog).not.toContain('lock-active-supers');
    expect(callLog).toContain('update-account');
  });

  it('bulunamayan hesap → null döner (404 route tarafında), transaction içinde UPDATE çalışmaz', async () => {
    const callLog = [];
    const { service } = loadWithFakeDb(async (sql) => {
      if (/SELECT \* FROM platform_admins WHERE id=\$1 FOR UPDATE/i.test(sql)) {
        callLog.push('lock-target');
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
