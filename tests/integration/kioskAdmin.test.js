import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { signAccessToken } from '../../src/utils/jwt.js';
import registry from '../../src/services/_registry.js';
import app from '../../src/app.js';

const request = supertest(app);
const mockKioskService = {
  isTokenRevoked: vi.fn(),
  getActiveSurgeryForRoom: vi.fn(),
  createKioskToken: vi.fn(),
  revokeKioskToken: vi.fn(),
  getMockConfig: vi.fn(),
  setMockConfig: vi.fn(),
};
const tok = (roleId) => signAccessToken({ sub: 'u1', email: 'e@t.com', roleId, institutionId: 'inst-1' });

beforeEach(() => {
  vi.clearAllMocks();
  registry.register('kiosk', mockKioskService);
});

describe('POST /api/kiosk-admin/rooms/:roomId/token', () => {
  it('hemşire (4) token üretemez → 403', async () => {
    const res = await request
      .post('/api/kiosk-admin/rooms/room-1/token')
      .set('Authorization', `Bearer ${tok(4)}`);
    expect(res.status).toBe(403);
    expect(mockKioskService.createKioskToken).not.toHaveBeenCalled();
  });

  it('Üst Yönetici (0) token üretebilir → 200 + token + eski token revoke edilir', async () => {
    mockKioskService.createKioskToken.mockResolvedValueOnce({
      token: 'signed.jwt.token',
      kioskUrl: '/kiosk/room-1',
    });

    const res = await request
      .post('/api/kiosk-admin/rooms/room-1/token')
      .set('Authorization', `Bearer ${tok(0)}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.data.token).toBe('string');
    expect(res.body.data.kioskUrl).toBe('/kiosk/room-1');

    // createKioskToken, eski aktif token'ı revoke edip yenisini üreten tek giriş
    // noktası (bkz. kiosk.service.js) — bu çağrının doğru institutionId/roomId ile
    // yapıldığının doğrulanması, revoke+create akışının tetiklendiğini gösterir.
    expect(mockKioskService.createKioskToken).toHaveBeenCalledWith('inst-1', 'room-1');
  });

  it('başka kuruma ait oda (cross-tenant) → servis 404 statusCode ile reddeder, route 404 döner', async () => {
    mockKioskService.createKioskToken.mockRejectedValueOnce(
      Object.assign(new Error('Oda bulunamadı'), { statusCode: 404 })
    );

    const res = await request
      .post('/api/kiosk-admin/rooms/other-institutions-room/token')
      .set('Authorization', `Bearer ${tok(0)}`);

    expect(res.status).toBe(404);
  });
});

describe('POST /api/kiosk-admin/rooms/:roomId/token/revoke', () => {
  it('hemşire (4) token iptal edemez → 403', async () => {
    const res = await request
      .post('/api/kiosk-admin/rooms/room-1/token/revoke')
      .set('Authorization', `Bearer ${tok(4)}`);
    expect(res.status).toBe(403);
    expect(mockKioskService.revokeKioskToken).not.toHaveBeenCalled();
  });

  it('Üst Yönetici (0) token iptal edebilir → 200', async () => {
    mockKioskService.revokeKioskToken.mockResolvedValueOnce(undefined);
    const res = await request
      .post('/api/kiosk-admin/rooms/room-1/token/revoke')
      .set('Authorization', `Bearer ${tok(0)}`);
    expect(res.status).toBe(200);
    // revokeKioskToken artık institutionId de alıyor (cross-tenant koruması için) —
    // route req.user.institutionId'yi ilk argüman olarak geçirmeli.
    expect(mockKioskService.revokeKioskToken).toHaveBeenCalledWith('inst-1', 'room-1');
  });

  it('başka kuruma ait oda (cross-tenant) → servis 404 statusCode ile reddeder, route 404 döner', async () => {
    mockKioskService.revokeKioskToken.mockRejectedValueOnce(
      Object.assign(new Error('Oda bulunamadı'), { statusCode: 404 })
    );

    const res = await request
      .post('/api/kiosk-admin/rooms/other-institutions-room/token/revoke')
      .set('Authorization', `Bearer ${tok(0)}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /api/kiosk-admin/mock-config', () => {
  it('token yok → 401', async () => {
    const res = await request.get('/api/kiosk-admin/mock-config');
    expect(res.status).toBe(401);
  });

  it('Üst Yönetici (0) mevcut konfigürasyonu okuyabilir → 200', async () => {
    mockKioskService.getMockConfig.mockResolvedValueOnce({ mode: 'always_match', cycleIndex: 0 });
    const res = await request
      .get('/api/kiosk-admin/mock-config')
      .set('Authorization', `Bearer ${tok(0)}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ mode: 'always_match', cycleIndex: 0 });
  });
});

describe('PUT /api/kiosk-admin/mock-config', () => {
  it('geçersiz mode → 400 (zod)', async () => {
    const res = await request
      .put('/api/kiosk-admin/mock-config')
      .set('Authorization', `Bearer ${tok(0)}`)
      .send({ mode: 'not_a_real_mode' });
    expect(res.status).toBe(400);
    expect(mockKioskService.setMockConfig).not.toHaveBeenCalled();
  });

  it('geçerli mode → 200', async () => {
    mockKioskService.setMockConfig.mockResolvedValueOnce({ mode: 'cycle', cycleIndex: 0 });
    const res = await request
      .put('/api/kiosk-admin/mock-config')
      .set('Authorization', `Bearer ${tok(0)}`)
      .send({ mode: 'cycle' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ mode: 'cycle', cycleIndex: 0 });
    expect(mockKioskService.setMockConfig).toHaveBeenCalledWith('inst-1', 'cycle');
  });

  // Final whole-branch review finding #2: mockConfigSchema'nın zod enum'u
  // sadece 4 demo modunu listeliyordu — migration'ın kiosk_mock_config.mode
  // CHECK kısıtı 'real'i kabul etse de, admin API bunu 400 ile reddediyordu
  // (gerçek mod sadece elle SQL ile açılabiliyordu).
  it("mode: 'real' → 200 (migration'ın CHECK kısıtıyla aynı 5. değer artık zod'da da kabul ediliyor)", async () => {
    mockKioskService.setMockConfig.mockResolvedValueOnce({ mode: 'real', cycleIndex: 0 });
    const res = await request
      .put('/api/kiosk-admin/mock-config')
      .set('Authorization', `Bearer ${tok(0)}`)
      .send({ mode: 'real' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ mode: 'real', cycleIndex: 0 });
    expect(mockKioskService.setMockConfig).toHaveBeenCalledWith('inst-1', 'real');
  });
});
