import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

describe('Raporlar.jsx artık /api/audit kullanıyor (Task 9 plan boşluğu)', () => {
  it('Raporlar.jsx artık /logs DEĞİL /api/audit kullanıyor', () => {
    const src = readFileSync('src/pages/Raporlar.jsx', 'utf8');
    expect(src).not.toMatch(/['"`]\/logs/);
    expect(src).toMatch(/\/api\/audit/);
  });
});
