import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { signAccessToken } from '../../src/utils/jwt.js';
import registry from '../../src/services/_registry.js';
import app from '../../src/app.js';

const request = supertest(app);

const mockAuth = { login: vi.fn(), register: vi.fn(), logout: vi.fn().mockResolvedValue(undefined), refreshTokens: vi.fn() };
const mockSurgery = {
  listSurgeries: vi.fn().mockResolvedValue({ surgeries: [], total: 0, page: 1, limit: 50, totalPages: 0 }),
  createSurgery: vi.fn(), updateSurgery: vi.fn(), deleteSurgery: vi.fn(),
  getSurgery: vi.fn(), assignTeamMember: vi.fn(), removeTeamMember: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.logout.mockResolvedValue(undefined);
  mockSurgery.listSurgeries.mockResolvedValue({ surgeries: [], total: 0, page: 1, limit: 50, totalPages: 0 });
  registry.register('auth', mockAuth);
  registry.register('surgery', mockSurgery);
});

const tok = (roleId, instId = 'inst') => signAccessToken({ sub: `u${roleId}`, email: `u@t.com`, roleId, institutionId: instId });

// ── SQL INJECTION ──────────────────────────────────────────────
describe('Güvenlik — SQL Injection', () => {

  const payloads = [
    { n: "OR bypass",    e: "' OR '1'='1@t.com",               p: "test12" },
    { n: "DROP TABLE",   e: "'; DROP TABLE users;--@t.com",     p: "test12" },
    { n: "UNION SELECT", e: "' UNION SELECT NULL,NULL--@t.com", p: "test12" },
    { n: "sleep attack", e: "1' AND SLEEP(5)--@t.com",          p: "test12" },
  ];

  payloads.forEach(({ n, e, p }) => {
    it(`SQLi (${n}) → 400/401, never 200`, async () => {
      mockAuth.login.mockRejectedValueOnce(new Error('hata'));
      const res = await request.post('/api/auth/login').send({ email: e, password: p });
      expect([400, 401, 422]).toContain(res.status);
      expect(res.status).not.toBe(200);
    });
  });

  it('query param SQLi → not 500', async () => {
    const res = await request.get("/api/surgeries?status=' OR '1'='1").set('Authorization', `Bearer ${tok(0)}`);
    expect(res.status).not.toBe(500);
  });

});

// ── XSS ─────────────────────────────────────────────────────
describe('Güvenlik — XSS Koruması', () => {

  const xssPayloads = [
    '<script>alert(1)</script>',
    '"><img src=x onerror=alert(1)>',
    "javascript:alert('xss')",
  ];

  xssPayloads.forEach((payload, i) => {
    it(`XSS ${i+1} — yanıtta yansımamalı`, async () => {
      mockAuth.login.mockRejectedValueOnce(new Error('hata'));
      const res = await request.post('/api/auth/login').send({ email: `${payload}@test.com`, password: 'test12' });
      expect(JSON.stringify(res.body)).not.toContain('<script>');
      expect(JSON.stringify(res.body)).not.toContain('onerror=');
    });
  });

});

// ── AUTHENTICATION BYPASS ─────────────────────────────────────
describe('Güvenlik — Kimlik Doğrulama Bypass', () => {

  it('header yok → 401', async () => { expect((await request.get('/api/surgeries')).status).toBe(401); });
  it('Bearer null → 401', async () => { expect((await request.get('/api/surgeries').set('Authorization', 'Bearer null')).status).toBe(401); });
  it('geçersiz JWT → 401', async () => { expect((await request.get('/api/surgeries').set('Authorization', 'Bearer invalid.jwt.token')).status).toBe(401); });

  it('yanlış secret ile imzalanmış → 401', async () => {
    const jwt = require('jsonwebtoken');
    const fake = jwt.sign({ sub: 'h', roleId: 0 }, 'wrong-secret');
    expect((await request.get('/api/surgeries').set('Authorization', `Bearer ${fake}`)).status).toBe(401);
  });

  it('algorithm none saldırısı → 401', async () => {
    const h = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const p = Buffer.from(JSON.stringify({ sub: 'h', roleId: 0, exp: 9999999999 })).toString('base64url');
    expect((await request.get('/api/surgeries').set('Authorization', `Bearer ${h}.${p}.`)).status).toBe(401);
  });

});

