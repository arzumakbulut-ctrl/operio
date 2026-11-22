import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import registry from '../../src/services/_registry.js';
import { signKioskToken } from '../../src/utils/kioskJwt.js';
import app from '../../src/app.js';

const request = supertest(app);

/**
 * 'kiosk'/'module'/'ai' servisleri registry üzerinden mock'lanır (diğer kiosk
 * entegrasyon testleriyle aynı desen — bkz. kioskVoiceCommand.spotify.test.js).
 * 'ai' YENİ bir registry key'dir (bu task'ta eklendi) — kiosk.routes.js'in
 * WEB_SEARCH dalı registry.get('ai', () => require('../services/ai.service'))
 * ile gerçek ai.service.js'i alır; burada mock'lanarak GERÇEK Claude API
 * çağrısı/ağ isteği yapılmaması garanti edilir.
 *
 * audit() DOĞRUDAN route'tan DEĞİL, kiosk.service.recordWebSearch() üzerinden
 * yazılır (bu projenin konvansiyonu — bkz. kioskVoiceCommand.timeout.test.js
 * dosya başı yorumu: "audit() her zaman servis katmanından yazılır, routes.js
 * audit()'i doğrudan çağırmaz"). Bu yüzden audit_logs'a ne yazıldığını burada
 * mockKioskService.recordWebSearch'ün çağrı argümanlarını doğrulayarak
 * doğruluyoruz — recordWebSearch'ün GERÇEK implementasyonunun audit()'i doğru
 * çağırdığı tests/unit/kioskService.recordWebSearch.test.js'te ayrıca ve
 * doğrudan test edilir (recordTimeoutRead ile birebir aynı ayrım).
 */
const mockKioskService = {
  isTokenRevoked: vi.fn(),
  getActiveSurgeryForRoom: vi.fn(),
  getMockConfig: vi.fn(),
  incrementMockCycleIndex: vi.fn(),
  recordWebSearch: vi.fn(),
};
const mockModuleService = { hasActiveModule: vi.fn() };
const mockAiService = { webSearch: vi.fn() };

