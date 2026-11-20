const db = require('../utils/db');
const { audit } = require('../utils/audit');

async function listPatients({ q, page=1, limit=20 }) {
  const conditions = [];
  const params = [];
  let pi = 1;

  if (q) {
    conditions.push(`(p.first_name ILIKE $${pi} OR p.last_name ILIKE $${pi} OR p.tc_no ILIKE $${pi})`);
    params.push(`%${q}%`); pi++;
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const offset = (page - 1) * limit;

  const [{ rows: patients }, { rows: countRows }] = await Promise.all([
    db.query(
      `SELECT p.*,
              (SELECT json_agg(json_build_object('id',s.id,'title',s.title,'status',s.status,'scheduled_start',s.scheduled_start) ORDER BY s.scheduled_start DESC)
               FROM surgeries s WHERE s.patient_id = p.id LIMIT 3) AS surgeries
       FROM patients p ${where}
       ORDER BY p.created_at DESC
       LIMIT $${pi} OFFSET $${pi+1}`,
      [...params, limit, offset]
    ),
    db.query(`SELECT COUNT(*) FROM patients p ${where}`, params),
  ]);

  const total = parseInt(countRows[0].count);
  return { patients, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function getPatient(id) {
  const { rows } = await db.query(
    `SELECT p.*,
            (SELECT json_agg(json_build_object('id',s.id,'title',s.title,'status',s.status,'scheduled_start',s.scheduled_start,'branch',s.branch,'surgeon_name',s.surgeon_name) ORDER BY s.scheduled_start DESC)
             FROM surgeries s WHERE s.patient_id = p.id) AS surgeries
     FROM patients p WHERE p.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function createPatient({ data, userId, req }) {
  const { rows } = await db.query(
    `INSERT INTO patients (tc_no, first_name, last_name, date_of_birth, gender, blood_type, phone)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [data.tcNo??null, data.firstName, data.lastName, data.dateOfBirth??null,
     data.gender??null, data.bloodType??null, data.phone??null]
  );
  const patient = rows[0];
  await audit({ userId, action:'CREATE', resource:'patient', resourceId:patient.id, newData:data, req });
  return patient;
}

async function updatePatient({ id, data, userId, req }) {
  const { rows: old } = await db.query('SELECT * FROM patients WHERE id=$1', [id]);
  if (!old[0]) return null;

  const sets = [];
  const params = [];
  let pi = 1;
  const fieldMap = { tcNo:'tc_no', firstName:'first_name', lastName:'last_name',
    dateOfBirth:'date_of_birth', gender:'gender', bloodType:'blood_type', phone:'phone' };

  for (const [k,col] of Object.entries(fieldMap)) {
    if (data[k] !== undefined) { sets.push(`${col} = $${pi++}`); params.push(data[k]); }
  }
  if (!sets.length) return old[0];

  sets.push('updated_at = NOW()');
  params.push(id);
  const { rows } = await db.query(`UPDATE patients SET ${sets.join(',')} WHERE id = $${pi} RETURNING *`, params);
  await audit({ userId, action:'UPDATE', resource:'patient', resourceId:id, oldData:old[0], newData:data, req });
  return rows[0];
}

module.exports = { listPatients, getPatient, createPatient, updatePatient };
