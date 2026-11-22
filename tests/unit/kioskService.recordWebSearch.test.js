import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

/**
 * recordWebSearch — recordTimeoutRead'in AYNI deseni (bkz.
 * tests/unit/kioskService.recordTimeoutRead.test.js'teki uzun yorum): bu projede
 * audit() HER ZAMAN servis katmanından yazılır (routes.js audit()'i doğrudan
 * çağırmaz — bkz. tests/integration/kioskVoiceCommand.timeout.test.js dosya başı
 * yorumu), bu yüzden WEB_SEARCH'ün audit kaydı da kiosk.service.js'e eklenen bu
 * küçük sarmalayıcı üzerinden yazılır (kiosk.routes.js WEB_SEARCH dalı,
 * getKioskService().recordWebSearch(...) çağırır — recordTimeoutRead ile birebir
 * aynı DI/registry deseni, yeni bir registry key GEREKMEZ).
 *
 * Aynı sebeple (`vi.mock('../../src/utils/audit.js', ...)` nested require'ı
 * yakalayamıyor — empirik olarak doğrulanmış), gerçek audit() çağrısının tam
 * şeklini doğrulamak için require.cache enjeksiyonu kullanılıyor.
 */
const nodeRequire = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const auditPath = path.resolve(here, '../../src/utils/audit.js');
const kioskServicePath = path.resolve(here, '../../src/services/kiosk.service.js');

describe('kiosk.service — recordWebSearch (real implementation, audit() call verified via require.cache injection)', () => {
  let fakeAudit;
  let recordWebSearch;

  beforeEach(() => {
    fakeAudit = vi.fn().mockResolvedValue(undefined);
    nodeRequire.cache[auditPath] = {
      id: auditPath,
      filename: auditPath,
      loaded: true,
      exports: { audit: fakeAudit },
    };
    delete nodeRequire.cache[kioskServicePath];
    ({ recordWebSearch } = nodeRequire(kioskServicePath));
  });

  afterEach(() => {
    delete nodeRequire.cache[auditPath];
    delete nodeRequire.cache[kioskServicePath];
  });

  it('calls the real audit() with action="voice:web_search", resource="surgeries", the speaker userId, and newData={query, answer} — never raw search-result/source data', async () => {
    const req = { ip: '10.0.0.1', headers: { 'user-agent': 'kiosk-device' } };

    await recordWebSearch({
      userId:    'speaker-1',
      surgeryId: 'surgery-42',
      query:     'parasetamol dozu nedir',
      answer:    'Bu doğrulanmış bir klinik kaynak değildir. Yetişkinlerde...',
      req,
    });

    expect(fakeAudit).toHaveBeenCalledTimes(1);
    expect(fakeAudit).toHaveBeenCalledWith({
      userId:     'speaker-1',
      action:     'voice:web_search',
      resource:   'surgeries',
      resourceId: 'surgery-42',
      newData:    { query: 'parasetamol dozu nedir', answer: 'Bu doğrulanmış bir klinik kaynak değildir. Yetişkinlerde...' },
      req,
    });
  });

  it('does not swallow an audit() rejection itself (no try/catch of its own — audit.js owns that)', async () => {
    fakeAudit.mockRejectedValueOnce(new Error('db down'));

    await expect(recordWebSearch({
      userId: 'speaker-1', surgeryId: 'surgery-1', query: 'q', answer: 'a', req: {},
    })).rejects.toThrow('db down');
  });
});
