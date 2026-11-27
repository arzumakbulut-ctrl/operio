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

  // Review bulgusu: ekleForm.salon'un varsayılanı sahte 'salon_1' string'iydi
  // (gerçek oda UUID'leriyle eşleşmiyor) ve roomId olarak backend'e doğrudan
  // gönderiliyordu — backend şeması roomId için UUID/null bekliyor, kullanıcı
  // salonu değiştirmeden gönderirse 400 ile başarısız olurdu (AmeliyatTalebi.jsx
  // için zaten düzeltilen aynı hata sınıfı). Artık geçersiz placeholder
  // bulunmuyor ve roomId boşken null olarak gönderiliyor.
  it('Ameliyatlar.jsx artık geçersiz salon_1 placeholder\'ını roomId olarak göndermiyor', () => {
    const src = readFileSync('src/pages/Ameliyatlar.jsx', 'utf8');
    expect(src).not.toMatch(/salon_1/);
    expect(src).toMatch(/roomId:\s*ekleForm\.salon\s*\|\|\s*null/);
  });
});
