import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

/**
 * Exercises the REAL `institution.service.js` `updateInstitution`'s `planSlug`
 * handling (task-3 review Finding 2: `planSlug` was never validated against the
 * real `plans` table before being written to `subscriptions.plan_slug`, which
 * would make the subscription invisible everywhere `getSubscription`'s INNER JOIN
 * runs — including `checkPlanLimit` — with the PATCH itself still returning 200).
 *
 * `require.cache` injection for `utils/db.js`, same technique/reason as
 * `tests/unit/authService.institutionActive.test.js` and the sibling
 * `institutionService.createInstitution.trialFailure.test.js` in this same task.
 */
const nodeRequire = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const dbPath                  = path.resolve(here, '../../src/utils/db.js');
const institutionServicePath  = path.resolve(here, '../../src/services/institution.service.js');
const passwordPath            = path.resolve(here, '../../src/utils/password.js');
const platformAdminAuditPath  = path.resolve(here, '../../src/utils/platformAdminAudit.js');
const subscriptionServicePath = path.resolve(here, '../../src/services/subscription.service.js');
const auditPath               = path.resolve(here, '../../src/utils/audit.js');
const DEPENDENT_PATHS = [institutionServicePath, passwordPath, platformAdminAuditPath, subscriptionServicePath, auditPath];

describe('institution.service — updateInstitution: planSlug plans tablosuna karşı doğrulanır', () => {
  let callLog;

  afterEach(() => {
    delete nodeRequire.cache[dbPath];
    DEPENDENT_PATHS.forEach((p) => delete nodeRequire.cache[p]);
  });

  function loadWithFakeDb({ planExists, hasExistingSubscription }) {
    callLog = [];
    const fakeQuery = vi.fn(async (sql, params) => {
      if (/SELECT \* FROM plans WHERE slug/i.test(sql)) {
        callLog.push('get-plan');
        return { rows: planExists ? [{ slug: params[0], name: 'Pro', is_active: true }] : [] };
      }
      if (/SELECT \* FROM institutions WHERE id/i.test(sql)) {
        callLog.push('get-institution');
        return { rows: [{ id: 'inst-1', name: 'Test Hastanesi', is_active: true }] };
      }
      if (/UPDATE institutions SET/i.test(sql)) {
        callLog.push('update-institution');
        return { rows: [{ id: 'inst-1' }] };
      }
      if (/FROM subscriptions s[\s\S]*JOIN plans p/i.test(sql)) {
        callLog.push('get-subscription');
        return { rows: hasExistingSubscription ? [{ id: 'sub-1', institution_id: 'inst-1', plan_slug: 'old-plan' }] : [] };
      }
      if (/UPDATE subscriptions SET plan_slug/i.test(sql)) {
        callLog.push('update-subscription-plan_slug');
        return { rows: [] };
      }
      if (/INSERT INTO subscriptions/i.test(sql)) {
        callLog.push('insert-subscription');
        return { rows: [{ id: 'sub-new', institution_id: 'inst-1', plan_slug: params[1] }] };
      }
      if (/INSERT INTO platform_admin_audit_logs/i.test(sql)) {
        callLog.push('audit-platform-admin');
        return { rows: [] };
      }
      if (/INSERT INTO audit_logs/i.test(sql)) {
        callLog.push('audit-hospital');
        return { rows: [] };
      }
      callLog.push(`other:${sql.slice(0, 40)}`);
      return { rows: [] };
    });

    nodeRequire.cache[dbPath] = {
      id: dbPath, filename: dbPath, loaded: true,
      exports: { query: fakeQuery, transaction: vi.fn() },
    };
    DEPENDENT_PATHS.forEach((p) => delete nodeRequire.cache[p]);
    return nodeRequire(institutionServicePath);
  }

  it('geçersiz planSlug → 400 fırlatılır, subscriptions üzerinde HİÇBİR UPDATE/INSERT çalışmaz', async () => {
    const { updateInstitution } = loadWithFakeDb({ planExists: false, hasExistingSubscription: true });

    await expect(updateInstitution({
      id: 'inst-1', data: { planSlug: 'olmayan-plan' }, actorGroupSlug: 'finans', actorId: 'admin-1', req: {},
    })).rejects.toMatchObject({ statusCode: 400 });

    expect(callLog).toContain('get-plan');
    expect(callLog).not.toContain('update-subscription-plan_slug');
    expect(callLog).not.toContain('insert-subscription');
  });

  it('geçerli planSlug + mevcut abonelik → subscriptions.plan_slug güncellenir (INSERT değil)', async () => {
    const { updateInstitution } = loadWithFakeDb({ planExists: true, hasExistingSubscription: true });

    const result = await updateInstitution({
      id: 'inst-1', data: { planSlug: 'business' }, actorGroupSlug: 'finans', actorId: 'admin-1', req: {},
    });

    expect(callLog).toContain('get-plan');
    expect(callLog).toContain('update-subscription-plan_slug');
    expect(callLog).not.toContain('insert-subscription');
    expect(result).toBeTruthy();
  });

  it('geçerli planSlug + HENÜZ abonelik yok (örn. startTrial bootstrap\'ta başarısız olmuş) → startTrial çağrılır (subscriptions INSERT), UPDATE değil', async () => {
    const { updateInstitution } = loadWithFakeDb({ planExists: true, hasExistingSubscription: false });

    await updateInstitution({
      id: 'inst-1', data: { planSlug: 'business' }, actorGroupSlug: 'super', actorId: 'admin-1', req: {},
    });

    expect(callLog).toContain('get-plan');
    expect(callLog).toContain('insert-subscription');
    expect(callLog).not.toContain('update-subscription-plan_slug');
  });

  it('finans dışı alan + geçersiz planSlug birlikte gönderilse: finans kısıtlaması HER ZAMAN önce kontrol edilir (400, plan doğrulaması hiç çalışmaz)', async () => {
    const { updateInstitution } = loadWithFakeDb({ planExists: false, hasExistingSubscription: true });

    await expect(updateInstitution({
      id: 'inst-1', data: { name: 'Yeni Ad', planSlug: 'olmayan-plan' }, actorGroupSlug: 'finans', actorId: 'admin-1', req: {},
    })).rejects.toMatchObject({ statusCode: 400 });

    expect(callLog).not.toContain('get-plan');
    expect(callLog).not.toContain('update-institution');
  });
});
