const db = require('../utils/db');
const { audit } = require('../utils/audit');
const { emitToInstitution, EVENTS } = require('../socket');

async function listSets({ q, status, page=1, limit=50 }) {
  const conditions = [];
  const params = [];
  let pi = 1;

  if (status) { conditions.push(`s.status = $${pi++}::set_status`); params.push(status); }
  if (q) {
    conditions.push(`(s.name ILIKE $${pi} OR s.code ILIKE $${pi})`);
    params.push(`%${q}%`); pi++;
  }

  const where  = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const offset = (page - 1) * limit;

  const [{ rows: sets }, { rows: countRows }] = await Promise.all([
    db.query(
      `SELECT s.*,
              (SELECT json_agg(i.*) FROM set_instruments i WHERE i.set_id = s.id) AS instruments
       FROM sterile_sets s ${where}
       ORDER BY s.name
       LIMIT $${pi} OFFSET $${pi+1}`,
      [...params, limit, offset]
    ),
    db.query(`SELECT COUNT(*) FROM sterile_sets s ${where}`, params),
  ]);

  const total = parseInt(countRows[0].count);
  return { sets, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function getSet(id) {
  const { rows } = await db.query(
    `SELECT s.*,
            (SELECT json_agg(i.*) FROM set_instruments i WHERE i.set_id = s.id) AS instruments,
            (SELECT json_agg(l.* ORDER BY l.created_at DESC) FROM set_tracking_logs l WHERE l.set_id = s.id LIMIT 20) AS tracking_logs
     FROM sterile_sets s WHERE s.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function createSet({ data, userId, req }) {
  const { instruments, ...setData } = data;
  return await db.transaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO sterile_sets (code, name, total_count, sterile_count, shelf_location, status)
       VALUES ($1,$2,$3,$4,$5,$6::set_status) RETURNING *`,
      [setData.code, setData.name, setData.totalCount??1, setData.totalCount??1,
       setData.shelfLocation??null, setData.status??'STERILE']
    );
    const set = rows[0];

    if (instruments?.length) {
      for (const inst of instruments) {
        await client.query(
          'INSERT INTO set_instruments (set_id, name, expected_count) VALUES ($1,$2,$3)',
          [set.id, inst.name, inst.expectedCount??1]
        );
      }
    }

    await audit({ userId, action:'CREATE', resource:'sterile_set',
      resourceId: set.id, newData: setData, req });
    return set;
  });
}

async function updateSet({ id, data, userId, req }) {
  const { rows: old } = await db.query('SELECT * FROM sterile_sets WHERE id=$1', [id]);
  if (!old[0]) return null;

  const { instruments, ...setData } = data;
  const sets   = [];
  const params = [];
  let pi = 1;

  const fieldMap = {
    code:'code', name:'name', totalCount:'total_count',
    sterileCount:'sterile_count', inUseCount:'in_use_count',
    shelfLocation:'shelf_location', status:'status',
  };

  for (const [k, col] of Object.entries(fieldMap)) {
    if (setData[k] !== undefined) {
      sets.push(`${col} = $${pi++}${col==='status'?'::set_status':''}`);
      params.push(setData[k]);
    }
  }
  if (!sets.length) return old[0];

  sets.push('updated_at = NOW()');
  params.push(id);

  const { rows } = await db.query(
    `UPDATE sterile_sets SET ${sets.join(',')} WHERE id = $${pi} RETURNING *`,
    params
  );

  await audit({ userId, action:'UPDATE', resource:'sterile_set',
    resourceId: id, oldData: old[0], newData: setData, req });

  // Sterilizasyon sorumlusuna bildir — institutionId yoksa tüm kuruma emit
  // (set tablosunda institution_id yok, tüm kuruma broadcast yapıyoruz)
  if (_globalInstitutionId) {
    emitToInstitution(_globalInstitutionId, EVENTS.SET_STATUS_CHANGED, { set: rows[0] });
  }

  return rows[0];
}

