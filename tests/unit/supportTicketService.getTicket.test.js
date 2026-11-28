import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

/**
 * Exercises the REAL `supportTicket.service.js` `getTicket` (task-5 Review Focus):
 * a comment's author reference (`platform_admin_id`) must survive that admin
 * account later being deactivated (`is_active=FALSE`) — the comments query must
 * `LEFT JOIN platform_admins` with NO `is_active` filter, so a historical
 * comment's author name still renders even after the admin is deactivated.
 *
 * `require.cache` injection for `utils/db.js`, same technique/reason as
 * `tests/unit/institutionGroupService.removeInstitution.test.js` /
 * `tests/unit/institutionService.updatePlanSlug.test.js` (Tasks 3/4's own
 * precedent for this codebase's actual testable architecture, see progress.md:
 * `supportTicket.service.js` does a plain `require('../utils/db')` at
 * module-load time, which `vi.mock` from this ESM test file doesn't reach).
 */
const nodeRequire = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const dbPath                 = path.resolve(here, '../../src/utils/db.js');
const supportTicketServicePath = path.resolve(here, '../../src/services/supportTicket.service.js');
const platformAdminAuditPath = path.resolve(here, '../../src/utils/platformAdminAudit.js');
const DEPENDENT_PATHS = [supportTicketServicePath, platformAdminAuditPath];

describe('supportTicket.service — getTicket: yorumcu adı is_active=FALSE olsa da görünür', () => {
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
    return nodeRequire(supportTicketServicePath);
  }

  it('yorumlar sorgusu platform_admins ile LEFT JOIN kullanır ve is_active filtresi İÇERMEZ', async () => {
    let commentsSql = null;
    const fakeQuery = vi.fn(async (sql, params) => {
      if (/FROM institution_support_tickets WHERE id/i.test(sql)) {
        return { rows: [{ id: 'tic1', institution_id: 'inst1', status: 'OPEN' }] };
      }
      if (/FROM institution_support_ticket_comments/i.test(sql)) {
        commentsSql = sql;
        // Gerçek DB'de bu admin is_active=FALSE olsa da LEFT JOIN eşleşmeyi kaybetmez —
        // bu fake satır, tam olarak bunu temsil ediyor: admin deaktif olsa da adı döner.
        return {
          rows: [{
            id: 'cmt1', ticket_id: 'tic1', platform_admin_id: 'admin-deactivated',
            message: 'Geçmiş yanıt', created_at: new Date().toISOString(),
            admin_name: 'Eski Destek Çalışanı', admin_email: 'eski@operio.com',
          }],
        };
      }
      return { rows: [] };
    });

    const { getTicket } = loadWithFakeQuery(fakeQuery);
    const ticket = await getTicket({ id: 'tic1' });

    expect(commentsSql).toBeTruthy();
    expect(commentsSql).toMatch(/LEFT JOIN platform_admins/i);
    expect(commentsSql).not.toMatch(/is_active/i);

    expect(ticket.comments).toHaveLength(1);
    expect(ticket.comments[0].admin_name).toBe('Eski Destek Çalışanı');
  });

  it('talep bulunamazsa null döner', async () => {
    const fakeQuery = vi.fn(async () => ({ rows: [] }));
    const { getTicket } = loadWithFakeQuery(fakeQuery);
    expect(await getTicket({ id: 'yok' })).toBeNull();
  });
});
