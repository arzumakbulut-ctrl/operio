import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import registry from '../../src/services/_registry.js';
import { signKioskToken } from '../../src/utils/kioskJwt.js';
import app from '../../src/app.js';

const request = supertest(app);

// 'kiosk' ve 'device' servisleri registry üzerinden mock'lanır (device.routes.js /
// kioskVoiceCommand.timeout.test.js'teki desenle aynı). kioskSpeakerAuth kendi içinde
// getKioskService().getMockConfig() + MockSpeakerVerifier kullanır — burada 'always_match'
// moduna sokup ilk candidate'in (speaker-1) tanınmasını sağlıyoruz.
const mockKioskService = {
  isTokenRevoked: vi.fn(),
  getActiveSurgeryForRoom: vi.fn(),
  getMockConfig: vi.fn(),
  incrementMockCycleIndex: vi.fn(),
};
const mockModuleService = { hasActiveModule: vi.fn() };
const mockDeviceService = {
  listDevices: vi.fn(),
  executeCommand: vi.fn(),
};

const activeSurgery = {
  id: 'surgery-1',
  surgeryTeams: [
    { userId: 'speaker-1', fullName: 'Ayşe Yılmaz', roleId: 6, teamRole: 'cerrah' },
  ],
};

const koterDevice = { id: 'dev-koter', device_group: 'electrosurgery', room_id: 'room-1' };
const tableDevice = { id: 'dev-table', device_group: 'table', room_id: 'room-1' };

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
  registry.register('device', mockDeviceService);
  mockKioskService.isTokenRevoked.mockResolvedValue(false);
  mockModuleService.hasActiveModule.mockResolvedValue(true);
  mockKioskService.getActiveSurgeryForRoom.mockResolvedValue(activeSurgery);
  mockKioskService.getMockConfig.mockResolvedValue({ mode: 'always_match', cycleIndex: 0 });
  mockDeviceService.listDevices.mockResolvedValue([koterDevice, tableDevice]);
});

