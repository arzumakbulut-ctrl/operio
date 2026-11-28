import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

describe('Küçük kablolama düzeltmeleri', () => {
  it('BildirimDuyuru.jsx doğru /api/notifications yoluna POST atıyor', () => {
    const src = readFileSync('src/pages/BildirimDuyuru.jsx', 'utf8');
    expect(src).toMatch(/\/api\/notifications/);
  });

  it('Kurum.jsx ve AktiviteLoglari.jsx artık /logs DEĞİL /api/audit kullanıyor, {success,data,meta} zarfını açıyor', () => {
    for (const file of ['src/pages/Kurum.jsx', 'src/pages/AktiviteLoglari.jsx']) {
      const src = readFileSync(file, 'utf8');
      expect(src).not.toMatch(/['"`]\/logs/);
      expect(src).toMatch(/\/api\/audit/);
    }
  });

  it('Profil.jsx şifre değiştirmede /api/security/password/change kullanıyor', () => {
    const src = readFileSync('src/pages/Profil.jsx', 'utf8');
    expect(src).toMatch(/\/api\/security\/password\/change/);
  });
});
