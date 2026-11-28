CREATE TABLE IF NOT EXISTS platform_admin_groups (
  slug         VARCHAR(20) PRIMARY KEY,
  display_name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS platform_admins (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(200) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(200) NOT NULL,
  group_slug    VARCHAR(20) NOT NULL REFERENCES platform_admin_groups(slug),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mevcut refresh_tokens tablosuyla (001_init.sql:45-52) AYNI şekil — id/token/created_at dahil,
-- ON DELETE CASCADE dahil, sadece user_id yerine admin_id ve FK hedefi platform_admins.
CREATE TABLE IF NOT EXISTS platform_admin_refresh_tokens (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  token      TEXT        UNIQUE NOT NULL,
  admin_id   UUID        NOT NULL REFERENCES platform_admins(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mevcut audit_logs (001_init.sql:166-178) ile AYNI alan adları/tipleri (surgery_id hariç —
-- platform-admin eylemleri hiçbir ameliyatla ilişkili değil, bu alan burada YOK).
CREATE TABLE IF NOT EXISTS platform_admin_audit_logs (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id    UUID        REFERENCES platform_admins(id),
  action      VARCHAR(30) NOT NULL,
  resource    VARCHAR(50) NOT NULL,
  resource_id UUID,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  VARCHAR(45),
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS institution_groups (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE institutions ADD COLUMN IF NOT EXISTS bed_count SMALLINT;
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS district VARCHAR(100);
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS contact_name VARCHAR(200);
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES institution_groups(id);

CREATE TYPE ticket_type AS ENUM ('TECHNICAL','FEATURE_REQUEST','BILLING','SALES');
CREATE TYPE ticket_priority AS ENUM ('LOW','MEDIUM','HIGH');
CREATE TYPE ticket_status AS ENUM ('OPEN','IN_PROGRESS','CLOSED');
-- Not: 001_init.sql'deki enum'lar (room_status, surgery_status, set_status, vb.) da
-- "IF NOT EXISTS" guard'ı OLMADAN bare CREATE TYPE ile tanımlı — docker-compose'un
-- komutu migration dosyasını her container restart'ında yeniden çalıştırıyor, ama
-- psql varsayılan olarak hata alınca script'i durdurmuyor (ON_ERROR_STOP yok), bu
-- yüzden "tip zaten var" hatası sessizce atlanıp sonraki (CREATE TABLE IF NOT EXISTS
-- olan) satırlar çalışmaya devam ediyor. Bu dosya da AYNI bare sözdizimini kullanır —
-- mevcut kod tabanının kendi idempotency yaklaşımıyla tutarlı, yeni bir desen icat edilmez.

CREATE TABLE IF NOT EXISTS institution_support_tickets (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID NOT NULL REFERENCES institutions(id),
  type           ticket_type NOT NULL,
  priority       ticket_priority NOT NULL DEFAULT 'MEDIUM',
  status         ticket_status NOT NULL DEFAULT 'OPEN',
  subject        VARCHAR(200) NOT NULL,
  description    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS institution_support_ticket_comments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id         UUID NOT NULL REFERENCES institution_support_tickets(id),
  platform_admin_id UUID REFERENCES platform_admins(id),
  message           TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_settings (
  id                SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  platform_name     VARCHAR(100) NOT NULL DEFAULT 'Operio',
  support_email     VARCHAR(200),
  billing_email     VARCHAR(200),
  trial_days        SMALLINT NOT NULL DEFAULT 14,
  auto_billing      BOOLEAN NOT NULL DEFAULT TRUE,
  maintenance_mode  BOOLEAN NOT NULL DEFAULT FALSE,
  backup_frequency  VARCHAR(20) NOT NULL DEFAULT 'Günlük',
  last_backup_at    TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO platform_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

INSERT INTO platform_admin_groups (slug, display_name) VALUES
  ('super','Süper Yöneticiler'), ('destek','Destek Ekibi'),
  ('finans','Finans Ekibi'), ('icerik','İçerik Yöneticileri')
ON CONFLICT (slug) DO NOTHING;
