import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SetTakip from '../../src/pages/SetTakip.jsx';
import { useDataStore, useUIStore } from '../../src/store';
import { STERIL_SETLER_V2, initSterilAkis } from '../../src/data/mockData.js';

vi.mock('../../src/services/api.js', () => ({
  sterileSetsAPI: {
    get: vi.fn(),
    addTracking: vi.fn().mockResolvedValue({ id: 'log1' }),
  },
}));

beforeEach(async () => {
  vi.clearAllMocks();
  const { sterileSetsAPI } = await import('../../src/services/api.js');
  sterileSetsAPI.addTracking.mockResolvedValue({ id: 'log1' });
  // Store'u bilinen bir başlangıç durumuna sıfırla — testler arası kaçak olmasın.
  useDataStore.setState({
    sterilSetlerV2: STERIL_SETLER_V2.map(s => ({ ...s })),
    sterilAkis: initSterilAkis(STERIL_SETLER_V2),
  });
  useUIStore.setState({ toastMsg: '', toastVisible: false });
});

describe('SetTakip — SayimModal gerçek backend entegrasyonu', () => {
  it('SayimModal açılınca sterileSetsAPI.get(backendSetId) çağrılır ve gerçek set_instruments gösterilir', async () => {
    const { sterileSetsAPI } = await import('../../src/services/api.js');
    sterileSetsAPI.get.mockResolvedValueOnce({
      id: '10000000-0000-0000-0000-000000000001',
      instruments: [
        { id: 'i1', name: 'Trokar 10mm', expected_count: 1, current_count: 1 },
        { id: 'i2', name: 'Trokar 5mm', expected_count: 2, current_count: 2 },
      ],
    });

    render(<SetTakip />);

    // Varsayılan aktif set id:1 (Laparoskopi Seti A) — "Kirli Teslim Alma" aşaması aktif.
    fireEvent.click(await screen.findByRole('button', { name: 'Teslim Al' }));

    await waitFor(() =>
      expect(sterileSetsAPI.get).toHaveBeenCalledWith('10000000-0000-0000-0000-000000000001')
    );
    expect(await screen.findByText('Trokar 10mm')).toBeInTheDocument();
    expect(screen.getByText('Trokar 5mm')).toBeInTheDocument();
  });

  it('"Sayımı Onayla" tıklanınca addTracking gerçek instrumentId\'lerle çağrılır', async () => {
    const { sterileSetsAPI } = await import('../../src/services/api.js');
    sterileSetsAPI.get.mockResolvedValueOnce({
      id: '10000000-0000-0000-0000-000000000001',
      instruments: [
        { id: 'i1', name: 'Trokar 10mm', expected_count: 1, current_count: 1 },
        { id: 'i2', name: 'Trokar 5mm', expected_count: 2, current_count: 2 },
      ],
    });

    render(<SetTakip />);
    fireEvent.click(await screen.findByRole('button', { name: 'Teslim Al' }));

    // Gerçek aletler yüklenene kadar bekle (sayaçlar varsayılan/expected değerde bırakılıyor).
    expect(await screen.findByText('Trokar 10mm')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Salon 1' } });
    fireEvent.change(screen.getByPlaceholderText('Dr. / Hemşire adı'), { target: { value: 'Hem. Test' } });
    fireEvent.click(screen.getByRole('button', { name: /Sayımı Onayla/i }));

    await waitFor(() =>
      expect(sterileSetsAPI.addTracking).toHaveBeenCalledWith(
        '10000000-0000-0000-0000-000000000001',
        expect.objectContaining({
          stage: 'teslim_alindi',
          counts: [
            { instrumentId: 'i1', count: 1 },
            { instrumentId: 'i2', count: 2 },
          ],
        })
      )
    );
  });

  it('backendSetId olmayan bir set için (varsayımsal) buton "AI sayım henüz tanımlı değil" ile pasifleşir', async () => {
    const { sterileSetsAPI } = await import('../../src/services/api.js');

    // Store'a backendSetId:undefined olan sahte bir set ekle.
    const fakeSet = {
      id: 999,
      name: 'Mock Test Seti',
      doktor: 'Dr. Test',
      raf: 'Z-9',
      durum: 'Kullanımda',
      color: '#000000',
      backendSetId: undefined,
      aletler: [{ ad: 'Mock Alet 1', adet: 1 }, { ad: 'Mock Alet 2', adet: 1 }],
    };
    useDataStore.setState((st) => ({
      sterilSetlerV2: [...st.sterilSetlerV2, fakeSet],
      sterilAkis: { ...st.sterilAkis, 999: { asama: 'kirli_teslim', sure: 45, zamanlar: {}, gercekSayim: {}, log: [] } },
    }));

    render(<SetTakip />);

    // Sahte seti aktif yap.
    fireEvent.click(await screen.findByText('Mock Test Seti'));
    fireEvent.click(await screen.findByRole('button', { name: 'Teslim Al' }));

    // Modal, eski-mock-davranışına (sadece yerel state, API çağrısı yok) düşmeli.
    expect(await screen.findByText('Mock Alet 1')).toBeInTheDocument();
    expect(screen.getByText('Mock Alet 2')).toBeInTheDocument();
    expect(sterileSetsAPI.get).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Salon 1' } });
    fireEvent.change(screen.getByPlaceholderText('Dr. / Hemşire adı'), { target: { value: 'Hem. Test' } });
    fireEvent.click(screen.getByRole('button', { name: /Sayımı Onayla/i }));

    await waitFor(() =>
      expect(screen.queryByText('Alet Sayım Formu — Mock Test Seti')).not.toBeInTheDocument()
    );
    expect(sterileSetsAPI.get).not.toHaveBeenCalled();
    expect(sterileSetsAPI.addTracking).not.toHaveBeenCalled();
  });
});
