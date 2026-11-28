import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as adapter from '../../src/services/sterileSetsAdapter.js';
import SterilSetler from '../../src/pages/SterilSetler.jsx';
import { useAuthStore, useUIStore } from '../../src/store';

beforeEach(() => {
  // Her testten önce temizleniyor: aksi halde `vi.spyOn` aynı adapter
  // metodunu tekrar spy'ladığında önceki testlerin `.mock.calls` geçmişi
  // taşınır ve `mock.calls[0]` yanlış (eski) çağrıyı işaret eder.
  vi.clearAllMocks();
  vi.spyOn(adapter, 'listSterileSets').mockResolvedValue([
    { id:'ss1', name:'Set A', doktor:'SET-001', raf:'Raf A', durum:'Steril — Hazır', aletler:[{ad:'Makas',adet:2}] },
  ]);
  // canEditDurum (SterilSetler.jsx) === curRole 8 || 9 — durum güncelleme
  // butonlarının render olması için gerekli. Testler arası kaçak olmasın diye
  // her testten önce sıfırlanıyor.
  useAuthStore.setState({ curRole: 8 });
  useUIStore.setState({ toastMsg: '', toastVisible: false });
});

// NOT: Brief'in orijinal taslağı `screen.findByText('Set A')` kullanıyordu.
// Gerçek SterilSetler.jsx, veri geldiğinde ilk seti otomatik seçiyor
// (useEffect içinde `setSelId(mapped[0].id)`), bu yüzden "Set A" metni AYNI ANDA
// hem sol sidebar'daki `.set-item-name` içinde HEM DE sağdaki detay panelindeki
// `.set-detail-name` içinde render ediliyor — `findByText` bu yüzden "Found
// multiple elements" hatasıyla patlıyor (bkz. SalonYonetim.rooms.test.jsx'teki
// aynı desen). Bunu `selector` seçeneğiyle sidebar liste öğesine daraltarak
// çözüyoruz; testin asıl amacı (listSterileSets()'in veriyi gerçekten render
// ettiğini doğrulamak) değişmiyor.
describe('SterilSetler — adapter + silme butonu yok', () => {
  it('listSterileSets() ile veri çeker, kendi fetch("/steril") kodunu kullanmaz', async () => {
    render(<SterilSetler />);
    expect(await screen.findByText('Set A', { selector: '.set-item-name' })).toBeInTheDocument();
    expect(adapter.listSterileSets).toHaveBeenCalled();
  });

  it('silme butonu/aksiyonu artık YOK (backend\'de DELETE rotası olmadığı için)', async () => {
    render(<SterilSetler />);
    await screen.findByText('Set A', { selector: '.set-item-name' });
    expect(screen.queryByRole('button', { name: /sil/i })).not.toBeInTheDocument();
  });
});

