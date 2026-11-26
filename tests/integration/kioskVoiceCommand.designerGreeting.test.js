import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import supertest from 'supertest';
import registry from '../../src/services/_registry.js';
import { signKioskToken } from '../../src/utils/kioskJwt.js';
import app from '../../src/app.js';

const require = createRequire(import.meta.url);
const { RealSpeakerVerifier } = require('../../src/drivers/RealSpeakerVerifier.js');
const { GREETING_POOL } = require('../../src/utils/designerGreeting.js');

const request = supertest(app);
const DESIGNER_ID = 'designer-1';

const mockKioskService = {
  isTokenRevoked: vi.fn(),
  getActiveSurgeryForRoom: vi.fn(),
  getMockConfig: vi.fn(),
  incrementMockCycleIndex: vi.fn(),
};
const mockModuleService = { hasActiveModule: vi.fn() };

const activeSurgery = {
  id: 'surgery-1',
  surgeryTeams: [{ userId: 'speaker-1', fullName: 'Ayşe Yılmaz', roleId: 6, teamRole: 'cerrah' }],
};

function authHeader(roomId = 'room-1') {
  const token = signKioskToken({ institutionId: 'inst-1', roomId, jti: 'jti-1' });
  return `Bearer ${token}`;
}

function sendVoiceCommand(body, roomId = 'room-1') {
  return request
    .post(`/api/kiosk/rooms/${roomId}/voice-command`)
    .set('Authorization', authHeader(roomId))
    .send({ audio: 'base64-audio-stub', ...body });
}

beforeEach(() => {
  vi.clearAllMocks();
  registry.register('kiosk', mockKioskService);
  registry.register('module', mockModuleService);
  mockKioskService.isTokenRevoked.mockResolvedValue(false);
  mockModuleService.hasActiveModule.mockResolvedValue(true);
  mockKioskService.getActiveSurgeryForRoom.mockResolvedValue(activeSurgery);
  process.env.DESIGNER_USER_ID = DESIGNER_ID;
});

afterEach(() => {
  delete process.env.DESIGNER_USER_ID;
});

describe('POST /api/kiosk/rooms/:roomId/voice-command — designer greeting', () => {
  it('(a) mode "real" + identify() designer ile eşleşirse → 200, type GREETING, say havuzdan', async () => {
    mockKioskService.getMockConfig.mockResolvedValueOnce({ mode: 'real' });
    const spy = vi
      .spyOn(RealSpeakerVerifier.prototype, 'identify')
      .mockResolvedValueOnce({ userId: DESIGNER_ID, confidence: 0.9 });

    // Kendi izole odası: kiosk.routes.js'teki ardışık-UNKNOWN sayacı (UNKNOWN_STREAK)
    // roomId'ye göre tutulur ve test dosyası boyunca modül-seviyesinde paylaşılır
    // (bkz. kioskVoiceCommand.timeout.test.js'teki (e)/(l)/(m) testlerinin aynı
    // sebeple kendi izole odalarını kullanması) — bu yüzden her test burada da
    // kendi roomId'sini kullanır, sıradaki testlerin sayaç durumunu kirletmemek için.
    const res = await sendVoiceCommand({ transcript: 'naber' }, 'room-designer-a');

    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe('GREETING');
    expect(GREETING_POOL).toContain(res.body.data.say);
    spy.mockRestore();
  });

  it('(b) mode "always_match" olsa bile designer selamlaması TETİKLENMEZ → normal UNKNOWN', async () => {
    mockKioskService.getMockConfig.mockResolvedValueOnce({ mode: 'always_match', cycleIndex: 0 });
    const spy = vi.spyOn(RealSpeakerVerifier.prototype, 'identify');

    const res = await sendVoiceCommand({ transcript: 'naber' }, 'room-designer-b');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ type: 'UNKNOWN', say: 'Anlayamadım, tekrar söyler misiniz?' });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('(c) mode "real" ama identify() null dönerse → normal UNKNOWN, 403 FIRLATILMAZ', async () => {
    mockKioskService.getMockConfig.mockResolvedValueOnce({ mode: 'real' });
    const spy = vi.spyOn(RealSpeakerVerifier.prototype, 'identify').mockResolvedValueOnce(null);

    const res = await sendVoiceCommand({ transcript: 'naber' }, 'room-designer-c');

    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe('UNKNOWN');
    spy.mockRestore();
  });

  it('(d) selamlama UNKNOWN_STREAK\'i sıfırlar — bir ardışık "anlaşılamadı" serisini BOZAR', async () => {
    const roomId = 'room-designer-d';
    mockKioskService.getMockConfig
      .mockResolvedValueOnce({ mode: 'always_unrecognized', cycleIndex: 0 }) // 1: gerçek UNKNOWN, streak=1
      .mockResolvedValueOnce({ mode: 'real' })                               // 2: designer selamlanır
      .mockResolvedValueOnce({ mode: 'always_unrecognized', cycleIndex: 0 }); // 3: streak YENİDEN 1 olmalı
    const spy = vi
      .spyOn(RealSpeakerVerifier.prototype, 'identify')
      .mockResolvedValueOnce({ userId: DESIGNER_ID, confidence: 0.9 });

    const first = await sendVoiceCommand({ transcript: 'xyzzy' }, roomId);
    expect(first.body.data.say).toBe('Anlayamadım, tekrar söyler misiniz?');

    const second = await sendVoiceCommand({ transcript: 'naber' }, roomId);
    expect(second.body.data.type).toBe('GREETING');

    const third = await sendVoiceCommand({ transcript: 'xyzzy' }, roomId);
    expect(third.body.data.say).toBe('Anlayamadım, tekrar söyler misiniz?'); // HÂLÂ 1. seviye

    spy.mockRestore();
  });

  it('(e) DESIGNER_USER_ID ayarlanmamışsa davranış tamamen eskisi gibidir', async () => {
    delete process.env.DESIGNER_USER_ID;
    mockKioskService.getMockConfig.mockResolvedValueOnce({ mode: 'real' });

    const res = await sendVoiceCommand({ transcript: 'naber' }, 'room-designer-e');

    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe('UNKNOWN');
  });
});