// Geçici çözüm: set servisi institutionId bilmez, route'dan geç
let _globalInstitutionId = null;
function setCurrentInstitution(id) { _globalInstitutionId = id; }

async function addTrackingLog({ setId, stage, operator, notes, counts, userId, req, institutionId }) {
  if (counts !== undefined) {
    return await db.transaction((client) =>
      _addTrackingLogCore(client, { setId, stage, operator, notes, counts, userId, req, institutionId })
    );
  }
  return await _addTrackingLogCore(db, { setId, stage, operator, notes, userId, req, institutionId });
}

// addTrackingLog'un asıl mantığı — `runner` ya düz `db` (counts yoksa) ya da bir
// `db.transaction` client'ı (counts varsa, tüm adımlar aynı transaction'da) olabilir.
async function _addTrackingLogCore(runner, { setId, stage, operator, notes, counts, userId, req, institutionId }) {
  let finalNotes = notes;

  if (counts !== undefined) {
    const { rows: expectedRows } = await runner.query(
      'SELECT id, expected_count FROM set_instruments WHERE set_id=$1',
      [setId]
    );
    const expectedMap = new Map(expectedRows.map(r => [r.id, r.expected_count]));

    const missing = [];
    for (const c of counts) {
      // id VE set_id BİRLİKTE filtrelenir — client'ın verdiği instrumentId başka bir sete
      // ait olsa bile bu UPDATE o satırı asla etkilemez (Review Focus #4).
      await runner.query(
        'UPDATE set_instruments SET current_count=$1 WHERE id=$2 AND set_id=$3',
        [c.count, c.instrumentId, setId]
      );

      const expected = expectedMap.get(c.instrumentId);
      if (expected != null && c.count < expected) {
        missing.push(c.instrumentId);
      }
    }

    if (missing.length) {
      finalNotes = (notes ? notes + ' | ' : '') + '⚠ Eksik alet: ' + missing.join(', ');
    }
  }

  const { rows: logRows } = await runner.query(
    'INSERT INTO set_tracking_logs (set_id, stage, operator, notes) VALUES ($1,$2,$3,$4) RETURNING *',
    [setId, stage, operator??null, finalNotes??null]
  );

  const statusMap = {
    teslim_alindi:'IN_USE', yikama:'STERILIZING',
    sterilizasyon:'STERILIZING', steril:'STERILE', depo:'STERILE',
  };
  const newStatus = statusMap[stage];
  if (newStatus) {
    const extraSets = stage === 'steril' ? ', last_sterilized = NOW()' : '';
    const { rows: updated } = await runner.query(
      `UPDATE sterile_sets SET status=$1::set_status${extraSets}, updated_at=NOW()
       WHERE id=$2 RETURNING *`,
      [newStatus, setId]
    );

    // ── WebSocket: set durumu değişti ──
    if (institutionId) {
      emitToInstitution(institutionId, EVENTS.SET_STATUS_CHANGED, {
        set: updated[0], stage,
      });
    }
  }

  await audit({ userId, action:'UPDATE', resource:'set_tracking',
    resourceId: setId, newData: { stage, operator }, req });

  return logRows[0];
}

/**
 * AI Vision'ın tahmin ettiği alet sayılarını kaydeder (insan onayı ÖNCESİ, ayrı bir
 * alandır — current_count'u ETKİLEMEZ). detectedCount null olan öneriler atlanır.
 */
async function recordVisionSuggestion({ setId, suggestions, userId, req }) {
  const toUpdate = suggestions.filter(s => s.detectedCount != null);

  for (const s of toUpdate) {
    await db.query(
      'UPDATE set_instruments SET last_suggested_count=$1 WHERE id=$2',
      [s.detectedCount, s.instrumentId]
    );
  }

  await audit({ userId, action:'AI_COUNT_SUGGESTION', resource:'sterile_set',
    resourceId: setId, newData: { suggestions }, req });

  return { updated: toUpdate.length };
}

module.exports = { listSets, getSet, createSet, updateSet, addTrackingLog, recordVisionSuggestion, setCurrentInstitution };
