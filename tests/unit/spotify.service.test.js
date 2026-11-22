import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import jwt from 'jsonwebtoken';

/**
 * Bu dosya spotify.service.js'i `vi.mock` ile DEĞİL, Node'un native
 * `require.cache`'ine enjeksiyon yaparak test ediyor (tests/unit/
 * kioskService.recordTimeoutRead.test.js'teki ile AYNI, deneysel olarak
 * doğrulanmış teknik). Neden: tests/setup.js'in global `vi.mock('../src/utils/db', ...)`'i
 * TEST DOSYASININ DOĞRUDAN import ettiği modülleri yakalıyor; spotify.service.js'in
 * kendi `require('../utils/db')` çağrısı bir hop ötede ve bu mock'u atlayıp gerçek
 * `pg` Pool'una (ECONNREFUSED 127.0.0.1:5432) düşüyor — bu repoda canlı olarak
 * doğrulandı (ilk denemede spotify.service.js'in db'ye dokunan fonksiyonları
 * gerçek Postgres'e bağlanmaya çalıştı). `createRequire` + `require.cache`
 * enjeksiyonu `require()`'ın kendi mekanizması olduğu için nested require'lara
 * da ulaşır.
 */
const nodeRequire  = createRequire(import.meta.url);
const here          = path.dirname(fileURLToPath(import.meta.url));
const dbPath        = path.resolve(here, '../../src/utils/db.js');
const servicePath   = path.resolve(here, '../../src/services/spotify.service.js');

/**
 * requireFreshService — spotify.service.js'i, verilirse sahte bir db modülüyle,
 * sıfırdan (cache'siz) require eder. fakeDb verilmezse GERÇEK db.js yüklenir —
 * bu güvenlidir çünkü `pg.Pool` kurucusu tembel'dir (yalnızca gerçek bir
 * `query()` çağrısı ağ bağlantısı dener); saf (pure) fonksiyonları test eden
 * bloklar hiç `db.query` çağırmadığı için sahte db'ye gerek yoktur.
 */
function requireFreshService(fakeDb) {
  if (fakeDb) {
    nodeRequire.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakeDb };
  } else {
    delete nodeRequire.cache[dbPath];
  }
  delete nodeRequire.cache[servicePath];
  return nodeRequire(servicePath);
}

afterEach(() => {
  delete nodeRequire.cache[dbPath];
  delete nodeRequire.cache[servicePath];
  vi.unstubAllGlobals();
});

describe('getAuthorizeUrl / verifyState (pure — db ya da fetch gerekmez)', () => {
  it('client_id, redirect_uri, scope, response_type ve state query paramlarını içeren bir URL döner', () => {
    const { getAuthorizeUrl } = requireFreshService();
    const url = getAuthorizeUrl('user-42');
    const parsed = new URL(url);

    expect(parsed.origin + parsed.pathname).toBe('https://accounts.spotify.com/authorize');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('scope')).toBe('user-read-playback-state user-modify-playback-state');
    expect(parsed.searchParams.has('client_id')).toBe(true);
    expect(parsed.searchParams.has('redirect_uri')).toBe(true);
    expect(parsed.searchParams.has('state')).toBe(true);
  });

  it('state parametresi, verifyState ile çözüldüğünde doğru userId\'yi geri verir (imzalama/doğrulama round-trip)', () => {
    const { getAuthorizeUrl, verifyState } = requireFreshService();
    const url = getAuthorizeUrl('user-42');
    const state = new URL(url).searchParams.get('state');
    const payload = verifyState(state);
    expect(payload.userId).toBe('user-42');
  });
});

// Bu task'ın asıl amacı CSRF'e dayanıklı state doğrulamasıdır — bu yüzden
// GERÇEK jwt.verify yolunun tahrif edilmiş/sahte/süresi dolmuş token'ları
// reddettiği burada mock KULLANILMADAN doğrulanıyor (route/entegrasyon
// testindeki "geçersiz state" senaryosu verifyState'i tamamen mock'luyor ve
// gerçek kriptoyu hiç çalıştırmıyor — bu blok o boşluğu kapatıyor).
describe('verifyState — tahrif edilmiş/sahte/süresi dolmuş state REDDEDİLİR (gerçek jwt.verify, mock yok)', () => {
  it('yanlış secret ile imzalanmış (sahte/forge edilmiş) state → fırlatır', () => {
    const { verifyState } = requireFreshService();
    const forged = jwt.sign({ userId: 'attacker-controlled' }, 'definitely-wrong-secret', { expiresIn: '10m' });

    expect(() => verifyState(forged)).toThrow();
  });

  it('geçerli bir state\'in imzası tek karakter tahrif edilmiş → fırlatır', () => {
    const { getAuthorizeUrl, verifyState } = requireFreshService();
    const url = getAuthorizeUrl('user-42');
    const state = new URL(url).searchParams.get('state');

    const parts = state.split('.');
    expect(parts).toHaveLength(3); // header.payload.signature
    const sig = parts[2];
    const flippedChar = sig[0] === 'A' ? 'B' : 'A';
    const tamperedSig = flippedChar + sig.slice(1);
    const tampered = `${parts[0]}.${parts[1]}.${tamperedSig}`;

    expect(() => verifyState(tampered)).toThrow();
  });

  it('süresi dolmuş state (aynı secret, geçmiş exp) → fırlatır', () => {
    const knownSecret = 'test-only-spotify-state-secret-for-expiry-case';
    const originalEnv = process.env.SPOTIFY_STATE_SECRET;
    process.env.SPOTIFY_STATE_SECRET = knownSecret;

    try {
      // SPOTIFY_STATE_SECRET değişkenini servis modülü yüklenirken okuduğu
      // için fresh require gerekiyor — aksi halde eski (varsayılan) secret
      // sabitlenmiş kalır.
      const { verifyState } = requireFreshService();
      // Negatif expiresIn, imzalama anında zaten geçmişte kalan bir exp üretir.
      const expired = jwt.sign({ userId: 'user-1' }, knownSecret, { expiresIn: -10 });

      expect(() => verifyState(expired)).toThrow();
    } finally {
      process.env.SPOTIFY_STATE_SECRET = originalEnv;
    }
  });
});