const activeSurgery = {
  id: 'surgery-1',
  surgeryTeams: [
    { userId: 'speaker-1', fullName: 'Ayşe Yılmaz', roleId: 6, teamRole: 'cerrah' },
  ],
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

let fetchMock;

beforeEach(() => {
  vi.clearAllMocks();
  registry.register('kiosk', mockKioskService);
  registry.register('module', mockModuleService);
  registry.register('ai', mockAiService);
  mockKioskService.isTokenRevoked.mockResolvedValue(false);
  mockModuleService.hasActiveModule.mockResolvedValue(true);
  mockKioskService.getActiveSurgeryForRoom.mockResolvedValue(activeSurgery);
  mockKioskService.getMockConfig.mockResolvedValue({ mode: 'always_match', cycleIndex: 0 });
  mockKioskService.recordWebSearch.mockResolvedValue(undefined);

  // Gerçek bir ağ çağrısının (Claude API dahil) bu akışta hiç yapılmadığını route
  // seviyesinde de pinlemek için global fetch'i stub'luyoruz — aiService.webSearch
  // burada tamamen mock'landığı için zaten çağrılmaması gerekir.
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

describe('POST /api/kiosk/rooms/:roomId/voice-command — WEB_SEARCH', () => {
  it('(a) "ara: " öneki soyulup kalan sorgu aiService.webSearch\'e geçirilir; klinik olmayan soru → cevap uyarı ÖNEKİ OLMADAN döner', async () => {
    mockAiService.webSearch.mockResolvedValueOnce('Bugün hava açık ve 18 derece.');

    const res = await sendVoiceCommand({ transcript: 'ara: bugün hava nasıl' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      type: 'WEB_SEARCH',
      say: 'Bugün hava açık ve 18 derece.',
    });
    expect(mockAiService.webSearch).toHaveBeenCalledWith('bugün hava nasıl');
    expect(fetchMock).not.toHaveBeenCalled();

    // audit — soru+özet servis katmanına (kiosk.service.recordWebSearch) geçirilir,
    // ham arama sonucu/kaynak hiç yoktur.
    expect(mockKioskService.recordWebSearch).toHaveBeenCalledWith({
      userId:    'speaker-1',
      surgeryId: 'surgery-1',
      query:     'bugün hava nasıl',
      answer:    'Bugün hava açık ve 18 derece.',
      req:       expect.anything(),
    });
  });

  it('(b) "bul " öneki de soyulur; klinik soru → cevabın ÖNÜNE "Bu doğrulanmış bir klinik kaynak değildir." uyarısı eklenir (hem say\'de hem audit\'teki answer\'da)', async () => {
    mockAiService.webSearch.mockResolvedValueOnce('Yetişkinlerde günlük doz 500-1000mg arasındadır.');

    const res = await sendVoiceCommand({ transcript: 'bul parasetamol dozu nedir' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      type: 'WEB_SEARCH',
      say: 'Bu doğrulanmış bir klinik kaynak değildir. Yetişkinlerde günlük doz 500-1000mg arasındadır.',
    });
    expect(mockAiService.webSearch).toHaveBeenCalledWith('parasetamol dozu nedir');

    expect(mockKioskService.recordWebSearch).toHaveBeenCalledWith(expect.objectContaining({
      query:  'parasetamol dozu nedir',
      answer: 'Bu doğrulanmış bir klinik kaynak değildir. Yetişkinlerde günlük doz 500-1000mg arasındadır.',
    }));
  });

  it('(c) önekten sonra anlamlı bir şey kalmazsa ("ara:" tek başına) → 200 + "anlayamadım" mesajı, aiService.webSearch HİÇ çağrılmaz', async () => {
    const res = await sendVoiceCommand({ transcript: 'ara:' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      type: 'WEB_SEARCH',
      say: 'Ne aramamı istediğinizi anlayamadım.',
    });
    expect(mockAiService.webSearch).not.toHaveBeenCalled();
    expect(mockKioskService.recordWebSearch).not.toHaveBeenCalled();
  });

  it('(d) önekten sonra sadece boşluk kalırsa ("ara: " + boşluklar) → 200 + "anlayamadım" mesajı, aiService.webSearch HİÇ çağrılmaz', async () => {
    const res = await sendVoiceCommand({ transcript: 'ara:    ' });

    expect(res.status).toBe(200);
    expect(res.body.data.say).toBe('Ne aramamı istediğinizi anlayamadım.');
    expect(mockAiService.webSearch).not.toHaveBeenCalled();
  });

  it('(e) çok kısa transcript (< 3 karakter, parseIntent global UNKNOWN fallback\'i) → WEB_SEARCH\'e hiç GİRMEZ, 200 UNKNOWN döner', async () => {
    const res = await sendVoiceCommand({ transcript: 'ar' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      type: 'UNKNOWN',
      say: 'Anlayamadım, tekrar söyler misiniz?',
    });
    expect(mockAiService.webSearch).not.toHaveBeenCalled();
    expect(mockKioskService.recordWebSearch).not.toHaveBeenCalled();
  });

  it('(f) kioskSpeakerAuth konuşmacıyı tanıyamazsa (always_unrecognized) → 403 unrecognized, aiService.webSearch HİÇ çağrılmaz', async () => {
    mockKioskService.getMockConfig.mockResolvedValueOnce({ mode: 'always_unrecognized', cycleIndex: 0 });

    const res = await sendVoiceCommand({ transcript: 'ara: bugün hava nasıl' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('unrecognized');
    expect(mockAiService.webSearch).not.toHaveBeenCalled();
    expect(mockKioskService.recordWebSearch).not.toHaveBeenCalled();
  });
});
