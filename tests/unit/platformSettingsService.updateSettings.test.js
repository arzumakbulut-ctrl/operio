import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

/**
 * Exercises the REAL `platformSettings.service.js` `updateSettings` (Final review
 * Finding 1): `platform_admin_audit_logs.resource_id` is `UUID` (migrations/
 * 002_platform_admin.sql) with no NOT NULL constraint — the previous code passed
 * the literal `resourceId: 1`, which Postgres rejects with a 22P02 (invalid input
 * syntax for type uuid). `auditPlatformAdmin` catches that and only `console.error`s
 * (the same catch-and-log convention as the hospital `audit()`), so every settings
 * change was silently never audited. Fix: pass `resourceId: null` — `resource:
 * 'platform_settings'` already uniquely identifies the single row (id=1), no
 * resourceId is needed, and NULL is a valid value for this column.
 *
 * `require.cache` injection for `utils/db.js`, same technique/reason as
 * `institutionGroupService.removeInstitution.test.js` (this plan's established
 * pattern) — `platformSettings.service.js` does a plain `require('../utils/db')`
 * at module-load time, which `vi.mock` doesn't reach.
 */
const nodeRequire = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const dbPath                     = path.resolve(here, '../../src/utils/db.js');
const platformSettingsServicePath = path.resolve(here, '../../src/services/platformSettings.service.js');
const platformAdminAuditPath     = path.resolve(here, '../../src/utils/platformAdminAudit.js');
const DEPENDENT_PATHS = [platformSettingsServicePath, platformAdminAuditPath];

describe('platformSettings.service — updateSettings: audit resourceId UUID kolonuna karşı geçerli', () => {
  afterEach(() => {
    delete nodeRequire.cache[dbPath];
    DEPENDENT_PATHS.forEach((p) => delete nodeRequire.cache[p]);
  });

  function loadWithFakeQuery(fakeQuery) {
    nodeRequire.cache[dbPath] = {
      id: dbPath, filename: dbPath, loaded: true,
      exports: { query: fakeQuery, transaction: vi.fn() },
    };
    DEPENDENT_PATHS.forEach((p) => delete nodeRequire.cache[p]);
    return nodeRequire(platformSettingsServicePath);
  }

  it('audit çağrısı resourceId olarak null geçer (1 DEĞİL) — gerçek INSERT bu değerle 22P02 fırlatmaz', async () => {
    const callLog = [];
    const fakeQuery = vi.fn(async (sql, params) => {
      if (/SELECT \* FROM platform_settings WHERE id=1/i.test(sql)) {
        callLog.push({ q: 'get-settings' });
        return { rows: [{ id: 1, platform_name: 'Operio', trial_days: 14 }] };
      }
      if (/UPDATE platform_settings SET/i.test(sql)) {
        callLog.push({ q: 'update-settings', params });
        return { rows: [{ id: 1, platform_name: 'Yeni Ad', trial_days: 14 }] };
      }
      if (/INSERT INTO platform_admin_audit_logs/i.test(sql)) {
        callLog.push({ q: 'audit', params });
        return { rows: [] };
      }
      callLog.push({ q: 'other', sql });
      return { rows: [] };
    });

    const { updateSettings } = loadWithFakeQuery(fakeQuery);

    await updateSettings({ data: { platformName: 'Yeni Ad' }, actorId: 'admin-1', req: {} });

    const auditCall = callLog.find((c) => c.q === 'audit');
    expect(auditCall).toBeTruthy();
    // platformAdminAudit.js INSERT param sırası: admin_id, action, resource, resource_id, old_data, new_data, ip, ua
    const resourceId = auditCall.params[3];
    expect(resourceId).toBeNull();
    expect(resourceId).not.toBe(1); // eski (hatalı) literal değer artık asla gönderilmiyor
  });

  it('auditPlatformAdmin gerçek INSERT çalışsa (fake değil) resourceId=null ile 22P02 fırlatmaz — hata simüle edilerek doğrulanır: resourceId=1 verilseydi burada 22P02 fırlatılırdı', async () => {
    // Bu test, platformSettings.service.js'in GERÇEKTEN null gönderdiğini ayrıca
    // şu şekilde doğrular: fakeQuery, bir UUID kolonuna literal 1 geçilirse gerçek
    // Postgres'in davranışını taklit edip 22P02 fırlatır — eğer servis hâlâ
    // resourceId:1 gönderseydi bu test FAILED olurdu.
    const fakeQuery = vi.fn(async (sql, params) => {
      if (/SELECT \* FROM platform_settings WHERE id=1/i.test(sql)) {
        return { rows: [{ id: 1, trial_days: 14 }] };
      }
      if (/UPDATE platform_settings SET/i.test(sql)) {
        return { rows: [{ id: 1, trial_days: 14 }] };
      }
      if (/INSERT INTO platform_admin_audit_logs/i.test(sql)) {
        const resourceId = params[3];
        if (resourceId !== null && typeof resourceId !== 'string') {
          // Gerçek Postgres'in UUID kolonuna sayısal literal karşısındaki davranışı
          throw Object.assign(new Error('invalid input syntax for type uuid: "1"'), { code: '22P02' });
        }
        return { rows: [] };
      }
      return { rows: [] };
    });

    const { updateSettings } = loadWithFakeQuery(fakeQuery);

    // auditPlatformAdmin kendi hatasını yutar (catch+console.error) — bu yüzden
    // updateSettings'in kendisi FIRLATMAZ, ama audit hiç yazılmamış olur. Burada
    // asıl doğrulama: servisin updateSettings'i normal şekilde tamamlaması
    // (22P02'ye asla ÇARPMAMASI, yakalanıp yutulması DEĞİL) — yani audit GERÇEKTEN
    // başarıyla yazıldı.
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await updateSettings({ data: { platformName: 'Yeni Ad' }, actorId: 'admin-1', req: {} });
    expect(consoleErrorSpy).not.toHaveBeenCalled(); // audit INSERT hiç hata fırlatmadı
    consoleErrorSpy.mockRestore();
  });
});
