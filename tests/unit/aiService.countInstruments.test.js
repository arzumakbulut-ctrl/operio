import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

/**
 * ai.service.js'in modül seviyesinde `const Anthropic = require('@anthropic-ai/sdk')`
 * ile oluşturduğu `client`'ı mock'lamak için `vi.mock('@anthropic-ai/sdk', ...)`
 * DEĞİL, tests/unit/aiService.webSearch.test.js ile AYNI, deneysel olarak
 * doğrulanmış require.cache enjeksiyon tekniği kullanılıyor (bkz. o dosyadaki
 * detaylı açıklama: `vi.mock` burada ai.service.js'in kendi `require()` çağrısını
 * yakalamıyor, native require.cache'e doğrudan enjeksiyon gerekiyor).
 */
const nodeRequire = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const sdkPath = nodeRequire.resolve('@anthropic-ai/sdk');
const servicePath = path.resolve(here, '../../src/services/ai.service.js');

/**
 * requireFreshService — ai.service.js'i, @anthropic-ai/sdk'nin require() ile
 * çağrıldığında `{ messages: { create: createMock } }` döndüren sahte bir
 * constructor'a enjekte edilmiş hâliyle, sıfırdan (cache'siz) require eder.
 */
function requireFreshService(createMock) {
  function FakeAnthropic() {
    return { messages: { create: createMock } };
  }
  nodeRequire.cache[sdkPath] = {
    id: sdkPath,
    filename: sdkPath,
    loaded: true,
    exports: FakeAnthropic,
  };
  delete nodeRequire.cache[servicePath];
  return nodeRequire(servicePath);
}

afterEach(() => {
  delete nodeRequire.cache[sdkPath];
  delete nodeRequire.cache[servicePath];
});

describe('ai.service — countInstruments (gerçek client.messages.create, require.cache enjeksiyonuyla mock\'lanır)', () => {
  it('Claude geçerli ```json bloğu dönerse, her beklenen alet için detectedCount eşler', async () => {
    const createMock = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: '```json\n{"counts":[{"name":"Trokar 10mm","detectedCount":1},{"name":"Grasper","detectedCount":0}]}\n```' }],
    });
    const { countInstruments } = requireFreshService(createMock);
    const result = await countInstruments('base64data', 'image/jpeg', [
      { instrumentId: 'i1', name: 'Trokar 10mm', expectedCount: 1 },
      { instrumentId: 'i2', name: 'Grasper', expectedCount: 1 },
    ]);
    expect(result.parsed).toBe(true);
    expect(result.suggestions).toEqual([
      { instrumentId: 'i1', name: 'Trokar 10mm', expectedCount: 1, detectedCount: 1 },
      { instrumentId: 'i2', name: 'Grasper', expectedCount: 1, detectedCount: 0 },
    ]);
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
      messages: [{
        role: 'user',
        content: expect.arrayContaining([
          expect.objectContaining({ type: 'image', source: expect.objectContaining({ type: 'base64', media_type: 'image/jpeg', data: 'base64data' }) }),
        ]),
      }],
    }));
  });

  it('yanıt parse edilemezse (json bloğu yok) fırlatmaz, parsed:false + boş suggestions döner', async () => {
    const createMock = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'anlayamadım' }] });
    const { countInstruments } = requireFreshService(createMock);
    const result = await countInstruments('x', 'image/jpeg', [{ instrumentId: 'i1', name: 'A', expectedCount: 1 }]);
    expect(result).toEqual({ suggestions: [], parsed: false });
  });

  it('```json bloğu VAR ama içindeki JSON bozuksa fırlatmaz, parsed:false + boş suggestions döner', async () => {
    const createMock = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: '```json\n{"counts":[{"name":"A","detectedCount":\n```' }],
    });
    const { countInstruments } = requireFreshService(createMock);
    const result = await countInstruments('x', 'image/jpeg', [{ instrumentId: 'i1', name: 'A', expectedCount: 1 }]);
    expect(result).toEqual({ suggestions: [], parsed: false });
  });

  it('geçersiz detectedCount değerleri (negatif, string, ondalıklı, SMALLINT dışı, eksik) null olur', async () => {
    const createMock = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: '```json\n{"counts":[' +
        '{"name":"A","detectedCount":-1},' +
        '{"name":"B","detectedCount":"3"},' +
        '{"name":"C","detectedCount":1.5},' +
        '{"name":"D","detectedCount":40000},' +
        '{"name":"E"},' +
        '{"name":"F","detectedCount":32767}' +
        ']}\n```' }],
    });
    const { countInstruments } = requireFreshService(createMock);
    const result = await countInstruments('x', 'image/jpeg', ['A', 'B', 'C', 'D', 'E', 'F'].map((name, i) => (
      { instrumentId: `i${i}`, name, expectedCount: 1 }
    )));
    expect(result.parsed).toBe(true);
    expect(result.suggestions.map(s => s.detectedCount)).toEqual([null, null, null, null, null, 32767]);
  });

  it('CRLF satır sonları ve ```json etiketinden sonra boşluk tolere edilir', async () => {
    const createMock = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: '```json \r\n{"counts":[{"name":"A","detectedCount":2}]}\r\n```' }],
    });
    const { countInstruments } = requireFreshService(createMock);
    const result = await countInstruments('x', 'image/jpeg', [{ instrumentId: 'i1', name: 'A', expectedCount: 2 }]);
    expect(result).toEqual({
      suggestions: [{ instrumentId: 'i1', name: 'A', expectedCount: 2, detectedCount: 2 }],
      parsed: true,
    });
  });

  it('expectedInstruments boşsa çökmez, boş suggestions döner', async () => {
    const createMock = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: '```json\n{"counts":[]}\n```' }] });
    const { countInstruments } = requireFreshService(createMock);
    const result = await countInstruments('x', 'image/jpeg', []);
    expect(result).toEqual({ suggestions: [], parsed: true });
  });
});
