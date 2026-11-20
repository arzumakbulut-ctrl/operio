import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { signAccessToken } from '../../src/utils/jwt.js';
import registry from '../../src/services/_registry.js';
import app from '../../src/app.js';

const request = supertest(app);

// Mock servis
const mockService = {
  listSurgeries:    vi.fn(),
  getSurgery:       vi.fn(),
  createSurgery:    vi.fn(),
  updateSurgery:    vi.fn(),
  deleteSurgery:    vi.fn(),
  assignTeamMember: vi.fn(),
  removeTeamMember: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  // Her testten önce mock servisini registry'ye yükle
  registry.register('surgery', mockService);
});

const tok = (roleId) => signAccessToken({ sub: `u${roleId}`, email: `e@t.com`, roleId, institutionId: 'inst-uuid' });
const mockSurgery = { id: 'surg-uuid', institution_id: 'inst-uuid', title: 'Test', status: 'WAITING', scheduled_start: '2025-06-01T09:00:00Z' };

describe('Surgery — GET /api/surgeries', () => {

  it('token yok → 401', async () => {
    expect((await request.get('/api/surgeries')).status).toBe(401);
  });

  it('geçersiz token → 401', async () => {
    expect((await request.get('/api/surgeries').set('Authorization', 'Bearer bad.tok')).status).toBe(401);
  });

  it('admin → 200', async () => {
    mockService.listSurgeries.mockResolvedValueOnce({ surgeries: [mockSurgery], total: 1, page: 1, limit: 50, totalPages: 1 });
    const res = await request.get('/api/surgeries').set('Authorization', `Bearer ${tok(0)}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(mockService.listSurgeries).toHaveBeenCalledOnce();
  });

  it('doktor → 200', async () => {
    mockService.listSurgeries.mockResolvedValueOnce({ surgeries: [], total: 0, page: 1, limit: 50, totalPages: 0 });
    expect((await request.get('/api/surgeries').set('Authorization', `Bearer ${tok(6)}`)).status).toBe(200);
  });

  it('geçersiz page → 400', async () => {
    expect((await request.get('/api/surgeries?page=-1').set('Authorization', `Bearer ${tok(0)}`)).status).toBe(400);
  });

  it('servis hatası → 500', async () => {
    mockService.listSurgeries.mockRejectedValueOnce(new Error('DB error'));
    expect((await request.get('/api/surgeries').set('Authorization', `Bearer ${tok(0)}`)).status).toBe(500);
  });

});

describe('Surgery — POST /api/surgeries', () => {

  const payload = { title: 'Test', scheduledStart: '2025-06-01T09:00:00.000Z' };

  it('token yok → 401', async () => { expect((await request.post('/api/surgeries').send(payload)).status).toBe(401); });
  it('title yok → 400', async () => { expect((await request.post('/api/surgeries').set('Authorization', `Bearer ${tok(0)}`).send({ scheduledStart: '2025-06-01T09:00:00.000Z' })).status).toBe(400); });
  it('tarih yok → 400', async () => { expect((await request.post('/api/surgeries').set('Authorization', `Bearer ${tok(0)}`).send({ title: 'Test' })).status).toBe(400); });
  it('geçersiz tarih → 400', async () => { expect((await request.post('/api/surgeries').set('Authorization', `Bearer ${tok(0)}`).send({ title: 'T', scheduledStart: 'gecersiz' })).status).toBe(400); });

  it('admin → 201', async () => {
    mockService.createSurgery.mockResolvedValueOnce(mockSurgery);
    expect((await request.post('/api/surgeries').set('Authorization', `Bearer ${tok(0)}`).send(payload)).status).toBe(201);
  });

  it('hemşire (1) → 201', async () => {
    mockService.createSurgery.mockResolvedValueOnce(mockSurgery);
    expect((await request.post('/api/surgeries').set('Authorization', `Bearer ${tok(1)}`).send(payload)).status).toBe(201);
  });

  it('sekreter (7) → 201', async () => {
    mockService.createSurgery.mockResolvedValueOnce(mockSurgery);
    expect((await request.post('/api/surgeries').set('Authorization', `Bearer ${tok(7)}`).send(payload)).status).toBe(201);
  });

  [3, 4, 5, 6, 9, 10].forEach(roleId => {
    it(`role=${roleId} → 403`, async () => {
      expect((await request.post('/api/surgeries').set('Authorization', `Bearer ${tok(roleId)}`).send(payload)).status).toBe(403);
    });
  });

});

describe('Surgery — PATCH /api/surgeries/:id', () => {

  const UUID = '550e8400-e29b-41d4-a716-446655440000';

  it('doktor → 403', async () => { expect((await request.patch(`/api/surgeries/${UUID}`).set('Authorization', `Bearer ${tok(6)}`).send({ status: 'IN_PROGRESS' })).status).toBe(403); });
  it('geçersiz status → 400', async () => { expect((await request.patch(`/api/surgeries/${UUID}`).set('Authorization', `Bearer ${tok(0)}`).send({ status: 'GECERSIZ' })).status).toBe(400); });

  it('bulunamadı → 404', async () => {
    mockService.updateSurgery.mockResolvedValueOnce(null);
    expect((await request.patch(`/api/surgeries/${UUID}`).set('Authorization', `Bearer ${tok(0)}`).send({ status: 'IN_PROGRESS' })).status).toBe(404);
  });

  it('başarılı → 200', async () => {
    mockService.updateSurgery.mockResolvedValueOnce({ ...mockSurgery, status: 'IN_PROGRESS' });
    expect((await request.patch(`/api/surgeries/${UUID}`).set('Authorization', `Bearer ${tok(0)}`).send({ status: 'IN_PROGRESS' })).status).toBe(200);
  });

});

describe('Surgery — DELETE /api/surgeries/:id', () => {

  const UUID = '550e8400-e29b-41d4-a716-446655440000';

  it('hemşire → 403', async () => { expect((await request.delete(`/api/surgeries/${UUID}`).set('Authorization', `Bearer ${tok(1)}`)).status).toBe(403); });

  it('bulunamadı → 404', async () => {
    mockService.deleteSurgery.mockResolvedValueOnce(false);
    expect((await request.delete(`/api/surgeries/${UUID}`).set('Authorization', `Bearer ${tok(0)}`)).status).toBe(404);
  });

  it('admin → 200', async () => {
    mockService.deleteSurgery.mockResolvedValueOnce(true);
    expect((await request.delete(`/api/surgeries/${UUID}`).set('Authorization', `Bearer ${tok(0)}`)).status).toBe(200);
  });

  [1,2,3,4,5,6,7,8,9,10].forEach(r => {
    it(`role=${r} → 403`, async () => {
      expect((await request.delete(`/api/surgeries/${UUID}`).set('Authorization', `Bearer ${tok(r)}`)).status).toBe(403);
    });
  });

});

describe('Surgery — IDOR', () => {
  it('bulunamayan ameliyat → 404', async () => {
    mockService.getSurgery.mockResolvedValueOnce(null);
    expect((await request.get('/api/surgeries/550e8400-e29b-41d4-a716-446655440000').set('Authorization', `Bearer ${tok(1)}`)).status).toBe(404);
  });
});
