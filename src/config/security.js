// ── GÜVENLİK YAPILANDIRMASI ──────────────────────────────────
// Tüm güvenlik sabitleri tek yerden yönetilir.

module.exports = {
  // Şifre politikası
  PASSWORD: {
    MIN_LENGTH:           8,
    MAX_LENGTH:           128,
    REQUIRE_UPPERCASE:    true,
    REQUIRE_LOWERCASE:    true,
    REQUIRE_NUMBER:       true,
    REQUIRE_SPECIAL:      true,
    HISTORY_COUNT:        5,      // Son 5 şifre tekrar kullanılamaz
    MAX_AGE_DAYS:         90,     // 90 günde bir zorunlu değişim (opsiyonel)
  },

  // Hesap kilitleme (brute-force koruması)
  LOCKOUT: {
    MAX_ATTEMPTS:         5,      // 5 başarısız denemede kilitle
    LOCKOUT_DURATION_MIN: 30,     // 30 dakika kilitli kal
    RESET_AFTER_MIN:      60,     // 60 dakika sonra sayaç sıfırla
  },

  // TOTP (Google Authenticator)
  TOTP: {
    ISSUER:               'Operio',
    ALGORITHM:            'sha1',
    DIGITS:               6,
    PERIOD:               30,     // 30 saniyede bir yeni kod
    WINDOW:               1,      // ±1 periyot tolerans (clock skew)
  },

  // Rate limiting
  RATE_LIMIT: {
    AUTH_WINDOW_MS:       15 * 60 * 1000,   // 15 dakika
    AUTH_MAX:             10,
    TOTP_WINDOW_MS:       5 * 60 * 1000,    // 5 dakika
    TOTP_MAX:             5,
    API_WINDOW_MS:        15 * 60 * 1000,
    // 100'den 500'e çıkarıldı (2026-11-27): tek bir panel sayfası açılışında
    // (dashboard + Topbar'ın paralel veri çekmeleri) ~15-20 istek gidiyor;
    // ConnectionStatus.jsx'in 30sn'lik /health yoklaması da 15 dakikada +30
    // istek ekliyor. 100, normal kullanımda (birkaç sayfa gezinme + arka plan
    // yoklaması) bile kolayca doluyordu — gerçek bir kötüye kullanım sinyali
    // değil, meşru kullanımın maliyetiydi. 500, aynı 15 dakikalık pencerede
    // onlarca sayfa geçişini rahatça karşılar, yine de otomatik/brute-force
    // bir tarama girişimini sınırlar.
    API_MAX:              500,
    // Kiosk (/api/kiosk/*) — genel IP-bazlı limitten muaf; kiosk token'ının jti'sine
    // göre (cihaz başına) anahtarlanır. Boştaki bir kiosk /status yoklamasıyla 60
    // istek/15dk üretir; sesli komutlar (onaylı cihaz komutu = 2 çağrı) bunun üstüne
    // patlamalı ama sınırlı gelir. 300/15dk (~20/dk) bunu rahatça karşılar, yine de
    // çalınmış/hatalı bir token'ın sınırsız istek atmasını engeller.
    KIOSK_WINDOW_MS:      15 * 60 * 1000,
    KIOSK_MAX:            300,
  },

  // CSP (Content Security Policy)
  CSP: {
    DIRECTIVES: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'"],
      styleSrc:       ["'self'", "'unsafe-inline'"],  // inline stil için
      imgSrc:         ["'self'", 'data:', 'https:'],
      connectSrc:     ["'self'"],
      fontSrc:        ["'self'", 'https://fonts.googleapis.com', 'https://fonts.gstatic.com', 'https://fonts.cdnfonts.com'],
      objectSrc:      ["'none'"],
      mediaSrc:       ["'none'"],
      frameSrc:       ["'none'"],
      frameAncestors: ["'none'"],
      baseUri:        ["'self'"],
      formAction:     ["'self'"],
      upgradeInsecureRequests: [],
    },
  },

  // Güvenlik başlıkları
  HEADERS: {
    HSTS_MAX_AGE:            31536000,    // 1 yıl
    HSTS_INCLUDE_SUBDOMAINS: true,
    HSTS_PRELOAD:            true,
    REFERRER_POLICY:         'strict-origin-when-cross-origin',
    PERMISSIONS_POLICY:      'camera=(), microphone=(), geolocation=(), payment=()',
  },

  // Şüpheli aktivite eşikleri
  SUSPICIOUS: {
    FAILED_LOGINS_PER_IP:    20,   // Bir IP'den 20 başarısız giriş → uyarı
    REQUESTS_PER_MINUTE:     60,   // Dakikada 60'tan fazla istek → şüpheli
  },
};
