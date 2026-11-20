import { describe, it, expect } from 'vitest';
const { decideCommand } = await import('../../src/services/device.service.js');

const cauteryDevice = { id: 'd1', room_id: 'room-1', device_group: 'electrosurgery', requires_physical_confirm: false, capabilities: { requiredTeamRoles: ['cerrah'] } };
const tableDevice   = { id: 'd2', room_id: 'room-1', device_group: 'table', requires_physical_confirm: true, capabilities: {} };

describe('decideCommand', () => {
  it('yetkili cerrah + turn_on → izin verilmeli (fırlatmamalı)', () => {
    expect(() => decideCommand({
      user: { roleId: 6 }, device: cauteryDevice, activeRoomId: 'room-1', teamRole: 'cerrah', action: 'turn_on',
    })).not.toThrow();
  });

  it('ekipte olmayan biri (activeRoomId uyuşmuyor) → reddedilmeli', () => {
    expect(() => decideCommand({
      user: { roleId: 6 }, device: cauteryDevice, activeRoomId: null, teamRole: null, action: 'turn_on',
    })).toThrow();
  });

  it('elektrocerrahi: team_role cerrah değilse → reddedilmeli', () => {
    expect(() => decideCommand({
      user: { roleId: 4 }, device: cauteryDevice, activeRoomId: 'room-1', teamRole: 'hemsire', action: 'turn_on',
    })).toThrow();
  });

  it('requires_physical_confirm=true cihazda turn_on → reddedilmeli', () => {
    expect(() => decideCommand({
      user: { roleId: 6 }, device: tableDevice, activeRoomId: 'room-1', teamRole: 'cerrah', action: 'turn_on',
    })).toThrow(/physical_confirm_required/);
  });

  it('requires_physical_confirm=true cihazda arm_move → izin verilmeli', () => {
    expect(() => decideCommand({
      user: { roleId: 6 }, device: tableDevice, activeRoomId: 'room-1', teamRole: 'cerrah', action: 'arm_move',
    })).not.toThrow();
  });
});
