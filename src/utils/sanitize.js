/**
 * Input Sanitizasyon ve Output Encoding
 *
 * XSS, HTML enjeksiyonu ve diğer input tabanlı saldırılara karşı koruma.
 * Zod doğrulamadan SONRA çalışır — tip güvenli + temiz veri garantisi.
 */

// HTML özel karakterleri encode et
const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * HTML entity encode — XSS'e karşı output'u güvenli hale getirir.
 * Veritabanına gitmeden önce DEĞİL, HTML response'a yazılırken kullanılır.
 * (Biz JSON API döndürdüğümüz için genellikle gerek yok — ama helper olarak var.)
 */
function encodeHTML(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char]);
}

/**
 * String'i temel tehlikeli karakterlerden temizle.
 * Null bytes ve kontrol karakterlerini kaldırır.
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/\x00/g, '')           // Null byte
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Kontrol karakterleri
    .trim();
}

/**
 * SQL injection için LIKE sorgularında kullanılan değerleri escape et.
 * Parameterized query kullandığımız için ana SQL injection riski yok,
 * ama LIKE wildcard'larını temizlemek için gerekli.
 */
function escapeLike(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[%_\\]/g, '\\$&');
}

/**
 * Nesnenin tüm string değerlerini sanitize et (derin).
 * Request body'ye uygulamak için kullanılır.
 */
function sanitizeObject(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return sanitizeString(obj);
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    // Key'i de temizle
    const cleanKey = sanitizeString(key);
    result[cleanKey] = sanitizeObject(value);
  }
  return result;
}

/**
 * IDOR (Insecure Direct Object Reference) kontrolü.
 * Kullanıcının erişmeye çalıştığı kaynağın kurumuna ait olup olmadığını doğrular.
 *
 * @param {object} opts
 * @param {string} opts.resourceInstitutionId - Kaynağın kurumu
 * @param {string} opts.userInstitutionId     - İsteği yapan kullanıcının kurumu
 * @param {number} opts.userRoleId            - Üst Yönetici (0) tüm kurumlara erişebilir
 * @returns {boolean} true = erişim izinli
 */
function checkInstitutionAccess({ resourceInstitutionId, userInstitutionId, userRoleId }) {
  if (userRoleId === 0) return true; // Üst Yönetici her şeye erişebilir
  return resourceInstitutionId === userInstitutionId;
}

/**
 * UUID formatını doğrula (parametre manipulation'a karşı)
 */
function isValidUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Express middleware — tüm request body'leri sanitize eder.
 * validate() middleware'inden ÖNCE çalışmalı.
 */
function sanitizeMiddleware(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  // params'ı da kontrol et ama UUID doğrulama route handler'da yapılır
  next();
}

module.exports = {
  encodeHTML,
  sanitizeString,
  escapeLike,
  sanitizeObject,
  checkInstitutionAccess,
  isValidUUID,
  sanitizeMiddleware,
};
