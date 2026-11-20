-- Operio Veritabanı Migrasyonu
-- Çalıştır: psql $DATABASE_URL -f migrations/001_init.sql
-- Docker: docker exec -i operio_postgres psql -U operio -d operio_db < migrations/001_init.sql

-- ── UZANTILAR ────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── ROLLER ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id           SMALLINT     PRIMARY KEY,
  name         VARCHAR(60)  UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  permissions  JSONB        NOT NULL DEFAULT '{}'
);

-- ── KURUMLAR ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS institutions (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(200) NOT NULL,
  type       VARCHAR(100) DEFAULT 'Devlet Hastanesi',
  address    TEXT,
  phone      VARCHAR(30),
  email      VARCHAR(200),
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── KULLANICILAR ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  email          VARCHAR(200) UNIQUE NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  full_name      VARCHAR(100) NOT NULL,
  role_id        SMALLINT    NOT NULL REFERENCES roles(id),
  institution_id UUID        REFERENCES institutions(id),
  is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_institution ON users(institution_id);

-- ── REFRESH TOKENS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  token      TEXT        UNIQUE NOT NULL,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

-- ── AMELİYAT SALONLARI ───────────────────────────────────────
CREATE TYPE room_status AS ENUM ('ACTIVE','IDLE','RESERVED','MAINTENANCE','CLOSED');

CREATE TABLE IF NOT EXISTS operating_rooms (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID        NOT NULL REFERENCES institutions(id),
  name           VARCHAR(100) NOT NULL,
  room_number    SMALLINT    NOT NULL,
  branch         VARCHAR(100),
  capacity       SMALLINT    DEFAULT 6,
  status         room_status NOT NULL DEFAULT 'IDLE',
  color          VARCHAR(30),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (institution_id, room_number)
);

-- ── HASTALAR ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tc_no         VARCHAR(11) UNIQUE,
  first_name    VARCHAR(60) NOT NULL,
  last_name     VARCHAR(60) NOT NULL,
  date_of_birth DATE,
  gender        CHAR(1),
  blood_type    VARCHAR(5),
  phone         VARCHAR(30),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(last_name, first_name);

-- ── AMELİYATLAR ──────────────────────────────────────────────
CREATE TYPE surgery_status AS ENUM ('WAITING','PREPARING','IN_PROGRESS','COMPLETED','CANCELLED','POSTPONED');

CREATE TABLE IF NOT EXISTS surgeries (
  id              UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id  UUID           NOT NULL REFERENCES institutions(id),
  room_id         UUID           REFERENCES operating_rooms(id),
  patient_id      UUID           REFERENCES patients(id),
  title           VARCHAR(200)   NOT NULL,
  branch          VARCHAR(100),
  surgeon_name    VARCHAR(100),
  scheduled_start TIMESTAMPTZ    NOT NULL,
  scheduled_end   TIMESTAMPTZ,
  duration_min    SMALLINT,
  status          surgery_status NOT NULL DEFAULT 'WAITING',
  notes           TEXT,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_surgeries_institution ON surgeries(institution_id);
CREATE INDEX IF NOT EXISTS idx_surgeries_date ON surgeries(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_surgeries_status ON surgeries(status);

-- ── CERRAHİ EKİP ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS surgery_teams (
  id         UUID       PRIMARY KEY DEFAULT uuid_generate_v4(),
  surgery_id UUID       NOT NULL REFERENCES surgeries(id) ON DELETE CASCADE,
  user_id    UUID       NOT NULL REFERENCES users(id),
  team_role  VARCHAR(30) NOT NULL,
  UNIQUE (surgery_id, user_id)
);

-- ── STERİL SETLER ────────────────────────────────────────────
CREATE TYPE set_status AS ENUM ('STERILE','IN_USE','STERILIZING','FAULTY','RETIRED');

CREATE TABLE IF NOT EXISTS sterile_sets (
  id              UUID       PRIMARY KEY DEFAULT uuid_generate_v4(),
  code            VARCHAR(50) UNIQUE NOT NULL,
  name            VARCHAR(200) NOT NULL,
  total_count     SMALLINT   NOT NULL DEFAULT 1,
  sterile_count   SMALLINT   NOT NULL DEFAULT 0,
  in_use_count    SMALLINT   NOT NULL DEFAULT 0,
  shelf_location  VARCHAR(50),
  last_sterilized TIMESTAMPTZ,
  status          set_status NOT NULL DEFAULT 'STERILE',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS set_instruments (
  id             UUID       PRIMARY KEY DEFAULT uuid_generate_v4(),
  set_id         UUID       NOT NULL REFERENCES sterile_sets(id) ON DELETE CASCADE,
  name           VARCHAR(100) NOT NULL,
  expected_count SMALLINT   NOT NULL DEFAULT 1,
  current_count  SMALLINT   NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS surgery_sterile_sets (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  surgery_id UUID NOT NULL REFERENCES surgeries(id) ON DELETE CASCADE,
  set_id     UUID NOT NULL REFERENCES sterile_sets(id),
  UNIQUE (surgery_id, set_id)
);

CREATE TABLE IF NOT EXISTS set_tracking_logs (
  id         UUID       PRIMARY KEY DEFAULT uuid_generate_v4(),
  set_id     UUID       NOT NULL REFERENCES sterile_sets(id) ON DELETE CASCADE,
  stage      VARCHAR(30) NOT NULL,
  operator   VARCHAR(100),
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── DENETİM GÜNLÜĞÜ ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID       PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID       REFERENCES users(id),
  action      VARCHAR(30) NOT NULL,
  resource    VARCHAR(50) NOT NULL,
  resource_id UUID,
  surgery_id  UUID       REFERENCES surgeries(id),
  old_data    JSONB,
  new_data    JSONB,
  ip_address  VARCHAR(45),
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource, resource_id);

-- ── BİLDİRİMLER ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id             UUID       PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_role    SMALLINT,
  target_user_id UUID       REFERENCES users(id),
  type           VARCHAR(30) NOT NULL,
  title          VARCHAR(200) NOT NULL,
  message        TEXT        NOT NULL,
  is_read        BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── GÜVENLİK EKLEMELERİ (002) ─────────────────────────────

-- Hesap kilitleme ve brute-force takibi
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS failed_login_attempts SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS password_changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- TOTP (Google Authenticator) desteği
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS totp_secret     VARCHAR(64),
  ADD COLUMN IF NOT EXISTS totp_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS totp_verified_at TIMESTAMPTZ;

-- Şifre geçmişi (son 5 şifre tekrar kullanılamaz)
CREATE TABLE IF NOT EXISTS password_history (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pwd_history_user ON password_history(user_id, created_at DESC);

-- Güvenlik olayları (audit_logs'dan ayrı — sadece güvenlik)
CREATE TABLE IF NOT EXISTS security_events (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        REFERENCES users(id),
  event_type VARCHAR(50) NOT NULL,  -- LOGIN_FAILED | ACCOUNT_LOCKED | TOTP_FAILED | PASSWORD_CHANGED | SUSPICIOUS_IP
  ip_address VARCHAR(45),
  user_agent TEXT,
  details    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sec_events_user   ON security_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sec_events_type   ON security_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sec_events_ip     ON security_events(ip_address, created_at DESC);

-- İzin verilen IP aralıkları (opsiyonel — kurumsal ağ kısıtlaması)
CREATE TABLE IF NOT EXISTS allowed_ip_ranges (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  label      VARCHAR(100) NOT NULL,
  cidr       INET        NOT NULL,
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ÖDEME SİSTEMİ (003) ───────────────────────────────────────

-- Plan tanımları
CREATE TABLE IF NOT EXISTS plans (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug         VARCHAR(30) UNIQUE NOT NULL,  -- starter | pro | enterprise
  name         VARCHAR(100) NOT NULL,
  price_try    INTEGER     NOT NULL DEFAULT 0,  -- kuruş cinsinden (₺2900 = 290000)
  price_usd    INTEGER     NOT NULL DEFAULT 0,
  max_rooms    SMALLINT    NOT NULL DEFAULT 3,
  max_users    SMALLINT    NOT NULL DEFAULT 10,
  features     JSONB       NOT NULL DEFAULT '[]',
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Kupon kodları
CREATE TABLE IF NOT EXISTS coupons (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  code            VARCHAR(30) UNIQUE NOT NULL,
  discount_type   VARCHAR(10) NOT NULL,  -- percent | fixed_try | fixed_usd
  discount_value  INTEGER     NOT NULL,  -- % veya kuruş
  max_uses        INTEGER,               -- NULL = sınırsız
  used_count      INTEGER     NOT NULL DEFAULT 0,
  valid_until     TIMESTAMPTZ,
  plan_slug       VARCHAR(30),           -- NULL = tüm planlar
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Abonelikler
CREATE TABLE IF NOT EXISTS subscriptions (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id        UUID        NOT NULL REFERENCES institutions(id),
  plan_slug             VARCHAR(30) NOT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'trial',
  -- trial | active | past_due | cancelled | expired
  trial_ends_at         TIMESTAMPTZ,
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  seat_count            SMALLINT    NOT NULL DEFAULT 10,
  -- Ödeme sağlayıcı referansları
  iyzico_subscription_id  VARCHAR(100),
  stripe_subscription_id  VARCHAR(100),
  stripe_customer_id      VARCHAR(100),
  -- Kupon
  coupon_id             UUID        REFERENCES coupons(id),
  -- Fatura adresi
  billing_name          VARCHAR(200),
  billing_tax_no        VARCHAR(20),
  billing_address       TEXT,
  billing_email         VARCHAR(200),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subs_institution ON subscriptions(institution_id);
CREATE INDEX IF NOT EXISTS idx_subs_status      ON subscriptions(status);

-- Faturalar
CREATE TABLE IF NOT EXISTS invoices (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id   UUID        NOT NULL REFERENCES subscriptions(id),
  institution_id    UUID        NOT NULL REFERENCES institutions(id),
  invoice_number    VARCHAR(30) UNIQUE NOT NULL,
  amount_try        INTEGER     NOT NULL,  -- kuruş
  amount_usd        INTEGER     NOT NULL DEFAULT 0,
  currency          VARCHAR(3)  NOT NULL DEFAULT 'TRY',
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- pending | paid | failed | refunded
  period_start      TIMESTAMPTZ,
  period_end        TIMESTAMPTZ,
  paid_at           TIMESTAMPTZ,
  -- Sağlayıcı referansları
  iyzico_payment_id VARCHAR(100),
  stripe_invoice_id VARCHAR(100),
  -- e-Fatura
  e_invoice_uuid    VARCHAR(100),
  e_invoice_url     TEXT,
  -- Fatura satırları
  line_items        JSONB       NOT NULL DEFAULT '[]',
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_sub  ON invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_inst ON invoices(institution_id);

-- Ödeme olayları (webhook logları)
CREATE TABLE IF NOT EXISTS payment_events (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider     VARCHAR(20) NOT NULL,  -- iyzico | stripe
  event_type   VARCHAR(100) NOT NULL,
  payload      JSONB       NOT NULL DEFAULT '{}',
  processed    BOOLEAN     NOT NULL DEFAULT FALSE,
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Varsayılan planları ekle
INSERT INTO plans (slug, name, price_try, price_usd, max_rooms, max_users, features) VALUES
  ('starter',    'Starter',    290000,  9900,  3,  10,  '["Temel ameliyat yönetimi","Steril set takibi","E-posta desteği"]'),
  ('pro',        'Pro',        790000,  24900, 10, 50,  '["Starter özellikleri","AI Asistan (Operia)","WebSocket bildirimler","Öncelikli destek","Gelişmiş raporlar"]'),
  ('enterprise', 'Enterprise', 0,       0,    -1, -1,  '["Pro özellikleri","HBYS/E-Nabız entegrasyonu","Özel eğitim","SLA garantisi","Sınırsız salon ve kullanıcı"]')
ON CONFLICT (slug) DO NOTHING;

