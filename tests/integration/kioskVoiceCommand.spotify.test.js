import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import supertest from 'supertest';
import registry from '../../src/services/_registry.js';
import { signKioskToken } from '../../src/utils/kioskJwt.js';
import app from '../../src/app.js';

const request = supertest(app);

/**
 * 'kiosk'/'module'/'spotify' servisleri registry üzerinden mock'lanır (diğer kiosk
 * entegrasyon testleriyle aynı desen — bkz. kioskVoiceCommand.device.test.js).
 *
 * 'spotifyPlaybackDriver' de AYNI registry'den mock'lanır — kiosk.routes.js'in
 * SPOTIFY_PLAY dalı somut sürücüyü registry.get('spotifyPlaybackDriver', () => new
 * MockSpotifyPlaybackDriver()) ile alır (bkz. kiosk.routes.js). Bu, DEVICE_COMMAND'ın
 * device.service'i registry'den almasıyla aynı DI deseni — buradaki ek sebep:
 * gerçek MockSpotifyPlaybackDriver.play() kendi içinde audit() çağırır (GERÇEK DB'ye
 * yazar), bu yüzden burada sahte bir sürücüyle değiştiriyoruz; gerçek sürücünün
 * kendisi (audit() çağrısının tam şekli dahil) tests/unit/spotifyPlaybackDriver.test.js'te
 * ayrıca ve doğrudan test edilir.
 */
const mockKioskService = {
  isTokenRevoked: vi.fn(),
  getActiveSurgeryForRoom: vi.fn(),
  getMockConfig: vi.fn(),
  incrementMockCycleIndex: vi.fn(),
};
const mockModuleService = { hasActiveModule: vi.fn() };
const mockSpotifyService = {
  refreshAccessTokenIfNeeded: vi.fn(),
  searchTrackOrPlaylist: vi.fn(),
};
const mockDriver = { play: vi.fn() };

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
  registry.register('spotify', mockSpotifyService);
  registry.register('spotifyPlaybackDriver', mockDriver);
  mockKioskService.isTokenRevoked.mockResolvedValue(false);
  mockModuleService.hasActiveModule.mockResolvedValue(true);
  mockKioskService.getActiveSurgeryForRoom.mockResolvedValue(activeSurgery);
  mockKioskService.getMockConfig.mockResolvedValue({ mode: 'always_match', cycleIndex: 0 });

  // Gerçek Spotify play/transfer-playback endpoint'ine (ya da herhangi bir ağa) bu
  // akışta HİÇ gidilmediğini route seviyesinde de pinlemek için global fetch'i
  // stub'luyoruz (searchTrackOrPlaylist burada mock'landığı için zaten çağrılmaması
  // gerekir — bu test o varsayımı açıkça doğrular).
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/kiosk/rooms/:roomId/voice-command — SPOTIFY_PLAY', () => {
  it('(a) Spotify hesabı bağlı değilse (refreshAccessTokenIfNeeded 404 fırlatır) → 200 + spesifik "bağlı değil" mesajı (jenerik hata DEĞİL), arama/sürücü hiç çağrılmaz', async () => {
    mockSpotifyService.refreshAccessTokenIfNeeded.mockRejectedValueOnce(
      Object.assign(new Error('Spotify bağlantısı bulunamadı'), { statusCode: 404 })
    );

    const res = await sendVoiceCommand({ transcript: "spotify'da seksenler çalsın" });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      type: 'SPOTIFY_PLAY',
      say: 'Spotify hesabınız bağlı değil, Profil sayfasından bağlayabilirsiniz.',
    });
    expect(mockSpotifyService.searchTrackOrPlaylist).not.toHaveBeenCalled();
    expect(mockDriver.play).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('(b) bağlı + arama sonuç bulursa → 200 + sürücünün onay metni; confirm döngüsüne GİRMEZ (status/phrase alanı yok), gerçek play endpoint\'ine hiç gidilmez', async () => {
    mockSpotifyService.refreshAccessTokenIfNeeded.mockResolvedValueOnce('access-token-123');
    mockSpotifyService.searchTrackOrPlaylist.mockResolvedValueOnce({ name: 'Bohemian Rhapsody', uri: 'spotify:track:abc' });
    mockDriver.play.mockResolvedValueOnce({ message: "Ayşe Yılmaz'in Spotify hesabından Bohemian Rhapsody çalınıyor (mock)." });

    const res = await sendVoiceCommand({ transcript: "spotify'da bohemian rhapsody çalsın" });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      type: 'SPOTIFY_PLAY',
      say: "Ayşe Yılmaz'in Spotify hesabından Bohemian Rhapsody çalınıyor (mock).",
    });
    // Review Focus #4/c: DEVICE_COMMAND'ın aksine tek çağrıda sonuçlanır — confirm
    // döngüsüne dair hiçbir alan (status/phrase) dönmez.
    expect(res.body.data.status).toBeUndefined();
    expect(res.body.data.phrase).toBeUndefined();

    expect(mockSpotifyService.refreshAccessTokenIfNeeded).toHaveBeenCalledWith('speaker-1');
    expect(mockSpotifyService.searchTrackOrPlaylist).toHaveBeenCalledWith('access-token-123', 'bohemian rhapsody çalsın');
    expect(mockDriver.play).toHaveBeenCalledWith({
      userName:  'Ayşe Yılmaz',
      trackName: 'Bohemian Rhapsody',
      roomId:    'room-1',
      req:       expect.anything(),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('(c) bağlı ama arama sonuç bulamazsa (null) → 200 + "bulamadım" mesajı, sürücü ÇAĞRILMAZ', async () => {
    mockSpotifyService.refreshAccessTokenIfNeeded.mockResolvedValueOnce('access-token-123');
    mockSpotifyService.searchTrackOrPlaylist.mockResolvedValueOnce(null);

    const res = await sendVoiceCommand({ transcript: "spotify'da tamamen anlamsız bir şey çalsın" });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      type: 'SPOTIFY_PLAY',
      say: 'Bu isimde bir şarkı veya liste bulamadım.',
    });
    expect(mockDriver.play).not.toHaveBeenCalled();
  });

  it('(d) "spotify" dışında anlamlı bir şey söylenmezse → 200 + "anlayamadım" mesajı, Spotify servisine HİÇ gidilmez', async () => {
    const res = await sendVoiceCommand({ transcript: 'spotify' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      type: 'SPOTIFY_PLAY',
      say: 'Ne çalmamı istediğinizi anlayamadım.',
    });
    expect(mockSpotifyService.refreshAccessTokenIfNeeded).not.toHaveBeenCalled();
    expect(mockSpotifyService.searchTrackOrPlaylist).not.toHaveBeenCalled();
    expect(mockDriver.play).not.toHaveBeenCalled();
  });

  it('(e) kioskSpeakerAuth konuşmacıyı tanıyamazsa (always_unrecognized) → 403 unrecognized, Spotify servisine hiç gidilmez', async () => {
    mockKioskService.getMockConfig.mockResolvedValueOnce({ mode: 'always_unrecognized', cycleIndex: 0 });

    const res = await sendVoiceCommand({ transcript: "spotify'da rock çalsın" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('unrecognized');
    expect(mockSpotifyService.refreshAccessTokenIfNeeded).not.toHaveBeenCalled();
  });
});
