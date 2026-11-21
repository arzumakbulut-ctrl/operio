import { describe, it, expect } from 'vitest';
const { defaultCapabilitiesFor } = await import('../../src/services/device.service.js');

describe('defaultCapabilitiesFor', () => {
  it('electrosurgery + capabilities verilmemiş → requiredTeamRoles: [cerrah] varsayılanı', () => {
    expect(defaultCapabilitiesFor('electrosurgery', undefined)).toEqual({ requiredTeamRoles: ['cerrah'] });
  });

  it('table + capabilities verilmemiş → requiredTeamRoles: [cerrah] varsayılanı', () => {
    expect(defaultCapabilitiesFor('table', undefined)).toEqual({ requiredTeamRoles: ['cerrah'] });
  });

  it('light (düşük risk) + capabilities verilmemiş → boş obje, kısıtlama yok', () => {
    expect(defaultCapabilitiesFor('light', undefined)).toEqual({});
  });

  it('endoscopy_imaging (düşük risk) + capabilities verilmemiş → boş obje', () => {
    expect(defaultCapabilitiesFor('endoscopy_imaging', undefined)).toEqual({});
  });

  it('electrosurgery + çağıran kendi capabilities\'ini vermişse → onu olduğu gibi kullanmalı (override)', () => {
    const provided = { requiredTeamRoles: ['anestezi'] };
    expect(defaultCapabilitiesFor('electrosurgery', provided)).toBe(provided);
  });

  it('table + çağıran bilerek boş obje vermişse → varsayılanı EZMEMELİ, boş objeyi saygı göstermeli', () => {
    expect(defaultCapabilitiesFor('table', {})).toEqual({});
  });

  it('null da "verilmemiş" sayılmalı (varsayılan uygulanır)', () => {
    expect(defaultCapabilitiesFor('electrosurgery', null)).toEqual({ requiredTeamRoles: ['cerrah'] });
  });
});
