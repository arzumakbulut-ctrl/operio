import { describe, it, expect } from 'vitest';
const { checkDeviceAuthorization } = await import('../../src/services/device.service.js');

const lightDevice  = { room_id: 'room-1', device_group: 'light',         capabilities: {} };
const cauteryDevice = { room_id: 'room-1', device_group: 'electrosurgery', capabilities: { requiredTeamRoles: ['cerrah'] } };

describe('checkDeviceAuthorization', () => {
  it('izinsiz rol (örn. Sekreterlik=7) → reddedilmeli', () => {
    const r = checkDeviceAuthorization({ user: { roleId: 7 }, device: lightDevice, activeRoomId: 'room-1', teamRole: 'sirkule' });
    expect(r.allowed).toBe(false);
  });

  it('izinli rol ama farklı oda → reddedilmeli', () => {
    const r = checkDeviceAuthorization({ user: { roleId: 6 }, device: lightDevice, activeRoomId: 'room-2', teamRole: 'cerrah' });
    expect(r.allowed).toBe(false);
  });

  it('ışık cihazı: izinli rol + doğru oda + herhangi team_role → kabul', () => {
    const r = checkDeviceAuthorization({ user: { roleId: 4 }, device: lightDevice, activeRoomId: 'room-1', teamRole: 'hemsire' });
    expect(r.allowed).toBe(true);
  });

  it('elektrocerrahi: doğru oda ama team_role cerrah değil (hemşire) → reddedilmeli', () => {
    const r = checkDeviceAuthorization({ user: { roleId: 4 }, device: cauteryDevice, activeRoomId: 'room-1', teamRole: 'hemsire' });
    expect(r.allowed).toBe(false);
  });

  it('elektrocerrahi: doğru oda + team_role cerrah → kabul', () => {
    const r = checkDeviceAuthorization({ user: { roleId: 6 }, device: cauteryDevice, activeRoomId: 'room-1', teamRole: 'cerrah' });
    expect(r.allowed).toBe(true);
  });

  it('aktif ameliyat yok (activeRoomId=null) + odasız cihaz (room_id=null) → reddedilmeli (null===null fail-open)', () => {
    const roomlessLight = { room_id: null, device_group: 'light', capabilities: {} };
    const r = checkDeviceAuthorization({ user: { roleId: 4 }, device: roomlessLight, activeRoomId: null, teamRole: 'hemsire' });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('room_mismatch');
  });

  it('device null → temiz red dönmeli, throw etmemeli', () => {
    let r;
    expect(() => {
      r = checkDeviceAuthorization({ user: { roleId: 4 }, device: null, activeRoomId: 'room-1', teamRole: 'hemsire' });
    }).not.toThrow();
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('device_not_found');
  });
});
