import { describe, it, expect } from 'vitest';

const { signKioskToken, verifyKioskToken } = await import('../../src/utils/kioskJwt.js');

describe('kioskJwt', () => {
  it('signs and verifies a kiosk token', () => {
    const token = signKioskToken({ institutionId: 'inst-1', roomId: 'room-1', jti: 'abc' });
    const payload = verifyKioskToken(token);
    expect(payload).toMatchObject({ institutionId: 'inst-1', roomId: 'room-1', jti: 'abc' });
  });

  it('throws on a tampered token', () => {
    const token = signKioskToken({ institutionId: 'inst-1', roomId: 'room-1', jti: 'abc' });
    expect(() => verifyKioskToken(token + 'x')).toThrow();
  });

  it('throws on a token signed with a different secret', () => {
    const jwt = require('jsonwebtoken');
    const fakeToken = jwt.sign({ institutionId: 'inst-1', roomId: 'room-1', jti: 'abc' }, 'wrong-secret');
    expect(() => verifyKioskToken(fakeToken)).toThrow();
  });
});
