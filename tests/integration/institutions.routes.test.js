import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import registry from '../../src/services/_registry.js';
import app from '../../src/app.js';
import { signPlatformAdminAccessToken } from '../../src/utils/platformAdminJwt.js';

const request = supertest(app);

// Servis tamamen mock'lanır — institution.service.js'in GERÇEK kodu (transaction,
// startTrial, vb.) burada hiç çalışmaz; bu dosya sadece rota/yetki/validasyon
// katmanını test eder (bkz. surgery.test.js'in AYNI deseni).
const mockService = {
  listInstitutions:     vi.fn(),
  getInstitution:       vi.fn(),
  createInstitution:    vi.fn(),
  updateInstitution:    vi.fn(),
  setInstitutionStatus: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  registry.register('institution', mockService);
});

const tok = (groupSlug) => signPlatformAdminAccessToken({
  sub: `admin-${groupSlug}`, email: `${groupSlug}@operio.com`, groupSlug,
});
const superToken  = tok('super');
const destekToken = tok('destek');
const finansToken = tok('finans');
const icerikToken = tok('icerik');

const mockInstitution = { id: 'inst1', name: 'Test Hastanesi', is_active: true };

describe('GET /api/platform-admin/institutions', () => {

  it('token yok → 401', async () => {
    expect((await request.get('/api/platform-admin/institutions')).status).toBe(401);
  });

  it('icerik grubu hiçbir institutions rotasına erişemez (403)', async () => {
    const res = await request.get('/api/platform-admin/institutions').set('Authorization', `Bearer ${icerikToken}`);
    expect(res.status).toBe(403);
  });

  it('super → 200, liste döner', async () => {
    mockService.listInstitutions.mockResolvedValueOnce({ institutions: [mockInstitution], total: 1, page: 1, limit: 20, totalPages: 1 });
    const res = await request.get('/api/platform-admin/institutions').set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(mockService.listInstitutions).toHaveBeenCalledOnce();
  });

  it('destek → 200', async () => {
    mockService.listInstitutions.mockResolvedValueOnce({ institutions: [], total: 0, page: 1, limit: 20, totalPages: 0 });
    expect((await request.get('/api/platform-admin/institutions').set('Authorization', `Bearer ${destekToken}`)).status).toBe(200);
  });

  it('finans → 200', async () => {
    mockService.listInstitutions.mockResolvedValueOnce({ institutions: [], total: 0, page: 1, limit: 20, totalPages: 0 });
    expect((await request.get('/api/platform-admin/institutions').set('Authorization', `Bearer ${finansToken}`)).status).toBe(200);
  });

  it('servis hatası → 500', async () => {
    mockService.listInstitutions.mockRejectedValueOnce(new Error('DB error'));
    expect((await request.get('/api/platform-admin/institutions').set('Authorization', `Bearer ${superToken}`)).status).toBe(500);
  });

});

describe('GET /api/platform-admin/institutions/:id', () => {

  it('icerik → 403', async () => {
    expect((await request.get('/api/platform-admin/institutions/inst1').set('Authorization', `Bearer ${icerikToken}`)).status).toBe(403);
  });

  it('bulunamadı → 404', async () => {
    mockService.getInstitution.mockResolvedValueOnce(null);
    expect((await request.get('/api/platform-admin/institutions/inst1').set('Authorization', `Bearer ${superToken}`)).status).toBe(404);
  });

  it('bulundu → 200', async () => {
    mockService.getInstitution.mockResolvedValueOnce(mockInstitution);
    const res = await request.get('/api/platform-admin/institutions/inst1').set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('inst1');
  });

});

describe('POST /api/platform-admin/institutions', () => {

  const payload = { name: 'Test Hastanesi', contactName: 'Ayşe Yılmaz', email: 'ayse@test-hastane.tr' };

  it('token yok → 401', async () => {
    expect((await request.post('/api/platform-admin/institutions').send(payload)).status).toBe(401);
  });

  it('super kurum oluşturabilir, servis çağrısı doğru argümanlarla yapılır', async () => {
    mockService.createInstitution.mockResolvedValueOnce({ id: 'inst1', name: 'Test Hastanesi' });
    const res = await request.post('/api/platform-admin/institutions').set('Authorization', `Bearer ${superToken}`).send(payload);
    expect(res.status).toBe(201);
    expect(mockService.createInstitution).toHaveBeenCalledOnce();
    const callArg = mockService.createInstitution.mock.calls[0][0];
    expect(callArg.data).toMatchObject({ name: 'Test Hastanesi', contactName: 'Ayşe Yılmaz', email: 'ayse@test-hastane.tr' });
    expect(callArg.actorId).toBe('admin-super');
  });

  it('finans grubu POST yapamaz (403)', async () => {
    expect((await request.post('/api/platform-admin/institutions').set('Authorization', `Bearer ${finansToken}`).send(payload)).status).toBe(403);
  });

  it('destek grubu POST yapamaz (403)', async () => {
    expect((await request.post('/api/platform-admin/institutions').set('Authorization', `Bearer ${destekToken}`).send(payload)).status).toBe(403);
  });

  it('icerik grubu hiçbir institutions rotasına erişemez (403)', async () => {
    expect((await request.post('/api/platform-admin/institutions').set('Authorization', `Bearer ${icerikToken}`).send(payload)).status).toBe(403);
  });

  it('contactName yok → 400', async () => {
    const res = await request.post('/api/platform-admin/institutions').set('Authorization', `Bearer ${superToken}`).send({ name: 'X', email: 'x@test.tr' });
    expect(res.status).toBe(400);
  });

  it('email yok → 400', async () => {
    const res = await request.post('/api/platform-admin/institutions').set('Authorization', `Bearer ${superToken}`).send({ name: 'X', contactName: 'Y' });
    expect(res.status).toBe(400);
  });

  it('servis "e-posta zaten kayıtlı" hatası fırlatırsa (statusCode 409) → 409 döner', async () => {
    mockService.createInstitution.mockRejectedValueOnce(Object.assign(new Error('Bu e-posta zaten kayıtlı'), { statusCode: 409 }));
    const res = await request.post('/api/platform-admin/institutions').set('Authorization', `Bearer ${superToken}`).send(payload);
    expect(res.status).toBe(409);
  });

});

