import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

/**
 * Exercises the REAL `institution.service.js` `createInstitution` for the specific
 * path where `startTrial()` throws AFTER the institution+user transaction has
 * already committed (task-3 review Finding 1: this must not go unaudited, and must
 * not surface as a bare 500 — the institution+user DID get created).
 *
 * Uses `require.cache` injection for `utils/db.js`, same technique and reason as
 * `tests/unit/authService.institutionActive.test.js` / `kioskService.*` —
 * `vi.mock` does not reach a nested `require()` from real service code here.
 * `institution.service.js` also pulls in `password.js`, `platformAdminAudit.js`,
 * `subscription.service.js` and (via that) `audit.js` — all of which do their OWN
 * `require('./db')` at module-load time, so their cache entries are cleared too,
 * not just `institution.service.js`'s own.
 */
const nodeRequire = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const dbPath                   = path.resolve(here, '../../src/utils/db.js');
const institutionServicePath   = path.resolve(here, '../../src/services/institution.service.js');
const passwordPath             = path.resolve(here, '../../src/utils/password.js');
const platformAdminAuditPath   = path.resolve(here, '../../src/utils/platformAdminAudit.js');
const subscriptionServicePath  = path.resolve(here, '../../src/services/subscription.service.js');
const auditPath                = path.resolve(here, '../../src/utils/audit.js');
const DEPENDENT_PATHS = [institutionServicePath, passwordPath, platformAdminAuditPath, subscriptionServicePath, auditPath];

describe('institution.service — createInstitution: startTrial commit SONRASI başarısız olursa (require.cache ile db enjeksiyonu)', () => {
  let callLog;

  afterEach(() => {
    delete nodeRequire.cache[dbPath];
    DEPENDENT_PATHS.forEach((p) => delete nodeRequire.cache[p]);
  });

  function loadWithFakeQuery(fakeQuery) {
    nodeRequire.cache[dbPath] = {
      id: dbPath, filename: dbPath, loaded: true,
      exports: {
        query: fakeQuery,
        transaction: vi.fn(async (fn) => fn({ query: fakeQuery })),
      },
    };
    DEPENDENT_PATHS.forEach((p) => delete nodeRequire.cache[p]);
    return nodeRequire(institutionServicePath);
  }

  it('hata FIRLATILMAZ; trialStarted:false + trialError ile dönülür VE institution+user denetim kaydı startTrial\'ın başarısız INSERT\'inden ÖNCE yazılmış olur', async () => {
    callLog = [];
    const fakeQuery = vi.fn(async (sql, params) => {
      if (/SELECT id FROM users WHERE email/i.test(sql)) {
        callLog.push('check-email');
        return { rows: [] }; // çarpışma yok
      }
      if (/INSERT INTO institutions/i.test(sql)) {
        callLog.push('insert-institution');
        return { rows: [{ id: 'inst-new', name: params[0], is_active: true, created_at: new Date() }] };
      }
      if (/INSERT INTO users/i.test(sql)) {
        callLog.push('insert-user');
        return { rows: [{ id: 'user-new', email: params[0], full_name: params[2], role_id: 0, institution_id: params[3], created_at: new Date() }] };
      }
      if (/INSERT INTO platform_admin_audit_logs/i.test(sql)) {
        callLog.push('audit-platform-admin');
        return { rows: [] };
      }
      if (/FROM subscriptions s[\s\S]*JOIN plans p/i.test(sql)) {
        callLog.push('get-subscription');
        return { rows: [] }; // henüz abonelik yok
      }
      if (/INSERT INTO subscriptions/i.test(sql)) {
        callLog.push('insert-subscription-FAILS');
        throw Object.assign(
          new Error('insert or update on table "subscriptions" violates foreign key constraint'),
          { code: '23503' }
        );
      }
      callLog.push(`other:${sql.slice(0, 40)}`);
      return { rows: [] };
    });

    const { createInstitution } = loadWithFakeQuery(fakeQuery);

    const result = await createInstitution({
      data: { name: 'Test Hastanesi', contactName: 'Ayşe Yılmaz', email: 'ayse@test-hastane.tr' },
      actorId: 'admin-1',
      req: {},
    });

    expect(result.id).toBe('inst-new');
    expect(result.firstUser.id).toBe('user-new');
    expect(result.trialStarted).toBe(false);
    expect(result.trialError).toMatch(/subscriptions/i);

    // Denetim kaydı, startTrial'ın başarısız INSERT'inden ÖNCE yazılmış olmalı —
    // institution+user commit olduğu anda kalıcı olarak audit edilir, startTrial'ın
    // sonucu NE OLURSA OLSUN.
    const auditIndex    = callLog.indexOf('audit-platform-admin');
    const failInsertIdx = callLog.indexOf('insert-subscription-FAILS');
    expect(auditIndex).toBeGreaterThanOrEqual(0);
    expect(failInsertIdx).toBeGreaterThan(auditIndex);

    // İkinci bir denetim kaydı da trial başarısızlığını işaretlemeli (görünürlük).
    expect(callLog.filter((c) => c === 'audit-platform-admin').length).toBeGreaterThanOrEqual(2);
  });

  it('startTrial BAŞARILI olursa: trialStarted:true, trialError yok', async () => {
    const fakeQuery = vi.fn(async (sql, params) => {
      if (/SELECT id FROM users WHERE email/i.test(sql)) return { rows: [] };
      if (/INSERT INTO institutions/i.test(sql)) return { rows: [{ id: 'inst-ok', name: params[0] }] };
      if (/INSERT INTO users/i.test(sql)) return { rows: [{ id: 'user-ok', email: params[0] }] };
      if (/INSERT INTO platform_admin_audit_logs/i.test(sql)) return { rows: [] };
      if (/FROM subscriptions s[\s\S]*JOIN plans p/i.test(sql)) return { rows: [] };
      if (/INSERT INTO subscriptions/i.test(sql)) {
        return { rows: [{ id: 'sub-ok', institution_id: 'inst-ok', plan_slug: 'pro', status: 'trial' }] };
      }
      if (/INSERT INTO audit_logs/i.test(sql)) return { rows: [] }; // startTrial'ın hospital-side audit()'i
      return { rows: [] };
    });

    const { createInstitution } = loadWithFakeQuery(fakeQuery);

    const result = await createInstitution({
      data: { name: 'Test Hastanesi 2', contactName: 'Mehmet', email: 'mehmet@test2.tr' },
      actorId: 'admin-1', req: {},
    });

    expect(result.trialStarted).toBe(true);
    expect(result.trialError).toBeUndefined();
  });
});
