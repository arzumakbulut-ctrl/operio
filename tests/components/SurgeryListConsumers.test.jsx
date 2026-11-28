import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as surgeriesAdapter from '../../src/services/surgeriesAdapter.js';

// Her tüketici dosyanın kendi fetch'i yerine adapter'ı çağırdığını doğrulamak için
// doğrudan modülü mock'luyoruz ve dosyanın import ettiğini teyit ediyoruz.
describe('Ameliyat tüketicileri artık surgeriesAdapter kullanıyor', () => {
  beforeEach(() => { vi.spyOn(surgeriesAdapter, 'listSurgeries').mockResolvedValue([
    { id:'s1', op:'Test Ameliyat', durum:'Devam Ediyor', st:'dot-active', salon:'Salon 1', dr:'Dr. Test', saat:'08:00' },
  ]); });

  // NOT: App.jsx'te "/ameliyatlar" route path'i (Ameliyatlar.jsx sayfası için,
  // Task 3 kapsamında) MEŞRU şekilde kalır — bu yüzden tüm dosyada '/ameliyatlar'
  // yokluğu değil, spesifik olarak useApiLoader'daki eski get("/ameliyatlar")
  // API çağrısının kaldırıldığı kontrol ediliyor.
  it('App.jsx useApiLoader artık doğrudan fetch("/ameliyatlar") YAPMIYOR, listSurgeries() çağırıyor', async () => {
    const src = await import('fs').then(fs => fs.readFileSync('src/App.jsx', 'utf8'));
    expect(src).not.toContain('get("/ameliyatlar")');
    expect(src).not.toContain('mapSurgery');
    expect(src).toContain('listSurgeries');
  });

  it('Sidebar.jsx artık listSurgeries() kullanıyor, eski /ameliyatlar yolunu kullanmıyor', async () => {
    const src = await import('fs').then(fs => fs.readFileSync('src/components/layout/Sidebar.jsx', 'utf8'));
    expect(src).not.toContain('/ameliyatlar');
    expect(src).toContain('listSurgeries');
  });

  it('Istatistik.jsx artık listSurgeries() kullanıyor, eski /ameliyatlar yolunu kullanmıyor', async () => {
    const src = await import('fs').then(fs => fs.readFileSync('src/pages/Istatistik.jsx', 'utf8'));
    expect(src).not.toContain('/ameliyatlar');
    expect(src).toContain('listSurgeries');
  });

  it('DolulukTakvimi.jsx artık listSurgeries() kullanıyor, eski /ameliyatlar yolunu kullanmıyor', async () => {
    const src = await import('fs').then(fs => fs.readFileSync('src/pages/DolulukTakvimi.jsx', 'utf8'));
    expect(src).not.toContain('/ameliyatlar');
    expect(src).toContain('listSurgeries');
  });

  // NOT: OnayBekleyenler.jsx ve EkipPlani.jsx'te durum/ekip GÜNCELLEME (PUT)
  // çağrıları var (`${BASE}/ameliyatlar/${id}` ile) — bunlar Task 3'ün kapsamı
  // (updateSurgeryStatus / assignTeamMember), Task 2 SADECE listeleme fetch'ini
  // taşır. O yüzden burada tüm dosyada '/ameliyatlar' yokluğu değil, spesifik
  // olarak eski LİSTE GET fetch'inin kaldırıldığı kontrol ediliyor.
  it('OnayBekleyenler.jsx liste için artık listSurgeries() kullanıyor, eski GET liste fetch\'ini kullanmıyor (PUT güncelleme çağrısı Task 3 kapsamında ayrı kalır)', async () => {
    const src = await import('fs').then(fs => fs.readFileSync('src/pages/OnayBekleyenler.jsx', 'utf8'));
    expect(src).not.toContain('fetch(`${BASE}/ameliyatlar`, { headers');
    expect(src).toContain('listSurgeries');
  });

  it('EkipPlani.jsx liste için artık listSurgeries() kullanıyor, eski GET liste fetch\'ini kullanmıyor (PUT güncelleme çağrısı Task 3 kapsamında ayrı kalır)', async () => {
    const src = await import('fs').then(fs => fs.readFileSync('src/pages/EkipPlani.jsx', 'utf8'));
    expect(src).not.toContain('fetch(`${BASE}/ameliyatlar`, { headers');
    expect(src).toContain('listSurgeries');
  });
});
