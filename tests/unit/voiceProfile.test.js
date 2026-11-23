import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

/**
 * voiceProfile.service.js exercises its REAL implementation here, with
 * `utils/db.js` and `services/speakerIdClient.js` substituted via Node's
 * native `require.cache` (same technique, and same reason `vi.mock` can't be
 * used, as `kioskService.recordTimeoutRead.test.js` / `kioskService.getActiveSurgeryForRoom.test.js`
 * — see the long comment there): `vi.mock` only intercepts a module the TEST
 * FILE ITSELF imports directly; voiceProfile.service.js's own internal
 * `require('../utils/db')` and `require('./speakerIdClient')` calls are one
 * hop away and keep resolving to the real modules regardless. So both
 * dependencies are substituted by injecting fake exports directly into
 * `nodeRequire.cache` before (re-)requiring voiceProfile.service.js fresh.
 */
const nodeRequire = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(here, '../../src/utils/db.js');
const speakerIdClientPath = path.resolve(here, '../../src/services/speakerIdClient.js');
const voiceProfileServicePath = path.resolve(here, '../../src/services/voiceProfile.service.js');

describe('voiceProfile.service — gerçek embedding', () => {
  let fakeQuery;
  let fakeGetEmbedding;
  let enrollVoiceProfile;
  let getVoiceProfile;
  let getEmbeddingsForUsers;
  let serializeEmbedding;
  let deserializeEmbedding;
  let MODEL_VERSION;

  beforeEach(() => {
    fakeQuery = vi.fn();
    fakeGetEmbedding = vi.fn();

    nodeRequire.cache[dbPath] = {
      id: dbPath,
      filename: dbPath,
      loaded: true,
      exports: { query: fakeQuery, transaction: vi.fn() },
    };
    nodeRequire.cache[speakerIdClientPath] = {
      id: speakerIdClientPath,
      filename: speakerIdClientPath,
      loaded: true,
      exports: { getEmbedding: fakeGetEmbedding },
    };
    delete nodeRequire.cache[voiceProfileServicePath]; // force a fresh require so it picks up the injected deps
    ({
      enrollVoiceProfile,
      getVoiceProfile,
      getEmbeddingsForUsers,
      serializeEmbedding,
      deserializeEmbedding,
      MODEL_VERSION,
    } = nodeRequire(voiceProfileServicePath));
  });

  afterEach(() => {
    delete nodeRequire.cache[dbPath];
    delete nodeRequire.cache[speakerIdClientPath];
    delete nodeRequire.cache[voiceProfileServicePath];
  });

  describe('enrollVoiceProfile', () => {
    it('3 örneğin embedding ortalamasını (centroid) hesaplar ve BYTEA olarak saklar', async () => {
      fakeGetEmbedding
        .mockResolvedValueOnce([1, 0])
        .mockResolvedValueOnce([0, 1])
        .mockResolvedValueOnce([2, 2]);
      fakeQuery.mockResolvedValueOnce({
        rows: [{ enrolled_at: new Date('2026-01-01T00:00:00Z'), model_version: 'ecapa-tdnn-v1' }],
      });

      await enrollVoiceProfile('u1', ['sample-a', 'sample-b', 'sample-c']);

      expect(fakeGetEmbedding).toHaveBeenCalledTimes(3);
      expect(fakeGetEmbedding).toHaveBeenNthCalledWith(1, 'sample-a');
      expect(fakeGetEmbedding).toHaveBeenNthCalledWith(2, 'sample-b');
      expect(fakeGetEmbedding).toHaveBeenNthCalledWith(3, 'sample-c');

      expect(fakeQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = fakeQuery.mock.calls[0];
      expect(sql).toMatch(/INSERT INTO voice_profiles/);
      expect(sql).toMatch(/ON CONFLICT \(user_id\) DO UPDATE/);
      expect(params[0]).toBe('u1');

      // ortalama [1,0],[0,1],[2,2] -> [1,1] — serialize edilmiş buffer'ın
      // deserialize edilince [1,1]'e dönmesini doğrula (round-trip ile).
      const embeddingBuffer = params[1];
      expect(Buffer.isBuffer(embeddingBuffer)).toBe(true);
      expect(deserializeEmbedding(embeddingBuffer)).toEqual([1, 1]);
      expect(embeddingBuffer).toEqual(serializeEmbedding([1, 1]));
    });

    it('yeniden enrollment (ON CONFLICT) SQL\'inde model_version SET\'e dahildir — stale model_version kalmaz', async () => {
      // Review finding: SET embedding=$2, enrolled_at=NOW() eskiden model_version'ı
      // güncellemiyordu. Bir kullanıcı eski bir model_version ile zaten enroll
      // olmuşken yeniden enroll ederse (ör. model yükseltmesi sonrası), hem
      // embedding hem model_version güncellenmeli — DB satırı eski (stale) bir
      // model_version'da kalmamalı.
      fakeGetEmbedding
        .mockResolvedValueOnce([1, 0])
        .mockResolvedValueOnce([0, 1])
        .mockResolvedValueOnce([2, 2]);
      // Gerçek Postgres'te ON CONFLICT ... DO UPDATE satırı günceller ve
      // RETURNING bunu yansıtır — burada DB'nin UPDATE'i uyguladığını simüle
      // ediyoruz: dönen satır artık MEVCUT (yeni) MODEL_VERSION'ı taşır.
      fakeQuery.mockResolvedValueOnce({
        rows: [{ enrolled_at: new Date('2026-03-01T00:00:00Z'), model_version: MODEL_VERSION }],
      });

      const result = await enrollVoiceProfile('u1', ['sample-a', 'sample-b', 'sample-c']);

      const [sql, params] = fakeQuery.mock.calls[0];
      // SET clause'un tam olarak model_version=$3'ü de içerdiğini doğrula —
      // sadece embedding=$2, enrolled_at=NOW() değil.
      expect(sql).toMatch(/ON CONFLICT \(user_id\) DO UPDATE SET embedding=\$2, enrolled_at=NOW\(\), model_version=\$3/);
      // Yeni model_version, hem INSERT değer listesine hem de (aynı $3
      // parametresi üzerinden) conflict-update'e geçiriliyor — stale kalmaz.
      expect(params[2]).toBe(MODEL_VERSION);
      expect(result.modelVersion).toBe(MODEL_VERSION);
    });

    it('audioSamples 3 eleman değilse (ör. 2 veya 4) hata fırlatır', async () => {
      await expect(enrollVoiceProfile('u1', ['a', 'b'])).rejects.toThrow();
      await expect(enrollVoiceProfile('u1', ['a', 'b', 'c', 'd'])).rejects.toThrow();
      expect(fakeGetEmbedding).not.toHaveBeenCalled();
      expect(fakeQuery).not.toHaveBeenCalled();
    });

    it('audioSamples dizi değilse hata fırlatır', async () => {
      await expect(enrollVoiceProfile('u1', 'not-an-array')).rejects.toThrow();
    });

    it('örneklerden biri voice_detected:false dönerse (getEmbedding null) enrollment reddedilir', async () => {
      fakeGetEmbedding
        .mockResolvedValueOnce([1, 0])
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce([2, 2]);

      await expect(enrollVoiceProfile('u1', ['a', 'b', 'c'])).rejects.toThrow();
      expect(fakeQuery).not.toHaveBeenCalled();
    });
  });

  describe('getVoiceProfile', () => {
    it('kayıtlı profil varsa enrolledAt/modelVersion döner', async () => {
      const enrolledAt = new Date('2026-02-01T00:00:00Z');
      fakeQuery.mockResolvedValueOnce({ rows: [{ enrolled_at: enrolledAt, model_version: 'ecapa-tdnn-v1' }] });

      const result = await getVoiceProfile('u1');

      expect(fakeQuery).toHaveBeenCalledWith(expect.stringContaining('voice_profiles'), ['u1']);
      expect(result).toEqual({ enrolledAt, modelVersion: 'ecapa-tdnn-v1' });
    });

    it('kayıtlı profil yoksa null döner', async () => {
      fakeQuery.mockResolvedValueOnce({ rows: [] });
      expect(await getVoiceProfile('u-yok')).toBeNull();
    });
  });

  describe('getEmbeddingsForUsers', () => {
    it("enrollment'ı olmayan userId'leri sonuçtan atlar", async () => {
      // 3 userId istenir ama DB'de sadece 2'si için satır vardır (3.'sü enroll
      // edilmemiş) — dönen dizi sadece kayıtlı olan 2'sini içermeli.
      fakeQuery.mockResolvedValueOnce({
        rows: [
          { user_id: 'u1', embedding: serializeEmbedding([1, 1]) },
          { user_id: 'u2', embedding: serializeEmbedding([0, 2]) },
        ],
      });

      const result = await getEmbeddingsForUsers(['u1', 'u2', 'u3-not-enrolled']);

      // model_version = $2 filtresi de sorguya dahil (bkz. aşağıdaki finding
      // #4 testi) — ikinci parametre artık MODEL_VERSION'ı taşıyor.
      expect(fakeQuery).toHaveBeenCalledWith(
        expect.stringContaining('ANY($1)'),
        [['u1', 'u2', 'u3-not-enrolled'], MODEL_VERSION]
      );
      expect(result).toEqual([
        { userId: 'u1', embedding: [1, 1] },
        { userId: 'u2', embedding: [0, 2] },
      ]);
      expect(result.find((r) => r.userId === 'u3-not-enrolled')).toBeUndefined();
    });

    it('hiçbir userId enroll edilmemişse boş dizi döner', async () => {
      fakeQuery.mockResolvedValueOnce({ rows: [] });
      expect(await getEmbeddingsForUsers(['x', 'y'])).toEqual([]);
    });

    it("final whole-branch review finding #4: farklı (stale) bir model_version ile enroll olmuş bir kullanıcı, hiç enroll olmamış gibi sonuçtan hariç tutulur", async () => {
      // Önceden bu sorgu model_version'dan bağımsız HER enrollment'ı
      // döndürüyordu — eski mock-v1 hash'lerin karşılaştırmaya girmemesi
      // sadece RealSpeakerVerifier'ın uzunluk-uyuşmazlığı korumasına
      // TESADÜFEN bağlıydı. Artık WHERE'e `model_version = $2` eklendi;
      // burada gerçek DB filtrelemesini simüle ediyoruz (mock sorgu sadece
      // güncel model_version'a sahip satırı döndürür) ve SQL metninin +
      // parametrelerin bu filtreyi GERÇEKTEN taşıdığını doğruluyoruz.
      fakeQuery.mockResolvedValueOnce({
        rows: [{ user_id: 'u1', embedding: serializeEmbedding([1, 1]) }],
      });

      const result = await getEmbeddingsForUsers(['u1', 'u-stale-model-version']);

      const [sql, params] = fakeQuery.mock.calls[0];
      expect(sql).toMatch(/model_version\s*=\s*\$2/);
      expect(params).toEqual([['u1', 'u-stale-model-version'], MODEL_VERSION]);
      expect(result).toEqual([{ userId: 'u1', embedding: [1, 1] }]);
      expect(result.find((r) => r.userId === 'u-stale-model-version')).toBeUndefined();
    });
  });

  describe('serializeEmbedding / deserializeEmbedding (pure round-trip)', () => {
    it('bir float vektörünü Buffer\'a çevirip geri aynı değerlere döner', () => {
      const vector = [0.5, -1.25, 3.0, 0, 100.75];
      const buffer = serializeEmbedding(vector);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBe(vector.length * 4);
      expect(deserializeEmbedding(buffer)).toEqual(vector);
    });
  });
});
