import { describe, it, expect } from 'vitest';
import { hashAudio, MODEL_VERSION } from '../../src/services/voiceProfile.service.js';

// hashAudio ve MODEL_VERSION, enrollVoiceProfile'ın DB'ye dokunan kısmından
// bağımsız, saf (pure) parçalarıdır — bu yüzden DB mock'u gerektirmeden
// doğrudan test edilebilirler (bkz. voiceProfile.service.js).

describe('hashAudio (pure)', () => {
  it('aynı base64 girdi için her zaman aynı hash döner (deterministik)', () => {
    const audio = Buffer.from('test-audio-bytes').toString('base64');
    const h1 = hashAudio(audio);
    const h2 = hashAudio(audio);
    expect(h1).toEqual(h2);
    expect(h1.equals(h2)).toBe(true);
  });

  it('farklı base64 girdiler için farklı hash döner', () => {
    const a = hashAudio(Buffer.from('audio-a').toString('base64'));
    const b = hashAudio(Buffer.from('audio-b').toString('base64'));
    expect(a.equals(b)).toBe(false);
  });

  it('bir Buffer döner (BYTEA olarak saklanabilir)', () => {
    const h = hashAudio(Buffer.from('x').toString('base64'));
    expect(Buffer.isBuffer(h)).toBe(true);
  });

  it('SHA-256 → 32 byte uzunluğunda buffer döner', () => {
    const h = hashAudio(Buffer.from('some-audio').toString('base64'));
    expect(h.length).toBe(32);
  });
});

describe('MODEL_VERSION (pure sabit)', () => {
  it("'mock-v1' değerine sahiptir — gerçek embedding modeli ayrı bir araştırma adımı olduğu için placeholder", () => {
    expect(MODEL_VERSION).toBe('mock-v1');
  });
});
