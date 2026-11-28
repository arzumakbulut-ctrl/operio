import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

/**
 * Exercises the REAL `institutionGroup.service.js` `assignInstitution` (Final
 * review Finding 4): the previous code was a bare `UPDATE institutions SET
 * group_id=$1 WHERE id=$2` with no row-count check — a nonexistent
 * `institutionId` still returned 200 and wrote a false `ASSIGN` audit entry for
 * something that never happened, and a nonexistent `groupId` hit the FK
 * constraint and surfaced as an unhandled 500. Fix: `RETURNING id` + a 0-rows
 * check → 404 ("Kurum bulunamadı"), and a caught `23503` (FK violation) → 404
 * ("Kurum grubu bulunamadı").
 *
 * `require.cache` injection for `utils/db.js`, same technique/reason as the
 * sibling `institutionGroupService.removeInstitution.test.js`.
 */
const nodeRequire = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const dbPath                      = path.resolve(here, '../../src/utils/db.js');
const institutionGroupServicePath = path.resolve(here, '../../src/services/institutionGroup.service.js');
const platformAdminAuditPath      = path.resolve(here, '../../src/utils/platformAdminAudit.js');
const DEPENDENT_PATHS = [institutionGroupServicePath, platformAdminAuditPath];

describe('institutionGroup.service — assignInstitution: satır-sayısı ve FK-ihlali kontrolleri', () => {
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
    return nodeRequire(institutionGroupServicePath);
  }

  it('institutionId yoksa (UPDATE 0 satır döner) → 404 fırlatılır, audit YAZILMAZ', async () => {
    const callLog = [];
    const fakeQuery = vi.fn(async (sql, params) => {
      if (/UPDATE institutions SET group_id=\$1 WHERE id=\$2 RETURNING id/i.test(sql)) {
        callLog.push({ q: 'assign-update', params });
        return { rows: [] }; // eşleşme yok — institutionId gerçek DB'de hiç yok
      }
      if (/INSERT INTO platform_admin_audit_logs/i.test(sql)) {
        callLog.push({ q: 'audit', params });
        return { rows: [] };
      }
      callLog.push({ q: 'other', sql });
      return { rows: [] };
    });

    const { assignInstitution } = loadWithFakeQuery(fakeQuery);

    await expect(assignInstitution({
      groupId: 'grp-1', institutionId: 'inst-missing', actorId: 'admin-1', req: {},
    })).rejects.toMatchObject({ statusCode: 404 });

    const updateCall = callLog.find((c) => c.q === 'assign-update');
    expect(updateCall).toBeTruthy();
    expect(updateCall.params).toEqual(['grp-1', 'inst-missing']);
    expect(callLog.some((c) => c.q === 'audit')).toBe(false); // gerçekleşmemiş bir atama audit'lenmez
  });

  it('groupId yoksa (FK ihlali, 23503) → temiz bir 404 fırlatılır (ham 500 DEĞİL), audit YAZILMAZ', async () => {
    const callLog = [];
    const fakeQuery = vi.fn(async (sql, params) => {
      if (/UPDATE institutions SET group_id=\$1 WHERE id=\$2 RETURNING id/i.test(sql)) {
        callLog.push({ q: 'assign-update', params });
        throw Object.assign(
          new Error('insert or update on table "institutions" violates foreign key constraint'),
          { code: '23503' }
        );
      }
      if (/INSERT INTO platform_admin_audit_logs/i.test(sql)) {
        callLog.push({ q: 'audit', params });
        return { rows: [] };
      }
      callLog.push({ q: 'other', sql });
      return { rows: [] };
    });

    const { assignInstitution } = loadWithFakeQuery(fakeQuery);

    await expect(assignInstitution({
      groupId: 'grp-missing', institutionId: 'inst-1', actorId: 'admin-1', req: {},
    })).rejects.toMatchObject({ statusCode: 404 });

    expect(callLog.some((c) => c.q === 'audit')).toBe(false);
  });

  it('institutionId ve groupId GERÇEKTEN varsa → UPDATE 1 satır döner, audit resourceId=groupId ile yazılır', async () => {
    const callLog = [];
    const fakeQuery = vi.fn(async (sql, params) => {
      if (/UPDATE institutions SET group_id=\$1 WHERE id=\$2 RETURNING id/i.test(sql)) {
        callLog.push({ q: 'assign-update', params });
        return { rows: [{ id: params[1] }] };
      }
      if (/INSERT INTO platform_admin_audit_logs/i.test(sql)) {
        callLog.push({ q: 'audit', params });
        return { rows: [] };
      }
      callLog.push({ q: 'other', sql });
      return { rows: [] };
    });

    const { assignInstitution } = loadWithFakeQuery(fakeQuery);

    await assignInstitution({ groupId: 'grp-1', institutionId: 'inst-1', actorId: 'admin-1', req: {} });

    const auditCall = callLog.find((c) => c.q === 'audit');
    expect(auditCall).toBeTruthy();
    // platformAdminAudit.js INSERT param sırası: admin_id, action, resource, resource_id, old_data, new_data, ip, ua
    expect(auditCall.params[3]).toBe('grp-1');
  });

  it('başka bir (23503 OLMAYAN) DB hatası ise olduğu gibi fırlatılır (404\'e ÇEVRİLMEZ)', async () => {
    const fakeQuery = vi.fn(async (sql) => {
      if (/UPDATE institutions SET group_id=\$1 WHERE id=\$2 RETURNING id/i.test(sql)) {
        throw Object.assign(new Error('connection terminated'), { code: '57P01' });
      }
      return { rows: [] };
    });

    const { assignInstitution } = loadWithFakeQuery(fakeQuery);

    await expect(assignInstitution({
      groupId: 'grp-1', institutionId: 'inst-1', actorId: 'admin-1', req: {},
    })).rejects.toMatchObject({ code: '57P01' });
  });
});
