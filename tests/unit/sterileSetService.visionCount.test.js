import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

/**
 * Exercises the REAL `sterileSet.service.js` implementation (`recordVisionSuggestion` and
 * the `counts`-aware `addTrackingLog`) with `utils/db.js` and `utils/audit.js` substituted
 * via Node's native `require.cache` — same technique, and same reason `vi.mock` can't be
 * used, as `kioskService.recordTimeoutRead.test.js` / `kioskService.getActiveSurgeryForRoom.test.js`:
 * `sterileSet.service.js`'s own internal `require('../utils/db')` / `require('../utils/audit')`
 * calls are one hop away from this test file and keep resolving to the REAL modules if only
 * `vi.mock` is used, so we inject fakes directly into `require.cache` before requiring the
 * service fresh.
 *
 * `../socket` is intentionally left un-mocked: `emitToInstitution` is a no-op whenever the
 * socket.io server hasn't been initialized (`if (!_io) return;`), which is always true here
 * since `initSocketServer` is never called in this test file.
 */
const nodeRequire = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(here, '../../src/utils/db.js');
const auditPath = path.resolve(here, '../../src/utils/audit.js');
const servicePath = path.resolve(here, '../../src/services/sterileSet.service.js');

describe('sterileSet.service — recordVisionSuggestion & addTrackingLog(counts) (require.cache ile db/audit enjeksiyonu)', () => {
  let queryMock;
  let transactionMock;
  let auditMock;
  let service;

  /** Her test kendi queryImpl'ini verir; transactionMock bunu client.query olarak kullanır. */
  function setupFakeDb(queryImpl) {
    queryMock = vi.fn(queryImpl);
    transactionMock = vi.fn(async (fn) => {
      const client = { query: queryMock };
      return await fn(client);
    });
    nodeRequire.cache[dbPath] = {
      id: dbPath,
      filename: dbPath,
      loaded: true,
      exports: { query: queryMock, transaction: transactionMock },
    };
  }

  beforeEach(() => {
    auditMock = vi.fn().mockResolvedValue(undefined);
    nodeRequire.cache[auditPath] = {
      id: auditPath,
      filename: auditPath,
      loaded: true,
      exports: { audit: auditMock },
    };
  });

  afterEach(() => {
    delete nodeRequire.cache[dbPath];
    delete nodeRequire.cache[auditPath];
    delete nodeRequire.cache[servicePath];
  });

  function requireService() {
    delete nodeRequire.cache[servicePath]; // force a fresh require so it picks up the injected db/audit
    service = nodeRequire(servicePath);
    return service;
  }

  it('recordVisionSuggestion: her suggestion için last_suggested_count güncellenir, detectedCount null olanlar atlanır, bir audit() çağrısı yapılır', async () => {
    setupFakeDb(async () => ({ rows: [], rowCount: 1 }));
    const { recordVisionSuggestion } = requireService();

    const req = { ip: '10.0.0.5' };
    const suggestions = [
      { instrumentId: 'i1', detectedCount: 3 },
      { instrumentId: 'i2', detectedCount: null },
      { instrumentId: 'i3', detectedCount: 5 },
    ];

    const result = await recordVisionSuggestion({ setId: 'set-1', suggestions, userId: 'u1', req });

    // Sadece detectedCount != null olan 2 öğe için UPDATE çalışmalı, i2 için ÇAĞRILMAMALI
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock).toHaveBeenNthCalledWith(
      1,
      'UPDATE set_instruments SET last_suggested_count=$1 WHERE id=$2 AND set_id=$3',
      [3, 'i1', 'set-1']
    );
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      'UPDATE set_instruments SET last_suggested_count=$1 WHERE id=$2 AND set_id=$3',
      [5, 'i3', 'set-1']
    );
    expect(queryMock.mock.calls.some(([, params]) => params.includes('i2'))).toBe(false);
    // Isolation: UPDATE hem id hem set_id ile filtreler (caller'a güvenmek yerine fonksiyonun kendisi zorlar)
    for (const [sql] of queryMock.mock.calls) {
      expect(sql).toContain('WHERE id=$2');
      expect(sql).toContain('AND set_id=$3');
    }

    // audit() tam olarak bir kez, doğru action/resource/newData ile
    expect(auditMock).toHaveBeenCalledTimes(1);
    expect(auditMock).toHaveBeenCalledWith({
      userId: 'u1',
      action: 'AI_COUNT_SUGGESTION',
      resource: 'sterile_set',
      resourceId: 'set-1',
      newData: { suggestions },
      req,
    });

    expect(result).toEqual({ updated: 2 });
  });

  it("addTrackingLog: counts verilirse ilgili set_instruments.current_count güncellenir", async () => {
    setupFakeDb(async (sql, params) => {
      if (/SELECT id, name, expected_count FROM set_instruments/.test(sql)) {
        return { rows: [{ id: 'i1', name: 'Trokar 10mm', expected_count: 1 }] };
      }
      if (/UPDATE set_instruments SET current_count/.test(sql)) {
        return { rowCount: 1, rows: [] };
      }
      if (/INSERT INTO set_tracking_logs/.test(sql)) {
        return { rows: [{ id: 'log-1', set_id: params[0], stage: params[1], operator: params[2], notes: params[3] }] };
      }
      if (/UPDATE sterile_sets SET status/.test(sql)) {
        return { rows: [{ id: params[1], status: params[0] }] };
      }
      return { rows: [] };
    });
    const { addTrackingLog } = requireService();

    const result = await addTrackingLog({
      setId: 'set-1',
      stage: 'depo',
      operator: 'op1',
      notes: null,
      counts: [{ instrumentId: 'i1', count: 1 }],
      userId: 'u1',
      req: {},
      institutionId: 'inst-1',
    });

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(queryMock).toHaveBeenCalledWith(
      'UPDATE set_instruments SET current_count=$1 WHERE id=$2 AND set_id=$3',
      [1, 'i1', 'set-1']
    );
    // count (1) === expected_count (1) → eksik yok, notes değişmeden log'a yazılır
    expect(queryMock).toHaveBeenCalledWith(
      'INSERT INTO set_tracking_logs (set_id, stage, operator, notes) VALUES ($1,$2,$3,$4) RETURNING *',
      ['set-1', 'depo', 'op1', null]
    );
    expect(result).toEqual({ id: 'log-1', set_id: 'set-1', stage: 'depo', operator: 'op1', notes: null });
  });

  it('addTrackingLog: count beklenenden azsa notes alanına eksik-alet uyarısı eklenir, AMA stage geçişi/status update ENGELLENMEZ', async () => {
    setupFakeDb(async (sql, params) => {
      if (/SELECT id, name, expected_count FROM set_instruments/.test(sql)) {
        return { rows: [{ id: 'i1', name: 'Trokar 5mm', expected_count: 2 }] };
      }
      if (/UPDATE set_instruments SET current_count/.test(sql)) {
        return { rowCount: 1, rows: [] };
      }
      if (/INSERT INTO set_tracking_logs/.test(sql)) {
        return { rows: [{ id: 'log-2', set_id: params[0], stage: params[1], operator: params[2], notes: params[3] }] };
      }
      if (/UPDATE sterile_sets SET status/.test(sql)) {
        return { rows: [{ id: params[1], status: params[0] }] };
      }
      return { rows: [] };
    });
    const { addTrackingLog } = requireService();

    await addTrackingLog({
      setId: 'set-1',
      stage: 'depo', // statusMap: depo -> STERILE
      operator: 'op1',
      notes: null,
      counts: [{ instrumentId: 'i1', count: 1 }], // 1 < expected_count(2) -> eksik
      userId: 'u1',
      req: {},
      institutionId: 'inst-1',
    });

    // notes '⚠' uyarısını içermeli (eksik alet uyarısı eklenmiş)
    const insertCall = queryMock.mock.calls.find(([sql]) => /INSERT INTO set_tracking_logs/.test(sql));
    expect(insertCall).toBeDefined();
    expect(insertCall[1]).toEqual(['set-1', 'depo', 'op1', '⚠ Eksik alet: Trokar 5mm']);
    expect(insertCall[1][3]).toContain('⚠');
    // not alanı instrument UUID'sini değil, aletin ADINI içermeli
    expect(insertCall[1][3]).not.toContain('i1');

    // statusMap'e göre sterile_sets UPDATE'i HÂLÂ çalışmalı (depo -> STERILE), engellenmemeli
    const statusCalls = queryMock.mock.calls.filter(([sql]) => /UPDATE sterile_sets SET status/.test(sql));
    expect(statusCalls).toHaveLength(1);
    expect(statusCalls[0][1]).toEqual(['STERILE', 'set-1']);
  });

  it("addTrackingLog: counts içindeki instrumentId başka bir sete aitse (set_id eşleşmiyor) o satır güncellenmez", async () => {
    // i-foreign gerçekte 'set-B'ye ait; set-A için SELECT sonucunda hiç görünmez.
    setupFakeDb(async (sql, params) => {
      if (/SELECT id, name, expected_count FROM set_instruments/.test(sql)) {
        return { rows: [{ id: 'i-other', name: 'Grasper', expected_count: 5 }] }; // i-foreign burada YOK
      }
      if (/UPDATE set_instruments SET current_count/.test(sql)) {
        const [, instrumentId, setIdParam] = params;
        const actualOwnerSetId = { 'i-foreign': 'set-B' }[instrumentId];
        // Gerçek DB'de WHERE id=$2 AND set_id=$3 eşleşmediği için 0 satır döner
        if (actualOwnerSetId && actualOwnerSetId !== setIdParam) {
          return { rowCount: 0, rows: [] };
        }
        return { rowCount: 1, rows: [] };
      }
      if (/INSERT INTO set_tracking_logs/.test(sql)) {
        return { rows: [{ id: 'log-3', set_id: params[0], stage: params[1], operator: params[2], notes: params[3] }] };
      }
      return { rows: [] };
    });
    const { addTrackingLog } = requireService();

    await addTrackingLog({
      setId: 'set-A',
      stage: 'belirsiz', // statusMap'te yok -> sterile_sets UPDATE devreye girmez, test isolation'a odaklı kalır
      operator: 'op1',
      notes: null,
      counts: [{ instrumentId: 'i-foreign', count: 1 }],
      userId: 'u1',
      req: {},
      institutionId: 'inst-1',
    });

    // UPDATE sorgusu HER ZAMAN id VE set_id'yi BİRLİKTE filtreler (caller'ın KENDİ setId'si ile, i-foreign'ın gerçek sahibi değil)
    const updateCall = queryMock.mock.calls.find(([sql]) => /UPDATE set_instruments SET current_count/.test(sql));
    expect(updateCall).toBeDefined();
    expect(updateCall[0]).toBe('UPDATE set_instruments SET current_count=$1 WHERE id=$2 AND set_id=$3');
    expect(updateCall[1]).toEqual([1, 'i-foreign', 'set-A']);

    // Simüle edilen DB: set_id eşleşmediği için 0 satır etkilendi -> başka sete ait satır GÜNCELLENMEDİ
    const updateCallIndex = queryMock.mock.calls.indexOf(updateCall);
    await expect(queryMock.mock.results[updateCallIndex].value).resolves.toEqual({ rowCount: 0, rows: [] });
  });
});
