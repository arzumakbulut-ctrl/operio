import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

/**
 * This test exercises the REAL `kiosk.service.recordTimeoutRead` implementation and
 * verifies the exact fields it passes to `audit()` — specifically to catch a typo in
 * `action`/`resource` (the compliance audit trail depends on these literal strings),
 * which a test that only asserts on a fully-mocked `kiosk` service (as
 * `tests/integration/kioskVoiceCommand.timeout.test.js` does) cannot catch.
 *
 * Why this doesn't use `vi.mock('../../src/utils/audit.js', ...)`: verified empirically
 * (several ways — direct one-hop import of kiosk.service.js, reversed import order,
 * extensionless specifier) that in this project's Vitest setup, `vi.mock` only
 * intercepts a module that the TEST FILE ITSELF imports directly. `kiosk.service.js`'s
 * own internal `require('../utils/audit')` call is one hop away and keeps resolving to
 * the REAL `audit.js` regardless — confirmed by a real `pg` ECONNREFUSED firing (caught
 * and swallowed by audit.js's own try/catch) instead of the mock being invoked. This
 * matches why no other test in this suite relies on `vi.mock` for `utils/db`/`utils/audit`
 * through any require chain (`tests/setup.js`'s `global.mockDBQuery` helper has zero call
 * sites repo-wide) — every existing test substitutes behavior via the `_registry` DI
 * pattern instead, which doesn't touch module resolution at all.
 *
 * Instead, this uses Node's own (native, non-Vitest) `require.cache`, obtained via
 * `createRequire`, to substitute `audit.js`'s exports before `kiosk.service.js` is
 * required — bypassing Vitest's ESM-oriented mock registry (which does not reach this
 * nested require) and using the exact mechanism `require()` itself already respects.
 */
const nodeRequire = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const auditPath = path.resolve(here, '../../src/utils/audit.js');
const kioskServicePath = path.resolve(here, '../../src/services/kiosk.service.js');

describe('kiosk.service — recordTimeoutRead (real implementation, audit() call verified via require.cache injection)', () => {
  let fakeAudit;
  let recordTimeoutRead;

  beforeEach(() => {
    fakeAudit = vi.fn().mockResolvedValue(undefined);
    nodeRequire.cache[auditPath] = {
      id: auditPath,
      filename: auditPath,
      loaded: true,
      exports: { audit: fakeAudit },
    };
    delete nodeRequire.cache[kioskServicePath]; // force a fresh require so it picks up the injected audit
    ({ recordTimeoutRead } = nodeRequire(kioskServicePath));
  });

  afterEach(() => {
    delete nodeRequire.cache[auditPath];
    delete nodeRequire.cache[kioskServicePath];
  });

  it('calls the real audit() with action="voice:timeout_read", resource="surgeries", userId: null, and the given resourceId/req', async () => {
    const req = { ip: '10.0.0.1', headers: { 'user-agent': 'kiosk-device' } };

    await recordTimeoutRead({ surgeryId: 'surgery-42', req });

    expect(fakeAudit).toHaveBeenCalledTimes(1);
    expect(fakeAudit).toHaveBeenCalledWith({
      userId: null,
      action: 'voice:timeout_read',
      resource: 'surgeries',
      resourceId: 'surgery-42',
      req,
    });
  });

  it('does not swallow an audit() rejection itself (recordTimeoutRead has no try/catch of its own — audit.js owns that)', async () => {
    fakeAudit.mockRejectedValueOnce(new Error('db down'));

    await expect(recordTimeoutRead({ surgeryId: 'surgery-1', req: {} })).rejects.toThrow('db down');
  });
});
