import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

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
