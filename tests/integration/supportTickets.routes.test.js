import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import registry from '../../src/services/_registry.js';
import app from '../../src/app.js';
import { signPlatformAdminAccessToken } from '../../src/utils/platformAdminJwt.js';

const request = supertest(app);

// Servis tamamen mock'lanır — supportTicket.service.js'in GERÇEK kodu burada hiç
// çalışmaz; bu dosya sadece rota/yetki/validasyon katmanını test eder (bkz.
// institutionGroups.routes.test.js'in AYNI deseni). Review Focus'un (LEFT JOIN,
// is_active filtresi YOK) gerçek servis seviyesinde doğrulaması ayrı bir unit test
// dosyasında yapılır: tests/unit/supportTicketService.getTicket.test.js — bu
// dosyadaki mock'lanmış servis testleri o SQL'i hiç çalıştırmaz, sadece rotanın
// servisten döneni olduğu gibi ilettiğini doğrular.
const mockService = {
  listTickets:  vi.fn(),
  getTicket:    vi.fn(),
  updateStatus: vi.fn(),
  addComment:   vi.fn(),
};

// Review Focus — Finding 5: `authenticatePlatformAdmin` artık HER istekte
// `registry.get('platformAdminAccount', ...)`'u `getActiveAccountById(sub)` ile
// çağırıp hesabın GÜNCEL is_active/group_slug'unu DB'den (burada: mock'tan) okur
// (bkz. institutionGroups.routes.test.js'in AYNI deseni).
const mockPlatformAdminAccountService = { getActiveAccountById: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  registry.register('supportTicket', mockService);
  registry.register('platformAdminAccount', mockPlatformAdminAccountService);
  mockPlatformAdminAccountService.getActiveAccountById.mockImplementation(async (id) => {
    const m = /^admin-(super|destek|finans|icerik)$/.exec(id);
    return m ? { is_active: true, group_slug: m[1] } : null;
  });
});

const tok = (groupSlug) => signPlatformAdminAccessToken({
  sub: `admin-${groupSlug}`, email: `${groupSlug}@operio.com`, groupSlug,
});
const superToken  = tok('super');
const destekToken = tok('destek');
const finansToken = tok('finans');
const icerikToken = tok('icerik');

const mockTicket = {
  id: 'tic1', institution_id: 'inst1', type: 'TECHNICAL', priority: 'HIGH',
  status: 'OPEN', subject: 'Giriş yapamıyorum', description: 'Detay',
};
const mockComment = {
  id: 'cmt1', ticket_id: 'tic1', platform_admin_id: 'admin-destek',
  message: 'İnceliyoruz', admin_name: 'Destek Kullanıcısı',
};

