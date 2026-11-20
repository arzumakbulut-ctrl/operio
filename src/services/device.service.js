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
  const { rows } = await db.query(
    `UPDATE controllable_devices SET driver_key=$1, mode=$2, updated_at=NOW()
     WHERE id=$3 AND institution_id=$4 RETURNING *`,
    [data.driverKey, data.mode, id, institutionId]
  );
  const device = rows[0] || null;
  if (device) {
    await audit({ userId, action:'UPDATE', resource:'controllable_devices', resourceId: id, newData: data, req });
  }
  return device;
}

module.exports = { listDevices, getDevice, createDevice, updateDeviceConfig };
