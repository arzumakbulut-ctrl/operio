import { describe, it, expect, vi, beforeEach } from 'vitest';
import registry from '../../src/services/_registry.js';

const { kioskSpeakerAuth } = await import('../../src/middleware/kioskSpeakerAuth.js');

const mockKioskService = {
  getMockConfig: vi.fn(),
  incrementMockCycleIndex: vi.fn(),
};

function makeRes() {
  const json = vi.fn();
  const res = { status: vi.fn(() => ({ json })) };
  return { res, json };
}

function makeReq({ surgeryTeams } = {}) {
  return {
    kiosk: { institutionId: 'inst-1', roomId: 'room-1' },
    activeSurgery: {
      id: 'surgery-1',
      surgeryTeams: surgeryTeams || [
        { userId: 'user-1', fullName: 'Ayşe Yılmaz', roleId: 6, teamRole: 'cerrah' },
        { userId: 'user-2', fullName: 'Mehmet Demir', roleId: 3, teamRole: 'hemşire' },
      ],
    },
    body: { audio: Buffer.from('mock-audio') },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  registry.register('kiosk', mockKioskService);
});

describe('kioskSpeakerAuth', () => {
  it('(a) identify() tanıyamazsa (always_unrecognized) 403 unrecognized döner — mesaj "Sizi tanıyamadım" İÇERİR, hiçbir isim İÇERMEZ', async () => {
    mockKioskService.getMockConfig.mockResolvedValueOnce({ mode: 'always_unrecognized', cycleIndex: 0 });
    const req = makeReq();
    const { res, json } = makeRes();
    const next = vi.fn();

    await kioskSpeakerAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    const body = json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('unrecognized');
    expect(body.error.message).toContain('Sizi tanıyamadım');
    expect(body.error.message).not.toContain('Ayşe Yılmaz');
    expect(body.error.message).not.toContain('Mehmet Demir');
    expect(next).not.toHaveBeenCalled();
    expect(req.speaker).toBeUndefined();
  });

  it('(b) identify() ekip-dışı bir userId dönerse (always_reject_team) 403 not_in_team döner — mesaj "görevli değilsiniz" İÇERİR ve (a)\'daki mesajdan net ayrışır', async () => {
    mockKioskService.getMockConfig.mockResolvedValueOnce({ mode: 'always_reject_team', cycleIndex: 0 });
    const req = makeReq();
    const { res, json } = makeRes();
    const next = vi.fn();

    await kioskSpeakerAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    const body = json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('not_in_team');
    expect(body.error.message).toContain('görevli değilsiniz');
    // Review Focus #3: unrecognized ve not_in_team mesajları birbirine KARIŞMAMALI
    expect(body.error.code).not.toBe('unrecognized');
    expect(body.error.message).not.toContain('Sizi tanıyamadım');
    expect(next).not.toHaveBeenCalled();
    expect(req.speaker).toBeUndefined();
  });

  it('(c) identify() ekipteki bir candidate\'i dönerse (always_match) req.speaker tam dolar ve next() çağrılır — ek DB sorgusu yok', async () => {
    mockKioskService.getMockConfig.mockResolvedValueOnce({ mode: 'always_match', cycleIndex: 0 });
    const req = makeReq();
    const { res } = makeRes();
    const next = vi.fn();

    await kioskSpeakerAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.speaker).toEqual({ userId: 'user-1', fullName: 'Ayşe Yılmaz', roleId: 6, teamRole: 'cerrah' });
  });

  it('(d) mode="cycle": ilk çağrıda ilk candidate tanınır ve incrementMockCycleIndex(institutionId) çağrılır', async () => {
    mockKioskService.getMockConfig.mockResolvedValueOnce({ mode: 'cycle', cycleIndex: 0 });
    mockKioskService.incrementMockCycleIndex.mockResolvedValueOnce(1);

    const req = makeReq();
    const { res } = makeRes();
    const next = vi.fn();

    await kioskSpeakerAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.speaker.userId).toBe('user-1'); // cycleIndex 0 % 2 → user-1
    expect(mockKioskService.incrementMockCycleIndex).toHaveBeenCalledWith('inst-1');
  });

  it('(e) mode="cycle": ardışık iki çağrı (getMockConfig ilerlemiş cycleIndex\'i döndürdükçe) FARKLI candidate\'leri tanır — index gerçekten ilerliyor', async () => {
    // 1. çağrı — cycleIndex 0
    mockKioskService.getMockConfig.mockResolvedValueOnce({ mode: 'cycle', cycleIndex: 0 });
    mockKioskService.incrementMockCycleIndex.mockResolvedValueOnce(1);
    const req1 = makeReq();
    const { res: res1 } = makeRes();
    const next1 = vi.fn();
    await kioskSpeakerAuth(req1, res1, next1);

    // 2. çağrı — incrementMockCycleIndex'in DB'de bıraktığı etkiyi simüle eder:
    // getMockConfig artık ilerlemiş cycleIndex'i döner.
    mockKioskService.getMockConfig.mockResolvedValueOnce({ mode: 'cycle', cycleIndex: 1 });
    mockKioskService.incrementMockCycleIndex.mockResolvedValueOnce(2);
    const req2 = makeReq();
    const { res: res2 } = makeRes();
    const next2 = vi.fn();
    await kioskSpeakerAuth(req2, res2, next2);

    expect(next1).toHaveBeenCalledOnce();
    expect(next2).toHaveBeenCalledOnce();
    expect(req1.speaker.userId).toBe('user-1'); // index 0 % 2
    expect(req2.speaker.userId).toBe('user-2'); // index 1 % 2
    expect(req1.speaker.userId).not.toBe(req2.speaker.userId);
    expect(mockKioskService.incrementMockCycleIndex).toHaveBeenCalledTimes(2);
  });

  it('(f) mode diğer modlardaysa (always_match) incrementMockCycleIndex ÇAĞRILMAZ', async () => {
    mockKioskService.getMockConfig.mockResolvedValueOnce({ mode: 'always_match', cycleIndex: 0 });
    const req = makeReq();
    const { res } = makeRes();
    const next = vi.fn();

    await kioskSpeakerAuth(req, res, next);

    expect(mockKioskService.incrementMockCycleIndex).not.toHaveBeenCalled();
  });
});
