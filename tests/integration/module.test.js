import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { signAccessToken } from '../../src/utils/jwt.js';
import registry from '../../src/services/_registry.js';
import app from '../../src/app.js';

const request = supertest(app);
const mockModuleService = { getModules: vi.fn(), getInstitutionModules: vi.fn(), purchaseModule: vi.fn() };
const tok = (roleId) => signAccessToken({ sub: 'u1', email: 'e@t.com', roleId, institutionId: 'inst-1' });

beforeEach(() => { vi.clearAllMocks(); registry.register('module', mockModuleService); });

describe('GET /api/billing/modules', () => {
  it('token olmadan da listelenebilmeli (public katalog)', async () => {
    mockModuleService.getModules.mockResolvedValueOnce([{ slug: 'voice_control', name: 'Sesli Kontrol' }]);
    const res = await request.get('/api/billing/modules');
    expect(res.status).toBe(200);
  });
});

describe('POST /api/billing/modules/:slug/purchase', () => {
  it('token yok → 401', async () => {
    expect((await request.post('/api/billing/modules/voice_control/purchase')).status).toBe(401);
  });
  it('sadece Üst Yönetici(0) satın alabilmeli — doktor(6) → 403', async () => {
    const res = await request.post('/api/billing/modules/voice_control/purchase')
      .set('Authorization', `Bearer ${tok(6)}`);
    expect(res.status).toBe(403);
  });
  it('Üst Yönetici → 201', async () => {
    mockModuleService.purchaseModule.mockResolvedValueOnce({ module_slug: 'voice_control', status: 'active' });
    const res = await request.post('/api/billing/modules/voice_control/purchase')
      .set('Authorization', `Bearer ${tok(0)}`);
    expect(res.status).toBe(201);
  });
});
