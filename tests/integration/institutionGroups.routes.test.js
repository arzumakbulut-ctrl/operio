import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import registry from '../../src/services/_registry.js';
import app from '../../src/app.js';
import { signPlatformAdminAccessToken } from '../../src/utils/platformAdminJwt.js';

const request = supertest(app);

// Servis tamamen mock'lanır — institutionGroup.service.js'in GERÇEK kodu (transaction
// dahil) burada hiç çalışmaz; bu dosya sadece rota/yetki/validasyon katmanını test
// eder (bkz. institutions.routes.test.js'in AYNI deseni).
const mockService = {
  listGroups:        vi.fn(),
  createGroup:        vi.fn(),
  updateGroup:        vi.fn(),
  deleteGroup:        vi.fn(),
  assignInstitution:  vi.fn(),
  removeInstitution:  vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  registry.register('institutionGroup', mockService);
});

const tok = (groupSlug) => signPlatformAdminAccessToken({
  sub: `admin-${groupSlug}`, email: `${groupSlug}@operio.com`, groupSlug,
});
const superToken  = tok('super');
const destekToken = tok('destek');
const finansToken = tok('finans');
const icerikToken = tok('icerik');

const mockGroup = { id: 'grp1', name: 'Acıbadem Grubu', institutions: [] };