describe('exchangeCodeForToken (fetch vi.stubGlobal — iki ağ çağrısı: token + profil)', () => {
  it('token exchange + /v1/me yanıtlarını { accessToken, refreshToken, expiresIn, spotifyUserId }\'e eşler', async () => {
    const fetchMock = vi.fn((url) => {
      if (url === 'https://accounts.spotify.com/api/token') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ access_token: 'at-123', refresh_token: 'rt-456', expires_in: 3600 }),
        });
      }
      if (url === 'https://api.spotify.com/v1/me') {
        return Promise.resolve({ ok: true, json: async () => ({ id: 'spotify-user-789' }) });
      }
      throw new Error(`beklenmeyen URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { exchangeCodeForToken } = requireFreshService();
    const result = await exchangeCodeForToken('auth-code-abc');

    expect(result).toEqual({
      accessToken:   'at-123',
      refreshToken:  'rt-456',
      expiresIn:     3600,
      spotifyUserId: 'spotify-user-789',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('Spotify token endpoint\'i hata dönerse (ok:false) fırlatır', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400 }));

    const { exchangeCodeForToken } = requireFreshService();
    await expect(exchangeCodeForToken('bad-code')).rejects.toThrow();
  });
});

describe('refreshAccessTokenIfNeeded (sahte db modülü + fetch vi.stubGlobal)', () => {
  it('expires_at gelecekteyse fetch ÇAĞIRMAZ, sadece 1 db.query (SELECT) ile mevcut access_token\'ı döner', async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000); // +1 saat
    const fakeDb = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [{
          spotify_user_id: 'sp-1',
          access_token:    'current-access-token',
          refresh_token:   'current-refresh-token',
          expires_at:      future,
          connected_at:    new Date(),
        }],
        rowCount: 1,
      }),
    };
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { refreshAccessTokenIfNeeded } = requireFreshService(fakeDb);
    const token = await refreshAccessTokenIfNeeded('user-1');

    expect(token).toBe('current-access-token');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(fakeDb.query).toHaveBeenCalledTimes(1); // yalnızca SELECT — UPDATE yok
  });

  it('expires_at geçmişteyse Spotify\'dan yeni access_token alır, DB\'yi UPDATE eder ve yeni token\'ı döner', async () => {
    const past = new Date(Date.now() - 60 * 1000); // 1 dakika önce doldu
    const fakeDb = {
      query: vi.fn()
        .mockResolvedValueOnce({
          rows: [{
            spotify_user_id: 'sp-1',
            access_token:    'expired-access-token',
            refresh_token:   'current-refresh-token',
            expires_at:      past,
            connected_at:    new Date(),
          }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }), // UPDATE
    };
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token:  'brand-new-access-token',
        refresh_token: 'brand-new-refresh-token',
        expires_in:    3600,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { refreshAccessTokenIfNeeded } = requireFreshService(fakeDb);
    const token = await refreshAccessTokenIfNeeded('user-1');

    expect(token).toBe('brand-new-access-token');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOptions] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe('https://accounts.spotify.com/api/token');
    expect(calledOptions.method).toBe('POST');
    expect(calledOptions.body.toString()).toContain('grant_type=refresh_token');
    expect(calledOptions.body.toString()).toContain('refresh_token=current-refresh-token');

    expect(fakeDb.query).toHaveBeenCalledTimes(2);
    const updateCall = fakeDb.query.mock.calls[1];
    expect(updateCall[0]).toMatch(/UPDATE user_spotify_connections/);
    expect(updateCall[1]).toEqual(['brand-new-access-token', 'brand-new-refresh-token', expect.any(Date), 'user-1']);
  });
});

describe('saveConnection (sahte db modülü — gerçek upsert SQL çalıştırılır)', () => {
  it('INSERT ... ON CONFLICT (user_id) DO UPDATE\'i doğru tablo/sütun/parametre pozisyonlarıyla çağırır', async () => {
    const fakeDb = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    const { saveConnection } = requireFreshService(fakeDb);

    const before = Date.now();
    await saveConnection('user-1', {
      accessToken:   'at-1',
      refreshToken:  'rt-1',
      expiresIn:     3600,
      spotifyUserId: 'sp-1',
    });

    expect(fakeDb.query).toHaveBeenCalledTimes(1);
    const [sql, params] = fakeDb.query.mock.calls[0];

    // Tablo adı, sütun listesi, conflict target ve UPDATE SET'in doğru
    // $N pozisyonlarına eşlendiğini sabitliyor — bir sütun/parametre
    // kayması ya da yanlış conflict target'ı burada yakalanır.
    expect(sql).toContain('INSERT INTO user_spotify_connections (user_id, spotify_user_id, access_token, refresh_token, expires_at)');
    expect(sql).toContain('VALUES ($1,$2,$3,$4,$5)');
    expect(sql).toContain('ON CONFLICT (user_id) DO UPDATE');
    expect(sql).toContain('SET spotify_user_id = $2, access_token = $3, refresh_token = $4, expires_at = $5');

    expect(params).toHaveLength(5);
    expect(params[0]).toBe('user-1');   // $1 user_id
    expect(params[1]).toBe('sp-1');     // $2 spotify_user_id
    expect(params[2]).toBe('at-1');     // $3 access_token
    expect(params[3]).toBe('rt-1');     // $4 refresh_token
    expect(params[4]).toBeInstanceOf(Date); // $5 expires_at

    // expires_at ~ now + 3600s (test çalışma süresi için küçük tolerans)
    const expiresAtMs = params[4].getTime();
    expect(expiresAtMs).toBeGreaterThanOrEqual(before + 3600 * 1000 - 1000);
    expect(expiresAtMs).toBeLessThanOrEqual(before + 3600 * 1000 + 5000);
  });
});

describe('searchTrackOrPlaylist (fetch vi.stubGlobal — GERÇEK tek bir /v1/search çağrısı; play/transfer-playback\'e bu fonksiyon içinden ASLA gidilmez)', () => {
  it('q/type=track,playlist/limit=1 parametreleriyle ve Bearer header\'ıyla GET /v1/search çağırır; track VE playlist sonucu varsa TRACK\'i döner (tasarım kararı: track önceliklidir)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tracks:    { items: [{ name: 'Bohemian Rhapsody', uri: 'spotify:track:abc' }] },
        playlists: { items: [{ name: 'Classic Rock', uri: 'spotify:playlist:xyz' }] },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { searchTrackOrPlaylist } = requireFreshService();
    const result = await searchTrackOrPlaylist('token-abc', 'bohemian rhapsody');

    expect(result).toEqual({ name: 'Bohemian Rhapsody', uri: 'spotify:track:abc' });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [calledUrl, calledOptions] = fetchMock.mock.calls[0];
    expect(calledUrl).toContain('https://api.spotify.com/v1/search?');
    expect(calledUrl).toContain('type=track,playlist');
    expect(calledUrl).toContain('limit=1');
    expect(calledUrl).toContain(encodeURIComponent('bohemian rhapsody'));
    expect(calledOptions.headers.Authorization).toBe('Bearer token-abc');

    // Review Focus: gerçek play/transfer-playback endpoint'ine bu fonksiyon İÇİNDE ASLA gidilmez.
    expect(calledUrl).not.toContain('/play');
    expect(calledUrl).not.toContain('/transfer-playback');
  });

  it('track sonucu boşsa ama playlist sonucu varsa playlist\'i döner', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tracks:    { items: [] },
        playlists: { items: [{ name: 'Seksenler Hits', uri: 'spotify:playlist:xyz' }] },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { searchTrackOrPlaylist } = requireFreshService();
    const result = await searchTrackOrPlaylist('token-abc', 'seksenler');

    expect(result).toEqual({ name: 'Seksenler Hits', uri: 'spotify:playlist:xyz' });
  });

  it('hem track hem playlist sonucu boşsa null döner', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tracks: { items: [] }, playlists: { items: [] } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { searchTrackOrPlaylist } = requireFreshService();
    const result = await searchTrackOrPlaylist('token-abc', 'tamamen anlamsız bir şey');

    expect(result).toBeNull();
  });

  it('Spotify arama endpoint\'i hata dönerse (ok:false) fırlatır', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    const { searchTrackOrPlaylist } = requireFreshService();
    await expect(searchTrackOrPlaylist('expired-token', 'query')).rejects.toThrow();
  });
});

describe('disconnect', () => {
  it('kullanıcının bağlantısını DB\'den siler (DELETE ... WHERE user_id)', async () => {
    const fakeDb = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    const { disconnect } = requireFreshService(fakeDb);

    await disconnect('user-1');

    expect(fakeDb.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM user_spotify_connections'),
      ['user-1']
    );
  });
});
