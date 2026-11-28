# Platform Admin Konsolu — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Operio'nun kendi platform-admin ekibinin (satış/destek/finans/içerik) müşteri hastanelerini yönetmesi için backend #1'e tamamen ayrı bir kimlik doğrulama katmanı ve 5 özelliğin (Kurumlar, Kurum Grupları, Kurum Talepleri, Yetki Grupları, Sistem Ayarları) gerçek route/şema/migration'ını ekler.

**Architecture:** Yeni, hastane `users`/`roles` sisteminden TAMAMEN izole bir platform-admin tablosu/JWT/middleware seti. 5 özelliğin her biri kendi route dosyasında, mevcut `{success,data,meta?}` zarf konvansiyonuyla. `institutions`/`plans`/`subscriptions` gibi mevcut tablolar yeniden kullanılır, SADECE eksik kolonlar eklenir.

**Tech Stack:** Node/Express (mevcut), raw SQL + `pg` Pool (mevcut desen, Prisma kullanılmaz — `001_init.sql` da raw SQL), zod (mevcut `src/validators/schemas.js`), bcryptjs + jsonwebtoken (mevcut `src/utils/password.js`/`src/utils/jwt.js`), Vitest (mevcut `tests/`).

**Spec:** `operio-react/operio/docs/superpowers/specs/2026-11-28-platform-admin-konsolu-design.md`

## Global Constraints

