import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import registry from '../../src/services/_registry.js';
import app from '../../src/app.js';
import { signAccessToken } from '../../src/utils/jwt.js';
import { signPlatformAdminAccessToken } from '../../src/utils/platformAdminJwt.js';

const request = supertest(app);
const mockAuth = { login: vi.fn(), refreshTokens: vi.fn(), logout: vi.fn() };
beforeEach(() => { vi.clearAllMocks(); registry.register('platformAdminAuth', mockAuth); });

describe('POST /api/platform-admin/auth/login', () => {
  it('başarılı login → 200, accessToken/refreshToken döner', async () => {
    mockAuth.login.mockResolvedValueOnce({ accessToken:'pa-acc', refreshToken:'pa-ref', admin:{id:'a1',email:'super@operio.com',groupSlug:'super'} });
    const res = await request.post('/api/platform-admin/auth/login').send({ email:'super@operio.com', password:'PlatformAdmin123!' });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBe('pa-acc');
  });
  it('yanlış şifre → 401', async () => {
    mockAuth.login.mockRejectedValueOnce(Object.assign(new Error('Hatalı'), { statusCode:401 }));
    expect((await request.post('/api/platform-admin/auth/login').send({ email:'super@operio.com', password:'yanlis' })).status).toBe(401);
  });
});

describe('Cross-boundary token rejection (Review Focus)', () => {
  it('platform-admin access token, authorize() korumalı bir hastane rotasına (GET /api/surgeries) erişemez', async () => {
    const paToken = signPlatformAdminAccessToken({ sub:'a1', email:'super@operio.com', groupSlug:'super' });
    const res = await request.get('/api/surgeries').set('Authorization', `Bearer ${paToken}`);
    expect([401,403]).toContain(res.status);
  });
  it('hastane access token, authorizePlatformAdmin() korumalı bir rotaya (GET /api/platform-admin/auth/me) erişemez', async () => {
    const hospToken = signAccessToken({ sub:'u1', email:'a@t.com', roleId:0, institutionId:'inst' });
    const res = await request.get('/api/platform-admin/auth/me').set('Authorization', `Bearer ${hospToken}`);
    expect([401,403]).toContain(res.status);
  });
});
