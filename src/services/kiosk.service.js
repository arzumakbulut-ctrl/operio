const crypto = require('crypto');
const db = require('../utils/db');
const { signKioskToken } = require('../utils/kioskJwt');
const { audit } = require('../utils/audit');

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
 *
 * surgeryTeams sırası DETERMİNİSTİKTİR: önce team_role = 'cerrah' olan(lar), sonra
 * user_id'ye göre artan. MockSpeakerVerifier'ın 'always_match' modu ilk adayı,
 * 'cycle' modu bu sırayla dönüşü kullandığından, ORDER BY olmadan (DB'ye bağlı keyfi
 * sıra) cerrah-yetkili komutların demo davranışı çalıştırmadan çalıştırmaya değişirdi.
 * @returns {Promise<{ id, surgeryTeams: Array<{ userId, fullName, roleId, teamRole }> } | null>}
 */
async function getActiveSurgeryForRoom(roomId) {
  const { rows } = await db.query(
    `SELECT s.id AS surgery_id, st.user_id, u.full_name, u.role_id, st.team_role
     FROM surgery_teams st
     JOIN surgeries s ON s.id = st.surgery_id
     JOIN users u ON u.id = st.user_id
     WHERE s.room_id = $1 AND s.status = 'IN_PROGRESS'
     ORDER BY (st.team_role = 'cerrah') DESC, st.user_id ASC`,
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
 * assertRoomOwnership — roomId'nin gerçekten institutionId'ye ait olduğunu
 * doğrular (room.service.js'teki getRoom ile aynı sorgu deseni). Kurum A'nın
 * admin'inin kurum B'nin oda UUID'siyle kiosk token üretmesini/iptal etmesini
 * engeller (IDOR — cross-tenant erişim).
 */
async function assertRoomOwnership(institutionId, roomId) {
  const { rows } = await db.query(
    'SELECT id FROM operating_rooms WHERE id=$1 AND institution_id=$2',
    [roomId, institutionId]
  );
  if (rows.length === 0) {
    throw Object.assign(new Error('Oda bulunamadı'), { statusCode: 404 });
  }
}

/**
 * createKioskToken — bir oda için yeni kiosk token'ı üretir. Önce roomId'nin
 * institutionId'ye ait olduğunu doğrular (cross-tenant koruması), sonra o
 * odaya ait henüz revoke edilmemiş önceki token varsa onu revoke eder (her
 * odada aynı anda sadece bir aktif token olmalı), yeni bir jti ile
 * kiosk_tokens'a INSERT eder ve imzalanmış JWT'yi döner. Revoke+insert tek
 * bir transaction içinde yapılır — iki eşzamanlı çağrının her ikisinin de
 * revoke edip her ikisinin de insert ederek odada iki aktif token bırakmasını
 * (race condition) engeller.
 * @returns {Promise<{ token: string, kioskUrl: string }>}
 */
async function createKioskToken(institutionId, roomId) {
  return db.transaction(async (client) => {
    const { rows } = await client.query(
      'SELECT id FROM operating_rooms WHERE id=$1 AND institution_id=$2',
      [roomId, institutionId]
    );
    if (rows.length === 0) {
      throw Object.assign(new Error('Oda bulunamadı'), { statusCode: 404 });
    }

    const jti = crypto.randomUUID();

    await client.query(
      'UPDATE kiosk_tokens SET revoked_at = NOW() WHERE room_id = $1 AND revoked_at IS NULL',
      [roomId]
    );

    await client.query(
      'INSERT INTO kiosk_tokens (institution_id, room_id, jti) VALUES ($1, $2, $3)',
      [institutionId, roomId, jti]
    );

    const token = signKioskToken({ institutionId, roomId, jti });
    return { token, kioskUrl: '/kiosk/' + roomId };
  });
}

/**
 * revokeKioskToken — bir odanın aktif (henüz revoke edilmemiş) kiosk
 * token'ını iptal eder. Önce roomId'nin institutionId'ye ait olduğunu
 * doğrular (cross-tenant koruması — bkz. createKioskToken).
 */
async function revokeKioskToken(institutionId, roomId) {
  await assertRoomOwnership(institutionId, roomId);

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

/**
 * incrementMockCycleIndex — 'cycle' modunda bir sonraki identify() çağrısının
 * farklı bir candidate döndürmesi için cycle_index'i 1 artırır (upsert —
 * kurum için henüz satır yoksa cycle_index=1 ile oluşturur, setMockConfig ile
 * aynı upsert deseni). mode'a dokunmaz, sadece cycle_index'i ilerletir.
 * @returns {Promise<number>} yeni cycleIndex
 */
async function incrementMockCycleIndex(institutionId) {
  const { rows } = await db.query(
    `INSERT INTO kiosk_mock_config (institution_id, cycle_index) VALUES ($1, 1)
     ON CONFLICT (institution_id) DO UPDATE SET cycle_index = kiosk_mock_config.cycle_index + 1
     RETURNING cycle_index`,
    [institutionId]
  );
  return rows[0].cycle_index;
}

/**
 * recordTimeoutRead — TIMEOUT (SKS Time-Out checklist) dalının okunduğunu
 * audit log'a yazar. TIMEOUT dalı kioskSpeakerAuth KULLANMADIĞINDAN (bkz.
 * kiosk.routes.js) konuşmacının kimliği hiçbir zaman bilinmez — userId
 * kasıtlı olarak her zaman null'dur.
 */
async function recordTimeoutRead({ surgeryId, req }) {
  await audit({
    userId: null,
    action: 'voice:timeout_read',
    resource: 'surgeries',
    resourceId: surgeryId,
    req,
  });
}

/**
 * recordWebSearch — WEB_SEARCH dalının (kiosk sesli web araması) audit log'a
 * yazılmasıdır. recordTimeoutRead'in AKSİNE WEB_SEARCH dalı kioskSpeakerAuth'tan
 * geçtiği için konuşmacı her zaman bilinir — userId null DEĞİLDİR.
 *
 * newData SADECE soruyu (query) ve Claude'un ürettiği özetlenmiş yanıtı (answer —
 * isClinicalQuestion true ise klinik uyarısı önüne eklenmiş hâliyle) taşır. Ham
 * web arama sonuçları/kaynak URL'leri hiçbir zaman loglanmaz — Claude'un
 * web_search aracının ürettiği ara bloklar (server_tool_use/web_search_tool_result)
 * ai.service.js'in webSearch()'ünde zaten ayıklanıp atılır, bu fonksiyona hiç
 * ulaşmaz (bkz. kiosk.routes.js WEB_SEARCH dalı, ai.service.js webSearch()).
 */
async function recordWebSearch({ userId, surgeryId, query, answer, req }) {
  await audit({
    userId,
    action: 'voice:web_search',
    resource: 'surgeries',
    resourceId: surgeryId,
    newData: { query, answer },
    req,
  });
}

module.exports = {
  isTokenRevoked,
  getActiveSurgeryForRoom,
  createKioskToken,
  revokeKioskToken,
  getMockConfig,
  setMockConfig,
  incrementMockCycleIndex,
  recordTimeoutRead,
  recordWebSearch,
};
