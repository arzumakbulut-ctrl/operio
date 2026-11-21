require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');

const { RATE_LIMIT, CSP, HEADERS } = require('./config/security');
const { sanitizeMiddleware }        = require('./utils/sanitize');
const authRoutes     = require('./routes/auth.routes');
const surgeryRoutes  = require('./routes/surgery.routes');
const securityRoutes = require('./routes/security.routes');
const aiRoutes       = require('./routes/ai.routes');
const notificationRoutes = require('./routes/notification.routes');
const billingRoutes      = require('./routes/billing.routes');
const deviceRoutes       = require('./routes/device.routes');
const kioskAdminRoutes   = require('./routes/kioskAdmin.routes');
const voiceProfileRoutes = require('./routes/voiceProfile.routes');
const { patientRouter, roomRouter, setRouter, auditRouter } = require('./routes/other.routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

// ── GÜVENLİK BAŞLIKLARI ─────────────────────────────────────
app.use(helmet({
  // CSP — hangi kaynaklardan içerik yüklenebilir
  contentSecurityPolicy: {
    directives: CSP.DIRECTIVES,
  },
  // HSTS — HTTPS zorunlu (üretimde etkin, geliştirmede kapalı)
  hsts: process.env.NODE_ENV === 'production'
    ? {
        maxAge:            HEADERS.HSTS_MAX_AGE,
        includeSubDomains: HEADERS.HSTS_INCLUDE_SUBDOMAINS,
        preload:           HEADERS.HSTS_PRELOAD,
      }
    : false,
  // X-Frame-Options: DENY — clickjacking koruması
  frameguard: { action: 'deny' },
  // X-Content-Type-Options: nosniff — MIME sniffing koruması
  noSniff: true,
  // X-XSS-Protection: 1; mode=block (eski tarayıcılar için)
  xssFilter: true,
  // Referrer-Policy
  referrerPolicy: { policy: HEADERS.REFERRER_POLICY },
  // X-Powered-By'ı gizle
  hidePoweredBy: true,
  // IE'nin içeriği uygulamada çalıştırmasını engelle
  ieNoOpen: true,
  // DNS prefetch kontrolü
  dnsPrefetchControl: { allow: false },
  // Permissions-Policy
  crossOriginResourcePolicy: { policy: 'same-site' },
}));

// Permissions-Policy başlığını manuel ekle (helmet henüz desteklemiyor)
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', HEADERS.PERMISSIONS_POLICY);
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// ── CORS ────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    const allowed = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');
    // API testi için null origin'e izin ver (Postman, curl)
    if (!origin || allowed.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: ${origin} izin verilmiyor`));
  },
  credentials:    true,
  methods:        ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge:         86400, // preflight önbelleği 24 saat
}));

// ── GENEL RATE LIMIT ─────────────────────────────────────────
app.use(rateLimit({
  windowMs: RATE_LIMIT.API_WINDOW_MS,
  max:      RATE_LIMIT.API_MAX,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Çok fazla istek gönderildi, lütfen bekleyin' },
  },
}));

// ── GÖVDE AYRIŞTIRICISI ──────────────────────────────────────
app.use(express.json({ limit: '512kb' }));        // 1MB'dan daha kısıtlayıcı
app.use(express.urlencoded({ extended: false }));

// ── INPUT SANİTİZASYON ───────────────────────────────────────
// Tüm input'lardan null-byte ve kontrol karakterlerini temizle
app.use(sanitizeMiddleware);

// Gerçek IP (reverse proxy arkasında)
app.set('trust proxy', 1);

// ── SAĞLIK KONTROLÜ ─────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'operio-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
  });
});

// ── API ROUTE'LARI ───────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/surgeries',    surgeryRoutes);
app.use('/api/patients',     patientRouter);
app.use('/api/rooms',        roomRouter);
app.use('/api/sterile-sets', setRouter);
app.use('/api/audit',        auditRouter);
app.use('/api/security',     securityRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/billing',      billingRoutes);
app.use('/api/devices',      deviceRoutes);
app.use('/api/kiosk-admin',  kioskAdminRoutes);
app.use('/api/profile',      voiceProfileRoutes);
app.use('/api/ws',            notificationRoutes);
app.use('/api/ai',          aiRoutes);

// ── HATA YÖNETİCİLERİ ───────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
