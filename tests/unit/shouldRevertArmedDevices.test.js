import { describe, it, expect } from 'vitest';
const { shouldRevertArmedDevices } = await import('../../src/services/surgery.service.js');

describe('shouldRevertArmedDevices', () => {
  it('IN_PROGRESS → COMPLETED: true', () => {
    expect(shouldRevertArmedDevices('IN_PROGRESS', 'COMPLETED')).toBe(true);
  });
  it('IN_PROGRESS → CANCELLED: true', () => {
    expect(shouldRevertArmedDevices('IN_PROGRESS', 'CANCELLED')).toBe(true);
  });
  it('IN_PROGRESS → IN_PROGRESS (değişmedi): false', () => {
    expect(shouldRevertArmedDevices('IN_PROGRESS', 'IN_PROGRESS')).toBe(false);
  });
  it('WAITING → PREPARING (zaten IN_PROGRESS değildi): false', () => {
    expect(shouldRevertArmedDevices('WAITING', 'PREPARING')).toBe(false);
  });
  it('newStatus tanımsızsa (bu alan güncellenmemiş): false', () => {
    expect(shouldRevertArmedDevices('IN_PROGRESS', undefined)).toBe(false);
  });
});
