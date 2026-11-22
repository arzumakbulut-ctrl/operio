import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

/**
 * Exercises the REAL `kiosk.service.getActiveSurgeryForRoom` with `utils/db.js` substituted
 * via Node's native `require.cache` (same technique, and same reason `vi.mock` can't be used,
 * as `kioskService.recordTimeoutRead.test.js` — see the long comment there).
 *
 * There is no real/in-memory Postgres in this test suite, so the fake `db.query` below
 * emulates what Postgres does with the query's ORDER BY: it returns the team rows in a
 * DIFFERENT shuffled order on every call (modelling an un-ordered JOIN's arbitrary order),
 * and only sorts them if the SQL actually contains the expected ORDER BY clause —
 * `(team_role = 'cerrah') DESC, user_id ASC`. Without that clause in the service's SQL,
 * the "deterministic across calls" assertion below fails.
 */
const nodeRequire = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(here, '../../src/utils/db.js');
const kioskServicePath = path.resolve(here, '../../src/services/kiosk.service.js');

const EXPECTED_ORDER_BY = /ORDER BY \(st\.team_role = 'cerrah'\) DESC, st\.user_id ASC/;

const TEAM_ROWS = [
  { surgery_id: 'surgery-1', user_id: 'u-30', full_name: 'Hemşire C', role_id: 7, team_role: 'sirkule' },
  { surgery_id: 'surgery-1', user_id: 'u-10', full_name: 'Scrub A',   role_id: 7, team_role: 'scrub' },
  { surgery_id: 'surgery-1', user_id: 'u-50', full_name: 'Dr. Cerrah', role_id: 6, team_role: 'cerrah' },
  { surgery_id: 'surgery-1', user_id: 'u-20', full_name: 'Anestezi B', role_id: 8, team_role: 'anestezi' },
];

function rotate(arr, n) {
  const k = n % arr.length;
  return [...arr.slice(k), ...arr.slice(0, k)];
}

describe('kiosk.service — getActiveSurgeryForRoom ekip sırası (require.cache ile db enjeksiyonu)', () => {
  let fakeQuery;
  let getActiveSurgeryForRoom;
  let callNo;

  beforeEach(() => {
    callNo = 0;
    fakeQuery = vi.fn(async (sql) => {
      const rows = rotate(TEAM_ROWS, callNo++); // her çağrıda farklı "keyfi" DB sırası
      if (EXPECTED_ORDER_BY.test(sql)) {
        rows.sort((a, b) => {
          const ac = a.team_role === 'cerrah' ? 1 : 0;
          const bc = b.team_role === 'cerrah' ? 1 : 0;
          if (ac !== bc) return bc - ac;
          return a.user_id < b.user_id ? -1 : a.user_id > b.user_id ? 1 : 0;
        });
      }
      return { rows };
    });
    nodeRequire.cache[dbPath] = {
      id: dbPath,
      filename: dbPath,
      loaded: true,
      exports: { query: fakeQuery, transaction: vi.fn() },
    };
    delete nodeRequire.cache[kioskServicePath];
    ({ getActiveSurgeryForRoom } = nodeRequire(kioskServicePath));
  });

  afterEach(() => {
    delete nodeRequire.cache[dbPath];
    delete nodeRequire.cache[kioskServicePath];
  });

  it('SQL, cerrah\'ı öne alan ve user_id ile kıran deterministik bir ORDER BY içerir', async () => {
    await getActiveSurgeryForRoom('room-1');

    expect(fakeQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = fakeQuery.mock.calls[0];
    expect(sql).toMatch(EXPECTED_ORDER_BY);
    expect(params).toEqual(['room-1']);
  });

  it('karışık rollü çok üyeli ekipte, birden çok çağrıda sıra AYNI kalır: önce cerrah, sonra user_id artan', async () => {
    const results = [];
    for (let i = 0; i < TEAM_ROWS.length; i++) {
      const surgery = await getActiveSurgeryForRoom('room-1');
      results.push(surgery.surgeryTeams.map(m => m.userId));
    }

    for (const order of results) {
      expect(order).toEqual(['u-50', 'u-10', 'u-20', 'u-30']);
    }

    const first = await getActiveSurgeryForRoom('room-1');
    expect(first.surgeryTeams[0]).toEqual({ userId: 'u-50', fullName: 'Dr. Cerrah', roleId: 6, teamRole: 'cerrah' });
    expect(first.id).toBe('surgery-1');
  });

  it('odada IN_PROGRESS ameliyat yoksa null döner', async () => {
    fakeQuery.mockResolvedValueOnce({ rows: [] });
    expect(await getActiveSurgeryForRoom('room-empty')).toBeNull();
  });
});
