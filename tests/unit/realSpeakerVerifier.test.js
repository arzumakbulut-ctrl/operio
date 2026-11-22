import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

/**
 * RealSpeakerVerifier.identify, `speakerIdClient.getEmbedding` ve
 * `voiceProfile.service.getEmbeddingsForUsers`'ı kendi içinde (bir hop ötede)
 * require eder. Bu projede `vi.mock` sadece TEST DOSYASININ DOĞRUDAN import
 * ettiği modülleri yakalar — bir hop ötedeki iç require() zincirine görünmez
 * (bkz. `tests/unit/voiceProfile.test.js` ve
 * `tests/unit/kioskService.recordTimeoutRead.test.js`'teki aynı, ampirik
 * olarak doğrulanmış gerekçe). Bu yüzden burada da Node'un kendi
 * `require.cache`'ine (native `createRequire` ile) sahte exports enjekte
 * edilip `RealSpeakerVerifier.js` taze (`delete cache[...]` sonrası) require
 * edilir — aynı teknik, aynı sebep.
 */
const nodeRequire = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const speakerIdClientPath = path.resolve(here, '../../src/services/speakerIdClient.js');
const voiceProfileServicePath = path.resolve(here, '../../src/services/voiceProfile.service.js');
const realSpeakerVerifierPath = path.resolve(here, '../../src/drivers/RealSpeakerVerifier.js');

describe('RealSpeakerVerifier.identify', () => {
  let fakeGetEmbedding;
  let fakeGetEmbeddingsForUsers;
  let RealSpeakerVerifier;

  beforeEach(() => {
    fakeGetEmbedding = vi.fn();
    fakeGetEmbeddingsForUsers = vi.fn();

    nodeRequire.cache[speakerIdClientPath] = {
      id: speakerIdClientPath,
      filename: speakerIdClientPath,
      loaded: true,
      exports: { getEmbedding: fakeGetEmbedding },
    };
    nodeRequire.cache[voiceProfileServicePath] = {
      id: voiceProfileServicePath,
      filename: voiceProfileServicePath,
      loaded: true,
      exports: { getEmbeddingsForUsers: fakeGetEmbeddingsForUsers },
    };
    delete nodeRequire.cache[realSpeakerVerifierPath]; // force fresh require so it picks up the injected deps

    ({ RealSpeakerVerifier } = nodeRequire(realSpeakerVerifierPath));
  });

  it("en yüksek cosine-similarity skoru eşik üstündeyse o userId'yi confidence ile döner", async () => {
    fakeGetEmbedding.mockResolvedValue([1, 0]);
    fakeGetEmbeddingsForUsers.mockResolvedValue([
      { userId: 'u1', embedding: [1, 0] }, // cosine sim = 1
      { userId: 'u2', embedding: [0, 1] }, // cosine sim = 0
    ]);

    const verifier = new RealSpeakerVerifier();
    const result = await verifier.identify('audio-base64', ['u1', 'u2'], {});

    expect(result).toEqual({ userId: 'u1', confidence: 1 });
    expect(fakeGetEmbeddingsForUsers).toHaveBeenCalledWith(['u1', 'u2']);
  });

  it("en yüksek skor eşik altındaysa null döner (false-accept'e düşmez)", async () => {
    fakeGetEmbedding.mockResolvedValue([1, 0]);
    fakeGetEmbeddingsForUsers.mockResolvedValue([
      { userId: 'u1', embedding: [0, 1] }, // cosine sim = 0
      { userId: 'u2', embedding: [-1, 0] }, // cosine sim = -1 (açıkça eşleşmeyen)
    ]);

    const verifier = new RealSpeakerVerifier();
    const result = await verifier.identify('audio-base64', ['u1', 'u2'], {});

    expect(result).toBeNull();
  });

  it('audioBuffer null ise (ses yok) fırlatmadan null döner', async () => {
    const verifier = new RealSpeakerVerifier();
    await expect(verifier.identify(null, ['u1'], {})).resolves.toBeNull();
    expect(fakeGetEmbedding).not.toHaveBeenCalled();
  });

  it('candidateUserIds boşsa null döner', async () => {
    const verifier = new RealSpeakerVerifier();
    await expect(verifier.identify('audio', [], {})).resolves.toBeNull();
    expect(fakeGetEmbedding).not.toHaveBeenCalled();
  });

  it('getEmbeddingsForUsers hiçbir eşleşme döndürmezse (kimse enroll olmamış) null döner', async () => {
    fakeGetEmbedding.mockResolvedValue([1, 0]);
    fakeGetEmbeddingsForUsers.mockResolvedValue([]);

    const verifier = new RealSpeakerVerifier();
    const result = await verifier.identify('audio-base64', ['u1', 'u2'], {});

    expect(result).toBeNull();
  });

  it('getEmbedding null dönerse (ses/konuşma tespit edilemedi) fırlatmadan null döner, getEmbeddingsForUsers çağrılmaz', async () => {
    fakeGetEmbedding.mockResolvedValue(null);

    const verifier = new RealSpeakerVerifier();
    const result = await verifier.identify('audio-base64', ['u1'], {});

    expect(result).toBeNull();
    expect(fakeGetEmbeddingsForUsers).not.toHaveBeenCalled();
  });
});
