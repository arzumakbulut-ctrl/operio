import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { signAccessToken } from '../../src/utils/jwt.js';
import registry from '../../src/services/_registry.js';
import app from '../../src/app.js';

const request = supertest(app);
const FRONTEND = process.env.CORS_ORIGIN || 'http://localhost:5173';

const mockSpotifyService = {
  getAuthorizeUrl: vi.fn(),
  verifyState: vi.fn(),
  exchangeCodeForToken: vi.fn(),
  saveConnection: vi.fn(),
  getConnection: vi.fn(),
  refreshAccessTokenIfNeeded: vi.fn(),
  disconnect: vi.fn(),
};
const tok = (sub = 'user-1') => signAccessToken({ sub, email: 'e@t.com', roleId: 6, institutionId: 'inst-1' });

beforeEach(() => {
  vi.clearAllMocks();
  registry.register('spotify', mockSpotifyService);
});

describe('GET /api/spotify/connect', () => {
  it('token yok → 401, servis çağrılmaz', async () => {
    const res = await request.get('/api/spotify/connect');
    expect(res.status).toBe(401);
    expect(mockSpotifyService.getAuthorizeUrl).not.toHaveBeenCalled();
  });

  it('kişisel JWT ile (herhangi bir rol) → 200 + { url }', async () => {
    mockSpotifyService.getAuthorizeUrl.mockReturnValueOnce('https://accounts.spotify.com/authorize?client_id=x&state=y');

    const res = await request
      .get('/api/spotify/connect')
      .set('Authorization', `Bearer ${tok('user-1')}`);

    expect(res.status).toBe(200);
    expect(res.body.data.url).toBe('https://accounts.spotify.com/authorize?client_id=x&state=y');
    // Kullanıcının KENDİ id'si state'e gömülecek userId olarak geçirilmeli
    expect(mockSpotifyService.getAuthorizeUrl).toHaveBeenCalledWith('user-1');
  });
});

describe('GET /api/spotify/callback (public — Spotify tarayıcıyı buraya redirect eder)', () => {
  it('code/state eksik → servis çağrılmadan ?spotify=error\'a redirect', async () => {
    const res = await request.get('/api/spotify/callback');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${FRONTEND}/profil?spotify=error`);
    expect(mockSpotifyService.verifyState).not.toHaveBeenCalled();
  });

  it('geçersiz/süresi dolmuş state → JSON 400 DEĞİL, ?spotify=error\'a redirect (gösterilecek JSON tüketicisi yok)', async () => {
    mockSpotifyService.verifyState.mockImplementationOnce(() => {
      throw new Error('jwt expired');
    });

    const res = await request.get('/api/spotify/callback?code=abc&state=bad-state');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${FRONTEND}/profil?spotify=error`);
    expect(mockSpotifyService.exchangeCodeForToken).not.toHaveBeenCalled();
  });

  it('token exchange başarısız → ?spotify=error\'a redirect', async () => {
    mockSpotifyService.verifyState.mockReturnValueOnce({ userId: 'user-1' });
    mockSpotifyService.exchangeCodeForToken.mockRejectedValueOnce(new Error('spotify 500'));

    const res = await request.get('/api/spotify/callback?code=abc&state=good-state');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${FRONTEND}/profil?spotify=error`);
    expect(mockSpotifyService.saveConnection).not.toHaveBeenCalled();
  });

  it('geçerli state + kod → exchangeCodeForToken + saveConnection çağrılır, ?spotify=connected\'a redirect', async () => {
    mockSpotifyService.verifyState.mockReturnValueOnce({ userId: 'user-1' });
    mockSpotifyService.exchangeCodeForToken.mockResolvedValueOnce({
      accessToken: 'secret-access-token',
      refreshToken: 'secret-refresh-token',
      expiresIn: 3600,
      spotifyUserId: 'sp-1',
    });
    mockSpotifyService.saveConnection.mockResolvedValueOnce(undefined);

    const res = await request.get('/api/spotify/callback?code=good-code&state=good-state');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${FRONTEND}/profil?spotify=connected`);
    expect(mockSpotifyService.verifyState).toHaveBeenCalledWith('good-state');
    expect(mockSpotifyService.exchangeCodeForToken).toHaveBeenCalledWith('good-code');
    expect(mockSpotifyService.saveConnection).toHaveBeenCalledWith('user-1', {
      accessToken: 'secret-access-token',
      refreshToken: 'secret-refresh-token',
      expiresIn: 3600,
      spotifyUserId: 'sp-1',
    });
    // Token sızıntısı kontrolü — redirect URL'de access/refresh token asla görünmemeli
    expect(res.headers.location).not.toMatch(/secret-access-token|secret-refresh-token/);
  });
});

describe('POST /api/spotify/disconnect', () => {
  it('token yok → 401, servis çağrılmaz', async () => {
    const res = await request.post('/api/spotify/disconnect');
    expect(res.status).toBe(401);
    expect(mockSpotifyService.disconnect).not.toHaveBeenCalled();
  });

  it('kişisel JWT ile → disconnect(req.user.sub) çağrılır, 200 + { disconnected: true }', async () => {
    mockSpotifyService.disconnect.mockResolvedValueOnce(undefined);

    const res = await request
      .post('/api/spotify/disconnect')
      .set('Authorization', `Bearer ${tok('user-7')}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ disconnected: true });
    expect(mockSpotifyService.disconnect).toHaveBeenCalledWith('user-7');
  });
});
