import { describe, it, expect } from 'vitest';

const { SpeakerVerifier } = await import('../../src/drivers/SpeakerVerifier.js');
const { MockSpeakerVerifier, NOT_IN_TEAM_USER_ID } = await import('../../src/drivers/MockSpeakerVerifier.js');

const candidateUserIds = ['user-1', 'user-2', 'user-3'];

describe('SpeakerVerifier (soyut taban sınıf)', () => {
  it('identify() çağrılırsa "not implemented" hatası fırlatmalı', async () => {
    const verifier = new SpeakerVerifier();
    await expect(
      verifier.identify(null, candidateUserIds, { mode: 'always_match', cycleIndex: 0 })
    ).rejects.toThrow('not implemented');
  });
});

describe('MockSpeakerVerifier', () => {
  it('always_match → ilk candidate\'i döner', async () => {
    const verifier = new MockSpeakerVerifier();
    const result = await verifier.identify(null, candidateUserIds, { mode: 'always_match', cycleIndex: 0 });
    expect(result).toEqual({ userId: 'user-1', confidence: 1 });
  });

  it('always_reject_team → candidate listesinde OLMAYAN bir userId döner (ekip-dışı reddini simüle eder)', async () => {
    const verifier = new MockSpeakerVerifier();
    const result = await verifier.identify(null, candidateUserIds, { mode: 'always_reject_team', cycleIndex: 0 });
    expect(result).not.toBeNull();
    expect(candidateUserIds).not.toContain(result.userId);
    expect(result.userId).toBe(NOT_IN_TEAM_USER_ID);
  });

  it('always_unrecognized → null döner', async () => {
    const verifier = new MockSpeakerVerifier();
    const result = await verifier.identify(null, candidateUserIds, { mode: 'always_unrecognized', cycleIndex: 0 });
    expect(result).toBeNull();
  });

  describe('cycle modu', () => {
    it('cycleIndex % length\'e göre doğru candidate\'i döner (0,1,2 sırayla, 3 → wrap)', async () => {
      const verifier = new MockSpeakerVerifier();

      const r0 = await verifier.identify(null, candidateUserIds, { mode: 'cycle', cycleIndex: 0 });
      const r1 = await verifier.identify(null, candidateUserIds, { mode: 'cycle', cycleIndex: 1 });
      const r2 = await verifier.identify(null, candidateUserIds, { mode: 'cycle', cycleIndex: 2 });
      const r3 = await verifier.identify(null, candidateUserIds, { mode: 'cycle', cycleIndex: 3 }); // wrap → index 0

      expect(r0.userId).toBe('user-1');
      expect(r1.userId).toBe('user-2');
      expect(r2.userId).toBe('user-3');
      expect(r3.userId).toBe('user-1');
    });

    it('ardışık çağrılarda (çağıranın cycleIndex\'i artırmasıyla) farklı candidate\'ler döner — index gerçekten ilerliyor', async () => {
      // identify() saf/stateless kalır: index'in ilerlemesi çağıranın (kioskSpeakerAuth +
      // incrementMockCycleIndex) sorumluluğundadır. Bu test o akışı simüle eder: her
      // identify() çağrısından sonra cycleIndex'i biz artırıp bir sonraki config'e veriyoruz
      // ve dönen candidate'in her seferinde gerçekten değiştiğini doğruluyoruz.
      const verifier = new MockSpeakerVerifier();

      let cycleIndex = 0;
      const seen = [];
      for (let i = 0; i < 4; i++) {
        const result = await verifier.identify(null, candidateUserIds, { mode: 'cycle', cycleIndex });
        seen.push(result.userId);
        cycleIndex += 1; // incrementMockCycleIndex'in DB'deki etkisini simüle eder
      }

      expect(seen).toEqual(['user-1', 'user-2', 'user-3', 'user-1']);
      expect(seen[0]).not.toBe(seen[1]);
      expect(seen[1]).not.toBe(seen[2]);
      expect(seen[2]).not.toBe(seen[3]);
    });

    it('identify() aynı config ile tekrar çağrılırsa AYNI sonucu döner (yan etkisiz/stateless)', async () => {
      const verifier = new MockSpeakerVerifier();
      const config = { mode: 'cycle', cycleIndex: 1 };
      const a = await verifier.identify(null, candidateUserIds, config);
      const b = await verifier.identify(null, candidateUserIds, config);
      expect(a).toEqual(b);
    });
  });
});