describe('PATCH /api/platform-admin/institutions/:id', () => {

  it('super tüm alanları güncelleyebilir → 200', async () => {
    mockService.updateInstitution.mockResolvedValueOnce({ ...mockInstitution, name: 'Yeni Ad' });
    const res = await request.patch('/api/platform-admin/institutions/inst1').set('Authorization', `Bearer ${superToken}`).send({ name: 'Yeni Ad', bedCount: 50 });
    expect(res.status).toBe(200);
    expect(mockService.updateInstitution).toHaveBeenCalledOnce();
    const callArg = mockService.updateInstitution.mock.calls[0][0];
    expect(callArg.actorGroupSlug).toBe('super');
  });

  it('finans grubu SADECE planSlug alanını gönderebilir — başka alan gönderirse 400', async () => {
    mockService.updateInstitution.mockRejectedValueOnce(Object.assign(new Error('Finans ekibi sadece planSlug alanını güncelleyebilir'), { statusCode: 400 }));
    const res = await request.patch('/api/platform-admin/institutions/inst1').set('Authorization', `Bearer ${finansToken}`).send({ name: 'Yeni Ad' });
    expect(res.status).toBe(400);
  });

  it('finans grubu sadece planSlug gönderirse → 200', async () => {
    mockService.updateInstitution.mockResolvedValueOnce({ ...mockInstitution, subscription: { plan_slug: 'business' } });
    const res = await request.patch('/api/platform-admin/institutions/inst1').set('Authorization', `Bearer ${finansToken}`).send({ planSlug: 'business' });
    expect(res.status).toBe(200);
    const callArg = mockService.updateInstitution.mock.calls[0][0];
    expect(callArg.actorGroupSlug).toBe('finans');
    expect(callArg.data).toEqual({ planSlug: 'business' });
  });

  it('destek grubu PATCH yapamaz (403)', async () => {
    const res = await request.patch('/api/platform-admin/institutions/inst1').set('Authorization', `Bearer ${destekToken}`).send({ planSlug: 'business' });
    expect(res.status).toBe(403);
  });

  it('icerik grubu PATCH yapamaz (403)', async () => {
    const res = await request.patch('/api/platform-admin/institutions/inst1').set('Authorization', `Bearer ${icerikToken}`).send({ planSlug: 'business' });
    expect(res.status).toBe(403);
  });

  it('bulunamadı → 404', async () => {
    mockService.updateInstitution.mockResolvedValueOnce(null);
    expect((await request.patch('/api/platform-admin/institutions/inst1').set('Authorization', `Bearer ${superToken}`).send({ name: 'Yeni Ad' })).status).toBe(404);
  });

});

describe('PATCH /api/platform-admin/institutions/:id/status', () => {

  it('super kurumu pasifleştirebilir → 200', async () => {
    mockService.setInstitutionStatus.mockResolvedValueOnce({ ...mockInstitution, is_active: false });
    const res = await request.patch('/api/platform-admin/institutions/inst1/status').set('Authorization', `Bearer ${superToken}`).send({ isActive: false });
    expect(res.status).toBe(200);
    expect(mockService.setInstitutionStatus).toHaveBeenCalledOnce();
  });

  it('finans grubu status değiştiremez (403)', async () => {
    expect((await request.patch('/api/platform-admin/institutions/inst1/status').set('Authorization', `Bearer ${finansToken}`).send({ isActive: false })).status).toBe(403);
  });

  it('destek grubu status değiştiremez (403)', async () => {
    expect((await request.patch('/api/platform-admin/institutions/inst1/status').set('Authorization', `Bearer ${destekToken}`).send({ isActive: false })).status).toBe(403);
  });

  it('isActive boolean değilse → 400', async () => {
    expect((await request.patch('/api/platform-admin/institutions/inst1/status').set('Authorization', `Bearer ${superToken}`).send({ isActive: 'evet' })).status).toBe(400);
  });

  it('bulunamadı → 404', async () => {
    mockService.setInstitutionStatus.mockResolvedValueOnce(null);
    expect((await request.patch('/api/platform-admin/institutions/inst1/status').set('Authorization', `Bearer ${superToken}`).send({ isActive: false })).status).toBe(404);
  });

});

describe('Cross-boundary (Review Focus)', () => {
  it('hastane access token, institutions rotasına erişemez', async () => {
    const { signAccessToken } = await import('../../src/utils/jwt.js');
    const hospToken = signAccessToken({ sub: 'u1', email: 'a@t.com', roleId: 0, institutionId: 'inst' });
    const res = await request.get('/api/platform-admin/institutions').set('Authorization', `Bearer ${hospToken}`);
    expect([401, 403]).toContain(res.status);
  });
});
