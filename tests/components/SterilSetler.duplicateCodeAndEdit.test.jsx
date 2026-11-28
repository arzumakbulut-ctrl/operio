import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as adapter from '../../src/services/sterileSetsAdapter.js';
import SterilSetler from '../../src/pages/SterilSetler.jsx';
import { useAuthStore, useUIStore } from '../../src/store';

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ curRole: 8 });
  useUIStore.setState({ toastMsg: '', toastVisible: false });
});

// Final review Finding 4: backend'in sterile_sets.code kolonu UNIQUE NOT
// NULL — iki farklı set aynı "doktor" adıyla (code olarak gönderilen alan)
// oluşturulursa gerçek bir unique-constraint ihlaline (500) yol açar.
describe('SterilSetler — aynı doktor adıyla ikinci set oluşturma (Finding 4)', () => {
  it('çakışan doktor adında yeni set oluşturulursa, gönderilen code okunabilir bir sayaç soneki ile benzersizleştirilir', async () => {
    vi.spyOn(adapter, 'listSterileSets').mockResolvedValue([
      { id: 'ss1', name: 'Set A', doktor: 'Dr. Mehmet', raf: 'Raf A', durum: 'Steril — Hazır', aletler: [] },
    ]);
    vi.spyOn(adapter, 'createSterileSet').mockResolvedValue({
      id: 'ss2', name: 'Set B', doktor: 'Dr. Mehmet #2', raf: 'A-1', durum: 'Steril — Hazır', aletler: [],
    });
    render(<SterilSetler />);
    await screen.findByText('Set A', { selector: '.set-item-name' });

    fireEvent.click(screen.getByRole('button', { name: 'Yeni Set Oluştur' }));
    fireEvent.change(screen.getByPlaceholderText('Ör: Laparoskopi Seti A'), { target: { value: 'Set B' } });
    fireEvent.change(screen.getByPlaceholderText('Dr. Ad Soyad / Genel Kullanım'), { target: { value: 'Dr. Mehmet' } });
    fireEvent.click(screen.getByText('Kaydet'));

    await waitFor(() => expect(adapter.createSterileSet).toHaveBeenCalled());
    const [payload] = adapter.createSterileSet.mock.calls[0];
    expect(payload.code).toBe('Dr. Mehmet #2');
  });

  it('backend\'de gerçek bir çakışma oluşursa (null dönerse), genel "Hata" DEĞİL backend\'in spesifik mesajı gösterilir', async () => {
    vi.spyOn(adapter, 'listSterileSets').mockResolvedValue([]);
    vi.spyOn(adapter, 'createSterileSet').mockResolvedValue(null);
    vi.spyOn(adapter, 'getLastError').mockReturnValue({ code: 'INTERNAL_SERVER_ERROR', message: 'Belirtilen kod zaten kullanılıyor' });
    render(<SterilSetler />);

    fireEvent.click(screen.getByRole('button', { name: 'Yeni Set Oluştur' }));
    fireEvent.change(screen.getByPlaceholderText('Ör: Laparoskopi Seti A'), { target: { value: 'Yeni Set' } });
    fireEvent.click(screen.getByText('Kaydet'));

    await waitFor(() => {
      expect(useUIStore.getState().toastMsg).toContain('Belirtilen kod zaten kullanılıyor');
    });
    expect(useUIStore.getState().toastMsg).not.toBe('Kayıt hatası: Hata');
  });
});

// Minor Finding A: backend'in updateSet() servisi instruments alanını PATCH'te
// yok sayıyor — edit sırasında alet listesi değişse de kalıcı olmuyor.
// Kullanıcı yanıltılmasın diye başarı mesajı bu durumu açıkça belirtir.
describe('SterilSetler — edit sırasında alet listesi değişikliği (Minor Finding A)', () => {
  it('alet listesi değiştirilip güncellenirse, başarı mesajı backend kısıtını açıklar', async () => {
    vi.spyOn(adapter, 'listSterileSets').mockResolvedValue([
      { id: 'ss1', name: 'Set A', doktor: 'Dr. Mehmet', raf: 'Raf A', durum: 'Steril — Hazır', aletler: [{ ad: 'Makas', adet: 2 }] },
    ]);
    vi.spyOn(adapter, 'updateSterileSet').mockResolvedValue({
      id: 'ss1', name: 'Set A', doktor: 'Dr. Mehmet', raf: 'Raf A', durum: 'Steril — Hazır', aletler: [],
    });
    render(<SterilSetler />);
    await screen.findByText('Set A', { selector: '.set-item-name' });

    fireEvent.click(screen.getByRole('button', { name: 'Düzenle' }));
    fireEvent.change(screen.getByDisplayValue('Makas'), { target: { value: 'Pens' } });
    fireEvent.click(screen.getByRole('button', { name: 'Güncelle' }));

    await waitFor(() => {
      expect(useUIStore.getState().toastMsg).toMatch(/alet listesi değişikliği bu sürümde kaydedilmiyor/i);
    });
  });

  it('alet listesi değiştirilmeden güncellenirse, normal başarı mesajı gösterilir', async () => {
    vi.spyOn(adapter, 'listSterileSets').mockResolvedValue([
      { id: 'ss1', name: 'Set A', doktor: 'Dr. Mehmet', raf: 'Raf A', durum: 'Steril — Hazır', aletler: [{ ad: 'Makas', adet: 2 }] },
    ]);
    vi.spyOn(adapter, 'updateSterileSet').mockResolvedValue({
      id: 'ss1', name: 'Set A', doktor: 'Dr. Mehmet', raf: 'Raf A', durum: 'Steril — Hazır', aletler: [],
    });
    render(<SterilSetler />);
    await screen.findByText('Set A', { selector: '.set-item-name' });

    fireEvent.click(screen.getByRole('button', { name: 'Düzenle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Güncelle' }));

    await waitFor(() => {
      expect(useUIStore.getState().toastMsg).toBe('Set güncellendi ✓');
    });
  });
});