describe('Kurum Talepleri', () => {

  describe('GET /api/platform-admin/support-tickets', () => {
    it('token yok → 401', async () => {
      expect((await request.get('/api/platform-admin/support-tickets')).status).toBe(401);
    });

    it('destek grubu talep listesini görür → 200', async () => {
      mockService.listTickets.mockResolvedValueOnce({ tickets: [mockTicket], total: 1, page: 1, limit: 20, totalPages: 1 });
      const res = await request.get('/api/platform-admin/support-tickets').set('Authorization', `Bearer ${destekToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(mockService.listTickets).toHaveBeenCalledOnce();
    });

    it('super her zaman erişir → 200', async () => {
      mockService.listTickets.mockResolvedValueOnce({ tickets: [], total: 0, page: 1, limit: 20, totalPages: 0 });
      expect((await request.get('/api/platform-admin/support-tickets').set('Authorization', `Bearer ${superToken}`)).status).toBe(200);
    });

    it('finans/icerik erişemez (403) — super her zaman erişir', async () => {
      for (const token of [finansToken, icerikToken]) {
        const res = await request.get('/api/platform-admin/support-tickets').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
      }
      mockService.listTickets.mockResolvedValueOnce({ tickets: [], total: 0, page: 1, limit: 20, totalPages: 0 });
      expect((await request.get('/api/platform-admin/support-tickets').set('Authorization', `Bearer ${superToken}`)).status).toBe(200);
    });

    it('status/type/institutionId query filtreleri servise geçer', async () => {
      mockService.listTickets.mockResolvedValueOnce({ tickets: [], total: 0, page: 1, limit: 20, totalPages: 0 });
      // institutionId artık .uuid() ile doğrulanıyor (Minor Finding B) — 'inst1' gibi
      // bir UUID OLMAYAN değer artık 400'e çarpardı, bu yüzden burada gerçek bir UUID
      // kullanılıyor.
      const uuid = '11111111-1111-1111-1111-111111111111';
      await request.get(`/api/platform-admin/support-tickets?status=OPEN&type=BILLING&institutionId=${uuid}`)
        .set('Authorization', `Bearer ${superToken}`);
      const callArg = mockService.listTickets.mock.calls[0][0];
      expect(callArg.status).toBe('OPEN');
      expect(callArg.type).toBe('BILLING');
      expect(callArg.institutionId).toBe(uuid);
    });

    it('geçersiz status değeri (örn. ?status=bogus) → 400, servis hiç çağrılmaz (Minor Finding B)', async () => {
      const res = await request.get('/api/platform-admin/support-tickets?status=bogus')
        .set('Authorization', `Bearer ${superToken}`);
      expect(res.status).toBe(400);
      expect(mockService.listTickets).not.toHaveBeenCalled();
    });

    it('geçersiz type değeri → 400, servis hiç çağrılmaz (Minor Finding B)', async () => {
      const res = await request.get('/api/platform-admin/support-tickets?type=bogus')
        .set('Authorization', `Bearer ${superToken}`);
      expect(res.status).toBe(400);
      expect(mockService.listTickets).not.toHaveBeenCalled();
    });

    it('UUID olmayan institutionId → 400, servis hiç çağrılmaz (Minor Finding B)', async () => {
      const res = await request.get('/api/platform-admin/support-tickets?institutionId=not-a-uuid')
        .set('Authorization', `Bearer ${superToken}`);
      expect(res.status).toBe(400);
      expect(mockService.listTickets).not.toHaveBeenCalled();
    });

    it('servis hatası → 500', async () => {
      mockService.listTickets.mockRejectedValueOnce(new Error('DB error'));
      expect((await request.get('/api/platform-admin/support-tickets').set('Authorization', `Bearer ${superToken}`)).status).toBe(500);
    });
  });

  describe('GET /api/platform-admin/support-tickets/:id', () => {
    it('destek grubu talep detayını görür (yorumlar dahil) → 200', async () => {
      mockService.getTicket.mockResolvedValueOnce({ ...mockTicket, comments: [mockComment] });
      const res = await request.get('/api/platform-admin/support-tickets/tic1').set('Authorization', `Bearer ${destekToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.comments[0].admin_name).toBe('Destek Kullanıcısı');
      expect(mockService.getTicket).toHaveBeenCalledOnce();
    });

    it('finans/icerik erişemez (403)', async () => {
      for (const token of [finansToken, icerikToken]) {
        const res = await request.get('/api/platform-admin/support-tickets/tic1').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
      }
    });

    it('bulunamadı → 404', async () => {
      mockService.getTicket.mockResolvedValueOnce(null);
      const res = await request.get('/api/platform-admin/support-tickets/tic1').set('Authorization', `Bearer ${superToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/platform-admin/support-tickets/:id/status', () => {
    it('destek grubu durumu güncelleyebilir → 200', async () => {
      mockService.updateStatus.mockResolvedValueOnce({ ...mockTicket, status: 'IN_PROGRESS' });
      const res = await request.patch('/api/platform-admin/support-tickets/tic1/status')
        .set('Authorization', `Bearer ${destekToken}`)
        .send({ status: 'IN_PROGRESS' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('IN_PROGRESS');
      const callArg = mockService.updateStatus.mock.calls[0][0];
      expect(callArg.id).toBe('tic1');
      expect(callArg.status).toBe('IN_PROGRESS');
      expect(callArg.actorId).toBe('admin-destek');
    });

    it('finans/icerik erişemez (403)', async () => {
      for (const token of [finansToken, icerikToken]) {
        const res = await request.patch('/api/platform-admin/support-tickets/tic1/status')
          .set('Authorization', `Bearer ${token}`)
          .send({ status: 'CLOSED' });
        expect(res.status).toBe(403);
      }
    });

    it('geçersiz status değeri → 400', async () => {
      const res = await request.patch('/api/platform-admin/support-tickets/tic1/status')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ status: 'ARCHIVED' });
      expect(res.status).toBe(400);
      expect(mockService.updateStatus).not.toHaveBeenCalled();
    });

    it('status yok → 400', async () => {
      const res = await request.patch('/api/platform-admin/support-tickets/tic1/status')
        .set('Authorization', `Bearer ${superToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('bulunamadı → 404', async () => {
      mockService.updateStatus.mockResolvedValueOnce(null);
      const res = await request.patch('/api/platform-admin/support-tickets/tic1/status')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ status: 'CLOSED' });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/platform-admin/support-tickets/:id/comments', () => {
    it('destek grubu yorum ekleyebilir → 201', async () => {
      mockService.addComment.mockResolvedValueOnce(mockComment);
      const res = await request.post('/api/platform-admin/support-tickets/tic1/comments')
        .set('Authorization', `Bearer ${destekToken}`)
        .send({ message: 'İnceliyoruz' });
      expect(res.status).toBe(201);
      const callArg = mockService.addComment.mock.calls[0][0];
      expect(callArg.ticketId).toBe('tic1');
      expect(callArg.adminId).toBe('admin-destek');
      expect(callArg.message).toBe('İnceliyoruz');
    });

    it('finans/icerik erişemez (403)', async () => {
      for (const token of [finansToken, icerikToken]) {
        const res = await request.post('/api/platform-admin/support-tickets/tic1/comments')
          .set('Authorization', `Bearer ${token}`)
          .send({ message: 'deneme' });
        expect(res.status).toBe(403);
      }
    });

    it('message boş → 400', async () => {
      const res = await request.post('/api/platform-admin/support-tickets/tic1/comments')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ message: '' });
      expect(res.status).toBe(400);
    });

    it('bulunamadı (talep yok) → 404', async () => {
      mockService.addComment.mockResolvedValueOnce(null);
      const res = await request.post('/api/platform-admin/support-tickets/tic1/comments')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ message: 'deneme' });
      expect(res.status).toBe(404);
    });
  });

  describe('Cross-boundary (Review Focus)', () => {
    it('hastane access token, support-tickets rotasına erişemez', async () => {
      const { signAccessToken } = await import('../../src/utils/jwt.js');
      const hospToken = signAccessToken({ sub: 'u1', email: 'a@t.com', roleId: 0, institutionId: 'inst' });
      const res = await request.get('/api/platform-admin/support-tickets').set('Authorization', `Bearer ${hospToken}`);
      expect([401, 403]).toContain(res.status);
    });
  });

});
