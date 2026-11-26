import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/auth.service.js', () => ({
  register: vi.fn(),
}));

const authService = await import('../../src/services/auth.service.js');
const { provisionDesignerAccount } = await import('../../scripts/provision-designer-account.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('provisionDesignerAccount', () => {
  it('authService.register\'ı role_id=0, institution_id=null ile çağırır ve yeni id\'yi döner', async () => {
    authService.register.mockResolvedValueOnce({ id: 'designer-uuid-1', email: 'patron@operio.app' });

    const id = await provisionDesignerAccount({
      email: 'patron@operio.app',
      password: 'Gecici-Guclu-Sifre1!',
      fullName: 'Arzu',
    });

    expect(id).toBe('designer-uuid-1');
    expect(authService.register).toHaveBeenCalledWith({
      email: 'patron@operio.app',
      password: 'Gecici-Guclu-Sifre1!',
      fullName: 'Arzu',
      roleId: 0,
      institutionId: null,
    });
  });

  it('authService.register fırlatırsa (örn. e-posta zaten kayıtlı) hata YUKARI PROPAGATE olur', async () => {
    authService.register.mockRejectedValueOnce(Object.assign(new Error('Bu e-posta zaten kayıtlı'), { statusCode: 409 }));

    await expect(
      provisionDesignerAccount({ email: 'patron@operio.app', password: 'x', fullName: 'Arzu' })
    ).rejects.toThrow('Bu e-posta zaten kayıtlı');
  });
});
