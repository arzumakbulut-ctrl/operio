const crypto = require('crypto');
const db = require('../utils/db');
const { signKioskToken } = require('../utils/kioskJwt');

/**
 * isTokenRevoked — jti'ye ait kiosk_tokens kaydı revoke edilmiş mi?
 * Kayıt hiç yoksa da revoke edilmiş kabul edilir (fail-closed).
 */
async function isTokenRevoked(jti) {
  const { rows } = await db.query(
    'SELECT revoked_at FROM kiosk_tokens WHERE jti = $1',
    [jti]
  );
  if (rows.length === 0) return true;
  return rows[0].revoked_at !== null;
}

/**
 * getActiveSurgeryForRoom — o odada şu an IN_PROGRESS olan ameliyatı, ekibiyle
 * birlikte getirir. surgery_teams + users JOIN edilerek her ekip üyesi için
 * full_name ve role_id tek sorguda alınır (device.service.js'teki
 * getActiveAssignment ile aynı JOIN deseni).
 * @returns {Promise<{ id, surgeryTeams: Array<{ userId, fullName, roleId, teamRole }> } | null>}
 */
async function getActiveSurgeryForRoom(roomId) {
  const { rows } = await db.query(
    `SELECT s.id AS surgery_id, st.user_id, u.full_name, u.role_id, st.team_role
     FROM surgery_teams st
     JOIN surgeries s ON s.id = st.surgery_id
     JOIN users u ON u.id = st.user_id
     WHERE s.room_id = $1 AND s.status = 'IN_PROGRESS'`,
    [roomId]
  );

  if (rows.length === 0) return null;

  const surgeryTeams = rows.map(row => ({
    userId:   row.user_id,
    fullName: row.full_name,
    roleId:   row.role_id,
    teamRole: row.team_role,
  }));

  return { id: rows[0].surgery_id, surgeryTeams };
}

/**
 * createKioskToken — bir oda için yeni kiosk token'ı üretir. O odaya ait,
 * henüz revoke edilmemiş önceki token varsa önce onu revoke eder (her odada
 * aynı anda sadece bir aktif token olmalı), sonra yeni bir jti ile
 * kiosk_tokens'a INSERT eder ve imzalanmış JWT'yi döner.
 * @returns {Promise<{ token: string, kioskUrl: string }>}
 */
async function createKioskToken(institutionId, roomId) {
  const jti = crypto.randomUUID();

  await db.query(
    'UPDATE kiosk_tokens SET revoked_at = NOW() WHERE room_id = $1 AND revoked_at IS NULL',
    [roomId]
  );

  await db.query(
    'INSERT INTO kiosk_tokens (institution_id, room_id, jti) VALUES ($1, $2, $3)',
    [institutionId, roomId, jti]
  );

  const token = signKioskToken({ institutionId, roomId, jti });
  return { token, kioskUrl: '/kiosk/' + roomId };
}

/**
 * revokeKioskToken — bir odanın aktif (henüz revoke edilmemiş) kiosk
 * token'ını iptal eder.
 */
async function revokeKioskToken(roomId) {
  await db.query(
    'UPDATE kiosk_tokens SET revoked_at = NOW() WHERE room_id = $1 AND revoked_at IS NULL',
    [roomId]
  );
}

/**
 * getMockConfig — kurumun mock konuşmacı-doğrulama konfigürasyonunu getirir.
 * Kurum için henüz bir satır yoksa (setMockConfig hiç çağrılmamışsa) varsayılan
 * { mode: 'always_match', cycleIndex: 0 } döner — satır sadece ilk
 * setMockConfig çağrısında oluşturulur.
 * @returns {Promise<{ mode: string, cycleIndex: number }>}
 */
async function getMockConfig(institutionId) {
  const { rows } = await db.query(
    'SELECT mode, cycle_index FROM kiosk_mock_config WHERE institution_id = $1',
    [institutionId]
  );
  if (rows.length === 0) {
    return { mode: 'always_match', cycleIndex: 0 };
  }
  return { mode: rows[0].mode, cycleIndex: rows[0].cycle_index };
}

/**
 * setMockConfig — kurumun mock konfigürasyon modunu upsert eder (satır yoksa
 * oluşturur, varsa mode'u günceller).
 * @returns {Promise<{ mode: string, cycleIndex: number }>}
 */
async function setMockConfig(institutionId, mode) {
  const { rows } = await db.query(
    `INSERT INTO kiosk_mock_config (institution_id, mode) VALUES ($1, $2)
     ON CONFLICT (institution_id) DO UPDATE SET mode = $2
     RETURNING mode, cycle_index`,
    [institutionId, mode]
  );
  return { mode: rows[0].mode, cycleIndex: rows[0].cycle_index };
}

module.exports = {
  isTokenRevoked,
  getActiveSurgeryForRoom,
  createKioskToken,
  revokeKioskToken,
  getMockConfig,
  setMockConfig,
};
