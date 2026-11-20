import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { signAccessToken } from '../../src/utils/jwt.js';
import registry from '../../src/services/_registry.js';
import app from '../../src/app.js';

const request = supertest(app);

const mockAuth = {
  login:         vi.fn(),
  register:      vi.fn(),
  refreshTokens: vi.fn(),
  logout:        vi.fn().mockResolvedValue(undefined),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.logout.mockResolvedValue(undefined);
  registry.register('auth', mockAuth);
});

const makeToken = (roleId = 0) => signAccessToken({ sub: 'u', email: 'a@t.com', roleId, institutionId: 'inst' });

describe('Auth — Validasyon', () => {

  it('geçersiz email → 400', async () => {
    expect((await request.post('/api/auth/login').send({ email: 'notanemail', password: '123456' })).status).toBe(400);
  });

  it('şifre yok → 400', async () => {
    expect((await request.post('/api/auth/login').send({ email: 'a@t.com' })).status).toBe(400);
  });

  it('boş body → 400', async () => {
    expect((await request.post('/api/auth/login').send({})).status).toBe(400);
  });

  it('çok uzun email → 400', async () => {
    expect((await request.post('/api/auth/login').send({ email: 'a'.repeat(300) + '@t.com', password: '123456' })).status).toBe(400);
  });

  it('başarılı login → 200', async () => {
    mockAuth.login.mockResolvedValueOnce({ accessToken: 'acc', refreshToken: 'ref', user: { id: 'u', email: 'a@t.com', role_id: 0 }, requiresTOTP: false });
    const res = await request.post('/api/auth/login').send({ email: 'a@t.com', password: 'Admin123!' });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBe('acc');
    expect(mockAuth.login).toHaveBeenCalledOnce();
  });

  it('yanlış şifre → 401', async () => {
    mockAuth.login.mockRejectedValueOnce(Object.assign(new Error('Hatalı'), { statusCode: 401 }));
    expect((await request.post('/api/auth/login').send({ email: 'a@t.com', password: 'yanlis' })).status).toBe(401);
  });

  it('kilitli hesap → 423', async () => {
    mockAuth.login.mockRejectedValueOnce(Object.assign(new Error('Kilitli'), { statusCode: 423 }));
    expect((await request.post('/api/auth/login').send({ email: 'a@t.com', password: '123456' })).status).toBe(423);
  });

});

describe('Auth — GET /api/auth/me', () => {

  it('token yok → 401', async () => {
    expect((await request.get('/api/auth/me')).status).toBe(401);
  });

  it('geçersiz token → 401', async () => {
    expect((await request.get('/api/auth/me').set('Authorization', 'Bearer bad.tok')).status).toBe(401);
  });

  it('geçerli token formatı doğrulanmalı — 401 değil', async () => {
    // DB bağlantısı test ortamında yok, 500 alabiliriz ama 401 OLMAMALI
    const res = await request.get('/api/auth/me').set('Authorization', `Bearer ${makeToken()}`);
    expect(res.status).not.toBe(401); // Token geçerli, auth middleware geçti
  });

});

describe('Auth — Refresh', () => {

  it('body yok → 400', async () => {
    expect((await request.post('/api/auth/refresh').send({})).status).toBe(400);
  });

  it('geçersiz token → 401', async () => {
    mockAuth.refreshTokens.mockRejectedValueOnce(Object.assign(new Error('Geçersiz'), { statusCode: 401 }));
    expect((await request.post('/api/auth/refresh').send({ refreshToken: 'bad.tok' })).status).toBe(401);
  });

  it('geçerli → 200', async () => {
    mockAuth.refreshTokens.mockResolvedValueOnce({ accessToken: 'new', refreshToken: 'newref' });
    const res = await request.post('/api/auth/refresh').send({ refreshToken: 'valid.refresh.token' });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBe('new');
  });

});

describe('Auth — Güvenlik Başlıkları', () => {

  it('nosniff', async () => { expect((await request.get('/health')).headers['x-content-type-options']).toBe('nosniff'); });
  it('X-Powered-By gizli', async () => { expect((await request.get('/health')).headers['x-powered-by']).toBeUndefined(); });
  it('CSP mevcut', async () => { expect((await request.get('/health')).headers['content-security-policy']).toBeDefined(); });
  it('Permissions-Policy mevcut', async () => { expect((await request.get('/health')).headers['permissions-policy']).toBeDefined(); });
  it('health → 200', async () => {
    const res = await request.get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

});

describe('Auth — Zararlı Payload', () => {

  ["' OR '1'='1", "<script>alert(1)</script>@t.com", "'; DROP TABLE users;--@t.com"].forEach((email, i) => {
    it(`payload ${i+1} → 400/401, yanıtta yansımamalı`, async () => {
      mockAuth.login.mockRejectedValueOnce(new Error('hata'));
      const res = await request.post('/api/auth/login').send({ email, password: 'test12' });
      expect([400, 401]).toContain(res.status);
      expect(JSON.stringify(res.body)).not.toContain('<script>');
    });
  });

});
