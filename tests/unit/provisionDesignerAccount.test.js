import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

/**
 * scripts/provision-designer-account.js auth.service.js'i düz bir top-level `require()`
 * ile yükler. Vitest'in `vi.mock` kaydı bu iç require zincirini yakalamaz (bkz.
 * tests/unit/spotify.service.test.js ve tests/unit/kioskService.recordTimeoutRead.test.js),
 * bu yüzden burada Node'un native `require.cache`'ine sahte bir auth.service modülü
 * enjekte edilip script ondan yeniden require edilir. Gerçek register() (DB'ye dokunan)
 * hiç çağrılmaz.
 */
const nodeRequire = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const authServicePath = path.resolve(here, '../../src/services/auth.service.js');
const scriptPath = path.resolve(here, '../../scripts/provision-designer-account.js');

describe('provisionDesignerAccount', () => {
  let fakeRegister;
  let provisionDesignerAccount;

  beforeEach(() => {
    fakeRegister = vi.fn();
    nodeRequire.cache[authServicePath] = {
      id: authServicePath,
      filename: authServicePath,
      loaded: true,
      exports: { register: fakeRegister },
    };
    delete nodeRequire.cache[scriptPath];
    ({ provisionDesignerAccount } = nodeRequire(scriptPath));
  });

  afterEach(() => {
    delete nodeRequire.cache[authServicePath];
    delete nodeRequire.cache[scriptPath];
  });

  it('authService.register\'ı role_id=0, institution_id=null ile çağırır ve yeni id\'yi döner', async () => {
    fakeRegister.mockResolvedValueOnce({ id: 'designer-uuid-1', email: 'patron@operio.app' });

    const id = await provisionDesignerAccount({
      email: 'patron@operio.app',
      password: 'Gecici-Guclu-Sifre1!',
      fullName: 'Arzu',
    });

    expect(id).toBe('designer-uuid-1');
    expect(fakeRegister).toHaveBeenCalledWith({
      email: 'patron@operio.app',
      password: 'Gecici-Guclu-Sifre1!',
      fullName: 'Arzu',
      roleId: 0,
      institutionId: null,
    });
  });

  it('authService.register fırlatırsa (örn. e-posta zaten kayıtlı) hata YUKARI PROPAGATE olur', async () => {
    fakeRegister.mockRejectedValueOnce(Object.assign(new Error('Bu e-posta zaten kayıtlı'), { statusCode: 409 }));

    await expect(
      provisionDesignerAccount({ email: 'patron@operio.app', password: 'x', fullName: 'Arzu' })
    ).rejects.toThrow('Bu e-posta zaten kayıtlı');
  });
});