- `migrations/001_init.sql` HİÇ DEĞİŞTİRİLMEZ — tüm yeni tablo/kolon `migrations/002_platform_admin.sql`'de, idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).
- Yanıt zarfı: başarıda `{success:true,data,meta?}`, hatada `{success:false,error:{code,message}}` — mevcut `src/utils/response.js`'in `ok/created/badRequest/unauthorized/forbidden/notFound/conflict/serverError` fonksiyonları kullanılır, yeni bir yanıt şekli İCAT EDİLMEZ.
- Platform-admin JWT, hastane JWT'siyle (`src/utils/jwt.js`'in `ACCESS_SECRET`/`REFRESH_SECRET`'ı) AYRI bir secret çifti kullanır (`PLATFORM_ADMIN_ACCESS_SECRET`/`PLATFORM_ADMIN_REFRESH_SECRET`) — aynı secret'ı paylaşmaz. Platform-admin payload'ında `roleId`/`institutionId` alanı OLMAZ; hastane payload'ında `kind`/`groupSlug` alanı OLMAZ — iki şema kesişmez.
- Yetki grupları SABİT 4 satır (`super`, `destek`, `finans`, `icerik` slug'ları — mock veride: Süper Yönetici/Destek Ekibi/Finans Ekibi/İçerik Yöneticileri), migration'da seed edilir. Bu grup YENİ grup oluşturma endpoint'i EKLEMEZ — sadece mevcut 4 gruptan birini bir platform-admin hesabına atayan endpoint'ler.
- Kanonik plan slug'ları mevcut `plans` tablosundaki `starter/pro/enterprise` — yeni bir slug sistemi icat edilmez.
- Her yeni tablo/route dosyası tek bir kaynak için sorumlu (institutions, institution_groups, support_tickets, platform_settings, platform_admin_groups+accounts, platform_admin auth) — mevcut `src/routes/*.routes.js` dosya-başına-kaynak deseniyle tutarlı.
- `docker-compose.yml`'in `api` servisinin `command`'ı `002_platform_admin.sql`'i de uygulayacak şekilde güncellenir (001'den sonra, seed'den önce).

## Review Focus

- Bir platform-admin token'ı herhangi bir hastane-scoped rotaya (`authorize(...)` korumalı) sunulduğunda REDDEDİLMELİ (payload'da `roleId` yok → `authorize()`'ın `roleIds.includes(undefined)` kontrolü zaten false döner, ama bunu açıkça test etmeden "çalışır" denemez). Aynı şekilde bir hastane token'ı `authorizePlatformAdmin(...)`'e sunulduğunda reddedilmeli.
- Bir kurum `is_active=FALSE` yapıldığında SADECE yeni login değil, o kurumun kullanıcılarının MEVCUT refresh token'larıyla yeni access token alması da reddedilmeli (`refreshTokens()` zaten `users.is_active`'i kontrol ediyor ama kurumun kendi `is_active`'ini kontrol etmiyor — bu plan bunu da ekler).
- Kurum oluşturulurken verilen iletişim e-postası zaten `users` tablosunda başka bir kullanıcıya aitse (UNIQUE ihlali), kurum kaydı YARI TAMAMLANMIŞ kalmamalı — ya tamamı bir transaction içinde geri alınır ya da kurum oluşturma + ilk-kullanıcı adımı açıkça ayrı/telafi edilebilir hatalarla ele alınır, sessizce 500 verip kurumun DB'de kullanıcısız kalmasına izin verilmez.
- Bir support ticket yorumunu ekleyen platform-admin hesabı sonradan pasife alınırsa (silinmezse — soft-delete/`is_active=FALSE`), o yorum geçmişte görünmeye devam etmeli (FK bozulmamalı).
- Aktif tek Süper Yönetici (`group_slug='super'`, `is_active=TRUE`) hesabı pasife alınmaya/silinmeye çalışılırsa reddedilmeli — platformu yönetecek hiç kimse kalmamasını önler.

---

### Task 1: Migration + Docker + Seed

**Files:**
- Create: `migrations/002_platform_admin.sql`
- Modify: `docker-compose.yml` (api servisinin `command`'ı)
- Modify: `prisma/seed.js` (platform_admin_groups + ilk platform-admin hesabı seed'i)
- Test: `tests/integration/platformAdminSeed.test.js`

**Interfaces:**
- Produces: aşağıdaki tablolar/kolonlar, sonraki TÜM task'ların üzerine inşa ettiği temel.

- [ ] **Step 1: Write the failing test**

`tests/integration/platformAdminSeed.test.js` — gerçek test DB'sine karşı (mevcut `tests/setup.js`'in kurduğu bağlantıyı kullanır, diğer `tests/integration/*.test.js` dosyalarıyla aynı desen):

```js
import { describe, it, expect } from 'vitest';
import db from '../../src/utils/db.js';

describe('002_platform_admin migration + seed', () => {
  it('platform_admin_groups tablosunda tam olarak 4 sabit grup var', async () => {
    const { rows } = await db.query('SELECT slug FROM platform_admin_groups ORDER BY slug');
    expect(rows.map(r => r.slug)).toEqual(['destek', 'finans', 'icerik', 'super']);
  });

  it('en az bir aktif super platform-admin hesabı seed edilmiş', async () => {
    const { rows } = await db.query(
      "SELECT 1 FROM platform_admins WHERE group_slug='super' AND is_active=TRUE"
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it('institutions tablosunda yeni kolonlar var', async () => {
    const { rows } = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name='institutions' AND column_name IN
        ('bed_count','city','district','contact_name','group_id')
    `);
    expect(rows.length).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:integration -- platformAdminSeed`
Expected: FAIL (tablolar/kolonlar yok)

- [ ] **Step 3: `migrations/002_platform_admin.sql`'i yaz**

Mevcut `001_init.sql`'deki stil/idempotency deseniyle (uuid_generate_v4(), `CREATE TABLE IF NOT EXISTS`, enum'lar için `CREATE TYPE ... AS ENUM`, index'ler):

```sql
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
```

`last_backup_at`: bu task'ta hiçbir kodun yazmadığı salt-okunur bir alan (gerçek yedekleme job'u kapsam dışı) — NULL kalır, builder bunu "henüz uygulanmadı" olarak not düşer, hata değildir.

- [ ] **Step 4: `docker-compose.yml`'in `api` servisinin `command`'ını güncelle**

```yaml
command: >
  sh -c "
    psql \"$$DATABASE_URL\" -f migrations/001_init.sql &&
    psql \"$$DATABASE_URL\" -f migrations/002_platform_admin.sql &&
    node prisma/seed.js &&
    node src/server.js
  "
```

- [ ] **Step 5: `prisma/seed.js`'e ilk platform-admin hesabını ekle**

Mevcut `DEMO_USERS` seed desenindeki AYNI `bcrypt.hash(...)` + `ON CONFLICT (email) DO UPDATE` deseniyle (dosyanın en sonunda, mevcut `main()` fonksiyonu içinde yeni bir blok):

```js
const PLATFORM_ADMIN_EMAIL = 'super@operio.com';
const PLATFORM_ADMIN_PASSWORD = 'PlatformAdmin123!'; // demo/geliştirme — prod'da env'den okunmalı, builder'a not
const hash = await bcrypt.hash(PLATFORM_ADMIN_PASSWORD, 12);
await pool.query(
  `INSERT INTO platform_admins (email, password_hash, full_name, group_slug)
   VALUES ($1,$2,'Operio Süper Yönetici','super')
   ON CONFLICT (email) DO UPDATE SET full_name=EXCLUDED.full_name`,
  [PLATFORM_ADMIN_EMAIL, hash]
);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm run test:integration -- platformAdminSeed`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add migrations/002_platform_admin.sql docker-compose.yml prisma/seed.js tests/integration/platformAdminSeed.test.js
git commit -m "feat(platform-admin): add migration, seed, and docker-compose wiring"
```

---

### Task 2: Platform-Admin Kimlik Doğrulama Katmanı

**Files:**
- Create: `src/utils/platformAdminJwt.js`
- Create: `src/middleware/platformAdminAuth.js`
- Create: `src/utils/platformAdminAudit.js`
- Create: `src/routes/platformAdminAuth.routes.js`
- Modify: `src/app.js` (route mount: `app.use('/api/platform-admin/auth', platformAdminAuthRoutes)`)
- Modify: `src/validators/schemas.js` (yeni zod şemaları ekle, mevcut diziye ekle)
- Test: `tests/integration/platformAdminAuth.test.js`

**Interfaces:**
- Consumes: Task 1'in `platform_admins`/`platform_admin_refresh_tokens`/`platform_admin_groups` tabloları.
- Produces: `authenticatePlatformAdmin` (middleware), `authorizePlatformAdmin(...groupSlugs)` (middleware factory), `auditPlatformAdmin(opts)` (sonraki tüm task'ların write işlemlerinde kullanacağı denetim-kaydı fonksiyonu) — Task 3-7 bunları import eder.

- [ ] **Step 1: Write the failing tests**

`tests/integration/platformAdminAuth.test.js` — mevcut `tests/integration/auth.test.js`'in desenine bak (supertest/`app` import deseni neyse onu kullan):

```js
describe('POST /api/platform-admin/auth/login', () => {
  it('doğru email/şifre ile accessToken+refreshToken döner', async () => { /* seed'deki super@operio.com ile */ });
  it('hastane kullanıcısının email/şifresiyle giriş REDDEDİLİR (farklı tablo)', async () => { /* admin@hastane.tr ile dene, 401 bekle */ });
});

describe('Cross-boundary token rejection (Review Focus)', () => {
  it('platform-admin access token, authorize() korumalı bir hastane rotasına (örn. GET /api/surgeries) erişemez', async () => { /* 401/403 bekle */ });
  it('hastane access token, authorizePlatformAdmin() korumalı bir rotaya erişemez', async () => { /* 401/403 bekle */ });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:integration -- platformAdminAuth`
Expected: FAIL

- [ ] **Step 3: `src/utils/platformAdminJwt.js`'i mevcut `src/utils/jwt.js`'in AYNI şekliyle yaz, AYRI env secret'larla**

`signPlatformAdminAccessToken(payload)` — payload: `{sub, email, groupSlug}` (ASLA `roleId`/`institutionId` alanı yok). `signPlatformAdminRefreshToken(adminId)`, `verifyPlatformAdminAccessToken`, `verifyPlatformAdminRefreshToken`, `platformAdminRefreshTokenExpiresAt` — `jwt.js`'deki fonksiyonların birebir aynısı, sadece `PLATFORM_ADMIN_ACCESS_SECRET`/`PLATFORM_ADMIN_REFRESH_SECRET` env değişkenlerini (varsayılan: `'operio-platform-admin-access-secret'`/`'...refresh-secret'`) kullanır.

- [ ] **Step 4: `src/middleware/platformAdminAuth.js`'i `src/middleware/auth.js`'in AYNI şekliyle yaz**

`authenticatePlatformAdmin(req,res,next)` → `req.platformAdmin = payload` atar (DİKKAT: `req.user` DEĞİL — isim çarpışmasını önler, hastane middleware'iyle aynı request içinde asla karışmaz). `authorizePlatformAdmin(...groupSlugs)` → `req.platformAdmin.groupSlug`'ı kontrol eder.

- [ ] **Step 5: `src/utils/platformAdminAudit.js`'i `src/utils/audit.js`'in AYNI şekliyle yaz**

`auditPlatformAdmin(opts)` → `platform_admin_audit_logs`'a yazar (`opts.adminId` → `admin_id`, diğerleri `audit()` ile aynı alan adları).

- [ ] **Step 6: `src/routes/platformAdminAuth.routes.js`'i yaz**

`POST /login` (email+password, `authLimiter`'ın aynısı kullanılır — mevcut `express-rate-limit` import'u), `POST /refresh`, `POST /logout` (authenticatePlatformAdmin korur), `GET /me` (authenticatePlatformAdmin korur) — `src/routes/auth.routes.js`'in 4 route'uyla AYNI yapı, sadece `platform_admins`/`platform_admin_refresh_tokens` tablolarına ve yukarıdaki yeni util/middleware'lere karşı. Login sorgusu `platform_admins`'ten `is_active=TRUE` ile çeker (mevcut hastane login'inin `users.is_active=TRUE` deseniyle aynı). Şifre doğrulama mevcut `src/utils/password.js`'in `verifyPassword` fonksiyonuyla (tablo-agnostik, direkt kullanılabilir).

- [ ] **Step 7: `src/validators/schemas.js`'e `platformAdminLoginSchema` ekle** (email+password, mevcut `loginSchema`'nın aynısı — muhtemelen onu yeniden kullanmak yeterli, yeni bir şema gerekmeyebilir; implementer karar verir).

- [ ] **Step 8: `src/app.js`'e mount et**

- [ ] **Step 9: Run tests to verify they pass**

Run: `npm run test:integration -- platformAdminAuth`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/utils/platformAdminJwt.js src/middleware/platformAdminAuth.js src/utils/platformAdminAudit.js src/routes/platformAdminAuth.routes.js src/app.js src/validators/schemas.js tests/integration/platformAdminAuth.test.js
git commit -m "feat(platform-admin): add isolated auth layer (jwt, middleware, login/refresh/logout)"
```

---

### Task 3: Kurumlar (Institutions) CRUD + İlk Kullanıcı + Trial

**Files:**
- Create: `src/routes/institutions.routes.js`
- Modify: `src/validators/schemas.js` (mevcut `institutionCreateSchema`'yı yeni alanlarla genişlet — `bedCount`, `city`, `district`, `contactName`; `institutionUpdateSchema` ekle; `institutionStatusSchema` ekle)
- Modify: `src/app.js` (mount: `/api/platform-admin/institutions`)
- Modify: `src/routes/auth.routes.js` → gerçek değişiklik `src/services/auth.service.js`'in `login`/`refreshTokens` fonksiyonlarında (Review Focus'un 2. satırı)
- Test: `tests/integration/institutions.routes.test.js`

**Interfaces:**
- Consumes: Task 2'nin `authenticatePlatformAdmin`/`authorizePlatformAdmin`/`auditPlatformAdmin`. Mevcut `src/services/subscription.service.js`'in `startTrial({institutionId, planSlug, trialDays})` fonksiyonu.
- Produces: bu task sonrası `institutions` tablosu platform-admin'den gerçekten yazılabilir — Task 4 (Kurum Grupları) bu route'un `group_id` alanını okur/günceller.

- [ ] **Step 1: Write the failing tests**

`tests/integration/institutions.routes.test.js`:
```js
describe('GET/POST/PATCH /api/platform-admin/institutions', () => {
  it('super platform-admin yeni kurum oluşturabilir, ilk kullanıcı + trial abonelik otomatik açılır', async () => {
    // POST ile kurum oluştur, response.data.id al
    // SELECT users WHERE institution_id=... AND role_id=0 → 1 satır bekle
    // SELECT subscriptions WHERE institution_id=... AND status='trial' → 1 satır bekle
  });
  it('finans grubu SADECE paket alanını güncelleyebilir, diğer alanları güncelleyemez', async () => { /* PATCH dene, 403 veya alan-bazlı reddetme bekle */ });
  it('destek grubu kurum listesini görebilir ama PATCH/POST yapamaz (403)', async () => {});
  it('icerik grubu hiçbir institutions rotasına erişemez (403)', async () => {});
});

describe('institution is_active login etkisi (Review Focus)', () => {
  it('kurum is_active=FALSE olduğunda o kurumun kullanıcısı LOGIN yapamaz', async () => {});
  it('kurum is_active=FALSE olduğunda o kurumun kullanıcısının MEVCUT refresh token\'ı da REDDEDİLİR', async () => {});
});

describe('kurum oluşturma hata durumu (Review Focus)', () => {
  it('iletişim e-postası zaten bir hastane kullanıcısına aitse, kurum YARI OLUŞMUŞ kalmaz (ya tamamı geri alınır ya açık 409 döner, kurum tablosunda yetim kayıt kalmaz)', async () => {});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:integration -- institutions.routes`
Expected: FAIL

- [ ] **Step 3: `src/validators/schemas.js`'i genişlet**

`institutionCreateSchema`'ya ekle: `bedCount` (optional int, positive), `city`/`district` (optional string ≤100), `contactName` (optional string ≤200). `institutionUpdateSchema = institutionCreateSchema.partial()`. `institutionStatusSchema = z.object({isActive: z.boolean()})`.

- [ ] **Step 4: `src/routes/institutions.routes.js`'i yaz**

`GET /` (liste, `authorizePlatformAdmin('super','destek','finans')` — mock izin metinlerine göre icerik hariç herkes görebilir, pagination mevcut `paginationSchema` ile), `GET /:id` (detay + `getSubscription(id)` join), `POST /` (`authorizePlatformAdmin('super')` — SADECE süper, çünkü mock'ta sadece Süper Yönetici "Tüm kurumları... düzenle" diyor, finans/destek'in "oluşturma" yetkisi mock'ta yok; implementer bunu Review Focus'un hata-durumu testiyle birlikte bir transaction içinde yazar: kurum INSERT + ilk kullanıcı INSERT [role_id=0, contactName'den gelen email, geçici şifre `crypto.randomBytes` ile üretilir, `bcrypt.hash` ile saklanır] + `startTrial()` çağrısı — üçü de başarısız olursa hepsi geri alınır), `PATCH /:id` (`authorizePlatformAdmin('super','finans')` — finans sadece paket/abonelik alanını değiştirebilir, route içinde `req.platformAdmin.groupSlug==='finans'` ise sadece `planSlug` alanını kabul eder, diğer alanları 403/400 ile reddeder), `PATCH /:id/status` (`authorizePlatformAdmin('super')`, body: `institutionStatusSchema`).

Her yazma işleminde `auditPlatformAdmin({adminId: req.platformAdmin.sub, ...})` çağrılır.

- [ ] **Step 5: `src/services/auth.service.js`'in `login`/`refreshTokens`'ına kurum is_active kontrolü ekle**

`login()`'deki mevcut kullanıcı sorgusuna (`SELECT u.*, r.name...FROM users u JOIN roles r...WHERE u.email=$1 AND u.is_active=TRUE`) bir `LEFT JOIN institutions i ON u.institution_id=i.id` ekle, sorguya `AND (u.institution_id IS NULL OR i.is_active=TRUE)` koşulunu ekle — misafir hekim gibi `institution_id IS NULL` olabilecek kullanıcılar etkilenmez (mevcut şemada `institution_id` nullable mı kontrol et; değilse bu koşulun `IS NULL` kısmı gereksiz ama zararsız). `refreshTokens()`'daki `SELECT * FROM users WHERE id=$1 AND is_active=TRUE` sorgusuna da aynı şekilde kurum kontrolü eklenir (ayrı bir `db.query` ile kullanıcının `institution_id`'sine bakıp kurumun `is_active`'ini kontrol etmek de kabul edilebilir, implementer karar verir).

- [ ] **Step 6: `src/app.js`'e mount et**

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm run test:integration -- institutions.routes auth`
Expected: PASS (mevcut `auth.test.js`'in de hâlâ geçtiğini doğrula — bu adım mevcut hastane login davranışını değiştiriyor)

- [ ] **Step 8: Commit**

```bash
git add src/routes/institutions.routes.js src/validators/schemas.js src/app.js src/services/auth.service.js tests/integration/institutions.routes.test.js
git commit -m "feat(platform-admin): real institutions CRUD + auto-bootstrap first user + trial + institution-suspend login gate"
```

---

### Task 4: Kurum Grupları (Institution Groups)

**Files:**
- Create: `src/routes/institutionGroups.routes.js`
- Modify: `src/validators/schemas.js` (`institutionGroupCreateSchema`)
- Modify: `src/app.js`
- Test: `tests/integration/institutionGroups.routes.test.js`

**Interfaces:**
- Consumes: Task 2'nin middleware/audit'i, Task 1'in `institution_groups` tablosu ve `institutions.group_id` kolonu, Task 3'ün institutions route'u (kurum-grup ilişkisi `institutions.group_id` üzerinden, ayrı bir join tablosu YOK — her kurum en fazla bir grupta).

- [ ] **Step 1: Write the failing tests**

```js
describe('Kurum Grupları CRUD', () => {
  it('super grup oluşturabilir', async () => {});
  it('bir kurumu bir gruba atamak, o kurumu ÖNCEKİ grubundan ÇIKARIR (tek grup kuralı)', async () => {});
  it('finans/destek/icerik bu rotalara erişemez (sadece super — mock izinlerinde kurum grupları hiçbir grupta açıkça geçmiyor, en kısıtlı varsayım: sadece super)', async () => {});
});
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: `institutionGroupCreateSchema` ekle** (`name`: string 2-200)

- [ ] **Step 4: `src/routes/institutionGroups.routes.js`'i yaz**

`GET /` (liste + her grubun `kurumIdler`'ı için `institutions WHERE group_id=$1`), `POST /` (`authorizePlatformAdmin('super')`), `PATCH /:id` (ad güncelleme), `DELETE /:id` (gruptaki kurumların `group_id`'sini NULL'a çeker, sonra grubu siler — tek transaction), `POST /:groupId/institutions/:institutionId` (bir kurumu bu gruba atar — `UPDATE institutions SET group_id=$1 WHERE id=$2`, zaten bir grupta ise otomatik taşır, frontend'in `kurumuGruptanCikar`/`setKurumGrubu` davranışıyla eşleşir), `DELETE /:groupId/institutions/:institutionId` (`group_id=NULL`).

- [ ] **Step 5: `src/app.js`'e mount et**

- [ ] **Step 6: Run tests to verify they pass**

- [ ] **Step 7: Commit**

```bash
git add src/routes/institutionGroups.routes.js src/validators/schemas.js src/app.js tests/integration/institutionGroups.routes.test.js
git commit -m "feat(platform-admin): institution groups CRUD (single-group-per-institution)"
```

---

### Task 5: Kurum Talepleri (Support Tickets)

**Files:**
- Create: `src/routes/supportTickets.routes.js`
- Modify: `src/validators/schemas.js` (`supportTicketCreateSchema`, `supportTicketUpdateSchema`, `supportTicketCommentSchema`)
- Modify: `src/app.js`
- Test: `tests/integration/supportTickets.routes.test.js`

**Interfaces:**
- Consumes: Task 2, Task 1'in `institution_support_tickets`/`_comments` tabloları.

**Implementer'a not:** `src/pages/KurumTalepleri.jsx`'i oku (frontend repo, read-only referans) — `durum`/`öncelik`/`tip` için kullanılan TAM Türkçe değerleri (örn. `'Açık'`) bul, bu plan'ın enum'larıyla (`OPEN/IN_PROGRESS/CLOSED`, `LOW/MEDIUM/HIGH`, `TECHNICAL/FEATURE_REQUEST/BILLING/SALES`) eşleşen bir çeviri tablosu tasarla (bu plan sadece backend'i kapsar, çeviri tablosunun KENDİSİ frontend plan'ında yazılacak — burada sadece backend'in enum değerlerinin frontend'in ne beklediğiyle TUTARLI olduğunu doğrula).

- [ ] **Step 1: Write the failing tests**

```js
describe('Kurum Talepleri', () => {
  it('destek grubu talep listesini görür, yorum ekleyebilir, durum güncelleyebilir', async () => {});
  it('finans/icerik bu rotalara erişemez (403) — super her zaman erişir', async () => {});
  it('yorumu ekleyen platform-admin hesabı sonradan is_active=FALSE olsa da yorum görünmeye devam eder (Review Focus)', async () => {});
});
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Şemaları ekle**

- [ ] **Step 4: `src/routes/supportTickets.routes.js`'i yaz**

`GET /` (`authorizePlatformAdmin('super','destek')`, filtre: `status`/`type`/`institutionId` query param, pagination), `GET /:id` (yorumlarıyla birlikte, `LEFT JOIN platform_admins` ile yorumcu adı — `platform_admin_id` NULL olabilir, `is_active=FALSE` olan bir admin'in yorumu da görünür, sadece FK üzerinden JOIN, filtre yok), `PATCH /:id/status`, `POST /:id/comments`.

- [ ] **Step 5: `src/app.js`'e mount et**

- [ ] **Step 6: Run tests to verify they pass**

- [ ] **Step 7: Commit**

```bash
git add src/routes/supportTickets.routes.js src/validators/schemas.js src/app.js tests/integration/supportTickets.routes.test.js
git commit -m "feat(platform-admin): support tickets CRUD + comments"
```

---

### Task 6: Sistem Ayarları (Platform Settings)

**Files:**
- Create: `src/routes/platformSettings.routes.js`
- Modify: `src/validators/schemas.js` (`platformSettingsUpdateSchema`)
- Modify: `src/app.js`
- Test: `tests/integration/platformSettings.routes.test.js`

**Interfaces:**
- Consumes: Task 2, Task 1'in `platform_settings` (tek satır, id=1) tablosu.

- [ ] **Step 1: Write the failing tests**

```js
describe('Sistem Ayarları', () => {
  it('super ayarları okuyabilir ve güncelleyebilir', async () => {});
  it('destek/finans/icerik bu rotaya erişemez (sadece super — mock\'ta açıkça "Sistem ayarları" sadece Süper Yöneticiler\'in izninde)', async () => {});
});
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: `platformSettingsUpdateSchema` ekle** (tüm alanlar `.partial()`, `maintenanceMode`/`autoBilling` boolean, `trialDays` positive int, email alanları `.email()`)

- [ ] **Step 4: `src/routes/platformSettings.routes.js`'i yaz**

`GET /` (`authorizePlatformAdmin('super')`, her zaman `id=1` satırını döner — yoksa Task 1'in seed'i zaten garanti ediyor), `PATCH /` (`UPDATE platform_settings SET ... WHERE id=1`).

- [ ] **Step 5: `src/app.js`'e mount et**

- [ ] **Step 6: Run tests to verify they pass**

- [ ] **Step 7: Commit**

```bash
git add src/routes/platformSettings.routes.js src/validators/schemas.js src/app.js tests/integration/platformSettings.routes.test.js
git commit -m "feat(platform-admin): platform settings single-row CRUD"
```

---

### Task 7: Platform-Admin Hesap/Grup Yönetimi

**Files:**
- Create: `src/routes/platformAdminAccounts.routes.js`
- Modify: `src/validators/schemas.js` (`platformAdminAccountCreateSchema`, `platformAdminAccountUpdateSchema`)
- Modify: `src/app.js`
- Test: `tests/integration/platformAdminAccounts.routes.test.js`

**Interfaces:**
- Consumes: Task 2, Task 1'in `platform_admins`/`platform_admin_groups` tabloları.

- [ ] **Step 1: Write the failing tests**

```js
describe('Platform-Admin Hesap Yönetimi', () => {
  it('super yeni platform-admin hesabı oluşturabilir, sabit 4 gruptan birine atar', async () => {});
  it('geçersiz bir group_slug (örn. "yeni-grup") ile hesap oluşturma 400 döner — sabit set dışına çıkılamaz', async () => {});
  it('destek/finans/icerik bu rotalara erişemez (sadece super)', async () => {});
  it('tek aktif süper yönetici pasife alınmaya/silinmeye çalışılırsa reddedilir (Review Focus)', async () => {});
});
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Şemaları ekle**

`groupSlug` alanı `z.enum(['super','destek','finans','icerik'])` — veritabanı FK'si zaten bunu zorunlu kılar ama zod seviyesinde de erken, anlaşılır bir 400 için tekrarlanır.

- [ ] **Step 4: `src/routes/platformAdminAccounts.routes.js`'i yaz**

`GET /groups` (sabit 4 satır + her birinin `kullaniciSayisi`'si için `COUNT(*) FROM platform_admins WHERE group_slug=... AND is_active=TRUE`), `GET /` (hesap listesi), `POST /` (`authorizePlatformAdmin('super')`, şifre: `crypto.randomBytes` ile geçici şifre üretilir ve response'ta BİR KEZ döner — mevcut `register()`'ın `validatePasswordStrength`/`hashPassword`/`savePasswordHistory` desenine bakılabilir ama `savePasswordHistory` hastane-`users`'a özel bir tablo kullanıyorsa platform-admin için bu adım atlanır, implementer kontrol eder), `PATCH /:id` (ad/grup/is_active güncelleme — `is_active=FALSE` yapılacaksa ÖNCE "bu son aktif süper yönetici mi?" kontrolü: `SELECT COUNT(*) FROM platform_admins WHERE group_slug='super' AND is_active=TRUE` sorgusu 1 dönüyorsa ve hedef bu hesapsa 409/400 ile reddet).

- [ ] **Step 5: `src/app.js`'e mount et**

- [ ] **Step 6: Run tests to verify they pass**

- [ ] **Step 7: Run full backend test suite (regresyon)**

Run: `npm test`
Expected: PASS (Task 3'ün hastane `login`/`refreshTokens` değişikliğinin mevcut hiçbir testi bozmadığını özellikle doğrula)

- [ ] **Step 8: Commit**

```bash
git add src/routes/platformAdminAccounts.routes.js src/validators/schemas.js src/app.js tests/integration/platformAdminAccounts.routes.test.js
git commit -m "feat(platform-admin): admin account management (fixed 4 groups, last-super-admin guard)"
```