// Bu blok, review'da bulunan 2 Critical hatayı tam olarak kapsayacak şekilde
// gerçek çağrı argümanlarını doğruluyor (sadece string-presence değil):
// 1) shelf_location/expected_count (snake_case) yerine shelfLocation/
//    expectedCount (camelCase) gönderilmeli — backend şeması bunu bekliyor.
// 2) status alanı TR UI etiketi değil, geçerli backend enum değeri olmalı.
describe('SterilSetler — saveSet() backend\'in beklediği camelCase + enum gönderir', () => {
  it('updateSterileSet() çağrısına camelCase alan adları ve geçerli status enum\'u gider', async () => {
    vi.spyOn(adapter, 'updateSterileSet').mockResolvedValue({
      id:'ss1', name:'Set A', doktor:'SET-001', raf:'Raf A', durum:'Steril — Hazır', aletler:[],
    });
    render(<SterilSetler />);
    await screen.findByText('Set A', { selector: '.set-item-name' });

    fireEvent.click(screen.getByRole('button', { name: 'Düzenle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Güncelle' }));

    await waitFor(() => expect(adapter.updateSterileSet).toHaveBeenCalled());
    const [id, payload] = adapter.updateSterileSet.mock.calls[0];
    expect(id).toBe('ss1');

    // camelCase anahtarlar mevcut, snake_case anahtarlar YOK
    expect(payload.shelfLocation).toBe('Raf A');
    expect(payload).not.toHaveProperty('shelf_location');
    expect(payload.instruments[0]).toEqual({ name:'Makas', expectedCount:2 });
    expect(payload.instruments[0]).not.toHaveProperty('expected_count');

    // status, backend'in kabul ettiği enum'lardan biri olmalı — TR etiket DEĞİL
    expect(['STERILE','IN_USE','STERILIZING','FAULTY','RETIRED']).toContain(payload.status);
    expect(payload.status).toBe('STERILE');
    expect(payload.status).not.toBe('Steril — Hazır');
  });

  it('createSterileSet() çağrısına da camelCase alan adları ve geçerli status enum\'u gider', async () => {
    vi.spyOn(adapter, 'createSterileSet').mockResolvedValue({
      id:'ss2', name:'Yeni Set', doktor:'Genel Kullanım', raf:'A-1', durum:'Steril — Hazır', aletler:[],
    });
    render(<SterilSetler />);
    await screen.findByText('Set A', { selector: '.set-item-name' });

    fireEvent.click(screen.getByRole('button', { name: 'Yeni Set Oluştur' }));
    fireEvent.change(screen.getByPlaceholderText('Ör: Laparoskopi Seti A'), { target: { value: 'Yeni Set' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));

    await waitFor(() => expect(adapter.createSterileSet).toHaveBeenCalled());
    const [payload] = adapter.createSterileSet.mock.calls[0];
    expect(payload.shelfLocation).toBe('A-1');
    expect(payload).not.toHaveProperty('shelf_location');
    expect(['STERILE','IN_USE','STERILIZING','FAULTY','RETIRED']).toContain(payload.status);
  });
});

describe('SterilSetler — updateDurum() başarı kontrolü yapar', () => {
  it('adapter null dönerse (hata), kullanıcıya başarı değil hata gösterilir ve durum eski haline döner', async () => {
    vi.spyOn(adapter, 'updateSterileSet').mockResolvedValue(null);
    render(<SterilSetler />);
    await screen.findByText('Set A', { selector: '.set-item-name' });

    fireEvent.click(screen.getByRole('button', { name: 'Kullanımda' }));

    await waitFor(() => expect(adapter.updateSterileSet).toHaveBeenCalled());
    const [, patch] = adapter.updateSterileSet.mock.calls[0];
    // updateDurum de TR etiketini değil geçerli enum'u göndermeli
    expect(patch.status).toBe('IN_USE');

    await waitFor(() => expect(useUIStore.getState().toastMsg).not.toMatch(/güncellendi/));
    expect(useUIStore.getState().toastMsg).toMatch(/güncellenemedi|hata/i);

    // Optimistic UI, hata sonrası eski duruma geri alınmalı. Durum rozeti
    // (.tag, detay başlığında) hâlâ orijinal "Steril — Hazır" olmalı — tüm
    // durum butonları zaten her zaman kendi etiketiyle render olduğundan
    // (ör. "Kullanımda" butonu var olmak ile set'in o durumda OLMASI ayrı
    // şeyler), karşılaştırmayı `.tag` rozetine daraltıyoruz.
    await waitFor(() => {
      expect(screen.getByText('Steril — Hazır', { selector: '.tag' })).toBeInTheDocument();
    });
  });

  it('adapter başarıyla sonuç dönerse, durum güncellenir ve başarı toast\'ı gösterilir', async () => {
    vi.spyOn(adapter, 'updateSterileSet').mockResolvedValue({
      id:'ss1', name:'Set A', doktor:'SET-001', raf:'Raf A', durum:'Kullanımda', aletler:[],
    });
    render(<SterilSetler />);
    await screen.findByText('Set A', { selector: '.set-item-name' });

    fireEvent.click(screen.getByRole('button', { name: 'Kullanımda' }));

    await waitFor(() => expect(useUIStore.getState().toastMsg).toMatch(/güncellendi/));
    expect(screen.getByText('Kullanımda', { selector: '.tag' })).toBeInTheDocument();
  });
});
