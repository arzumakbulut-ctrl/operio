import { describe, it, expect, vi, beforeEach } from 'vitest';
import registry from '../../src/services/_registry.js';
import { signPlatformAdminAccessToken } from '../../src/utils/platformAdminJwt.js';

/**
 * Exercises the REAL `authenticatePlatformAdmin` middleware directly (same
 * direct-unit-test-of-a-middleware-function pattern as `tests/unit/
 * kioskRoomAuth.test.js`), bypassing supertest/app entirely.
 *
 * Final review Finding 5: the old middleware trusted `groupSlug` (and implicitly
 * that the account was still active) straight from the JWT payload, with no DB
 * check — so a deactivated or demoted 'super' account kept full access for up to
 * the access-token TTL. The fix adds a real-time `getActiveAccountById` lookup
 * (via the established `registry` DI pattern, matching `kioskRoomAuth.js`'s own
 * use of `registry.get('kiosk', ...)`) and uses the FRESH `group_slug` from that
 * lookup — not the token's own claim — for `req.platformAdmin.groupSlug`.
 */
const { authenticatePlatformAdmin } = await import('../../src/middleware/platformAdminAuth.js');

const mockAccountService = { getActiveAccountById: vi.fn() };

function makeRes() {
  const json = vi.fn();
  const res = { status: vi.fn(() => ({ json })) };
  return { res, json };
}

function makeReq(token) {
  return { headers: token ? { authorization: `Bearer ${token}` } : {} };
}

beforeEach(() => {
  vi.clearAllMocks();
  registry.register('platformAdminAccount', mockAccountService);
});

describe('authenticatePlatformAdmin', () => {
  it('token yoksa 401 döner, DB hiç sorgulanmaz', async () => {
    const req = makeReq(undefined);
    const { res } = makeRes();
    const next = vi.fn();

    await authenticatePlatformAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(mockAccountService.getActiveAccountById).not.toHaveBeenCalled();
  });

  it('geçersiz/bozuk token → 401, DB hiç sorgulanmaz', async () => {
    const req = makeReq('not-a-real-jwt');
    const { res } = makeRes();
    const next = vi.fn();

    await authenticatePlatformAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(mockAccountService.getActiveAccountById).not.toHaveBeenCalled();
  });

  it('token geçerli AMA hesap artık is_active=false (deaktif edilmiş) → 401, next() ÇAĞRILMAZ (token süresi önemsiz)', async () => {
    const token = signPlatformAdminAccessToken({ sub: 'admin-1', email: 'a@operio.com', groupSlug: 'super' });
    const req = makeReq(token);
    const { res } = makeRes();
    const next = vi.fn();

    mockAccountService.getActiveAccountById.mockResolvedValueOnce({ is_active: false, group_slug: 'super' });

    await authenticatePlatformAdmin(req, res, next);

    expect(mockAccountService.getActiveAccountById).toHaveBeenCalledWith('admin-1');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('token geçerli AMA hesap artık hiç yok (silinmiş) → 401, next() ÇAĞRILMAZ', async () => {
    const token = signPlatformAdminAccessToken({ sub: 'admin-deleted', email: 'a@operio.com', groupSlug: 'super' });
    const req = makeReq(token);
    const { res } = makeRes();
    const next = vi.fn();

    mockAccountService.getActiveAccountById.mockResolvedValueOnce(null);

    await authenticatePlatformAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('hesap aktif VE token\'daki groupSlug ile DB\'nin GÜNCEL group_slug\'u AYNI → next() çağrılır, req.platformAdmin.groupSlug dolar', async () => {
    const token = signPlatformAdminAccessToken({ sub: 'admin-1', email: 'a@operio.com', groupSlug: 'super' });
    const req = makeReq(token);
    const { res } = makeRes();
    const next = vi.fn();

    mockAccountService.getActiveAccountById.mockResolvedValueOnce({ is_active: true, group_slug: 'super' });

    await authenticatePlatformAdmin(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.platformAdmin).toMatchObject({ sub: 'admin-1', email: 'a@operio.com', groupSlug: 'super' });
  });

  it('DEMOTION senaryosu: token\'daki groupSlug HÂLÂ \'super\' iddia ediyor ama DB\'deki GÜNCEL group_slug başka bir gruba taşınmış → req.platformAdmin.groupSlug DB\'nin GÜNCEL değerini taşır, token\'ın BAYAT iddiasını DEĞİL (Review Focus — Finding 5)', async () => {
    // Bu token, admin 'super' İKEN imzalandı — sonra hesap 'destek'e taşındı (DB güncel).
    const staleToken = signPlatformAdminAccessToken({ sub: 'admin-1', email: 'a@operio.com', groupSlug: 'super' });
    const req = makeReq(staleToken);
    const { res } = makeRes();
    const next = vi.fn();

    mockAccountService.getActiveAccountById.mockResolvedValueOnce({ is_active: true, group_slug: 'destek' });

    await authenticatePlatformAdmin(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.platformAdmin.groupSlug).toBe('destek'); // DB'nin güncel değeri — token'ın 'super' iddiası DEĞİL
  });

  it('DB sorgusu hata fırlatırsa next(err) ile errorHandler\'a devredilir (401/200 DEĞİL)', async () => {
    const token = signPlatformAdminAccessToken({ sub: 'admin-1', email: 'a@operio.com', groupSlug: 'super' });
    const req = makeReq(token);
    const { res } = makeRes();
    const next = vi.fn();

    const dbError = new Error('connection terminated');
    mockAccountService.getActiveAccountById.mockRejectedValueOnce(dbError);

    await authenticatePlatformAdmin(req, res, next);

    expect(next).toHaveBeenCalledWith(dbError);
    expect(res.status).not.toHaveBeenCalled();
  });
});
