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
 * `subscription.service.js`, `platformSettings.service.js` (Review Focus Finding 3 —
 * `resolveTrialDays`) and (via that) `audit.js` — all of which do their OWN
 * `require('./db')` at module-load time, so their cache entries are cleared too,
 * not just `institution.service.js`'s own.
 */
const nodeRequire = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const dbPath                      = path.resolve(here, '../../src/utils/db.js');
const institutionServicePath      = path.resolve(here, '../../src/services/institution.service.js');
const passwordPath                = path.resolve(here, '../../src/utils/password.js');
const platformAdminAuditPath      = path.resolve(here, '../../src/utils/platformAdminAudit.js');
const subscriptionServicePath     = path.resolve(here, '../../src/services/subscription.service.js');
const platformSettingsServicePath = path.resolve(here, '../../src/services/platformSettings.service.js');
const auditPath                   = path.resolve(here, '../../src/utils/audit.js');
const DEPENDENT_PATHS = [
  institutionServicePath, passwordPath, platformAdminAuditPath,
  subscriptionServicePath, platformSettingsServicePath, auditPath,
];

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

  /**
   * Review Focus — Finding 3: trial süresi artık sabit 14 DEĞİL, `platform_settings.
   * trial_days`'den okunuyor (platformSettings.service.js'in GERÇEK `getSettings`'i
   * — "gerçek fonksiyon, don't reimplement its logic"). Aksi halde Task 6'nın PATCH
   * /platform-settings ile düzenlettiği bu alan tamamen dekoratif kalırdı.
   */
  it('startTrial, platform_settings.trial_days\'in GERÇEK (sabit 14 DEĞİL) değeriyle çağrılır', async () => {
    const startTrialCalls = [];
    const fakeQuery = vi.fn(async (sql, params) => {
      if (/SELECT id FROM users WHERE email/i.test(sql)) return { rows: [] };
      if (/INSERT INTO institutions/i.test(sql)) return { rows: [{ id: 'inst-settings', name: params[0] }] };
      if (/INSERT INTO users/i.test(sql)) return { rows: [{ id: 'user-settings', email: params[0] }] };
      if (/INSERT INTO platform_admin_audit_logs/i.test(sql)) return { rows: [] };
      if (/SELECT \* FROM platform_settings WHERE id=1/i.test(sql)) {
        return { rows: [{ id: 1, platform_name: 'Operio', trial_days: 30 }] };
      }
      if (/FROM subscriptions s[\s\S]*JOIN plans p/i.test(sql)) return { rows: [] };
      if (/INSERT INTO subscriptions/i.test(sql)) {
        startTrialCalls.push(params);
        return { rows: [{ id: 'sub-settings', institution_id: 'inst-settings', plan_slug: params[1], trial_ends_at: params[2] }] };
      }
      if (/INSERT INTO audit_logs/i.test(sql)) return { rows: [] };
      return { rows: [] };
    });

    const { createInstitution } = loadWithFakeQuery(fakeQuery);

    const before = Date.now();
    await createInstitution({
      data: { name: 'Test Hastanesi 3', contactName: 'Zeynep', email: 'zeynep@test3.tr' },
      actorId: 'admin-1', req: {},
    });

    expect(startTrialCalls).toHaveLength(1);
    // subscriptions INSERT: ($1 institutionId, $2 planSlug, $3 trialEndsAt, ...) —
    // trialEndsAt, startTrial içinde `new Date(); setDate(getDate() + trialDays)` ile
    // hesaplanır — 30 günlük bir fark (eski sabit 14 DEĞİL) ~30 gün sonrasına denk gelmeli.
    const trialEndsAt = startTrialCalls[0][2];
    const daysFromNow = (trialEndsAt.getTime() - before) / (1000 * 60 * 60 * 24);
    expect(daysFromNow).toBeGreaterThan(29);
    expect(daysFromNow).toBeLessThan(31);
  });

  it('platform_settings satırı okunamazsa (getSettings null döner) ESKİ sabit 14 güne düşülür', async () => {
    const startTrialCalls = [];
    const fakeQuery = vi.fn(async (sql, params) => {
      if (/SELECT id FROM users WHERE email/i.test(sql)) return { rows: [] };
      if (/INSERT INTO institutions/i.test(sql)) return { rows: [{ id: 'inst-fallback', name: params[0] }] };
      if (/INSERT INTO users/i.test(sql)) return { rows: [{ id: 'user-fallback', email: params[0] }] };
      if (/INSERT INTO platform_admin_audit_logs/i.test(sql)) return { rows: [] };
      if (/SELECT \* FROM platform_settings WHERE id=1/i.test(sql)) return { rows: [] }; // beklenmeyen: satır yok
      if (/FROM subscriptions s[\s\S]*JOIN plans p/i.test(sql)) return { rows: [] };
      if (/INSERT INTO subscriptions/i.test(sql)) {
        startTrialCalls.push(params);
        return { rows: [{ id: 'sub-fallback', institution_id: 'inst-fallback', plan_slug: params[1], trial_ends_at: params[2] }] };
      }
      if (/INSERT INTO audit_logs/i.test(sql)) return { rows: [] };
      return { rows: [] };
    });

    const { createInstitution } = loadWithFakeQuery(fakeQuery);

    const before = Date.now();
    await createInstitution({
      data: { name: 'Test Hastanesi 4', contactName: 'Can', email: 'can@test4.tr' },
      actorId: 'admin-1', req: {},
    });

    const trialEndsAt = startTrialCalls[0][2];
    const daysFromNow = (trialEndsAt.getTime() - before) / (1000 * 60 * 60 * 24);
    expect(daysFromNow).toBeGreaterThan(13);
    expect(daysFromNow).toBeLessThan(15);
  });
});
