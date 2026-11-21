import { describe, it, expect, vi, beforeEach } from 'vitest';
import registry from '../../src/services/_registry.js';
import { signKioskToken } from '../../src/utils/kioskJwt.js';

const { kioskRoomAuth } = await import('../../src/middleware/kioskRoomAuth.js');

const mockKioskService  = { getActiveSurgeryForRoom: vi.fn(), isTokenRevoked: vi.fn() };
const mockModuleService = { hasActiveModule: vi.fn() };

function makeRes() {
  const json = vi.fn();
  const res = { status: vi.fn(() => ({ json })) };
  return { res, json };
}

function makeReq({ roomId = 'room-1', token } = {}) {
  return {
    params:  { roomId },
    headers: token ? { authorization: `Bearer ${token}` } : {},
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  registry.register('kiosk', mockKioskService);
  registry.register('module', mockModuleService);
});

describe('kioskRoomAuth', () => {
  it('(a) token yoksa 401 döner', async () => {
    const req = makeReq({ token: undefined });
    const { res, json } = makeRes();
    const next = vi.fn();

    await kioskRoomAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('(b) token geçerli ama kiosk_tokens\'ta revoked ise 403 döner', async () => {
    const token = signKioskToken({ institutionId: 'inst-1', roomId: 'room-1', jti: 'jti-1' });
    const req = makeReq({ roomId: 'room-1', token });
    const { res, json } = makeRes();
    const next = vi.fn();

    mockKioskService.isTokenRevoked.mockResolvedValueOnce(true);

    await kioskRoomAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('(c) token\'ın roomId\'si URL\'deki :roomId ile uyuşmuyorsa 403 döner', async () => {
    const token = signKioskToken({ institutionId: 'inst-1', roomId: 'room-1', jti: 'jti-1' });
    const req = makeReq({ roomId: 'room-OTHER', token });
    const { res, json } = makeRes();
    const next = vi.fn();

    mockKioskService.isTokenRevoked.mockResolvedValueOnce(false);

    await kioskRoomAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
    // Review Focus #1: room mismatch must be rejected before module/surgery checks run
    expect(mockModuleService.hasActiveModule).not.toHaveBeenCalled();
    expect(mockKioskService.getActiveSurgeryForRoom).not.toHaveBeenCalled();
  });

  it('(d) hasActiveModule false ise 403 module_not_purchased döner', async () => {
    const token = signKioskToken({ institutionId: 'inst-1', roomId: 'room-1', jti: 'jti-1' });
    const req = makeReq({ roomId: 'room-1', token });
    const { res, json } = makeRes();
    const next = vi.fn();

    mockKioskService.isTokenRevoked.mockResolvedValueOnce(false);
    mockModuleService.hasActiveModule.mockResolvedValueOnce(false);

    await kioskRoomAuth(req, res, next);

    expect(mockModuleService.hasActiveModule).toHaveBeenCalledWith({ institutionId: 'inst-1', slug: 'voice_control' });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ code: 'module_not_purchased' }),
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('(e) modül aktif ama odada IN_PROGRESS ameliyat yoksa 409 no_active_surgery döner', async () => {
    const token = signKioskToken({ institutionId: 'inst-1', roomId: 'room-1', jti: 'jti-1' });
    const req = makeReq({ roomId: 'room-1', token });
    const { res, json } = makeRes();
    const next = vi.fn();

    mockKioskService.isTokenRevoked.mockResolvedValueOnce(false);
    mockModuleService.hasActiveModule.mockResolvedValueOnce(true);
    mockKioskService.getActiveSurgeryForRoom.mockResolvedValueOnce(null);

    await kioskRoomAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ code: 'no_active_surgery' }),
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('(f) her şey geçerliyse next() çağrılır, req.kiosk/req.activeSurgery dolu olur', async () => {
    const token = signKioskToken({ institutionId: 'inst-1', roomId: 'room-1', jti: 'jti-1' });
    const req = makeReq({ roomId: 'room-1', token });
    const { res } = makeRes();
    const next = vi.fn();

    const activeSurgery = {
      id: 'surgery-1',
      surgeryTeams: [
        { userId: 'user-1', fullName: 'Ayşe Yılmaz', roleId: 6, teamRole: 'cerrah' },
      ],
    };

    mockKioskService.isTokenRevoked.mockResolvedValueOnce(false);
    mockModuleService.hasActiveModule.mockResolvedValueOnce(true);
    mockKioskService.getActiveSurgeryForRoom.mockResolvedValueOnce(activeSurgery);

    await kioskRoomAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.kiosk).toEqual({ institutionId: 'inst-1', roomId: 'room-1' });
    expect(req.activeSurgery).toEqual(activeSurgery);
  });
});
