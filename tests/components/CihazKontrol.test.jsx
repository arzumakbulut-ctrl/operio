import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CihazKontrol from '../../src/pages/CihazKontrol.jsx';
import { useAuthStore } from '../../src/store';

// CihazKontrol.jsx modül satın alınmamışsa (403) Abonelik sayfasına gitmek için
// useNavigate() kullanıyor — bileşen bir <Router> olmadan da render edilebilsin
// diye mock'lanıyor (fonksiyonun gerçekten çağrıldığı iki testte ayrıca okunuyor).
const navigateMock = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('../../src/services/api.js', () => ({
  deviceAPI: {
    list: vi.fn().mockResolvedValue([{ id: 'd1', name: 'Elektrokoter', mode: 'SIM', power_state: 'OFF', device_group: 'electrosurgery' }]),
    command: vi.fn().mockResolvedValue({ id: 'd1', power_state: 'ON' }),
    physicalConfirm: vi.fn().mockResolvedValue({ id: 't1', power_state: 'ON' }),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  // useAuthStore varsayılanı curRole:0 (Üst Yönetici) — testler arası kaçak
  // olmasın diye her testten önce bilinen bir duruma sıfırlanıyor.
  useAuthStore.setState({ curRole: 0 });
});

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

  it('tanımlı cihaz yoksa oda-sabit değil genel bir boş durum metni göstermeli', async () => {
    const { deviceAPI } = await import('../../src/services/api.js');
    deviceAPI.list.mockResolvedValueOnce([]);
    render(<CihazKontrol />);
    expect(await screen.findByText('Tanımlı cihaz bulunamadı')).toBeInTheDocument();
  });

  describe('güç slider', () => {
    it('sürükleme sırasında (onChange) komut göndermemeli, sadece bırakınca (onMouseUp) tam şekilde göndermeli', async () => {
      const { deviceAPI } = await import('../../src/services/api.js');
      deviceAPI.list.mockResolvedValueOnce([
        { id: 'd1', name: 'Elektrokoter', mode: 'SIM', power_state: 'ON', power_level: 10, device_group: 'electrosurgery' },
      ]);
      render(<CihazKontrol />);
      const slider = await screen.findByRole('slider');

      fireEvent.change(slider, { target: { value: '55' } });
      expect(deviceAPI.command).not.toHaveBeenCalled();

      fireEvent.mouseUp(slider);
      await waitFor(() => expect(deviceAPI.command).toHaveBeenCalledWith('d1', { action: 'set_power', value: 55 }));
      expect(deviceAPI.command).toHaveBeenCalledTimes(1);
    });

    it('fiziksel onay gerektiren (table) cihazda hiç gösterilmemeli', async () => {
      const { deviceAPI } = await import('../../src/services/api.js');
      deviceAPI.list.mockResolvedValueOnce([
        { id: 't1', name: 'Masa Ünitesi', mode: 'SIM', power_state: 'ON', power_level: 10, device_group: 'table', requires_physical_confirm: true },
      ]);
      render(<CihazKontrol />);
      await screen.findByText('Masa Ünitesi');
      expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    });

    it('cihaz ON değilken gösterilmemeli', async () => {
      const { deviceAPI } = await import('../../src/services/api.js');
      deviceAPI.list.mockResolvedValueOnce([
        { id: 'd1', name: 'Elektrokoter', mode: 'SIM', power_state: 'STANDBY', power_level: 10, device_group: 'electrosurgery' },
      ]);
      render(<CihazKontrol />);
      await screen.findByText('Elektrokoter');
      expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    });
  });

  describe('fiziksel onay gerektiren (table) cihaz', () => {
    it('OFF durumdayken "Hazırla" butonu arm_move komutu göndermeli', async () => {
      const { deviceAPI } = await import('../../src/services/api.js');
      deviceAPI.list.mockResolvedValueOnce([
        { id: 't1', name: 'Masa Ünitesi', mode: 'SIM', power_state: 'OFF', device_group: 'table', requires_physical_confirm: true },
      ]);
      render(<CihazKontrol />);
      fireEvent.click(await screen.findByRole('button', { name: /hazırla/i }));
      await waitFor(() => expect(deviceAPI.command).toHaveBeenCalledWith('t1', { action: 'arm_move' }));
      // "Aç" hiçbir zaman bu cihaz için gösterilmemeli
      expect(screen.queryByRole('button', { name: /^aç$/i })).not.toBeInTheDocument();
    });

    it('ARMED durumdayken ayrı bir rozet/metin göstermeli ve fiziksel onay butonu etkin olmalı', async () => {
      const { deviceAPI } = await import('../../src/services/api.js');
      deviceAPI.list.mockResolvedValueOnce([
        { id: 't1', name: 'Masa Ünitesi', mode: 'SIM', power_state: 'ARMED', device_group: 'table', requires_physical_confirm: true },
      ]);
      render(<CihazKontrol />);
      expect(await screen.findByText(/onay bekliyor/i)).toBeInTheDocument();
      const confirmBtn = screen.getByRole('button', { name: /konsoldan fiziksel onayla/i });
      expect(confirmBtn).not.toBeDisabled();

      fireEvent.click(confirmBtn);
      await waitFor(() => expect(deviceAPI.physicalConfirm).toHaveBeenCalledWith('t1'));
    });

    it('OFF durumdayken fiziksel onay butonu devre dışı olmalı', async () => {
      const { deviceAPI } = await import('../../src/services/api.js');
      deviceAPI.list.mockResolvedValueOnce([
        { id: 't1', name: 'Masa Ünitesi', mode: 'SIM', power_state: 'OFF', device_group: 'table', requires_physical_confirm: true },
      ]);
      render(<CihazKontrol />);
      const confirmBtn = await screen.findByRole('button', { name: /konsoldan fiziksel onayla/i });
      expect(confirmBtn).toBeDisabled();
    });
  });

  describe('modül satın alınmamış (403)', () => {
    it('Üst Yönetici (roleId 0) için Abonelik sayfasına bağlantı göstermeli', async () => {
      const { deviceAPI } = await import('../../src/services/api.js');
      const err = new Error('Bu modül satın alınmamış');
      err.status = 403;
      deviceAPI.list.mockRejectedValueOnce(err);
      useAuthStore.setState({ curRole: 0 });

      render(<CihazKontrol />);
      expect(await screen.findByText('Sesli Kontrol modülü bu kurum için aktif değil.')).toBeInTheDocument();
      const link = screen.getByRole('button', { name: /abonelik/i });
      fireEvent.click(link);
      expect(navigateMock).toHaveBeenCalledWith('/abonelik');
    });

    it('Üst Yönetici olmayan bir rol için bağlantı göstermemeli', async () => {
      const { deviceAPI } = await import('../../src/services/api.js');
      const err = new Error('Bu modül satın alınmamış');
      err.status = 403;
      deviceAPI.list.mockRejectedValueOnce(err);
      useAuthStore.setState({ curRole: 6 });

      render(<CihazKontrol />);
      expect(await screen.findByText('Sesli Kontrol modülü bu kurum için aktif değil.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /abonelik/i })).not.toBeInTheDocument();
    });
  });
});
