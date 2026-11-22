import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SetTakip from '../../src/pages/SetTakip.jsx';
import { useDataStore, useUIStore } from '../../src/store';
import { STERIL_SETLER_V2, initSterilAkis } from '../../src/data/mockData.js';

// SetTakip.jsx (Task 6) Abonelik sayfasına gitmek için useNavigate() kullanıyor —
// bileşen bir <Router> olmadan da render edilebilsin diye mock'lanıyor.
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('../../src/services/api.js', () => ({
  sterileSetsAPI: {
    get: vi.fn(),
    addTracking: vi.fn().mockResolvedValue({ id: 'log1' }),
    visionCount: vi.fn(),
  },
  // Task 6'nın modül-gated "Fotoğrafla Say" kontrolü için — bu dosyadaki testler
  // o akışla ilgilenmiyor, sadece SayimModal'ın moduleAPI.mine() çağrısının
  // çözülmeyen bir promise'de kalmamasını sağlıyoruz.
  moduleAPI: {
    mine: vi.fn().mockResolvedValue([]),
  },
}));

beforeEach(async () => {
  vi.clearAllMocks();
  const { sterileSetsAPI, moduleAPI } = await import('../../src/services/api.js');
  sterileSetsAPI.addTracking.mockResolvedValue({ id: 'log1' });
  moduleAPI.mine.mockResolvedValue([]);
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

  it('GET /sterile-sets/:id dönmeden "Sayımı Onayla" tıklanırsa addTracking çağrılmaz — buton devre dışı ve "yükleniyor" durumunda', async () => {
    const { sterileSetsAPI } = await import('../../src/services/api.js');
    let resolveGet;
    sterileSetsAPI.get.mockImplementationOnce(() => new Promise((resolve) => { resolveGet = resolve; }));

    render(<SetTakip />);
    fireEvent.click(await screen.findByRole('button', { name: 'Teslim Al' }));

    // GET henüz dönmedi (realInstruments === null) — buton "yükleniyor" metniyle
    // devre dışı olmalı, "Sayımı Onayla" metniyle ETKİN olmamalı.
    const yukleniyorButonu = await screen.findByRole('button', { name: /Aletler yükleniyor/i });
    expect(yukleniyorButonu).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Sayımı Onayla/i })).not.toBeInTheDocument();

    fireEvent.click(yukleniyorButonu);
    expect(sterileSetsAPI.addTracking).not.toHaveBeenCalled();

    // Fetch'i şimdi çöz — gerçek aletler gelince buton normal metnine ve etkin haline dönmeli,
    // ve önceki (devre dışı) tıklama hiçbir zaman gerçek bir tracking çağrısı üretmemiş olmalı.
    resolveGet({
      id: '10000000-0000-0000-0000-000000000001',
      instruments: [{ id: 'i1', name: 'Trokar 10mm', expected_count: 1, current_count: 1 }],
    });
    const onaylaButonu = await screen.findByRole('button', { name: /Sayımı Onayla/i });
    expect(onaylaButonu).not.toBeDisabled();
    expect(sterileSetsAPI.addTracking).not.toHaveBeenCalled();
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

  it('GET /sterile-sets/:id başarısız olursa modal "yükleniyor"da kilitlenmez — toast gösterilir ve eski mock dalına düşülür', async () => {
    const { sterileSetsAPI } = await import('../../src/services/api.js');
    sterileSetsAPI.get.mockRejectedValueOnce(Object.assign(new Error('Set bulunamadı'), { status: 404 }));

    render(<SetTakip />);
    fireEvent.click(await screen.findByRole('button', { name: 'Teslim Al' }));

    // Hata toast'ı gösterilmeli.
    await waitFor(() => expect(useUIStore.getState().toastMsg).toMatch(/Alet listesi sunucudan yüklenemedi/));

    // "Aletler yükleniyor…" durumu temizlenmeli ve gönder butonu etkin olmalı.
    const onaylaButonu = await screen.findByRole('button', { name: /Sayımı Onayla/i });
    expect(onaylaButonu).not.toBeDisabled();
    expect(screen.queryByText('Aletler yükleniyor…')).not.toBeInTheDocument();
    // Gerçek-dal sayaç butonları (aria-label'lı) yok — mock dalı render edildi.
    expect(screen.queryByRole('button', { name: /arttır$/ })).not.toBeInTheDocument();

    // Mock dalı üzerinden kayıt çalışmalı: addTracking çağrılmaz, akış ilerler, modal kapanır.
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Salon 1' } });
    fireEvent.change(screen.getByPlaceholderText('Dr. / Hemşire adı'), { target: { value: 'Hem. Test' } });
    fireEvent.click(onaylaButonu);

    await waitFor(() =>
      expect(screen.queryByText('Alet Sayım Formu — Laparoskopi Seti A')).not.toBeInTheDocument()
    );
    expect(sterileSetsAPI.addTracking).not.toHaveBeenCalled();
    expect(useDataStore.getState().sterilAkis[1].asama).toBe('yikamada');
  });

  it("addTracking başarısız olursa başarı gösterilmez — hata toast'ı, modal açık kalır, akış ilerlemez", async () => {
    const { sterileSetsAPI } = await import('../../src/services/api.js');
    sterileSetsAPI.get.mockResolvedValueOnce({
      id: '10000000-0000-0000-0000-000000000001',
      instruments: [{ id: 'i1', name: 'Trokar 10mm', expected_count: 1, current_count: 1 }],
    });
    sterileSetsAPI.addTracking.mockRejectedValueOnce(Object.assign(new Error('Yetkiniz yok'), { status: 403 }));
    const oncekiAsama = useDataStore.getState().sterilAkis[1].asama;

    render(<SetTakip />);
    fireEvent.click(await screen.findByRole('button', { name: 'Teslim Al' }));
    expect(await screen.findByRole('button', { name: 'Trokar 10mm arttır' })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Salon 1' } });
    fireEvent.change(screen.getByPlaceholderText('Dr. / Hemşire adı'), { target: { value: 'Hem. Test' } });
    fireEvent.click(screen.getByRole('button', { name: /Sayımı Onayla/i }));

    await waitFor(() => expect(sterileSetsAPI.addTracking).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(useUIStore.getState().toastMsg).toMatch(/Sayım kaydedilemedi: Yetkiniz yok/));
    expect(useUIStore.getState().toastMsg).not.toMatch(/teslim alındı/);

    // Modal açık, akış ilerlemedi, kullanıcı tekrar deneyebilir.
    expect(screen.getByText('Alet Sayım Formu — Laparoskopi Seti A')).toBeInTheDocument();
    expect(useDataStore.getState().sterilAkis[1].asama).toBe(oncekiAsama);
    const tekrarButonu = await screen.findByRole('button', { name: /Sayımı Onayla/i });
    expect(tekrarButonu).not.toBeDisabled();
  });

  it('kayıt sürerken gönder butonu devre dışıdır (çift gönderim yok)', async () => {
    const { sterileSetsAPI } = await import('../../src/services/api.js');
    sterileSetsAPI.get.mockResolvedValueOnce({
      id: '10000000-0000-0000-0000-000000000001',
      instruments: [{ id: 'i1', name: 'Trokar 10mm', expected_count: 1, current_count: 1 }],
    });
    sterileSetsAPI.addTracking.mockImplementationOnce(() => new Promise(() => {}));

    render(<SetTakip />);
    fireEvent.click(await screen.findByRole('button', { name: 'Teslim Al' }));
    await screen.findByRole('button', { name: 'Trokar 10mm arttır' });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Salon 1' } });
    fireEvent.change(screen.getByPlaceholderText('Dr. / Hemşire adı'), { target: { value: 'Hem. Test' } });
    fireEvent.click(screen.getByRole('button', { name: /Sayımı Onayla/i }));

    const kaydediliyorButonu = await screen.findByRole('button', { name: /Kaydediliyor/i });
    expect(kaydediliyorButonu).toBeDisabled();
    fireEvent.click(kaydediliyorButonu);
    expect(sterileSetsAPI.addTracking).toHaveBeenCalledTimes(1);
  });
});
