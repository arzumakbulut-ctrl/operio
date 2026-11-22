import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SesliKontrolAyarlari from '../../src/pages/SesliKontrolAyarlari.jsx';

vi.mock('../../src/services/api.js', () => ({
  deviceAPI: {
    list: vi.fn().mockResolvedValue([{ id: 'd1', name: 'Elektrokoter', mode: 'SIM' }]),
    updateConfig: vi.fn().mockResolvedValue({ id: 'd1', mode: 'REAL' }),
  },
  kioskAdminAPI: {
    createToken:   vi.fn().mockResolvedValue({ token: 'tok', kioskUrl: '/kiosk/x' }),
    revokeToken:   vi.fn().mockResolvedValue({ revoked: true }),
    getMockConfig: vi.fn().mockResolvedValue({ mode: 'always_match', cycleIndex: 0 }),
    setMockConfig: vi.fn().mockResolvedValue({ mode: 'always_match', cycleIndex: 0 }),
  },
}));

describe('SesliKontrolAyarlari', () => {
  it('mod değiştirme kontrolü deviceAPI.updateConfig çağırmalı', async () => {
    const { deviceAPI } = await import('../../src/services/api.js');
    render(<SesliKontrolAyarlari />);
    const select = await screen.findByLabelText(/mod/i);
    fireEvent.change(select, { target: { value: 'REAL' } });
    await waitFor(() => expect(deviceAPI.updateConfig).toHaveBeenCalledWith('d1', expect.objectContaining({ mode: 'REAL' })));
  });
});
