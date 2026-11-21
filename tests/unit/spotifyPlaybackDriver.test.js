import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const { SpotifyPlaybackDriver } = await import('../../src/drivers/SpotifyPlaybackDriver.js');

/**
 * MockSpotifyPlaybackDriver.play() kendi içinde GERÇEK audit()'i çağırır (bkz.
 * MockSpotifyPlaybackDriver.js). tests/unit/kioskService.recordTimeoutRead.test.js'teki
 * uzun yorumda açıklanan AYNI, empirik olarak doğrulanmış sebeple, bu nested-require
 * (driver -> utils/audit) tests/setup.js'in global vi.mock('../src/utils/audit', ...)'i
 * tarafından yakalanamaz. Bu yüzden audit()'in çağrılıp çağrılmadığını ve hangi
 * argümanlarla çağrıldığını doğrulamak için AYNI require.cache enjeksiyon tekniği
 * kullanılıyor (Node'un native require'ı — vite-node'un ESM mock registry'sini atlar,
 * ama her iki dünyanın da paylaştığı gerçek require.cache'e enjekte eder).
 */
const nodeRequire   = createRequire(import.meta.url);
const here           = path.dirname(fileURLToPath(import.meta.url));
const auditPath      = path.resolve(here, '../../src/utils/audit.js');
const baseDriverPath = path.resolve(here, '../../src/drivers/SpotifyPlaybackDriver.js');
const mockDriverPath = path.resolve(here, '../../src/drivers/MockSpotifyPlaybackDriver.js');

describe('SpotifyPlaybackDriver (soyut taban sınıf)', () => {
  it('play() çağrılırsa "not implemented" hatası fırlatmalı', async () => {
    const driver = new SpotifyPlaybackDriver();
    await expect(
      driver.play({ userName: 'Ayşe Yılmaz', trackName: 'Bohemian Rhapsody' })
    ).rejects.toThrow('not implemented');
  });
});

describe('MockSpotifyPlaybackDriver', () => {
  let fakeAudit;
  let MockSpotifyPlaybackDriver;
  let fetchMock;

  beforeEach(() => {
    fakeAudit = vi.fn().mockResolvedValue(undefined);
    nodeRequire.cache[auditPath] = {
      id: auditPath,
      filename: auditPath,
      loaded: true,
      exports: { audit: fakeAudit },
    };
    delete nodeRequire.cache[baseDriverPath];
    delete nodeRequire.cache[mockDriverPath];
    ({ MockSpotifyPlaybackDriver } = nodeRequire(mockDriverPath));

    // Gerçek play/transfer-playback endpoint'ine (ya da herhangi bir ağa) bu fazda
    // HİÇ gidilmediğini pinlemek için global fetch'i stub'luyoruz.
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    delete nodeRequire.cache[auditPath];
    delete nodeRequire.cache[baseDriverPath];
    delete nodeRequire.cache[mockDriverPath];
    vi.unstubAllGlobals();
  });

  it('beklenen onay metnini döner: "{userName}\'in Spotify hesabından {trackName} çalınıyor (mock)."', async () => {
    const driver = new MockSpotifyPlaybackDriver();
    const result = await driver.play({
      userName:  'Ayşe Yılmaz',
      trackName: 'Bohemian Rhapsody',
      roomId:    'room-1',
      req:       { ip: '10.0.0.1' },
    });

    expect(result).toEqual({
      message: "Ayşe Yılmaz'in Spotify hesabından Bohemian Rhapsody çalınıyor (mock).",
    });
  });

  it('gerçek bir ağ çağrısı YAPMAZ — fetch hiç çağrılmaz (real play/transfer-playback endpoint\'inin bu fazda asla çağrılmadığı kısıtını pinler)', async () => {
    const driver = new MockSpotifyPlaybackDriver();
    await driver.play({ userName: 'Ayşe Yılmaz', trackName: 'Bohemian Rhapsody', roomId: 'room-1', req: {} });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('audit()\'i action: "voice:spotify_play", resource: "controllable_devices", userId: null ile ve newData/req doğru geçirerek çağırır', async () => {
    const driver = new MockSpotifyPlaybackDriver();
    const req = { ip: '10.0.0.1', headers: { 'user-agent': 'kiosk-device' } };

    await driver.play({ userName: 'Ayşe Yılmaz', trackName: 'Bohemian Rhapsody', roomId: 'room-1', req });

    expect(fakeAudit).toHaveBeenCalledTimes(1);
    expect(fakeAudit).toHaveBeenCalledWith({
      userId:     null,
      action:     'voice:spotify_play',
      resource:   'controllable_devices',
      resourceId: null,
      newData:    { userName: 'Ayşe Yılmaz', trackName: 'Bohemian Rhapsody', roomId: 'room-1' },
      req,
    });
  });
});
