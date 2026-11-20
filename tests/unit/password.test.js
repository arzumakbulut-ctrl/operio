import { describe, it, expect, vi } from 'vitest';

vi.unmock('../../src/utils/password');

const {
  validatePasswordStrength,
  hashPassword,
  verifyPassword,
} = await import('../../src/utils/password');

describe('Password Utility', () => {

  describe('validatePasswordStrength', () => {
    it('güçlü şifreyi kabul etmeli', () => {
      const errors = validatePasswordStrength('StrongP@ss1');
      expect(errors).toHaveLength(0);
    });

    it('8 karakterden kısa şifreyi reddetmeli', () => {
      const errors = validatePasswordStrength('Ab1!');
      expect(errors.some(e => e.includes('8 karakter'))).toBe(true);
    });

    it('büyük harf gerektirmeli', () => {
      const errors = validatePasswordStrength('lowercase1!');
      expect(errors.some(e => e.includes('büyük harf'))).toBe(true);
    });

    it('küçük harf gerektirmeli', () => {
      const errors = validatePasswordStrength('UPPERCASE1!');
      expect(errors.some(e => e.includes('küçük harf'))).toBe(true);
    });

    it('rakam gerektirmeli', () => {
      const errors = validatePasswordStrength('NoNumbers!');
      expect(errors.some(e => e.includes('rakam'))).toBe(true);
    });

    it('özel karakter gerektirmeli', () => {
      const errors = validatePasswordStrength('NoSpecial1');
      expect(errors.some(e => e.includes('özel karakter'))).toBe(true);
    });

    it('yaygın şifreleri reddetmeli', () => {
      const errors = validatePasswordStrength('password');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('128 karakterden uzun şifreyi reddetmeli', () => {
      const long   = 'A'.repeat(130) + '1!';
      const errors = validatePasswordStrength(long);
      expect(errors.some(e => e.includes('128 karakter'))).toBe(true);
    });

    it('tüm kriterleri sağlayan şifreyi geçirmeli', () => {
      const passwords = ['Operio2025!', 'H@stane#99X', 'Test$ecure1A'];
      passwords.forEach(p => {
        expect(validatePasswordStrength(p)).toHaveLength(0);
      });
    });
  });

  describe('hashPassword', () => {
    it('şifreyi hashlemeli', async () => {
      const hash = await hashPassword('TestPass1!');
      expect(hash).toBeTypeOf('string');
      expect(hash).not.toBe('TestPass1!');
      expect(hash).toMatch(/^\$2[ab]\$/); // bcrypt formatı
    });

    it('aynı şifre için farklı hash üretmeli (salt)', async () => {
      const hash1 = await hashPassword('TestPass1!');
      const hash2 = await hashPassword('TestPass1!');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('doğru şifreyi onaylamalı', async () => {
      const hash  = await hashPassword('TestPass1!');
      const valid = await verifyPassword('TestPass1!', hash);
      expect(valid).toBe(true);
    });

    it('yanlış şifreyi reddetmeli', async () => {
      const hash  = await hashPassword('TestPass1!');
      const valid = await verifyPassword('WrongPass1!', hash);
      expect(valid).toBe(false);
    });

    it('boş şifreyi reddetmeli', async () => {
      const hash  = await hashPassword('TestPass1!');
      const valid = await verifyPassword('', hash);
      expect(valid).toBe(false);
    });
  });

});
