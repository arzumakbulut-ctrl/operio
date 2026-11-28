import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

/**
 * Exercises the REAL `institutionGroup.service.js` `removeInstitution` (task-4
 * review finding: the route's `groupId` path-param was previously dropped on the
 * floor — the service did a bare `UPDATE institutions SET group_id=NULL WHERE
 * id=$1`, so calling DELETE with a stale/wrong `groupId` silently detached the
 * institution from whatever group it was ACTUALLY in, with no error, and the audit
 * log's `resourceId` was `null` — permanently losing which group it came from).
 *
 * `require.cache` injection for `utils/db.js`, same technique/reason as
 * `tests/unit/institutionService.updatePlanSlug.test.js` (this same task's
 * sibling) — needed because `institutionGroup.service.js` does a plain
 * `require('../utils/db')` at module-load time, which `vi.mock` doesn't reach.
 */
const nodeRequire = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const dbPath                      = path.resolve(here, '../../src/utils/db.js');
const institutionGroupServicePath = path.resolve(here, '../../src/services/institutionGroup.service.js');
const platformAdminAuditPath      = path.resolve(here, '../../src/utils/platformAdminAudit.js');
const DEPENDENT_PATHS = [institutionGroupServicePath, platformAdminAuditPath];

describe('institutionGroup.service — removeInstitution: groupId kurumun GERÇEK group_id\'ine karşı doğrulanır', () => {
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

  it('kurum URL\'deki groupId\'de DEĞİLSE (farklı grupta ya da groupId yok) → 409 fırlatılır, UPDATE 0 satır döner, hiçbir audit yazılmaz', async () => {
    const callLog = [];
    const fakeQuery = vi.fn(async (sql, params) => {
      if (/UPDATE institutions SET group_id=NULL WHERE id=\$1 AND group_id=\$2/i.test(sql)) {
        callLog.push({ q: 'scoped-update', params });
        return { rows: [] }; // eşleşme yok — kurum bu groupId'de DEĞİL (gerçek DB'de hiçbir satır değişmezdi)
      }
      if (/INSERT INTO platform_admin_audit_logs/i.test(sql)) {
        callLog.push({ q: 'audit', params });
        return { rows: [] };
      }
      callLog.push({ q: 'other', sql });
      return { rows: [] };
    });

    const { removeInstitution } = loadWithFakeQuery(fakeQuery);

    await expect(removeInstitution({
      groupId: 'grp-wrong', institutionId: 'inst-1', actorId: 'admin-1', req: {},
    })).rejects.toMatchObject({ statusCode: 409 });

    const updateCall = callLog.find((c) => c.q === 'scoped-update');
    expect(updateCall).toBeTruthy();
    expect(updateCall.params).toEqual(['inst-1', 'grp-wrong']); // WHERE id=$1 AND group_id=$2
    expect(callLog.some((c) => c.q === 'audit')).toBe(false); // başarısız doğrulama audit'lenmez
  });

  it('kurum URL\'deki groupId\'de GERÇEKTEN varsa → group_id NULL yapılır, audit resourceId=groupId ile yazılır (removeTeamMember precedent)', async () => {
    const callLog = [];
    const fakeQuery = vi.fn(async (sql, params) => {
      if (/UPDATE institutions SET group_id=NULL WHERE id=\$1 AND group_id=\$2/i.test(sql)) {
        callLog.push({ q: 'scoped-update', params });
        return { rows: [{ id: params[0] }] }; // eşleşti — 1 satır güncellendi
      }
      if (/INSERT INTO platform_admin_audit_logs/i.test(sql)) {
        callLog.push({ q: 'audit', params });
        return { rows: [] };
      }
      callLog.push({ q: 'other', sql });
      return { rows: [] };
    });

    const { removeInstitution } = loadWithFakeQuery(fakeQuery);

    await removeInstitution({ groupId: 'grp-1', institutionId: 'inst-1', actorId: 'admin-1', req: {} });

    const auditCall = callLog.find((c) => c.q === 'audit');
    expect(auditCall).toBeTruthy();
    // platformAdminAudit.js INSERT param sırası: admin_id, action, resource, resource_id, old_data, new_data, ip, ua
    expect(auditCall.params[3]).toBe('grp-1'); // resource_id === groupId, null DEĞİL
  });
});
