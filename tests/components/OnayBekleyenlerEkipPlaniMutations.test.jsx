import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

// NOT: Brief'teki orijinal regex (['"`]\/ameliyatlar\/\$?\{?) gerçek kodu
// YAKALAMIYORDU — her iki dosya da `${BASE}/ameliyatlar/${id}` şeklinde bir
// template literal kullanıyor; "/ameliyatlar/" öncesindeki karakter bir
// quote/backtick değil, "${BASE}"'in kapanış parantezi "}". Bu yüzden regex'e
// "}/ameliyatlar/" (şablon-literal içindeki değişken önekinin ardından gelen
// yol) desenini de yakalayacak ek bir kontrol eklendi. Ayrıca
// SurgeryMutationConsumers.test.jsx'teki (Task 3) emsale uyacak şekilde doğru
// adapter fonksiyonlarının gerçekten kullanıldığı da doğrulanıyor — sadece
// eski yolun yokluğunu kontrol etmek, dosyanın hiçbir DB çağrısı yapmadığı
// durumda da (yanlışlıkla) yeşil dönebilirdi.
describe('OnayBekleyenler/EkipPlani artık surgeriesAdapter kullanıyor (Task 3 plan boşluğu)', () => {
  it.each([
    ['src/pages/OnayBekleyenler.jsx'],
    ['src/pages/EkipPlani.jsx'],
  ])('%s artık eski PUT /ameliyatlar/:id yolunu kullanmıyor', (file) => {
    const src = readFileSync(file, 'utf8');
    expect(src).not.toMatch(/['"`]\/ameliyatlar\/\$?\{?/);
    expect(src).not.toMatch(/\}\/ameliyatlar\//);
  });

  it('OnayBekleyenler.jsx artık updateSurgeryStatus kullanıyor', () => {
    const src = readFileSync('src/pages/OnayBekleyenler.jsx', 'utf8');
    expect(src).toContain('updateSurgeryStatus');
  });

  it('EkipPlani.jsx artık assignTeamMember/removeTeamMember kullanıyor', () => {
    const src = readFileSync('src/pages/EkipPlani.jsx', 'utf8');
    expect(src).toContain('assignTeamMember');
    expect(src).toContain('removeTeamMember');
  });
});
