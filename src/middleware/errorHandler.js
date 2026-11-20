const { serverError } = require('../utils/response');

/**
 * Global hata yakalayıcı — Express'te 4 parametreli middleware hata handler'dır.
 * Tüm route'lardan sonra app.use(errorHandler) olarak eklenmeli.
 */
function errorHandler(err, req, res, next) {
  // Prisma hataları
  if (err.code === 'P2002') {
    const field = err.meta?.target?.join(', ') || 'alan';
    return res.status(409).json({
      success: false,
      error: { code: 'CONFLICT', message: `${field} zaten kayıtlı` },
    });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Kayıt bulunamadı' },
    });
  }

  // JWT hataları (middleware'den kaçmış olabilir)
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Geçersiz veya süresi dolmuş token' },
    });
  }

  // Genel hata
  return serverError(res, err);
}

/**
 * 404 handler — eşleşmeyen tüm route'lar için
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `${req.method} ${req.path} bulunamadı` },
  });
}

module.exports = { errorHandler, notFoundHandler };