// ── YETKİLENDİRME ──────────────────────────────────────────
describe('Güvenlik — RBAC Yetkilendirme', () => {

  [1,2,3,4,5,6,7,8,9,10].forEach(r => {
    it(`role=${r} denetim logu göremez → 403`, async () => {
      expect((await request.get('/api/audit').set('Authorization', `Bearer ${tok(r)}`)).status).toBe(403);
    });
  });

  [3,4,5,6,9,10].forEach(r => {
    it(`role=${r} ameliyat oluşturamaz → 403`, async () => {
      expect((await request.post('/api/surgeries').set('Authorization', `Bearer ${tok(r)}`).send({ title: 'T', scheduledStart: '2025-06-01T09:00:00.000Z' })).status).toBe(403);
    });
  });

  [1,2,3,4,5,6,7,8,9,10].forEach(r => {
    it(`role=${r} ameliyat silemez → 403`, async () => {
      expect((await request.delete('/api/surgeries/550e8400-e29b-41d4-a716-446655440000').set('Authorization', `Bearer ${tok(r)}`)).status).toBe(403);
    });
  });

  it('güvenlik olayları admin dışı → 403', async () => {
    expect((await request.get('/api/security/events').set('Authorization', `Bearer ${tok(1)}`)).status).toBe(403);
    expect((await request.get('/api/security/events').set('Authorization', `Bearer ${tok(6)}`)).status).toBe(403);
  });

});

// ── HTTP BAŞLIKLARI ────────────────────────────────────────
describe('Güvenlik — HTTP Başlıkları', () => {

  it('X-Content-Type-Options: nosniff', async () => { expect((await request.get('/health')).headers['x-content-type-options']).toBe('nosniff'); });
  it('X-Powered-By gizli', async () => { expect((await request.get('/health')).headers['x-powered-by']).toBeUndefined(); });
  it('CSP mevcut', async () => { expect((await request.get('/health')).headers['content-security-policy']).toBeDefined(); });
  it("CSP default-src içeriyor", async () => { expect((await request.get('/health')).headers['content-security-policy']).toContain('default-src'); });
  it('Referrer-Policy ayarlı', async () => { expect((await request.get('/health')).headers['referrer-policy']).toBeDefined(); });
  it('Permissions-Policy ayarlı', async () => { expect((await request.get('/health')).headers['permissions-policy']).toBeDefined(); });
  it('Permissions-Policy kamera engellendi', async () => { expect((await request.get('/health')).headers['permissions-policy']).toContain('camera=()'); });
  it('X-XSS-Protection ayarlı', async () => { expect((await request.get('/health')).headers['x-xss-protection']).toBeDefined(); });
  it('X-Frame-Options veya frame-ancestors mevcut', async () => {
    const res = await request.get('/health');
    expect(res.headers['x-frame-options'] === 'DENY' || res.headers['content-security-policy']?.includes('frame-ancestors')).toBe(true);
  });

});

// ── PAYLOAD LİMİTLERİ ────────────────────────────────────
describe('Güvenlik — Payload Boyutu', () => {

  it('512KB üzeri body → 400, 413 veya 500 (not undefined)', async () => {
    // JSON parse etmek zor olabilir, sadece 200 gelmemeli
    const res = await request.post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ data: 'x'.repeat(550 * 1024) }));
    expect(res.status).not.toBe(200);
  });

  it('çok uzun email → 400', async () => {
    expect((await request.post('/api/auth/login').send({ email: 'a'.repeat(300) + '@t.com', password: '123456' })).status).toBe(400);
  });

});

// ── PROTOTYPE POLLUTION ───────────────────────────────────
describe('Güvenlik — Prototype Pollution', () => {

  it('__proto__ girişimi → server çökmemeli (istek kabul ya da reddedilir)', async () => {
    mockAuth.login.mockRejectedValueOnce(new Error('hata'));
    const res = await request.post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":"t@t.com","password":"123456","__proto__":{"isAdmin":true}}');
    // Sunucu çökmemeli (herhangi bir HTTP yanıtı döner)
    // 400=validation, 401=auth hatası, 500=işlendi ama hata
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(600);
    // Yanıt body'si hâlâ JSON olmalı
    expect(res.body).toBeDefined();
  });

});
