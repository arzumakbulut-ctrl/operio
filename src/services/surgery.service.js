const db = require('../utils/db');
const { audit } = require('../utils/audit');
const { emitToInstitution, pushNotification, EVENTS } = require('../socket');

const STATUS_LABELS = {
  WAITING:     'Bekliyor',
  PREPARING:   'Hazırlanıyor',
  IN_PROGRESS: 'Devam Ediyor',
  COMPLETED:   'Tamamlandı',
  CANCELLED:   'İptal Edildi',
  POSTPONED:   'Ertelendi',
};

async function listSurgeries({ institutionId, userId, roleId, status, date, page=1, limit=50 }) {
  const conditions = ['s.institution_id = $1'];
  const params = [institutionId];
  let pi = 2;

  if (status) { conditions.push(`s.status = $${pi++}`); params.push(status); }
  if (date) {
    conditions.push(`s.scheduled_start >= $${pi++} AND s.scheduled_start <= $${pi++}`);
    const d = new Date(date);
    params.push(new Date(d.setHours(0,0,0,0)), new Date(d.setHours(23,59,59,999)));
  }

  if ([6,10].includes(roleId)) {
    const { rows: u } = await db.query('SELECT full_name FROM users WHERE id=$1', [userId]);
    if (u[0]) {
      conditions.push(`(s.surgeon_name ILIKE $${pi++} OR EXISTS (SELECT 1 FROM surgery_teams st WHERE st.surgery_id=s.id AND st.user_id=$${pi++}))`);
      params.push(`%${u[0].full_name}%`, userId);
    }
  } else if ([3,4,5,9].includes(roleId)) {
    conditions.push(`EXISTS (SELECT 1 FROM surgery_teams st WHERE st.surgery_id=s.id AND st.user_id=$${pi++})`);
    params.push(userId);
  }

  const where  = conditions.join(' AND ');
  const offset = (page - 1) * limit;

  const [{ rows: surgeries }, { rows: countRows }] = await Promise.all([
    db.query(
      `SELECT s.*, r.name AS room_name, r.room_number,
              p.first_name||' '||p.last_name AS patient_name, p.tc_no, p.blood_type
       FROM surgeries s
       LEFT JOIN operating_rooms r ON s.room_id = r.id
       LEFT JOIN patients p ON s.patient_id = p.id
       WHERE ${where}
       ORDER BY s.scheduled_start ASC
       LIMIT $${pi++} OFFSET $${pi}`,
      [...params, limit, offset]
    ),
    db.query(`SELECT COUNT(*) FROM surgeries s WHERE ${where}`, params),
  ]);

  const total = parseInt(countRows[0].count);
  return { surgeries, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function getSurgery({ id, institutionId }) {
  const { rows } = await db.query(
    `SELECT s.*, r.name AS room_name,
            p.first_name||' '||p.last_name AS patient_name, p.tc_no, p.blood_type
     FROM surgeries s
     LEFT JOIN operating_rooms r ON s.room_id = r.id
     LEFT JOIN patients p ON s.patient_id = p.id
     WHERE s.id = $1 AND s.institution_id = $2`,
    [id, institutionId]
  );
  return rows[0] || null;
}

async function createSurgery({ data, institutionId, userId, req }) {
  const { rows } = await db.query(
    `INSERT INTO surgeries
       (institution_id, room_id, patient_id, title, branch, surgeon_name,
        scheduled_start, scheduled_end, duration_min, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [institutionId, data.roomId??null, data.patientId??null, data.title,
     data.branch??null, data.surgeonName??null, data.scheduledStart,
     data.scheduledEnd??null, data.durationMin??null, data.notes??null]
  );
  const surgery = rows[0];

  await audit({ userId, action:'CREATE', resource:'surgery',
    resourceId: surgery.id, surgeryId: surgery.id, newData: data, req });

  // ── WebSocket: tüm kuruma bildir ──
  emitToInstitution(institutionId, EVENTS.SURGERY_CREATED, { surgery });
  await pushNotification({
    institutionId,
    type:    'tamamlandi',
    title:   'Yeni Ameliyat Eklendi',
    message: `${surgery.title} — ${surgery.surgeon_name || 'Cerrah atanmadı'}`,
    data:    { surgeryId: surgery.id },
  });

  return surgery;
}

async function updateSurgery({ id, data, institutionId, userId, req }) {
  const old = await getSurgery({ id, institutionId });
  if (!old) return null;

  const sets  = [];
  const params = [];
  let pi = 1;

  const fieldMap = {
    status: 'status', title: 'title', branch: 'branch',
    surgeonName: 'surgeon_name', scheduledStart: 'scheduled_start',
    scheduledEnd: 'scheduled_end', durationMin: 'duration_min',
    notes: 'notes', roomId: 'room_id', patientId: 'patient_id',
  };

  for (const [k, col] of Object.entries(fieldMap)) {
    if (data[k] !== undefined) {
      sets.push(`${col} = $${pi++}${col==='status'?'::surgery_status':''}`);
      params.push(data[k]);
    }
  }
  if (!sets.length) return old;

  sets.push('updated_at = NOW()');
  params.push(id);

  const { rows } = await db.query(
    `UPDATE surgeries SET ${sets.join(',')} WHERE id = $${pi} RETURNING *`,
    params
  );
  const surgery = rows[0];

  await audit({ userId, action:'UPDATE', resource:'surgery',
    resourceId: id, surgeryId: id, oldData: old, newData: data, req });

  // ── WebSocket: ameliyat güncellendi ──
  emitToInstitution(institutionId, EVENTS.SURGERY_UPDATED, { surgery, changedFields: Object.keys(data) });

  // Durum değişikliği varsa özel bildirim
  if (data.status && data.status !== old.status) {
    const newLabel = STATUS_LABELS[data.status] || data.status;
    await pushNotification({
      institutionId,
      type:    data.status === 'COMPLETED' ? 'tamamlandi' : 'uyari',
      title:   `Ameliyat Durumu: ${newLabel}`,
      message: `${surgery.title} → ${newLabel}`,
      data:    { surgeryId: id, oldStatus: old.status, newStatus: data.status },
    });
  }

  return surgery;
}

async function deleteSurgery({ id, institutionId, userId, req }) {
  const old = await getSurgery({ id, institutionId });
  if (!old) return false;

  await db.query('DELETE FROM surgeries WHERE id=$1', [id]);
  await audit({ userId, action:'DELETE', resource:'surgery',
    resourceId: id, oldData: old, req });

  // ── WebSocket ──
  emitToInstitution(institutionId, EVENTS.SURGERY_DELETED, { surgeryId: id });

  return true;
}

async function assignTeamMember({ surgeryId, userId, teamRole, actorId, req }) {
  await db.query(
    `INSERT INTO surgery_teams (surgery_id, user_id, team_role) VALUES ($1,$2,$3)
     ON CONFLICT (surgery_id, user_id) DO UPDATE SET team_role = EXCLUDED.team_role`,
    [surgeryId, userId, teamRole]
  );
  await audit({ userId: actorId, action:'UPDATE', resource:'surgery_team',
    resourceId: surgeryId, surgeryId, newData: { userId, teamRole }, req });
}

async function removeTeamMember({ surgeryId, userId, actorId, req }) {
  await db.query('DELETE FROM surgery_teams WHERE surgery_id=$1 AND user_id=$2', [surgeryId, userId]);
  await audit({ userId: actorId, action:'DELETE', resource:'surgery_team',
    resourceId: surgeryId, surgeryId, req });
}

module.exports = {
  listSurgeries, getSurgery, createSurgery, updateSurgery,
  deleteSurgery, assignTeamMember, removeTeamMember,
};
