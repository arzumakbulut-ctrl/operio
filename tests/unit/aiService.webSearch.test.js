import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

/**
 * ai.service.js'in modül seviyesinde `const Anthropic = require('@anthropic-ai/sdk')`
 * ile oluşturduğu `client`'ı mock'lamak için `vi.mock('@anthropic-ai/sdk', ...)`
 * DEĞİL, tests/unit/kioskService.recordTimeoutRead.test.js / spotify.service.test.js
 * ile AYNI, deneysel olarak doğrulanmış require.cache enjeksiyon tekniği kullanılıyor.
 *
 * Neden: bu projenin Vitest kurulumunda `vi.mock`, sadece TEST DOSYASININ KENDİSİNİN
 * doğrudan import ettiği modülleri yakalıyor — ai.service.js'in kendi
 * `require('@anthropic-ai/sdk')` çağrısı bir hop ötede ve bu mock'u atlıyor. Bu,
 * burada da AYNI deneyle doğrulandı: `vi.mock('@anthropic-ai/sdk', factory)` + test
 * dosyasının `require('../../src/services/ai.service')` ile servisi dolaylı yüklemesi
 * denendiğinde, sahte client ÇAĞRILMADI ve gerçek Anthropic SDK'sı gerçek bir ağ
 * isteği attı (sahte apiKey'le 401 "invalid x-api-key" döndürerek bunu kanıtladı).
 * Bu yüzden Node'un native require.cache'ine (createRequire ile) doğrudan enjeksiyon
 * yapılıyor — bu, vite-node'un ESM mock registry'sini atlar ama her iki dünyanın da
 * paylaştığı gerçek require.cache'e yazar, ai.service.js'in KENDİ require() çağrısı
 * bunu görür.
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

describe('ai.service — webSearch (gerçek client.messages.create, require.cache enjeksiyonuyla mock\'lanır)', () => {
  it('client.messages.create\'i doğru model/max_tokens/tools/messages parametreleriyle çağırır ve tek bir text bloğunu döner', async () => {
    const createMock = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Bugün hava açık ve 18 derece.' }],
    });
    const { webSearch } = requireFreshService(createMock);

    const result = await webSearch('bugün hava nasıl');

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: 'bugün hava nasıl' }],
    });
    expect(result).toBe('Bugün hava açık ve 18 derece.');
  });

  it('yanıt server_tool_use/web_search_tool_result ile ARAYA GİRMİŞ birden fazla text bloğu içeriyorsa, sadece text bloklarını sırayla birleştirip trim\'ler', async () => {
    const createMock = vi.fn().mockResolvedValue({
      content: [
        { type: 'text', text: 'Önce bir arama yapayım.' },
        { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'hava durumu' } },
        {
          type: 'web_search_tool_result',
          tool_use_id: 'srvtoolu_1',
          content: [{ type: 'web_search_result', url: 'https://example.com', title: 'Örnek' }],
        },
        { type: 'text', text: ' Sonuçlara göre hava açık.' },
      ],
    });
    const { webSearch } = requireFreshService(createMock);

    const result = await webSearch('hava durumu nedir');

    expect(result).toBe('Önce bir arama yapayım. Sonuçlara göre hava açık.');
  });

  it('content içinde hiç text bloğu yoksa boş string döner (fırlatmaz)', async () => {
    const createMock = vi.fn().mockResolvedValue({
      content: [
        { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: {} },
        { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [] },
      ],
    });
    const { webSearch } = requireFreshService(createMock);

    const result = await webSearch('garip bir sorgu');

    expect(result).toBe('');
  });

  it('process.env.AI_MODEL/AI_MAX_TOKENS ayarlıysa bunları kullanır (mevcut chat/streamChat ile aynı env okuma deseni)', async () => {
    const originalModel = process.env.AI_MODEL;
    const originalMaxTokens = process.env.AI_MAX_TOKENS;
    process.env.AI_MODEL = 'claude-custom-model';
    process.env.AI_MAX_TOKENS = '2048';

    try {
      const createMock = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });
      const { webSearch } = requireFreshService(createMock);

      await webSearch('bir sorgu');

      expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
        model: 'claude-custom-model',
        max_tokens: 2048,
      }));
    } finally {
      process.env.AI_MODEL = originalModel;
      process.env.AI_MAX_TOKENS = originalMaxTokens;
    }
  });
});
