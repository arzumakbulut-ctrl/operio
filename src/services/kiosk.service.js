const db = require('../utils/db');

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

module.exports = { isTokenRevoked, getActiveSurgeryForRoom };