describe('POST /api/kiosk/rooms/:roomId/voice-command — DEVICE_COMMAND', () => {
  it('(a) ilk çağrı (confirmationPhrase yok) → kioskSpeakerAuth geçer → 200 + pending_confirmation + phrase', async () => {
    const res = await sendVoiceCommand({ transcript: 'koteri aç' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('pending_confirmation');
    expect(res.body.data.phrase).toMatch(/^\d-\d-\d$/);
    expect(mockDeviceService.executeCommand).not.toHaveBeenCalled();
  });

  it('(b) ikinci çağrı, aynı roomId + doğru confirmationPhrase + aynı transcript → executeCommand doğru parametrelerle çağrılır → 200', async () => {
    const first = await sendVoiceCommand({ transcript: 'koteri aç' });
    const { phrase } = first.body.data;

    mockDeviceService.executeCommand.mockResolvedValueOnce({ id: 'dev-koter', power_state: 'ON' });

    const second = await sendVoiceCommand({ transcript: 'koteri aç', confirmationPhrase: phrase });

    expect(second.status).toBe(200);
    expect(mockDeviceService.executeCommand).toHaveBeenCalledWith({
      deviceId: 'dev-koter',
      institutionId: 'inst-1',
      userId: 'speaker-1',
      roleId: 6,
      action: 'turn_on',
      value: undefined,
      req: expect.anything(),
    });
    expect(second.body.data.device).toEqual({ id: 'dev-koter', power_state: 'ON' });
  });

  it('(c) ikinci çağrıda YANLIŞ confirmationPhrase → 400 {code: "confirmation_mismatch"}, executeCommand ÇAĞRILMAZ', async () => {
    const first = await sendVoiceCommand({ transcript: 'koteri aç' });
    const { phrase } = first.body.data;
    const wrongPhrase = phrase === '0-0-0' ? '1-0-0' : '0-0-0';

    const second = await sendVoiceCommand({ transcript: 'koteri aç', confirmationPhrase: wrongPhrase });

    expect(second.status).toBe(400);
    expect(second.body.error.code).toBe('confirmation_mismatch');
    expect(mockDeviceService.executeCommand).not.toHaveBeenCalled();
  });

  it('(d) masa (table) grubu → her zaman action: arm_move, turn_on/off asla, değer verilmese de null geçer', async () => {
    const first = await sendVoiceCommand({ transcript: 'masayı aç' });
    const { phrase } = first.body.data;

    mockDeviceService.executeCommand.mockResolvedValueOnce({ id: 'dev-table', power_state: 'ARMED' });

    await sendVoiceCommand({ transcript: 'masayı aç', confirmationPhrase: phrase });

    expect(mockDeviceService.executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: 'dev-table', action: 'arm_move', value: null })
    );
  });

  it('(e) masa grubu + sayısal değer söylenirse bile action hâlâ arm_move kalır (set_power asla)', async () => {
    const first = await sendVoiceCommand({ transcript: 'masayı 45 derece kaldır' });
    const { phrase } = first.body.data;

    mockDeviceService.executeCommand.mockResolvedValueOnce({ id: 'dev-table', power_state: 'ARMED' });

    await sendVoiceCommand({ transcript: 'masayı 45 derece kaldır', confirmationPhrase: phrase });

    expect(mockDeviceService.executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: 'dev-table', action: 'arm_move', value: 45 })
    );
  });

  it('(f) sayısal değerli komut (koter 50) → action: set_power, value: 50', async () => {
    const first = await sendVoiceCommand({ transcript: 'koteri 50 yap' });
    const { phrase } = first.body.data;

    mockDeviceService.executeCommand.mockResolvedValueOnce({ id: 'dev-koter', power_state: 'ON' });

    await sendVoiceCommand({ transcript: 'koteri 50 yap', confirmationPhrase: phrase });

    expect(mockDeviceService.executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: 'dev-koter', action: 'set_power', value: 50 })
    );
  });

  it('(g) "kapat" transcript → action: turn_off', async () => {
    const first = await sendVoiceCommand({ transcript: 'koteri kapat' });
    const { phrase } = first.body.data;

    mockDeviceService.executeCommand.mockResolvedValueOnce({ id: 'dev-koter', power_state: 'OFF' });

    await sendVoiceCommand({ transcript: 'koteri kapat', confirmationPhrase: phrase });

    expect(mockDeviceService.executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: 'dev-koter', action: 'turn_off' })
    );
  });

  it('(h) eylem ayrıştırılamazsa (aç/kapat/sayı yok) → 200 "anlayamadım" fallback, pending_confirmation OLUŞMAZ', async () => {
    const res = await sendVoiceCommand({ transcript: 'koter ile bir şey yapalım' });

    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe('DEVICE_COMMAND');
    expect(res.body.data.say).toMatch(/anlayamadım/i);
    expect(res.body.data.status).toBeUndefined();
    expect(mockDeviceService.listDevices).not.toHaveBeenCalled();
  });

  it('(i) odada eşleşen cihaz yoksa → handleCommandError üzerinden 403 device_not_found', async () => {
    mockDeviceService.listDevices.mockResolvedValueOnce([]);

    const res = await sendVoiceCommand({ transcript: 'koteri aç' });

    expect(res.status).toBe(403);
  });

  it('(j) kioskSpeakerAuth konuşmacıyı tanıyamazsa (always_unrecognized) → 403 unrecognized, cihaz servisine hiç gidilmez', async () => {
    mockKioskService.getMockConfig.mockResolvedValueOnce({ mode: 'always_unrecognized', cycleIndex: 0 });

    const res = await sendVoiceCommand({ transcript: 'koteri aç' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('unrecognized');
    expect(mockDeviceService.listDevices).not.toHaveBeenCalled();
  });
});
