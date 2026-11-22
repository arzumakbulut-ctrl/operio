import { describe, it, expect } from 'vitest';
const { deviceCommandSchema } = await import('../../src/validators/schemas.js');

describe('deviceCommandSchema', () => {
  describe('set_power', () => {
    it('value olmadan reddedilmeli', () => {
      expect(deviceCommandSchema.safeParse({ action: 'set_power' }).success).toBe(false);
    });
    it('value 0-100 dışında bir sayıysa reddedilmeli', () => {
      expect(deviceCommandSchema.safeParse({ action: 'set_power', value: 101 }).success).toBe(false);
      expect(deviceCommandSchema.safeParse({ action: 'set_power', value: -1 }).success).toBe(false);
    });
    it('value tam sayı değilse reddedilmeli', () => {
      expect(deviceCommandSchema.safeParse({ action: 'set_power', value: 50.5 }).success).toBe(false);
    });
    it('value string ise reddedilmeli', () => {
      expect(deviceCommandSchema.safeParse({ action: 'set_power', value: '50' }).success).toBe(false);
    });
    it('geçerli bir 0-100 tam sayı → kabul', () => {
      const r = deviceCommandSchema.safeParse({ action: 'set_power', value: 50 });
      expect(r.success).toBe(true);
    });
  });

  describe('arm_move', () => {
    it('value olmadan kabul edilmeli (opsiyonel)', () => {
      expect(deviceCommandSchema.safeParse({ action: 'arm_move' }).success).toBe(true);
    });
    it('value kısa bir string ise kabul edilmeli', () => {
      expect(deviceCommandSchema.safeParse({ action: 'arm_move', value: 'yatir' }).success).toBe(true);
    });
    it('value 50 karakterden uzun string ise reddedilmeli', () => {
      expect(deviceCommandSchema.safeParse({ action: 'arm_move', value: 'x'.repeat(51) }).success).toBe(false);
    });
    it('value obje ise reddedilmeli', () => {
      expect(deviceCommandSchema.safeParse({ action: 'arm_move', value: { foo: 'bar' } }).success).toBe(false);
    });
  });

  describe('invoke_action', () => {
    it('value olmadan reddedilmeli', () => {
      expect(deviceCommandSchema.safeParse({ action: 'invoke_action' }).success).toBe(false);
    });
    it('value.name eksikse reddedilmeli', () => {
      expect(deviceCommandSchema.safeParse({ action: 'invoke_action', value: { args: {} } }).success).toBe(false);
    });
    it('{ name } ile kabul edilmeli (args opsiyonel)', () => {
      expect(deviceCommandSchema.safeParse({ action: 'invoke_action', value: { name: 'zoom' } }).success).toBe(true);
    });
    it('{ name, args } ile kabul edilmeli', () => {
      const r = deviceCommandSchema.safeParse({ action: 'invoke_action', value: { name: 'zoom', args: { level: 2 } } });
      expect(r.success).toBe(true);
    });
  });

  describe('turn_on / turn_off', () => {
    it('value olmadan kabul edilmeli', () => {
      expect(deviceCommandSchema.safeParse({ action: 'turn_on' }).success).toBe(true);
      expect(deviceCommandSchema.safeParse({ action: 'turn_off' }).success).toBe(true);
    });
    it('value verilse de (yok sayılır) kabul edilmeli', () => {
      expect(deviceCommandSchema.safeParse({ action: 'turn_on', value: 'anything' }).success).toBe(true);
    });
  });

  it('bilinmeyen action reddedilmeli', () => {
    expect(deviceCommandSchema.safeParse({ action: 'explode' }).success).toBe(false);
  });
});
