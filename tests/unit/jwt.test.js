import { describe, it, expect, vi } from 'vitest';

// Gerçek JWT'yi test ediyoruz — mock değil
vi.unmock('../../src/utils/jwt');

const {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  refreshTokenExpiresAt,
} = await import('../../src/utils/jwt');

describe('JWT Utility', () => {
  const payload = {
    sub:           'user-123',
    email:         'test@hastane.tr',
    roleId:        1,
    institutionId: 'inst-456',
  };

  describe('signAccessToken', () => {
    it('geçerli bir JWT string üretmeli', () => {
      const token = signAccessToken(payload);
      expect(token).toBeTypeOf('string');
      expect(token.split('.')).toHaveLength(3); // header.payload.signature
    });

    it('payload bilgilerini içermeli', () => {
      const token   = signAccessToken(payload);
      const decoded = verifyAccessToken(token);
      expect(decoded.sub).toBe(payload.sub);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.roleId).toBe(payload.roleId);
    });

    it('iat ve exp claim içermeli', () => {
      const token   = signAccessToken(payload);
      const decoded = verifyAccessToken(token);
      expect(decoded.iat).toBeTypeOf('number');
      expect(decoded.exp).toBeTypeOf('number');
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });
  });

  describe('verifyAccessToken', () => {
    it('geçerli token başarıyla doğrulanmalı', () => {
      const token = signAccessToken(payload);
      expect(() => verifyAccessToken(token)).not.toThrow();
    });

    it('sahte token reddedilmeli', () => {
      expect(() => verifyAccessToken('fake.jwt.token')).toThrow();
    });

    it('boş string reddedilmeli', () => {
      expect(() => verifyAccessToken('')).toThrow();
    });

    it('farklı secret ile imzalanmış token reddedilmeli', () => {
      const jwt = require('jsonwebtoken');
      const fakeToken = jwt.sign(payload, 'wrong-secret');
      expect(() => verifyAccessToken(fakeToken)).toThrow();
    });
  });

  describe('signRefreshToken', () => {
    it('sadece sub içermeli', () => {
      const token   = signRefreshToken('user-123');
      const decoded = verifyRefreshToken(token);
      expect(decoded.sub).toBe('user-123');
      expect(decoded.email).toBeUndefined(); // hassas bilgi olmamalı
      expect(decoded.roleId).toBeUndefined();
    });

    it('access tokenden farklı olmalı', () => {
      const access  = signAccessToken(payload);
      const refresh = signRefreshToken(payload.sub);
      expect(access).not.toBe(refresh);
    });
  });

  describe('refreshTokenExpiresAt', () => {
    it('gelecekte bir tarih döndürmeli', () => {
      const exp = refreshTokenExpiresAt();
      expect(exp).toBeInstanceOf(Date);
      expect(exp.getTime()).toBeGreaterThan(Date.now());
    });

    it('en az 1 gün ilerisi olmalı', () => {
      const exp = refreshTokenExpiresAt();
      const oneDayFromNow = Date.now() + 24 * 60 * 60 * 1000;
      expect(exp.getTime()).toBeGreaterThan(oneDayFromNow);
    });
  });
});
