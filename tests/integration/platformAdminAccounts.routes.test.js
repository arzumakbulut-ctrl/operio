import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import registry from '../../src/services/_registry.js';
import app from '../../src/app.js';
import { signPlatformAdminAccessToken } from '../../src/utils/platformAdminJwt.js';

const request = supertest(app);

// Servis tamamen mock'lanır — platformAdminAccount.service.js'in GERÇEK kodu (son aktif
// süper yönetici kilidi dahil) burada hiç çalışmaz; bu dosya sadece rota/yetki/
// validasyon katmanını test eder (bkz. institutionGroups.routes.test.js'in AYNI deseni).
// Gerçek servisin race-safety davranışı platformAdminAccountService.updateAccount.test.js'te
// (ayrı bir unit test, require.cache fake-db enjeksiyonuyla) doğrulanır.
const mockService = {
  listGroups:    vi.fn(),
  listAccounts:  vi.fn(),
  createAccount: vi.fn(),
  updateAccount: vi.fn(),
  // Review Focus — Finding 5: `authenticatePlatformAdmin` artık HER istekte bu
  // servisin `getActiveAccountById(sub)`'unu çağırıp hesabın GÜNCEL is_active/
  // group_slug'unu okur (bkz. institutionGroups.routes.test.js'in AYNI deseni) —
  // bu dosya SERVİSİ ZATEN TAMAMEN mock'ladığı için (diğer 4 dosyadaki gibi
  // registry'ye düşüp GERÇEK servise ulaşmak yerine), bu metod da AYNI mock
  // nesnesine eklenir.
  getActiveAccountById: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  registry.register('platformAdminAccount', mockService);
  mockService.getActiveAccountById.mockImplementation(async (id) => {
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

const lastSuperId = 'admin-last-super';

const mockGroups = [
  { slug: 'super',   display_name: 'Süper Yöneticiler',     kullaniciSayisi: 1 },
  { slug: 'destek',  display_name: 'Destek Ekibi',          kullaniciSayisi: 2 },
  { slug: 'finans',  display_name: 'Finans Ekibi',          kullaniciSayisi: 1 },
  { slug: 'icerik',  display_name: 'İçerik Yöneticileri',   kullaniciSayisi: 0 },
];

const mockAccount = {
  id: 'admin-2', email: 'yeni@operio.com', full_name: 'Yeni Yönetici',
  group_slug: 'destek', is_active: true, created_at: new Date().toISOString(),
};

describe('Platform-Admin Hesap Yönetimi', () => {

  describe('GET /api/platform-admin/accounts/groups', () => {
    it('token yok → 401', async () => {
      expect((await request.get('/api/platform-admin/accounts/groups')).status).toBe(401);
    });

    it('super sabit 4 grubu + kullaniciSayisi\'yi alabilir → 200', async () => {
      mockService.listGroups.mockResolvedValueOnce(mockGroups);
      const res = await request.get('/api/platform-admin/accounts/groups').set('Authorization', `Bearer ${superToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(4);
      expect(res.body.data.map(g => g.slug)).toEqual(['super', 'destek', 'finans', 'icerik']);
      expect(mockService.listGroups).toHaveBeenCalledOnce();
    });

    it('destek/finans/icerik erişemez (sadece super)', async () => {
      for (const token of [destekToken, finansToken, icerikToken]) {
        const res = await request.get('/api/platform-admin/accounts/groups').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
      }
    });

    it('servis hatası → 500', async () => {
      mockService.listGroups.mockRejectedValueOnce(new Error('DB error'));
      const res = await request.get('/api/platform-admin/accounts/groups').set('Authorization', `Bearer ${superToken}`);
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/platform-admin/accounts', () => {
    it('token yok → 401', async () => {
      expect((await request.get('/api/platform-admin/accounts')).status).toBe(401);
    });

    it('super hesap listesini alabilir → 200', async () => {
      mockService.listAccounts.mockResolvedValueOnce([mockAccount]);
      const res = await request.get('/api/platform-admin/accounts').set('Authorization', `Bearer ${superToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(mockService.listAccounts).toHaveBeenCalledOnce();
    });

    it('destek/finans/icerik erişemez (sadece super)', async () => {
      for (const token of [destekToken, finansToken, icerikToken]) {
        const res = await request.get('/api/platform-admin/accounts').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
      }
    });
  });

  describe('POST /api/platform-admin/accounts', () => {
    it('super yeni platform-admin hesabı oluşturabilir, sabit 4 gruptan birine atar', async () => {
      mockService.createAccount.mockResolvedValueOnce({ ...mockAccount, temporaryPassword: 'Xk9#mPq2@Lw7' });
      const res = await request.post('/api/platform-admin/accounts')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ email: 'yeni@operio.com', fullName: 'Yeni Yönetici', groupSlug: 'destek' });
      expect(res.status).toBe(201);
      expect(res.body.data.temporaryPassword).toBe('Xk9#mPq2@Lw7');
      expect(mockService.createAccount).toHaveBeenCalledOnce();
      const callArg = mockService.createAccount.mock.calls[0][0];
      expect(callArg.data.groupSlug).toBe('destek');
      expect(callArg.data.email).toBe('yeni@operio.com');
      expect(callArg.actorId).toBe('admin-super');
    });

    it('geçersiz bir group_slug (örn. "yeni-grup") ile hesap oluşturma 400 döner', async () => {
      const res = await request.post('/api/platform-admin/accounts')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ email: 'yeni@operio.com', fullName: 'Yeni Yönetici', groupSlug: 'yeni-grup' });
      expect(res.status).toBe(400);
      expect(mockService.createAccount).not.toHaveBeenCalled();
    });

    it('destek/finans/icerik erişemez (sadece super)', async () => {
      for (const token of [destekToken, finansToken, icerikToken]) {
        const res = await request.post('/api/platform-admin/accounts')
          .set('Authorization', `Bearer ${token}`)
          .send({ email: 'yeni@operio.com', fullName: 'Yeni Yönetici', groupSlug: 'destek' });
        expect(res.status).toBe(403);
      }
    });

    it('email yok → 400', async () => {
      const res = await request.post('/api/platform-admin/accounts')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ fullName: 'Yeni Yönetici', groupSlug: 'destek' });
      expect(res.status).toBe(400);
    });

    it('servis 409 (e-posta zaten kayıtlı) → route 409 yansıtır', async () => {
      mockService.createAccount.mockRejectedValueOnce(
        Object.assign(new Error('Bu e-posta zaten kayıtlı'), { statusCode: 409 })
      );
      const res = await request.post('/api/platform-admin/accounts')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ email: 'yeni@operio.com', fullName: 'Yeni Yönetici', groupSlug: 'destek' });
      expect(res.status).toBe(409);
    });
  });

  describe('PATCH /api/platform-admin/accounts/:id', () => {
    it('super bir hesabı güncelleyebilir → 200', async () => {
      mockService.updateAccount.mockResolvedValueOnce({ ...mockAccount, full_name: 'Güncellenmiş Ad' });
      const res = await request.patch('/api/platform-admin/accounts/admin-2')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ fullName: 'Güncellenmiş Ad' });
      expect(res.status).toBe(200);
      expect(mockService.updateAccount).toHaveBeenCalledOnce();
      const callArg = mockService.updateAccount.mock.calls[0][0];
      expect(callArg.id).toBe('admin-2');
      expect(callArg.data.fullName).toBe('Güncellenmiş Ad');
      expect(callArg.actorId).toBe('admin-super');
    });

    it('bulunamadı → 404', async () => {
      mockService.updateAccount.mockResolvedValueOnce(null);
      const res = await request.patch('/api/platform-admin/accounts/admin-2')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ fullName: 'Güncellenmiş Ad' });
      expect(res.status).toBe(404);
    });

    it('destek/finans/icerik erişemez (sadece super)', async () => {
      for (const token of [destekToken, finansToken, icerikToken]) {
        const res = await request.patch('/api/platform-admin/accounts/admin-2')
          .set('Authorization', `Bearer ${token}`)
          .send({ fullName: 'Güncellenmiş Ad' });
        expect(res.status).toBe(403);
      }
    });

    it('geçersiz groupSlug ile güncelleme → 400', async () => {
      const res = await request.patch('/api/platform-admin/accounts/admin-2')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ groupSlug: 'yeni-grup' });
      expect(res.status).toBe(400);
      expect(mockService.updateAccount).not.toHaveBeenCalled();
    });

    it('tek aktif süper yönetici pasife alınmaya/silinmeye çalışılırsa servis 409/400 fırlatır, route bunu yansıtır (Review Focus)', async () => {
      mockService.updateAccount.mockRejectedValueOnce(
        Object.assign(new Error('Son aktif süper yönetici pasife alınamaz'), { statusCode: 409 })
      );
      const res = await request.patch(`/api/platform-admin/accounts/${lastSuperId}`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ isActive: false });
      expect(res.status).toBe(409);
    });

    it('tek aktif süper yönetici groupSlug ile BAŞKA bir gruba taşınmaya çalışılırsa (isActive gönderilmese de) servis 409 fırlatır, route bunu yansıtır (Review Focus — Critical fix)', async () => {
      mockService.updateAccount.mockRejectedValueOnce(
        Object.assign(new Error('Son aktif süper yönetici pasife alınamaz veya süper grubundan çıkarılamaz'), { statusCode: 409 })
      );
      const res = await request.patch(`/api/platform-admin/accounts/${lastSuperId}`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ groupSlug: 'destek' });
      expect(res.status).toBe(409);
      const callArg = mockService.updateAccount.mock.calls[0][0];
      expect(callArg.data).toEqual({ groupSlug: 'destek' });
    });
  });

  describe('Cross-boundary (Review Focus)', () => {
    it('hastane access token, accounts rotasına erişemez', async () => {
      const { signAccessToken } = await import('../../src/utils/jwt.js');
      const hospToken = signAccessToken({ sub: 'u1', email: 'a@t.com', roleId: 0, institutionId: 'inst' });
      const res = await request.get('/api/platform-admin/accounts').set('Authorization', `Bearer ${hospToken}`);
      expect([401, 403]).toContain(res.status);
    });
  });

});
