import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import registry from '../../src/services/_registry.js';
import app from '../../src/app.js';
import { signPlatformAdminAccessToken } from '../../src/utils/platformAdminJwt.js';

const request = supertest(app);

// Servis tamamen mock'lanır — platformSettings.service.js'in GERÇEK SQL'i burada
// çalışmaz; bu dosya rota/yetki/validasyon katmanını test eder (bkz.
// institutionGroups.routes.test.js'in AYNI deseni).
const mockService = {
  getSettings:    vi.fn(),
  updateSettings: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  registry.register('platformSettings', mockService);
});

const tok = (groupSlug) => signPlatformAdminAccessToken({
  sub: `admin-${groupSlug}`, email: `${groupSlug}@operio.com`, groupSlug,
});
const superToken  = tok('super');
const destekToken = tok('destek');
const finansToken = tok('finans');
const icerikToken = tok('icerik');

const mockSettings = {
  id: 1, platform_name: 'Operio', support_email: null, billing_email: null,
  trial_days: 14, auto_billing: true, maintenance_mode: false,
  backup_frequency: 'Günlük', last_backup_at: null,
};

const BASE = '/api/platform-admin/platform-settings';

describe('Sistem Ayarları', () => {

  describe('GET /api/platform-admin/settings', () => {
    it('token yok → 401', async () => {
      expect((await request.get(BASE)).status).toBe(401);
    });

    it('super ayarları okuyabilir → 200', async () => {
      mockService.getSettings.mockResolvedValueOnce(mockSettings);
      const res = await request.get(BASE).set('Authorization', `Bearer ${superToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(mockSettings);
      expect(mockService.getSettings).toHaveBeenCalledOnce();
    });

    it('destek/finans/icerik erişemez (403) — sadece super', async () => {
      for (const token of [destekToken, finansToken, icerikToken]) {
        const res = await request.get(BASE).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
      }
      expect(mockService.getSettings).not.toHaveBeenCalled();
    });

    it('servis hatası → 500', async () => {
      mockService.getSettings.mockRejectedValueOnce(new Error('DB error'));
      expect((await request.get(BASE).set('Authorization', `Bearer ${superToken}`)).status).toBe(500);
    });
  });

  describe('PATCH /api/platform-admin/settings', () => {
    it('super ayarları güncelleyebilir → 200, servise camelCase alanlar + actorId geçer', async () => {
      mockService.updateSettings.mockResolvedValueOnce({ ...mockSettings, maintenance_mode: true });
      const res = await request.patch(BASE)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ maintenanceMode: true, trialDays: 30 });
      expect(res.status).toBe(200);
      expect(mockService.updateSettings).toHaveBeenCalledOnce();
      const callArg = mockService.updateSettings.mock.calls[0][0];
      expect(callArg.data).toEqual({ maintenanceMode: true, trialDays: 30 });
      expect(callArg.actorId).toBe('admin-super');
    });

    it('destek/finans/icerik erişemez (403) — sadece super', async () => {
      for (const token of [destekToken, finansToken, icerikToken]) {
        const res = await request.patch(BASE)
          .set('Authorization', `Bearer ${token}`)
          .send({ maintenanceMode: true });
        expect(res.status).toBe(403);
      }
      expect(mockService.updateSettings).not.toHaveBeenCalled();
    });

    it('geçersiz e-posta → 400', async () => {
      const res = await request.patch(BASE)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ supportEmail: 'bu-bir-eposta-degil' });
      expect(res.status).toBe(400);
      expect(mockService.updateSettings).not.toHaveBeenCalled();
    });

    it('trialDays pozitif tam sayı değilse → 400', async () => {
      for (const trialDays of [0, -5, 2.5, 'abc']) {
        const res = await request.patch(BASE)
          .set('Authorization', `Bearer ${superToken}`)
          .send({ trialDays });
        expect(res.status).toBe(400);
      }
    });

    it('maintenanceMode boolean değilse → 400', async () => {
      const res = await request.patch(BASE)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ maintenanceMode: 'evet' });
      expect(res.status).toBe(400);
    });
  });

  describe('Cross-boundary', () => {
    it('hastane access token, platform settings rotasına erişemez', async () => {
      const { signAccessToken } = await import('../../src/utils/jwt.js');
      const hospToken = signAccessToken({ sub: 'u1', email: 'a@t.com', roleId: 0, institutionId: 'inst' });
      const res = await request.get(BASE).set('Authorization', `Bearer ${hospToken}`);
      expect([401, 403]).toContain(res.status);
    });
  });

});
