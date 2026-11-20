/**
 * Tutarlı API yanıt formatı
 * { success, data, meta, error }
 */

function ok(res, data, meta = undefined, statusCode = 200) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

function created(res, data) {
  return ok(res, data, undefined, 201);
}

function noContent(res) {
  return res.status(204).send();
}

function badRequest(res, message, details = undefined) {
  return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message, details } });
}

function unauthorized(res, message = 'Kimlik doğrulama gerekli') {
  return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message } });
}

function forbidden(res, message = 'Bu işlem için yetkiniz yok') {
  return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message } });
}

function notFound(res, resource = 'Kaynak') {
  return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `${resource} bulunamadı` } });
}

function conflict(res, message) {
  return res.status(409).json({ success: false, error: { code: 'CONFLICT', message } });
}

function serverError(res, err) {
  console.error('[SERVER ERROR]', err);
  const message = process.env.NODE_ENV === 'production'
    ? 'Sunucu hatası oluştu'
    : err.message;
  return res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message } });
}

module.exports = { ok, created, noContent, badRequest, unauthorized, forbidden, notFound, conflict, serverError };
