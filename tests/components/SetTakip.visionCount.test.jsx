import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SetTakip from '../../src/pages/SetTakip.jsx';
import { useDataStore, useUIStore, useAuthStore } from '../../src/store';
import { STERIL_SETLER_V2, initSterilAkis } from '../../src/data/mockData.js';

// SetTakip.jsx modül satın alınmamışsa Abonelik sayfasına gitmek için
// useNavigate() kullanıyor — bileşen bir <Router> olmadan da render edilebilsin
// diye mock'lanıyor (CihazKontrol.test.jsx'teki aynı desen).
const navigateMock = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('../../src/services/api.js', () => ({
  sterileSetsAPI: { get: vi.fn(), addTracking: vi.fn(), visionCount: vi.fn() },
  moduleAPI: { mine: vi.fn() },
}));

const BACKEND_SET_ID = '10000000-0000-0000-0000-000000000001';

beforeEach(async () => {
  vi.clearAllMocks();
  navigateMock.mockClear();
  const { sterileSetsAPI, moduleAPI } = await import('../../src/services/api.js');
  sterileSetsAPI.addTracking.mockResolvedValue({ id: 'log1' });
  useDataStore.setState({
    sterilSetlerV2: STERIL_SETLER_V2.map(s => ({ ...s })),
    sterilAkis: initSterilAkis(STERIL_SETLER_V2),
  });
  useUIStore.setState({ toastMsg: '', toastVisible: false });
  useAuthStore.setState({ curRole: 0 });
  // Varsayılan: testler kendi mockResolvedValueOnce'ını eklemezse bile
  // moduleAPI.mine() asla çözülmeyen bir promise'de kalmasın.
  moduleAPI.mine.mockResolvedValue([]);
});

describe('SetTakip — AI ile fotoğrafla sayım + modül CTA', () => {
  it('vision_counting aktif değilse "📷 Fotoğrafla Say" yerine CTA gösterilir', async () => {
    const { moduleAPI, sterileSetsAPI } = await import('../../src/services/api.js');
    moduleAPI.mine.mockResolvedValueOnce([{ slug: 'voice_control' }]); // vision_counting YOK
    sterileSetsAPI.get.mockResolvedValueOnce({ id: BACKEND_SET_ID, instruments: [] });

    render(<SetTakip />);
    fireEvent.click(await screen.findByRole('button', { name: 'Teslim Al' }));

    expect(await screen.findByText('Görsel Alet Sayımı modülü bu kurum için aktif değil.')).toBeInTheDocument();
    expect(screen.queryByText('📷 Fotoğrafla Say')).not.toBeInTheDocument();

    // curRole:0 (Üst Yönetici) → Abonelik sayfasına git butonu görünür olmalı.
    const abonelikButonu = screen.getByRole('button', { name: /Abonelik sayfasına git/i });
    fireEvent.click(abonelikButonu);
    expect(navigateMock).toHaveBeenCalledWith('/abonelik');
  });

  it('vision_counting aktifse buton görünür; dosya seçilince visionCount çağrılır ve dönen detectedCount sayaçları doldurur', async () => {
    const { moduleAPI, sterileSetsAPI } = await import('../../src/services/api.js');
    moduleAPI.mine.mockResolvedValueOnce([{ slug: 'vision_counting' }]);
    sterileSetsAPI.get.mockResolvedValueOnce({
      id: BACKEND_SET_ID,
      instruments: [{ id: 'i1', name: 'Trokar 10mm', expected_count: 1, current_count: 1 }],
    });
    sterileSetsAPI.visionCount.mockResolvedValueOnce({
      suggestions: [{ instrumentId: 'i1', name: 'Trokar 10mm', expectedCount: 1, detectedCount: 0 }],
      parsed: true,
    });

    render(<SetTakip />);
    fireEvent.click(await screen.findByRole('button', { name: 'Teslim Al' }));

    const fotoButonu = await screen.findByRole('button', { name: '📷 Fotoğrafla Say' });
    fireEvent.click(fotoButonu);

    const dosyaInput = await screen.findByTestId('vision-photo-input');
    const sahteDosya = new File(['sahte-fotograf-verisi'], 'alet-foto.jpg', { type: 'image/jpeg' });
    fireEvent.change(dosyaInput, { target: { files: [sahteDosya] } });

    await waitFor(() =>
      expect(sterileSetsAPI.visionCount).toHaveBeenCalledWith(
        BACKEND_SET_ID,
        expect.objectContaining({
          imageBase64: expect.any(String),
          mediaType: expect.stringMatching(/^image\//),
        })
      )
    );
    // Gönderilen base64 boş olmamalı (gerçek dosya içeriğinden üretildi).
    const gonderilenBody = sterileSetsAPI.visionCount.mock.calls[0][1];
    expect(gonderilenBody.imageBase64.length).toBeGreaterThan(0);

    // detectedCount:0 → "i1" sayacı artık 0 göstermeli (kullanıcı hâlâ +/- ile düzeltebilir).
    await waitFor(() => expect(screen.getByTestId('sayim-value-i1')).toHaveTextContent('0'));
  });

  it("AI öneri hatası (parsed:false) elle sayımı engellemez — sayaçlar expected_count'ta kalır, hata toast'ı gösterilir", async () => {
    const { moduleAPI, sterileSetsAPI } = await import('../../src/services/api.js');
    moduleAPI.mine.mockResolvedValueOnce([{ slug: 'vision_counting' }]);
    sterileSetsAPI.get.mockResolvedValueOnce({
      id: BACKEND_SET_ID,
      instruments: [{ id: 'i1', name: 'Trokar 10mm', expected_count: 1, current_count: 1 }],
    });
    sterileSetsAPI.visionCount.mockResolvedValueOnce({ suggestions: [], parsed: false });

    render(<SetTakip />);
    fireEvent.click(await screen.findByRole('button', { name: 'Teslim Al' }));

    const fotoButonu = await screen.findByRole('button', { name: '📷 Fotoğrafla Say' });
    fireEvent.click(fotoButonu);

    const dosyaInput = await screen.findByTestId('vision-photo-input');
    const sahteDosya = new File(['sahte-fotograf-verisi'], 'alet-foto.jpg', { type: 'image/jpeg' });
    fireEvent.change(dosyaInput, { target: { files: [sahteDosya] } });

    await waitFor(() => expect(sterileSetsAPI.visionCount).toHaveBeenCalled());

    // Sayaç değişmemiş olmalı — başlangıç değeri expected_count (1).
    expect(screen.getByTestId('sayim-value-i1')).toHaveTextContent('1');

    // Hata toast'ı gösterilmeli.
    await waitFor(() => expect(useUIStore.getState().toastVisible).toBe(true));
    expect(useUIStore.getState().toastMsg).toBe('AI sayamadı, lütfen elle sayın');
  });
});
