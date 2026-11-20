const db = require('../utils/db');
const { audit } = require('../utils/audit');

async function listDevices({ institutionId, roomId }) {
  const { rows } = await db.query(
    `SELECT * FROM controllable_devices
     WHERE institution_id=$1 AND ($2::uuid IS NULL OR room_id=$2)`,
    [institutionId, roomId ?? null]
  );
  return rows;
}

async function getDevice({ id, institutionId }) {
  const { rows } = await db.query(
    'SELECT * FROM controllable_devices WHERE id=$1 AND institution_id=$2',
    [id, institutionId]
  );
  return rows[0] || null;
}

async function createDevice({ data, institutionId, userId, req }) {
  const { rows } = await db.query(
    `INSERT INTO controllable_devices (institution_id, room_id, name, device_group, device_type, driver_key, requires_physical_confirm)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [
      institutionId,
      data.roomId ?? null,
      data.name,
      data.deviceGroup,
      data.deviceType,
      data.driverKey ?? 'mock',
      data.requiresPhysicalConfirm ?? false,
    ]
  );
  const device = rows[0];
  await audit({ userId, action:'CREATE', resource:'controllable_devices', resourceId: device.id, newData: data, req });
  return device;
}

async function updateDeviceConfig({ id, data, institutionId, userId, req }) {
  const old = await getDevice({ id, institutionId });
  if (!old) return null;

  const sets   = [];
  const params = [];
  let pi = 1;

  const fieldMap = { driverKey: 'driver_key', mode: 'mode' };

  for (const [k, col] of Object.entries(fieldMap)) {
    if (data[k] !== undefined) {
      sets.push(`${col} = $${pi++}${col==='mode'?'::device_mode':''}`);
      params.push(data[k]);
    }
  }
  if (!sets.length) return old;

  sets.push('updated_at = NOW()');
  params.push(id, institutionId);

  const { rows } = await db.query(
    `UPDATE controllable_devices SET ${sets.join(',')}
     WHERE id = $${pi} AND institution_id = $${pi + 1} RETURNING *`,
    params
  );
  const device = rows[0] || null;
  if (device) {
    await audit({ userId, action:'UPDATE', resource:'controllable_devices',
      resourceId: id, oldData: old, newData: data, req });
  }
  return device;
}

const ALLOWED_ROLE_IDS = [0, 1, 2, 3, 4, 5, 6];

// Pure function: no DB / I/O. Caller pre-fetches user, device, active room and team role.
function checkDeviceAuthorization({ user, device, activeRoomId, teamRole }) {
  if (!ALLOWED_ROLE_IDS.includes(user?.roleId)) {
    return { allowed: false, reason: 'role_not_allowed' };
  }

  if (device.room_id !== activeRoomId) {
    return { allowed: false, reason: 'room_mismatch' };
  }

  const requiredTeamRoles = device.capabilities?.requiredTeamRoles;
  if (Array.isArray(requiredTeamRoles) && requiredTeamRoles.length > 0
      && !requiredTeamRoles.includes(teamRole)) {
    return { allowed: false, reason: 'team_role_required' };
  }

  return { allowed: true };
}

module.exports = { listDevices, getDevice, createDevice, updateDeviceConfig, checkDeviceAuthorization };
