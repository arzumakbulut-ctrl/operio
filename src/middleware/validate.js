const { badRequest } = require('../utils/response');

/**
 * validate(schema) — Zod şeması ile request body doğrular.
 * Hata varsa 400 + detaylar döner, geçerliyse req.body temizlenmiş hali alır.
 */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map(i => ({
        field: i.path.join('.'),
        message: i.message,
      }));
      return badRequest(res, 'Doğrulama hatası', details);
    }
    req.body = result.data; // parsed + cleaned data
    next();
  };
}

/**
 * validateQuery(schema) — query string'i doğrular
 */
function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const details = result.error.issues.map(i => ({
        field: i.path.join('.'),
        message: i.message,
      }));
      return badRequest(res, 'Sorgu parametresi hatası', details);
    }
    req.query = result.data;
    next();
  };
}

module.exports = { validate, validateQuery };
