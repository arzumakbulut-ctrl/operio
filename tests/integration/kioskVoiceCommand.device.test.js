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
  it('(a) ilk çağrı (confirmationAnswer yok) → kioskSpeakerAuth geçer → 200 + pending_confirmation + doğal dil soru (rakam yok)', async () => {
    const res = await sendVoiceCommand({ transcript: 'koteri aç' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('pending_confirmation');
    // Artık rakam-bazlı bir phrase alanı YOK — soru addressSpeaker (hitap) +
    // describeDeviceAction (eylem açıklaması) ile doğal dilde kurulur.
    expect(res.body.data.phrase).toBeUndefined();
    // Final whole-branch review finding #6: "istiyorsunuz" eklendi (eski metin
    // dilbilgisel olarak eksikti — tasarım dokümanının örneğiyle hizalandı).
    expect(res.body.data.say).toBe('Ayşe hocam, koteri açmamı istiyorsunuz, doğru mu?');
    expect(mockDeviceService.executeCommand).not.toHaveBeenCalled();
  });

  it('(b) ikinci çağrı, confirmationAnswer: "evet" + aynı transcript → executeCommand doğru parametrelerle çağrılır → 200', async () => {
    await sendVoiceCommand({ transcript: 'koteri aç' });

    mockDeviceService.executeCommand.mockResolvedValueOnce({ id: 'dev-koter', power_state: 'ON' });

    const second = await sendVoiceCommand({ transcript: 'koteri aç', confirmationAnswer: 'evet' });

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

  it('(c) bekleyen onay yokken (hiç ilk çağrı yapılmamış/süresi geçmiş) confirmationAnswer gönderilirse → 400 {code: "confirmation_mismatch"}, executeCommand ÇAĞRILMAZ', async () => {
    const res = await sendVoiceCommand({ transcript: 'evet', confirmationAnswer: 'evet' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('confirmation_mismatch');
    expect(mockDeviceService.executeCommand).not.toHaveBeenCalled();
  });

  it('(c2) "hayır" cevabı komut iptal edildi mesajıyla sonuçlanır, executeCommand ÇAĞRILMAZ', async () => {
    await sendVoiceCommand({ transcript: 'koteri aç' });

    const second = await sendVoiceCommand({ transcript: 'hayır', confirmationAnswer: 'hayır' });

    expect(second.status).toBe(200);
    expect(second.body.data).toEqual({ type: 'DEVICE_COMMAND', say: 'Komut iptal edildi.' });
    expect(mockDeviceService.executeCommand).not.toHaveBeenCalled();
  });

  it('(c3) anlaşılmaz bir cevap sessizce pending_confirmation\'a döner (say boş/null, executeCommand ÇAĞRILMAZ)', async () => {
    await sendVoiceCommand({ transcript: 'koteri aç' });

    const second = await sendVoiceCommand({ transcript: 'ne diyorsun', confirmationAnswer: 'ne diyorsun' });

    expect(second.status).toBe(200);
    expect(second.body.data).toEqual({ type: 'DEVICE_COMMAND', status: 'pending_confirmation', say: null });
    expect(mockDeviceService.executeCommand).not.toHaveBeenCalled();
  });

  it('(d) masa (table) grubu + kapat/durdur DIŞI ifade ("masayı aç") → action: arm_move (turn_on asla), değer verilmese de null; yanıt hareketin henüz OLMADIĞINI söyler', async () => {
    await sendVoiceCommand({ transcript: 'masayı aç' });

    mockDeviceService.executeCommand.mockResolvedValueOnce({ id: 'dev-table', power_state: 'ARMED' });

    const second = await sendVoiceCommand({ transcript: 'masayı aç', confirmationAnswer: 'evet' });

    expect(mockDeviceService.executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: 'dev-table', action: 'arm_move', value: null })
    );
    expect(second.status).toBe(200);
    expect(second.body.data.say).toBe('Masa hazırlandı, konsoldan fiziksel onay bekleniyor.');
  });

  it.each(['masayı kapat', 'masayı durdur'])(
    '(d2) masa (table) + "%s" → action: turn_off (hareket yok, güvenli disarm), jenerik başarı mesajı',
    async (transcript) => {
      await sendVoiceCommand({ transcript });

      mockDeviceService.executeCommand.mockResolvedValueOnce({ id: 'dev-table', power_state: 'OFF' });

      const second = await sendVoiceCommand({ transcript, confirmationAnswer: 'evet' });

      expect(mockDeviceService.executeCommand).toHaveBeenCalledWith(
        expect.objectContaining({ deviceId: 'dev-table', action: 'turn_off' })
      );
      expect(second.status).toBe(200);
      expect(second.body.data.say).toBe('Komut uygulandı.');
    }
  );

  it('(e) masa grubu + sayısal değer söylenirse bile action hâlâ arm_move kalır (set_power asla)', async () => {
    await sendVoiceCommand({ transcript: 'masayı 45 derece kaldır' });

    mockDeviceService.executeCommand.mockResolvedValueOnce({ id: 'dev-table', power_state: 'ARMED' });

    await sendVoiceCommand({ transcript: 'masayı 45 derece kaldır', confirmationAnswer: 'evet' });

    expect(mockDeviceService.executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: 'dev-table', action: 'arm_move', value: 45 })
    );
  });

  it('(f) sayısal değerli komut (koter 50) → action: set_power, value: 50', async () => {
    await sendVoiceCommand({ transcript: 'koteri 50 yap' });

    mockDeviceService.executeCommand.mockResolvedValueOnce({ id: 'dev-koter', power_state: 'ON' });

    await sendVoiceCommand({ transcript: 'koteri 50 yap', confirmationAnswer: 'evet' });

    expect(mockDeviceService.executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: 'dev-koter', action: 'set_power', value: 50 })
    );
  });

  it('(g) "kapat" transcript → action: turn_off', async () => {
    await sendVoiceCommand({ transcript: 'koteri kapat' });

    mockDeviceService.executeCommand.mockResolvedValueOnce({ id: 'dev-koter', power_state: 'OFF' });

    await sendVoiceCommand({ transcript: 'koteri kapat', confirmationAnswer: 'evet' });

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

describe('POST /api/kiosk/rooms/:roomId/voice-command — gerçekçi istemci onay döngüsü', () => {
  // Gerçek kiosk istemcisi onay çağrısında transcript olarak kullanıcının söylediği
  // serbest metni, confirmationAnswer'da ise ayrıştırılmış evet/hayır cevabını gönderir.
  // confirmationAnswer varken route parseIntent'i hiç çalıştırmamalı — transcript'in
  // içeriği (UNKNOWN'a ya da başka bir niyete ayrışsa da) yönlendirmeyi etkilemez.
  it.each([
    ['dört yedi iki', 'Türkçe sayı kelimeleri (tek başına UNKNOWN)'],
    ['472', 'bitişik rakamlar (tek başına UNKNOWN)'],
    ['Operio time-out', 'başka bir niyete (TIMEOUT) ayrışan metin'],
  ])('(k) ikinci çağrı transcript="%s" (%s) + confirmationAnswer: "evet" → komut yine uygulanır', async (confirmTranscript) => {
    await sendVoiceCommand({ transcript: 'koteri aç' });

    mockDeviceService.executeCommand.mockResolvedValueOnce({ id: 'dev-koter', power_state: 'ON' });

    const second = await sendVoiceCommand({ transcript: confirmTranscript, confirmationAnswer: 'evet' });

    expect(second.status).toBe(200);
    expect(second.body.data.type).toBe('DEVICE_COMMAND');
    expect(second.body.data.say).toBe('Komut uygulandı.');
    expect(mockDeviceService.executeCommand).toHaveBeenCalledWith({
      deviceId: 'dev-koter',
      institutionId: 'inst-1',
      userId: 'speaker-1',
      roleId: 6,
      action: 'turn_on',
      value: undefined,
      req: expect.anything(),
    });
  });

  it('(l) "evet" yerine eş anlamlı bir onay kelimesi ("tamam") gelirse → yine confirmed sayılır', async () => {
    await sendVoiceCommand({ transcript: 'koteri aç' });

    mockDeviceService.executeCommand.mockResolvedValueOnce({ id: 'dev-koter', power_state: 'ON' });

    const second = await sendVoiceCommand({ transcript: 'tamam', confirmationAnswer: 'tamam' });

    expect(second.status).toBe(200);
    expect(mockDeviceService.executeCommand).toHaveBeenCalledTimes(1);
  });

  it('(m) onay çağrısında FARKLI bir ekip üyesi tanınırsa (cycle modu) → unresolved olarak ele alınır (200 pending_confirmation, say: null), executeCommand ÇAĞRILMAZ; entry silinmez, asıl başlatan hâlâ onaylayabilir', async () => {
    mockKioskService.getActiveSurgeryForRoom.mockResolvedValue({
      id: 'surgery-1',
      surgeryTeams: [
        { userId: 'speaker-1', fullName: 'Ayşe Yılmaz', roleId: 6, teamRole: 'cerrah' },
        { userId: 'speaker-2', fullName: 'Fatma Demir', roleId: 7, teamRole: 'scrub' },
      ],
    });
    // 1. çağrı: cycleIndex 0 → speaker-1 başlatır; 2. çağrı: cycleIndex 1 → speaker-2
    // onaylamaya çalışır; 3. çağrı: cycleIndex 2 → tekrar speaker-1.
    mockKioskService.getMockConfig
      .mockResolvedValueOnce({ mode: 'cycle', cycleIndex: 0 })
      .mockResolvedValueOnce({ mode: 'cycle', cycleIndex: 1 })
      .mockResolvedValueOnce({ mode: 'cycle', cycleIndex: 2 });

    const first = await sendVoiceCommand({ transcript: 'koteri aç' });
    expect(first.body.data.status).toBe('pending_confirmation');

    const other = await sendVoiceCommand({ transcript: 'evet', confirmationAnswer: 'evet' });
    expect(other.status).toBe(200);
    expect(other.body.data).toEqual({ type: 'DEVICE_COMMAND', status: 'pending_confirmation', say: null });
    expect(mockDeviceService.executeCommand).not.toHaveBeenCalled();

    // Bekleyen onay silinmedi — asıl başlatan (speaker-1) TTL içinde hâlâ onaylayabilir.
    mockDeviceService.executeCommand.mockResolvedValueOnce({ id: 'dev-koter', power_state: 'ON' });
    const genuine = await sendVoiceCommand({ transcript: 'evet', confirmationAnswer: 'evet' });
    expect(genuine.status).toBe(200);
    expect(mockDeviceService.executeCommand).toHaveBeenCalledTimes(1);
    expect(mockDeviceService.executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'speaker-1', action: 'turn_on' })
    );
  });

  it('(n) audio: null ile DEVICE_COMMAND → 400 DEĞİL; konuşmacı tanıma çökmeden çalışır → pending_confirmation', async () => {
    const res = await sendVoiceCommand({ transcript: 'koteri aç', audio: null });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('pending_confirmation');
    expect(mockKioskService.getMockConfig).toHaveBeenCalled();
  });

  it('(o) audio: null ile onay çağrısı da çalışır', async () => {
    await sendVoiceCommand({ transcript: 'koteri aç', audio: null });
    mockDeviceService.executeCommand.mockResolvedValueOnce({ id: 'dev-koter', power_state: 'ON' });

    const second = await sendVoiceCommand({ transcript: 'evet', confirmationAnswer: 'evet', audio: null });

    expect(second.status).toBe(200);
    expect(mockDeviceService.executeCommand).toHaveBeenCalledTimes(1);
  });

  it('(p) onay çağrısında konuşmacı tanınamazsa (always_unrecognized) → 403 unrecognized, executeCommand ÇAĞRILMAZ', async () => {
    await sendVoiceCommand({ transcript: 'koteri aç' });
    mockKioskService.getMockConfig.mockResolvedValueOnce({ mode: 'always_unrecognized', cycleIndex: 0 });

    const second = await sendVoiceCommand({ transcript: 'evet', confirmationAnswer: 'evet' });

    expect(second.status).toBe(403);
    expect(second.body.error.code).toBe('unrecognized');
    expect(mockDeviceService.executeCommand).not.toHaveBeenCalled();
  });
});
