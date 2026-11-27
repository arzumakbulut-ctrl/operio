import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

// NOT: Brief'in orijinal taslağında 'src/components/ui/AmeliyatDrawer.jsx' satırı
// 'updateSurgeryStatus' bekliyordu. Dosyayı okuduğumuzda bu dosyada durum
// güncelleme çağrısı HİÇ YOK — tek mevcut mutasyon ekip ataması
// (kaydetEkip, PUT {ekip:...}). Bu satır gerçek dosya içeriğine göre
// 'assignTeamMember' bekleyecek şekilde düzeltildi (task-3-report.md'de
// detaylandırıldı — Task 2'nin Sidebar.jsx/Istatistik.jsx emsaliyle aynı tür
// plan-metni/gerçek-dosya uyuşmazlığı).
describe('Ameliyat yazma işlemleri artık surgeriesAdapter kullanıyor', () => {
  it.each([
    ['src/pages/Ameliyatlar.jsx', 'createSurgery'],
    ['src/components/ui/AmeliyatDrawer.jsx', 'assignTeamMember'],
    ['src/pages/AmeliyatTalebi.jsx', 'createSurgery'],
    ['src/pages/AmeliyatDetay.jsx', 'updateSurgeryStatus'],
    ['src/pages/AmeliyatDetay.jsx', 'assignTeamMember'],
  ])('%s artık %s kullanıyor, eski PUT /ameliyatlar yolunu kullanmıyor', (file, fn) => {
    const src = readFileSync(file, 'utf8');
    expect(src).not.toMatch(/['"`]\/ameliyatlar/);
    expect(src).toContain(fn);
  });
});
