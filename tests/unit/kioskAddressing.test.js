import { describe, it, expect } from 'vitest';

const { addressSpeaker, describeDeviceAction } = await import('../../src/utils/kioskAddressing.js');

describe('addressSpeaker', () => {
  it.each([
    [{ fullName: 'Dr. Ahmet Yılmaz', roleId: 6 }, 'Ahmet hocam'],
    [{ fullName: 'Misafir Dr. Zeynep Kaya', roleId: 10 }, 'Misafir hocam'], // unvan ön-eki "Dr." temizlenir, "Misafir" ilk kelime kalır — builder'ın ad çıkarma kuralını not et
    [{ fullName: 'Hem. Ayşe Korkmaz', roleId: 4 }, 'Ayşe'],
    [{ fullName: 'Tek. Mehmet Arslan', roleId: 3 }, 'Mehmet'],
  ])('%j için %s döner', (speaker, expected) => {
    expect(addressSpeaker(speaker)).toBe(expected);
  });
});

describe('describeDeviceAction', () => {
  it('set_power için "{grup}i {value} yapmamı" döner', () => {
    expect(describeDeviceAction('koter', 'set_power', 20)).toBe('koteri 20 yapmamı');
  });

  it('turn_on için "{grup}i açmamı" döner', () => {
    expect(describeDeviceAction('koter', 'turn_on')).toBe('koteri açmamı');
  });

  it('turn_off için "{grup}i kapatmamı" döner', () => {
    expect(describeDeviceAction('koter', 'turn_off')).toBe('koteri kapatmamı');
  });

  it('arm_move için "masayı hareket için hazırlamamı" döner (sabit metin)', () => {
    expect(describeDeviceAction('masa', 'arm_move', null)).toBe('masayı hareket için hazırlamamı');
  });
});
