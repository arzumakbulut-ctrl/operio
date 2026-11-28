const db = require('../utils/db');
const { auditPlatformAdmin } = require('../utils/platformAdminAudit');

/**
 * listTickets — status/type/institutionId filtrelerine göre sayfalanmış talep
 * listesi. `institution.service.js`'in `listInstitutions`'ı (basit sayfalama) ile
 * `surgery.service.js`'in `listSurgeries`'i (dinamik WHERE kurucu, pi-sayaçlı
 * parametreler, LIMIT/OFFSET için AYNI sayaç) AYNI desen — bkz. surgery.routes.js'in
 * GET /'inde status/date query'lerinin şemaya hiç girmeden doğrudan okunduğu AYNI
 * tercih (bu task için de institutionId/status/type paylaşılan `paginationSchema`'ya
 * EKLENMEDİ, route'ta inline `.extend()` ile genişletildi).
 */
async function listTickets({ status, type, institutionId, page = 1, limit = 20 } = {}) {
  const conditions = [];
  const params = [];
  let pi = 1;

  if (status) { conditions.push(`status = $${pi++}`); params.push(status); }
  if (type) { conditions.push(`type = $${pi++}`); params.push(type); }
  if (institutionId) { conditions.push(`institution_id = $${pi++}`); params.push(institutionId); }

  const where  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const [{ rows: tickets }, { rows: countRows }] = await Promise.all([
    db.query(
      `SELECT * FROM institution_support_tickets ${where}
       ORDER BY created_at DESC
       LIMIT $${pi++} OFFSET $${pi}`,
      [...params, limit, offset]
    ),
    db.query(`SELECT COUNT(*) FROM institution_support_tickets ${where}`, params),
  ]);

  const total = parseInt(countRows[0].count);
  return { tickets, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/**
 * getTicket — talep + yorum geçmişi.
 *
 * REVIEW FOCUS: yorumların yazarı (`platform_admin_id`) o admin hesabı SONRADAN
 * `is_active=FALSE` olsa da (hesap deaktif edilse de) kalıcı olarak görünür kalmalı
 * — bir yorumun yazarının adı, o kişi ekipten ayrılsa/deaktif edilse bile talep
 * geçmişinde kaybolmamalı. Bu yüzden `platform_admins`'e `LEFT JOIN` yapılır (INNER
 * JOIN DEĞİL — deaktif/silinmiş bir admin'e işaret eden bir yorumu tamamen
 * düşürürdü) ve JOIN koşuluna veya WHERE'e `is_active` filtresi KASITLI OLARAK
 * EKLENMEZ (bkz. subscription.service.js'in getSubscription's INNER JOIN'i gibi bir
 * filtrenin yanlışlıkla satırları görünmez kılmasının institution.service.js'teki
 * Review Focus Finding 2'de zaten bir kez sorun olduğu emsal — buradaki risk
 * tersten AYNI: bir filtrenin GEÇMİŞ veriyi görünmez kılması).
 */
async function getTicket({ id }) {
  const { rows: ticketRows } = await db.query('SELECT * FROM institution_support_tickets WHERE id=$1', [id]);
  const ticket = ticketRows[0];
  if (!ticket) return null;

  const { rows: comments } = await db.query(
    `SELECT c.id, c.ticket_id, c.platform_admin_id, c.message, c.created_at,
            a.full_name AS admin_name, a.email AS admin_email
     FROM institution_support_ticket_comments c
     LEFT JOIN platform_admins a ON a.id = c.platform_admin_id
     WHERE c.ticket_id = $1
     ORDER BY c.created_at ASC`,
    [id]
  );

  return { ...ticket, comments };
}

async function updateStatus({ id, status, actorId, req }) {
  const { rows: oldRows } = await db.query('SELECT * FROM institution_support_tickets WHERE id=$1', [id]);
  const old = oldRows[0];
  if (!old) return null;

  const { rows } = await db.query(
    'UPDATE institution_support_tickets SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
    [status, id]
  );
  const ticket = rows[0];

  await auditPlatformAdmin({
    adminId: actorId, action: 'UPDATE_STATUS', resource: 'support_ticket',
    resourceId: id, oldData: { status: old.status }, newData: { status }, req,
  });

  return ticket;
}

/**
 * addComment — talep yoksa (silinmiş/yanlış id) `null` döner, route 404'e çevirir
 * (institutionGroup.service.js'in updateGroup/deleteGroup'undaki AYNI "önce
 * var mı kontrol et, yoksa null" deseni — ticketId burada hem yorumun FK'si hem de
 * route'un var-mı kontrolü için kullanılıyor). `adminId` AYNI ZAMANDA hem yorumun
 * `platform_admin_id`'si hem de denetim kaydının `admin_id`'si (yorum ekleyen kişi
 * = eylemi yapan kişi, task brief'in `addComment({ticketId,adminId,message,req})`
 * imzasıyla tutarlı).
 */
async function addComment({ ticketId, adminId, message, req }) {
  const { rows: ticketRows } = await db.query('SELECT id FROM institution_support_tickets WHERE id=$1', [ticketId]);
  if (!ticketRows.length) return null;

  const { rows } = await db.query(
    `INSERT INTO institution_support_ticket_comments (ticket_id, platform_admin_id, message)
     VALUES ($1,$2,$3) RETURNING *`,
    [ticketId, adminId, message]
  );
  const comment = rows[0];

  await auditPlatformAdmin({
    adminId, action: 'ADD_COMMENT', resource: 'support_ticket',
    resourceId: ticketId, newData: { message }, req,
  });

  return comment;
}

module.exports = {
  listTickets,
  getTicket,
  updateStatus,
  addComment,
};
