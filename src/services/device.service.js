const db = require('../utils/db');
const { audit } = require('../utils/audit');
const { emitToInstitution, EVENTS } = require('../socket');
const { getDriver } = require('../drivers/registry');

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

// Pure function: no DB / I/O. High-risk device groups (electrosurgery, table) default
// to a cerrah-only team_role restriction so checkDeviceAuthorization's tiering (which
// reads device.capabilities.requiredTeamRoles) is actually active for devices created
// through the real API, not just in tests. A caller-provided `capabilities` (including
// an intentionally empty {}) is always respected as-is and never overridden.
const HIGH_RISK_DEVICE_GROUPS = ['electrosurgery', 'table'];

function defaultCapabilitiesFor(deviceGroup, providedCapabilities) {
  if (providedCapabilities !== undefined && providedCapabilities !== null) {
    return providedCapabilities;
  }
  if (HIGH_RISK_DEVICE_GROUPS.includes(deviceGroup)) {
    return { requiredTeamRoles: ['cerrah'] };
  }
  return {};
}

async function createDevice({ data, institutionId, userId, req }) {
  const capabilities = defaultCapabilitiesFor(data.deviceGroup, data.capabilities);
  const { rows } = await db.query(
    `INSERT INTO controllable_devices (institution_id, room_id, name, device_group, device_type, driver_key, requires_physical_confirm, capabilities)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      institutionId,
      data.roomId ?? null,
      data.name,
      data.deviceGroup,
      data.deviceType,
      data.driverKey ?? 'mock',
      data.requiresPhysicalConfirm ?? false,
      JSON.stringify(capabilities),
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
  if (!device) {
    return { allowed: false, reason: 'device_not_found' };
  }

  if (!ALLOWED_ROLE_IDS.includes(user?.roleId)) {
    return { allowed: false, reason: 'role_not_allowed' };
  }

  // activeRoomId == null means the caller is in no active surgery; never authorize that,
  // even when the device has no room either (null === null must not pass).
  if (activeRoomId == null || device.room_id !== activeRoomId) {
    return { allowed: false, reason: 'room_mismatch' };
  }

  const requiredTeamRoles = device.capabilities?.requiredTeamRoles;
  if (Array.isArray(requiredTeamRoles) && requiredTeamRoles.length > 0
      && !requiredTeamRoles.includes(teamRole)) {
    return { allowed: false, reason: 'team_role_required' };
  }

  return { allowed: true };
}

// Pure function: no DB / I/O / driver / audit / socket access.
// Re-uses checkDeviceAuthorization for the room+role+team_role decision, then layers
// the physical-confirm gating rule on top. Authorization is checked FIRST — a caller
// who isn't even authorized must never reach the physical-confirm branch.
function decideCommand({ user, device, activeRoomId, teamRole, action }) {
  const { allowed, reason } = checkDeviceAuthorization({ user, device, activeRoomId, teamRole });
  if (!allowed) {
    throw new Error(reason);
  }

  // Devices that require physical confirmation (e.g. the OR table) may only be
  // *armed* remotely — the actual move must be confirmed from the physical console
  // via physicalConfirm(). Every other action is rejected outright.
  if (device.requires_physical_confirm && action !== 'arm_move') {
    throw new Error('physical_confirm_required');
  }
}

// Caller's current room/team_role, derived from whichever surgery they're actively
// assigned to right now. No active IN_PROGRESS surgery → both null (never fail-open).
async function getActiveAssignment({ userId }) {
  const { rows } = await db.query(
    `SELECT s.room_id, st.team_role
     FROM surgery_teams st
     JOIN surgeries s ON s.id = st.surgery_id
     WHERE st.user_id = $1 AND s.status = 'IN_PROGRESS'
     LIMIT 1`,
    [userId]
  );
  const row = rows[0];
  return { activeRoomId: row ? row.room_id : null, teamRole: row ? row.team_role : null };
}

async function updateDeviceStatus({ deviceId, institutionId, status }) {
  const { rows } = await db.query(
    `UPDATE controllable_devices SET power_state=$1::device_power_state, power_level=$2, updated_at=NOW()
     WHERE id=$3 AND institution_id=$4 RETURNING *`,
    [status.power_state, status.power_level, deviceId, institutionId]
  );
  return rows[0] || null;
}

// Thin, db-touching orchestration — not unit tested (see Task 5/7 notes: db.query
// can't be mocked for require()-based code in this project's Vitest setup).
// Correctness of the decideCommand call is verified indirectly by Task 8's route tests
// and/or manual verification against a real DB.
//
// NOTE: `roleId` is not in the plan's literal param list for executeCommand, but
// decideCommand requires `user.roleId` and nothing else here can supply it. This
// follows the existing convention (see surgery.routes.js, which passes `roleId:
// req.user.roleId` explicitly into service calls rather than re-deriving it). Task 8's
// route must pass `roleId: req.user.roleId` when calling executeCommand.
async function executeCommand({ deviceId, institutionId, userId, roleId, action, value, req }) {
  const device = await getDevice({ id: deviceId, institutionId });
  if (!device) {
    throw new Error('device_not_found');
  }

  const { activeRoomId, teamRole } = await getActiveAssignment({ userId });

  decideCommand({ user: { roleId }, device, activeRoomId, teamRole, action });

  const driver = getDriver(device);
  let status;
  switch (action) {
    case 'turn_on':
      status = await driver.turnOn();
      break;
    case 'turn_off':
      status = await driver.turnOff();
      break;
    case 'set_power':
      status = await driver.setPower(value);
      break;
    case 'arm_move':
      status = await driver.armMove(value);
      break;
    case 'invoke_action':
      status = await driver.invokeAction(value?.name, value?.args);
      break;
    default:
      throw new Error('unknown_action');
  }

  const updated = await updateDeviceStatus({ deviceId, institutionId, status });

  await audit({
    userId, action: 'device:command', resource: 'controllable_devices',
    resourceId: deviceId, newData: { action, value }, req,
  });
  emitToInstitution(institutionId, EVENTS.DEVICE_STATUS_CHANGED, { device: updated });

  return updated;
}

// Thin, db-touching orchestration — not unit tested, see note on executeCommand above.
// Deliberately does NOT run the FULL decideCommand/checkDeviceAuthorization bar (no
// requiredTeamRoles check): physicalConfirm models someone physically at the device
// console confirming a move that an authorized arm_move already armed, and any team
// member actually in that room can reasonably press the confirm button — not only
// whoever issued the arm_move. It still must reject anyone with no connection to that
// room at all, so it applies the same room-membership half of the check that
// checkDeviceAuthorization uses (reusing getActiveAssignment, same as executeCommand),
// plus the ARMED-state gate.
async function physicalConfirm({ deviceId, institutionId, userId, req }) {
  const device = await getDevice({ id: deviceId, institutionId });
  if (!device) {
    throw new Error('device_not_found');
  }

  const { activeRoomId } = await getActiveAssignment({ userId });
  if (activeRoomId == null || device.room_id !== activeRoomId) {
    throw new Error('room_mismatch');
  }

  if (device.power_state !== 'ARMED') {
    throw new Error('not_armed');
  }

  const driver = getDriver(device);
  const status = await driver.confirmPhysical();

  const updated = await updateDeviceStatus({ deviceId, institutionId, status });

  await audit({
    userId, action: 'device:command', resource: 'controllable_devices',
    resourceId: deviceId, newData: { action: 'physical_confirm' }, req,
  });
  emitToInstitution(institutionId, EVENTS.DEVICE_STATUS_CHANGED, { device: updated });

  return updated;
}

module.exports = {
  listDevices, getDevice, createDevice, updateDeviceConfig, checkDeviceAuthorization,
  decideCommand, getActiveAssignment, executeCommand, physicalConfirm, defaultCapabilitiesFor,
};
