require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');

const { RATE_LIMIT, CSP, HEADERS } = require('./config/security');
const { sanitizeMiddleware }        = require('./utils/sanitize');
const authRoutes     = require('./routes/auth.routes');
const platformAdminAuthRoutes = require('./routes/platformAdminAuth.routes');
const institutionsRoutes = require('./routes/institutions.routes');
const surgeryRoutes  = require('./routes/surgery.routes');
const securityRoutes = require('./routes/security.routes');
const aiRoutes       = require('./routes/ai.routes');
const notificationRoutes = require('./routes/notification.routes');
const billingRoutes      = require('./routes/billing.routes');
const deviceRoutes       = require('./routes/device.routes');
const kioskAdminRoutes   = require('./routes/kioskAdmin.routes');
const kioskRoutes        = require('./routes/kiosk.routes');
const voiceProfileRoutes = require('./routes/voiceProfile.routes');
const spotifyRoutes      = require('./routes/spotify.routes');
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
// /api/kiosk/* bu IP-bazlı limitten MUAF tutulur: kiosk'lar /status'u 15sn'de bir
// yoklar (tek boştaki kiosk = 60 istek/15dk). Hastanede birkaç kiosk aynı NAT
// arkasındaysa, IP-bazlı 100/15dk limit dolup HEM kiosk trafiğini HEM de aynı IP'den
// gelen sıradan klinisyen tarayıcı trafiğini 429'latırdı. Kiosk route'ları bunun yerine
// kiosk.routes.js'teki, kiosk token'ının jti'sine göre anahtarlanan kendi limitini
// kullanır (RATE_LIMIT.KIOSK_*). '/api/kiosk-admin' bu muafiyete GİRMEZ (sondaki '/').
app.use(rateLimit({
  windowMs: RATE_LIMIT.API_WINDOW_MS,
  max:      RATE_LIMIT.API_MAX,
  skip:     (req) => req.originalUrl.startsWith('/api/kiosk/'),
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Çok fazla istek gönderildi, lütfen bekleyin' },
  },
}));

// ── GÖVDE AYRIŞTIRICISI ──────────────────────────────────────
// Operio Vision fotoğrafları base64 kodlandığında 512kb limitini kolayca aşar —
// bu route'a özel 4mb limit, aşağıdaki küresel 512kb'den ÖNCE tanımlanır (body-parser
// bir kez req._body=true koyduktan sonra ikinci parser'ı atlar, bu yüzden sıra önemli).
app.use('/api/sterile-sets/:id/vision-count', express.json({ limit: '4mb' }));
app.use(express.json({ limit: '512kb' }));        // 1MB'dan daha kısıtlayıcı
app.use(express.urlencoded({ extended: false }));

// body-parser limiti aşıldığında 'entity.too.large' tipinde, status=413 bir hata
// fırlatır — bunu gövde ayrıştırıcılarından HEMEN SONRA, genel errorHandler'a
// (err.status/type'ı tanımadığı için 500'e düşürürdü) varmadan 413'e çeviriyoruz.
app.use((err, req, res, next) => {
  if (err?.type === 'entity.too.large' || err?.status === 413) {
    return res.status(413).json({
      success: false,
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Gönderilen veri çok büyük' },
    });
  }
  next(err);
});

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
app.use('/api/platform-admin/auth', platformAdminAuthRoutes);
app.use('/api/platform-admin/institutions', institutionsRoutes);
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
app.use('/api/kiosk',        kioskRoutes);
app.use('/api/profile',      voiceProfileRoutes);
app.use('/api/spotify',      spotifyRoutes);
app.use('/api/ws',            notificationRoutes);
app.use('/api/ai',          aiRoutes);

// ── HATA YÖNETİCİLERİ ───────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
