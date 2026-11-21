import { describe, it, expect } from 'vitest';
const { isRealDriverKey } = await import('../../src/drivers/registry.js');

describe('isRealDriverKey', () => {
  it("'mock' bir gerçek sürücü SAYILMAMALI (mode=REAL için yeterli değil)", () => {
    expect(isRealDriverKey('mock')).toBe(false);
  });

  it('DRIVERS haritasında olmayan bir anahtar → false', () => {
    expect(isRealDriverKey('bilinmeyen-surucu')).toBe(false);
  });

  it('undefined/null/boş → false', () => {
    expect(isRealDriverKey(undefined)).toBe(false);
    expect(isRealDriverKey(null)).toBe(false);
    expect(isRealDriverKey('')).toBe(false);
  });

  it("prototip kirliliğine (örn. 'constructor') karşı dayanıklı olmalı → false", () => {
    expect(isRealDriverKey('constructor')).toBe(false);
  });
});
