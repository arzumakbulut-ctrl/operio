import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as adapter from '../../src/services/sterileSetsAdapter.js';
import SterilSetler from '../../src/pages/SterilSetler.jsx';

beforeEach(() => {
  vi.spyOn(adapter, 'listSterileSets').mockResolvedValue([
    { id:'ss1', name:'Set A', doktor:'SET-001', raf:'Raf A', durum:'Steril — Hazır', aletler:[] },
  ]);
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
