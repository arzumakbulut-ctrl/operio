import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CihazKontrol from '../../src/pages/CihazKontrol.jsx';

vi.mock('../../src/services/api.js', () => ({
  deviceAPI: {
    list: vi.fn().mockResolvedValue([{ id: 'd1', name: 'Elektrokoter', mode: 'SIM', power_state: 'OFF', device_group: 'electrosurgery' }]),
    command: vi.fn().mockResolvedValue({ id: 'd1', power_state: 'ON' }),
  },
}));

describe('CihazKontrol', () => {
  it('cihaz listesini ve SİMÜLASYON rozetini göstermeli', async () => {
    render(<CihazKontrol />);
    expect(await screen.findByText('Elektrokoter')).toBeInTheDocument();
    expect(screen.getByText(/SİMÜLASYON/i)).toBeInTheDocument();
  });

  it('Aç butonuna tıklanınca deviceAPI.command çağrılmalı', async () => {
    const { deviceAPI } = await import('../../src/services/api.js');
    render(<CihazKontrol />);
    fireEvent.click(await screen.findByRole('button', { name: /aç/i }));
    await waitFor(() => expect(deviceAPI.command).toHaveBeenCalledWith('d1', expect.objectContaining({ action: 'turn_on' })));
  });
});
