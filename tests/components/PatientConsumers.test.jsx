import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

// Her tüketici dosyanın kendi fetch'i yerine patientsAdapter'ı çağırdığını
// doğrulamak için dosya içeriğini okuyoruz (Task 2/3'teki dosya-içerik-kontrolü
// deseniyle aynı yaklaşım).
describe('Hasta tüketicileri artık patientsAdapter kullanıyor', () => {
  // NOT: App.jsx'te "/hastalar" route path'i (Hastalar.jsx sayfası için) MEŞRU
  // şekilde kalır — bu yüzden tüm dosyada '/hastalar' yokluğu değil, spesifik
  // olarak useApiLoader'daki eski get("/hastalar") çağrısının ve mapHasta
  // fonksiyonunun kaldırıldığı kontrol ediliyor.
  it('App.jsx useApiLoader artık get("/hastalar") YAPMIYOR, mapHasta silindi, listPatients() çağırıyor', () => {
    const src = readFileSync('src/App.jsx', 'utf8');
    expect(src).not.toContain('get("/hastalar")');
    expect(src).not.toContain('mapHasta');
    expect(src).toContain('listPatients');
  });

  it('YeniHasta.jsx artık eski POST /api/hastalar fetch\'ini kullanmıyor, createPatient() çağırıyor', () => {
    const src = readFileSync('src/pages/YeniHasta.jsx', 'utf8');
    expect(src).not.toContain("fetch('http://localhost:4000/api/hastalar'");
    expect(src).toContain('createPatient');
  });

  it('HastaDrawer.jsx artık eski GET /api/hastalar/:id fetch\'ini kullanmıyor, getPatient() çağırıyor', () => {
    const src = readFileSync('src/components/ui/HastaDrawer.jsx', 'utf8');
    expect(src).not.toContain("fetch('http://localhost:4000/api/hastalar/");
    expect(src).toContain('getPatient');
  });

  // Brief'in orijinal taslağı bu dosyada "bir <select>/picker için hasta listesi
  // çeken AYRI bir fetch" bekliyordu. Gerçek dosyada öyle bir picker YOK
  // (hastaAd düz bir metin <input>'u, bkz. satır ~559); bulunan şey, Task 3'ün
  // zaten dokunduğu createSurgery çağrısıyla AYNI ekleAmeliyat() fonksiyonu
  // içinde, ama Task 3'ün DOKUNMADIĞI (git show 477006d/0d81acb'de bu satırlar
  // değişmemiş) bir "hasta bul-veya-oluştur" GET+POST /hastalar bloğu. Bu açıkça
  // taşınmamış hasta okuma/yazma mantığı olduğundan task-5-report.md'de
  // belgelenen gerekçeyle burada da adapter'a taşındı; createSurgery çağrısı ve
  // salon/roomId mantığı (Task 3 kapsamı) DOKUNULMADAN bırakıldı.
  it('Ameliyatlar.jsx hasta bul-veya-oluştur bloğu artık listPatients/createPatient kullanıyor, Task 3\'ün createSurgery çağrısı dokunulmadan kalıyor', () => {
    const src = readFileSync('src/pages/Ameliyatlar.jsx', 'utf8');
    expect(src).not.toContain("fetch('http://localhost:4000/api/hastalar'");
    expect(src).toContain('listPatients');
    expect(src).toContain('createPatient');
    expect(src).toContain('createSurgery');
    expect(src).toMatch(/roomId:\s*ekleForm\.salon\s*\|\|\s*null/);
  });
});