describe('Kurum Grupları CRUD', () => {

  describe('GET /api/platform-admin/institution-groups', () => {
    it('token yok → 401', async () => {
      expect((await request.get('/api/platform-admin/institution-groups')).status).toBe(401);
    });

    it('super grup listesini alabilir → 200', async () => {
      mockService.listGroups.mockResolvedValueOnce([mockGroup]);
      const res = await request.get('/api/platform-admin/institution-groups').set('Authorization', `Bearer ${superToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(mockService.listGroups).toHaveBeenCalledOnce();
    });

    it('finans/destek/icerik erişemez (sadece super)', async () => {
      for (const token of [finansToken, destekToken, icerikToken]) {
        const res = await request.get('/api/platform-admin/institution-groups').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
      }
    });

    it('servis hatası → 500', async () => {
      mockService.listGroups.mockRejectedValueOnce(new Error('DB error'));
      expect((await request.get('/api/platform-admin/institution-groups').set('Authorization', `Bearer ${superToken}`)).status).toBe(500);
    });
  });

  describe('POST /api/platform-admin/institution-groups', () => {
    it('super grup oluşturabilir', async () => {
      mockService.createGroup.mockResolvedValueOnce(mockGroup);
      const res = await request.post('/api/platform-admin/institution-groups')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ name: 'Acıbadem Grubu' });
      expect(res.status).toBe(201);
      expect(mockService.createGroup).toHaveBeenCalledOnce();
      const callArg = mockService.createGroup.mock.calls[0][0];
      expect(callArg.name).toBe('Acıbadem Grubu');
      expect(callArg.actorId).toBe('admin-super');
    });

    it('finans/destek/icerik erişemez (sadece super)', async () => {
      for (const token of [finansToken, destekToken, icerikToken]) {
        const res = await request.post('/api/platform-admin/institution-groups')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'Acıbadem Grubu' });
        expect(res.status).toBe(403);
      }
    });

    it('name çok kısa → 400', async () => {
      const res = await request.post('/api/platform-admin/institution-groups')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ name: 'A' });
      expect(res.status).toBe(400);
    });

    it('name yok → 400', async () => {
      const res = await request.post('/api/platform-admin/institution-groups')
        .set('Authorization', `Bearer ${superToken}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/platform-admin/institution-groups/:id', () => {
    it('super grup adını güncelleyebilir → 200', async () => {
      mockService.updateGroup.mockResolvedValueOnce({ ...mockGroup, name: 'Yeni Ad' });
      const res = await request.patch('/api/platform-admin/institution-groups/grp1')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ name: 'Yeni Ad' });
      expect(res.status).toBe(200);
      expect(mockService.updateGroup).toHaveBeenCalledOnce();
      const callArg = mockService.updateGroup.mock.calls[0][0];
      expect(callArg.id).toBe('grp1');
      expect(callArg.name).toBe('Yeni Ad');
    });

    it('finans/destek/icerik erişemez (sadece super)', async () => {
      for (const token of [finansToken, destekToken, icerikToken]) {
        const res = await request.patch('/api/platform-admin/institution-groups/grp1')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'Yeni Ad' });
        expect(res.status).toBe(403);
      }
    });

    it('bulunamadı → 404', async () => {
      mockService.updateGroup.mockResolvedValueOnce(null);
      const res = await request.patch('/api/platform-admin/institution-groups/grp1')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ name: 'Yeni Ad' });
      expect(res.status).toBe(404);
    });

    it('name yok → 400', async () => {
      const res = await request.patch('/api/platform-admin/institution-groups/grp1')
        .set('Authorization', `Bearer ${superToken}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/platform-admin/institution-groups/:id', () => {
    it('super grubu silebilir (önce üye kurumların group_id NULL yapılır) → 200', async () => {
      mockService.deleteGroup.mockResolvedValueOnce(mockGroup);
      const res = await request.delete('/api/platform-admin/institution-groups/grp1')
        .set('Authorization', `Bearer ${superToken}`);
      expect(res.status).toBe(200);
      expect(mockService.deleteGroup).toHaveBeenCalledOnce();
      const callArg = mockService.deleteGroup.mock.calls[0][0];
      expect(callArg.id).toBe('grp1');
      expect(callArg.actorId).toBe('admin-super');
    });

    it('finans/destek/icerik erişemez (sadece super)', async () => {
      for (const token of [finansToken, destekToken, icerikToken]) {
        const res = await request.delete('/api/platform-admin/institution-groups/grp1')
          .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
      }
    });

    it('bulunamadı → 404', async () => {
      mockService.deleteGroup.mockResolvedValueOnce(null);
      const res = await request.delete('/api/platform-admin/institution-groups/grp1')
        .set('Authorization', `Bearer ${superToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/platform-admin/institution-groups/:groupId/institutions/:institutionId', () => {
    it('bir kurumu bir gruba atama servis çağrısı yapılır (tek grup kuralı servis katmanında)', async () => {
      mockService.assignInstitution.mockResolvedValueOnce();
      const res = await request.post('/api/platform-admin/institution-groups/grp1/institutions/inst1')
        .set('Authorization', `Bearer ${superToken}`);
      expect(res.status).toBe(200);
      expect(mockService.assignInstitution).toHaveBeenCalledOnce();
      const callArg = mockService.assignInstitution.mock.calls[0][0];
      expect(callArg.groupId).toBe('grp1');
      expect(callArg.institutionId).toBe('inst1');
      expect(callArg.actorId).toBe('admin-super');
    });

    it('finans/destek/icerik erişemez (sadece super)', async () => {
      for (const token of [finansToken, destekToken, icerikToken]) {
        const res = await request.post('/api/platform-admin/institution-groups/grp1/institutions/inst1')
          .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
      }
    });
  });

  describe('DELETE /api/platform-admin/institution-groups/:groupId/institutions/:institutionId', () => {
    it('bir kurumu gruptan çıkarma servis çağrısı yapılır, URL\'deki groupId servise GEÇER', async () => {
      mockService.removeInstitution.mockResolvedValueOnce();
      const res = await request.delete('/api/platform-admin/institution-groups/grp1/institutions/inst1')
        .set('Authorization', `Bearer ${superToken}`);
      expect(res.status).toBe(200);
      expect(mockService.removeInstitution).toHaveBeenCalledOnce();
      const callArg = mockService.removeInstitution.mock.calls[0][0];
      expect(callArg.groupId).toBe('grp1');
      expect(callArg.institutionId).toBe('inst1');
      expect(callArg.actorId).toBe('admin-super');
    });

    it('kurum URL\'deki groupId\'de DEĞİLSE (başka bir grupta ya da groupId yok) → servis 409 fırlatır, route 409 döner', async () => {
      mockService.removeInstitution.mockRejectedValueOnce(
        Object.assign(new Error('Kurum bu grupta değil'), { statusCode: 409 })
      );
      const res = await request.delete('/api/platform-admin/institution-groups/grp-wrong/institutions/inst1')
        .set('Authorization', `Bearer ${superToken}`);
      expect(res.status).toBe(409);
    });

    it('finans/destek/icerik erişemez (sadece super)', async () => {
      for (const token of [finansToken, destekToken, icerikToken]) {
        const res = await request.delete('/api/platform-admin/institution-groups/grp1/institutions/inst1')
          .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
      }
    });
  });

  describe('Cross-boundary (Review Focus)', () => {
    it('hastane access token, institution-groups rotasına erişemez', async () => {
      const { signAccessToken } = await import('../../src/utils/jwt.js');
      const hospToken = signAccessToken({ sub: 'u1', email: 'a@t.com', roleId: 0, institutionId: 'inst' });
      const res = await request.get('/api/platform-admin/institution-groups').set('Authorization', `Bearer ${hospToken}`);
      expect([401, 403]).toContain(res.status);
    });
  });

});
