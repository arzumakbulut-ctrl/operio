import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import registry from '../../src/services/_registry.js';
import { signKioskToken } from '../../src/utils/kioskJwt.js';
import app from '../../src/app.js';

const request = supertest(app);

// kioskRoomAuth'un gerçek zinciri çalışır (supertest + gerçek app). Sadece 'kiosk' ve
// 'module' servisleri registry üzerinden mock'lanır (kioskVoiceCommand.timeout.test.js ile aynı desen).
const mockKioskService = {
  isTokenRevoked: vi.fn(),
  getActiveSurgeryForRoom: vi.fn(),
};
const mockModuleService = { hasActiveModule: vi.fn() };

const activeSurgery = {
  id: 'surgery-1',
  surgeryTeams: [
    { userId: 'user-1', fullName: 'Ayşe Yılmaz', roleId: 6, teamRole: 'cerrah' },
  ],
};

function authHeader(roomId = 'room-1') {
  const token = signKioskToken({ institutionId: 'inst-1', roomId, jti: 'jti-1' });
  return `Bearer ${token}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  registry.register('kiosk', mockKioskService);
  registry.register('module', mockModuleService);
  mockKioskService.isTokenRevoked.mockResolvedValue(false);
  mockModuleService.hasActiveModule.mockResolvedValue(true);
  mockKioskService.getActiveSurgeryForRoom.mockResolvedValue(activeSurgery);
});

describe('GET /api/kiosk/rooms/:roomId/status', () => {
  it('(a) modül aktif ve odada IN_PROGRESS ameliyat varsa → 200 { active: true, surgeryId }', async () => {
    const res = await request
      .get('/api/kiosk/rooms/room-1/status')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { active: true, surgeryId: 'surgery-1' },
    });
  });

  it('(b) odada aktif ameliyat yoksa → 409 (kioskRoomAuth davranışı, route yeni bir 409 üretmez)', async () => {
    mockKioskService.getActiveSurgeryForRoom.mockResolvedValueOnce(null);

    const res = await request
      .get('/api/kiosk/rooms/room-1/status')
      .set('Authorization', authHeader());

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('no_active_surgery');
  });

  it('(c) /api/kiosk/* genel IP-bazlı 100/15dk limitten muaf — kendi jti-bazlı (300/15dk) limitini kullanır', async () => {
    // Genel limiti (100) aşacak kadar yoklama: hiçbiri 429 almamalı.
    const statuses = [];
    for (let i = 0; i < 110; i++) {
      const res = await request
        .get('/api/kiosk/rooms/room-1/status')
        .set('Authorization', authHeader());
      statuses.push(res.status);
    }
    expect(statuses.every(s => s === 200)).toBe(true);

    // Standart RateLimit-Limit başlığı genel limiti (100) değil, kiosk limitini (300) gösterir.
    const last = await request
      .get('/api/kiosk/rooms/room-1/status')
      .set('Authorization', authHeader());
    expect(last.headers['ratelimit-limit']).toBe('300');
  });
});
