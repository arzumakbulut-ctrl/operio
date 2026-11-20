import { describe, it, expect } from 'vitest';
const { MockDriver } = await import('../../src/drivers/MockDriver.js');
const { getDriver }  = await import('../../src/drivers/registry.js');

describe('MockDriver', () => {
  const device = { id: 'd1', driver_key: 'mock', power_level: 0 };

  it('turnOn → ON durumuna geçmeli', async () => {
    const d = new MockDriver(device);
    const status = await d.turnOn();
    expect(status.power_state).toBe('ON');
  });

  it('turnOff → OFF, power_level 0 olmalı', async () => {
    const d = new MockDriver(device);
    const status = await d.turnOff();
    expect(status).toEqual({ power_state: 'OFF', power_level: 0 });
  });

  it('setPower(42) → ON + power_level 42', async () => {
    const d = new MockDriver(device);
    const status = await d.setPower(42);
    expect(status).toEqual({ power_state: 'ON', power_level: 42 });
  });

  it('armMove → ARMED durumuna geçmeli, confirmPhysical sonrası ON olmalı', async () => {
    const d = new MockDriver(device);
    expect((await d.armMove('yatir')).power_state).toBe('ARMED');
    expect((await d.confirmPhysical()).power_state).toBe('ON');
  });
});

describe('registry.getDriver', () => {
  it('bilinmeyen driver_key için de MockDriver döndürmeli (güvenli varsayılan)', () => {
    const d = getDriver({ driver_key: 'bilinmeyen-surucu' });
    expect(d.constructor.name).toBe('MockDriver');
  });
});
