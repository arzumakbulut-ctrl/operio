const db = require('../utils/db');
const { audit } = require('../utils/audit');
const { emitToInstitution, pushNotification, EVENTS } = require('../socket');

const STATUS_LABELS = {
  ACTIVE:      'Aktif',
  IDLE:        'Boşta',
  RESERVED:    'Rezerve',
  MAINTENANCE: 'Bakımda',
  CLOSED:      'Kapalı',
};

async function listRooms(institutionId) {
  const { rows } = await db.query(
    `SELECT r.*,
            (SELECT row_to_json(s.*) FROM surgeries s
             WHERE s.room_id = r.id AND s.status IN ('IN_PROGRESS','PREPARING')
               AND s.scheduled_start >= NOW()::date
             ORDER BY s.scheduled_start LIMIT 1) AS active_surgery
     FROM operating_rooms r
     WHERE r.institution_id = $1
     ORDER BY r.room_number`,
    [institutionId]
  );
  return rows;
}

async function getRoom({ id, institutionId }) {
  const { rows } = await db.query(
    'SELECT * FROM operating_rooms WHERE id=$1 AND institution_id=$2',
    [id, institutionId]
  );
  return rows[0] || null;
}

async function createRoom({ data, institutionId, userId, req }) {
  const { rows } = await db.query(
    `INSERT INTO operating_rooms (institution_id, name, room_number, branch, capacity, color)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [institutionId, data.name, data.roomNumber, data.branch??null, data.capacity??6, data.color??null]
  );
  const room = rows[0];
  await audit({ userId, action:'CREATE', resource:'room', resourceId: room.id, newData: data, req });
  emitToInstitution(institutionId, EVENTS.ROOM_STATUS_CHANGED, { room });
  return room;
}

async function updateRoomStatus({ id, status, institutionId, userId, req }) {
  const old = await getRoom({ id, institutionId });
  if (!old) return null;

  const { rows } = await db.query(
    `UPDATE operating_rooms SET status=$1::room_status, updated_at=NOW() WHERE id=$2 RETURNING *`,
    [status, id]
  );
  const room = rows[0];

  await audit({ userId, action:'UPDATE', resource:'room',
    resourceId: id, oldData: { status: old.status }, newData: { status }, req });

  // ── WebSocket: salon durumu değişti ──
  emitToInstitution(institutionId, EVENTS.ROOM_STATUS_CHANGED, {
    room,
    oldStatus: old.status,
    newStatus: status,
  });

  // Bakıma alındıysa uyarı bildir
  if (status === 'MAINTENANCE') {
    await pushNotification({
      institutionId,
      type:    'ekipman',
      title:   `${room.name} Bakıma Alındı`,
      message: `${room.name} (${room.branch || 'Genel'}) bakım moduna geçirildi`,
      data:    { roomId: id },
    });
  }

  return room;
}

async function deleteRoom({ id, institutionId, userId, req }) {
  const old = await getRoom({ id, institutionId });
  if (!old) return false;
  await db.query('DELETE FROM operating_rooms WHERE id=$1', [id]);
  await audit({ userId, action:'DELETE', resource:'room', resourceId: id, req });
  return true;
}

module.exports = { listRooms, getRoom, createRoom, updateRoomStatus, deleteRoom };
