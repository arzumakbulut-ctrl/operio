import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import registry from '../../src/services/_registry.js';
import { signKioskToken } from '../../src/utils/kioskJwt.js';
import app from '../../src/app.js';

const request = supertest(app);

// 'kiosk' servisi registry üzerinden mock'lanır (device.routes.js/kioskAdmin.routes.js'teki
// desenle aynı). Not: audit() gerçek implementasyonda kiosk.service.recordTimeoutRead()
// içinden çağrılır (bkz. src/services/kiosk.service.js) — routes.js audit()'i DOĞRUDAN
// çağırmaz, çünkü bu projede audit() her zaman servis katmanından yazılır (device.service.js,
// surgery.service.js vb. ile aynı konvansiyon). Bu yüzden burada recordTimeoutRead'in doğru
// argümanlarla çağrıldığını doğruluyoruz — services/kiosk.service.js'in audit()'i doğru
// çağırdığı okuyarak teyit edilebilir (basit, tek satırlık bir sarmalayıcı).
const mockKioskService = {
  isTokenRevoked: vi.fn(),
  getActiveSurgeryForRoom: vi.fn(),
  recordTimeoutRead: vi.fn(),
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
  mockKioskService.recordTimeoutRead.mockResolvedValue(undefined);
});

describe('POST /api/kiosk/rooms/:roomId/voice-command', () => {
  it('(a) TIMEOUT transcript ("time-out") → 200 + iki sabit Türkçe SKS maddesi + recordTimeoutRead çağrılır', async () => {
    const res = await request
      .post('/api/kiosk/rooms/room-1/voice-command')
      .set('Authorization', authHeader())
      .send({ transcript: 'Operio time-out', audio: 'base64-audio-stub' });

    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe('TIMEOUT');
    expect(res.body.data.say).toEqual([
      'Ekipteki kişiler kendilerini ad, soyad ve görevleri ile tanıttı mı?',
      'Ekipten bir kişi sesli olarak hastanın kimliğini, yapılan ameliyatı, ameliyat bölgesini teyit etti mi?',
    ]);

    // recordTimeoutRead → kiosk.service.js içinde audit({ userId: null,
    // action: 'voice:timeout_read', resource: 'surgeries', resourceId, req }) çağırır.
    expect(mockKioskService.recordTimeoutRead).toHaveBeenCalledWith(expect.objectContaining({
      surgeryId: 'surgery-1',
    }));
  });

  it('(b) TIMEOUT transcript (Türkçe eşanlamlı "zaman aşımı") → 200 TIMEOUT', async () => {
    const res = await request
      .post('/api/kiosk/rooms/room-1/voice-command')
      .set('Authorization', authHeader())
      .send({ transcript: 'operio zaman aşımı', audio: 'base64-audio-stub' });

    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe('TIMEOUT');
  });

  it('(c) TIMEOUT req.speaker doğrulaması gerektirmez — konuşmacı servisi hiç kayıtlı olmadan bile 200 döner', async () => {
    // Kasıtlı olarak 'speaker'/voice-identify servisi registry'e kayıtlı DEĞİL —
    // TIMEOUT dalı kioskSpeakerAuth'u hiç kullanmadığından istek yine de başarılı olmalı.
    const res = await request
      .post('/api/kiosk/rooms/room-1/voice-command')
      .set('Authorization', authHeader())
      .send({ transcript: 'time out', audio: 'base64-audio-stub' });

    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe('TIMEOUT');
  });

  it('(d) UNKNOWN — çok kısa transcript (< 3 karakter) → 200 + say dolu, recordTimeoutRead ÇAĞRILMAZ', async () => {
    const res = await request
      .post('/api/kiosk/rooms/room-1/voice-command')
      .set('Authorization', authHeader())
      .send({ transcript: 'ha', audio: 'base64-audio-stub' });

    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe('UNKNOWN');
    expect(res.body.data.say).toBe('Anlayamadım, tekrar söyler misiniz?');
    expect(mockKioskService.recordTimeoutRead).not.toHaveBeenCalled();
  });

  it('(e) UNKNOWN — hiçbir anahtar kelimeyle eşleşmeyen transcript → 200 + say dolu', async () => {
    const res = await request
      .post('/api/kiosk/rooms/room-1/voice-command')
      .set('Authorization', authHeader())
      .send({ transcript: 'asdasd zzz qqq', audio: 'base64-audio-stub' });

    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe('UNKNOWN');
    expect(res.body.data.say).toBe('Anlayamadım, tekrar söyler misiniz?');
  });

  it('(f) kiosk token yoksa 401 döner (kioskRoomAuth zinciri çalışıyor)', async () => {
    const res = await request
      .post('/api/kiosk/rooms/room-1/voice-command')
      .send({ transcript: 'time-out', audio: 'base64-audio-stub' });

    expect(res.status).toBe(401);
    expect(mockKioskService.recordTimeoutRead).not.toHaveBeenCalled();
  });

  it('(g) odada aktif ameliyat yoksa 409 döner (kioskRoomAuth zinciri çalışıyor)', async () => {
    mockKioskService.getActiveSurgeryForRoom.mockResolvedValueOnce(null);

    const res = await request
      .post('/api/kiosk/rooms/room-1/voice-command')
      .set('Authorization', authHeader())
      .send({ transcript: 'time-out', audio: 'base64-audio-stub' });

    expect(res.status).toBe(409);
  });

  it('(h) transcript alanı eksikse 400 döner (zod doğrulama)', async () => {
    const res = await request
      .post('/api/kiosk/rooms/room-1/voice-command')
      .set('Authorization', authHeader())
      .send({ audio: 'base64-audio-stub' });

    expect(res.status).toBe(400);
  });
});
