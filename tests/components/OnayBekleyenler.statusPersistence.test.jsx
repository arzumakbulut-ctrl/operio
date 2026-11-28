import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as adapter from '../../src/services/surgeriesAdapter.js';
import OnayBekleyenler from '../../src/pages/OnayBekleyenler.jsx';
import { useAuthStore, useUIStore } from '../../src/store';

// Final review Finding 1: önceden Onaylandi->WAITING ve (STATUS_TO_TR'nin eski
// hali yüzünden) Reddedildi->CANCELLED yazılsa da her ikisi de reload sonrası
// listSurgeries()'ten "Bekliyor" TR etiketiyle geri geliyordu — dbToTalep bunu
// hiçbir zaman "onaylandi"/"reddedildi" kovasına değil, varsayılan
// "beklemede" kovasına düşürüyordu. Bu test, listSurgeries() sahte bir
// "reload sonrası" veri seti döndürdüğünde (durum: 'Hazırlanıyor'/'Iptal')
// doğru kovalara düştüğünü ve aksiyon butonlarının doğru backend enum'unu
// gönderdiğini doğruluyor.

beforeEach(() => {
  localStorage.setItem('operio_access', 'test-token');
  useAuthStore.setState({ curRole: 0 });
  useUIStore.setState({ toastMsg: '', toastVisible: false, bekleyenSayisi: 0 });
  vi.restoreAllMocks();
});

describe('OnayBekleyenler — reload sonrası durum kalıcılığı (Finding 1)', () => {
  it('durum="Hazırlanıyor" (onay sonrası PREPARING) olan bir ameliyat "Onaylananlar" sekmesine düşer, "Bekleyenler"e değil', async () => {
    vi.spyOn(adapter, 'listSurgeries').mockResolvedValue([
      { id: 's1', op: 'Apendektomi', dr: 'Dr. Ahmet', durum: 'Hazırlanıyor', saat: '08:00', tarihRaw: '2026-11-28T08:00:00.000Z' },
    ]);
    render(<OnayBekleyenler />);

    // Varsayılan aktif sekme 'beklemede' — talep 'onaylandi' kovasına
    // düştüğü için önce doğru sekmeye geçmeden kart görünmez.
    await waitFor(() => expect(adapter.listSurgeries).toHaveBeenCalled());
    fireEvent.click(screen.getByText(/Onaylananlar/));
    // Metin sol listedeki karttaki ".onay-card-op" İLE sağdaki detay
    // panelinde İKİ YERDE render olur (SterilSetler.adapter.test.jsx'teki
    // aynı çoklu-eşleşme deseni) — sol karta daraltıyoruz.
    expect(await screen.findByText('Apendektomi', { selector: '.onay-card-op' })).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Bekleyenler/));
    expect(screen.queryByText('Apendektomi', { selector: '.onay-card-op' })).not.toBeInTheDocument();
  });

  it('durum="Iptal" (red sonrası CANCELLED) olan bir ameliyat "Reddedilenler" sekmesine düşer, "Bekleyenler"e değil', async () => {
    vi.spyOn(adapter, 'listSurgeries').mockResolvedValue([
      { id: 's2', op: 'Kolesistektomi', dr: 'Dr. Ayşe', durum: 'Iptal', saat: '09:00', tarihRaw: '2026-11-28T09:00:00.000Z' },
    ]);
    render(<OnayBekleyenler />);

    await waitFor(() => expect(adapter.listSurgeries).toHaveBeenCalled());
    fireEvent.click(screen.getByText(/Reddedilenler/));
    expect(await screen.findByText('Kolesistektomi', { selector: '.onay-card-op' })).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Bekleyenler/));
    expect(screen.queryByText('Kolesistektomi', { selector: '.onay-card-op' })).not.toBeInTheDocument();
  });

  it('"Onayla" artık PREPARING yazıyor (WAITING DEĞİL — WAITING, hiç dokunulmamış bir talebin de varsayılan durumu)', async () => {
    vi.spyOn(adapter, 'listSurgeries').mockResolvedValue([
      { id: 's3', op: 'Apendektomi', dr: 'Dr. Ahmet', durum: 'Bekliyor', saat: '08:00', tarihRaw: '2026-11-28T08:00:00.000Z' },
    ]);
    vi.spyOn(adapter, 'updateSurgeryStatus').mockResolvedValue({ id: 's3', durum: 'Hazırlanıyor' });
    render(<OnayBekleyenler />);

    await screen.findByText('Apendektomi');
    fireEvent.click(screen.getByText('Onayla'));

    await waitFor(() => expect(adapter.updateSurgeryStatus).toHaveBeenCalledWith('s3', 'PREPARING'));
  });

  it('"Reddet" CANCELLED yazıyor (Task 3\'ün kendi fix\'iyle tutarlı, değişmedi)', async () => {
    vi.spyOn(adapter, 'listSurgeries').mockResolvedValue([
      { id: 's4', op: 'Apendektomi', dr: 'Dr. Ahmet', durum: 'Bekliyor', saat: '08:00', tarihRaw: '2026-11-28T08:00:00.000Z' },
    ]);
    vi.spyOn(adapter, 'updateSurgeryStatus').mockResolvedValue({ id: 's4', durum: 'Iptal' });
    render(<OnayBekleyenler />);

    await screen.findByText('Apendektomi');
    fireEvent.change(screen.getByPlaceholderText(/Onay notu/i), { target: { value: 'Uygun değil' } });
    fireEvent.click(screen.getByText('Reddet'));

    await waitFor(() => expect(adapter.updateSurgeryStatus).toHaveBeenCalledWith('s4', 'CANCELLED'));
  });
});
