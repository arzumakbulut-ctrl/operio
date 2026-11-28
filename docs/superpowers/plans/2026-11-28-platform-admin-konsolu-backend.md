# Platform Admin Konsolu — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Operio'nun kendi platform-admin ekibinin (satış/destek/finans/içerik) müşteri hastanelerini yönetmesi için backend #1'e tamamen ayrı bir kimlik doğrulama katmanı ve 5 özelliğin (Kurumlar, Kurum Grupları, Kurum Talepleri, Yetki Grupları, Sistem Ayarları) gerçek route/şema/migration'ını ekler.

**Architecture:** Yeni, hastane `users`/`roles` sisteminden TAMAMEN izole bir platform-admin tablosu/JWT/middleware seti. Her yeni kaynak kendi `src/services/<kaynak>.service.js` (tüm `db.query` çağrıları burada) + `src/routes/<kaynak>.routes.js` (ince HTTP katmanı: validate + `registry.get(...)` ile servisi çağır) dosya çiftinde — bu, `src/services/_registry.js` DI deseniyle (mevcut `auth`/`surgery`/`sterileSet` servislerinde kullanılan, GERÇEKTEN test edilebilen TEK desen) birlikte çalışır.

**Tech Stack:** Node/Express (mevcut), raw SQL + `pg` Pool (mevcut desen, Prisma kullanılmaz — `001_init.sql` da raw SQL), zod (mevcut `src/validators/schemas.js`), bcryptjs + jsonwebtoken (mevcut `src/utils/password.js`/`src/utils/jwt.js`), Vitest + supertest (mevcut `tests/integration/*.test.js` deseni).

**Spec:** `operio-react/operio/docs/superpowers/specs/2026-11-28-platform-admin-konsolu-design.md`

## Global Constraints

- `migrations/001_init.sql` HİÇ DEĞİŞTİRİLMEZ — tüm yeni tablo/kolon `migrations/002_platform_admin.sql`'de, idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`). Yeni enum'lar (`CREATE TYPE`) mevcut `001_init.sql`'in kendi deseniyle AYNI şekilde, "IF NOT EXISTS" guard'ı OLMADAN bare yazılır (Postgres bunu desteklemiyor; docker-compose'un migration dosyasını her restart'ta yeniden çalıştırması, psql'in hata alınca script'i durdurmaması sayesinde zaten idempotent çalışıyor — bkz. Task 1).
- **KRİTİK test mimarisi kararı (worktree kurulumunda doğrulandı):** `tests/setup.js`'in `vi.mock('../src/utils/db', ...)` ve `global.mockDBQuery`'si bu kod tabanında GERÇEKTE ÇALIŞMIYOR — repo genelinde `mockDBQuery`'nin SIFIR gerçek çağrı yeri var (doğrulandı: `tests/unit/kioskService.recordTimeoutRead.test.js`'in kod içi notu, `vi.mock`'un test dosyasının kendisinin import ETMEDİĞİ, zincirleme (nested) bir `require()`'a asla ulaşmadığını deneysel olarak kanıtlıyor). Bu kod tabanında GERÇEKTEN test edilebilen TEK desen: route, DB mantığını kendi işlemediği, `registry.get('<ad>', () => require('../services/<ad>.service'))` ile çağırdığı bir servis dosyasına devreder; test dosyası `registry.register('<ad>', mockService)` ile o servisi DOĞRUDAN (module-mock'suz, düz JS obje değişimiyle) değiştirir. `auth.routes.js`/`auth.service.js` ve `surgery.routes.js`/`surgery.service.js` bu deseni kullanıyor ve GERÇEKTEN test ediliyor; `other.routes.js`'in `auditRouter`'ı gibi `db.query`'yi route içinde DOĞRUDAN çağıran kod SIFIR test kapsamına sahip. **Bu planın HER route'u, servis+registry deseniyle yazılır — db.query asla route dosyasında doğrudan çağrılmaz.**
- Yanıt zarfı: başarıda `{success:true,data,meta?}`, hatada `{success:false,error:{code,message}}` — mevcut `src/utils/response.js`'in `ok/created/badRequest/unauthorized/forbidden/notFound/conflict/serverError` fonksiyonları route katmanında kullanılır. Servis katmanı hata fırlatırken mevcut `auth.service.js`/`surgery.service.js` deseniyle (`Object.assign(new Error(msg), {statusCode})`) fırlatır, route katmanı `err.statusCode`'a göre doğru response helper'ı çağırır.
- Platform-admin JWT, hastane JWT'siyle (`src/utils/jwt.js`'in `ACCESS_SECRET`/`REFRESH_SECRET`'ı) AYRI bir secret çifti kullanır (`PLATFORM_ADMIN_ACCESS_SECRET`/`PLATFORM_ADMIN_REFRESH_SECRET`) — aynı secret'ı paylaşmaz. Platform-admin payload'ında `roleId`/`institutionId` alanı OLMAZ; hastane payload'ında `kind`/`groupSlug` alanı OLMAZ — iki şema kesişmez.
- Yetki grupları SABİT 4 satır (`super`, `destek`, `finans`, `icerik` slug'ları — mock veride: Süper Yönetici/Destek Ekibi/Finans Ekibi/İçerik Yöneticileri), migration'da seed edilir. Bu grup YENİ grup oluşturma endpoint'i EKLEMEZ — sadece mevcut 4 gruptan birini bir platform-admin hesabına atayan endpoint'ler.
- Kanonik plan slug'ları mevcut `plans` tablosundaki `starter/pro/enterprise` — yeni bir slug sistemi icat edilmez.
- `docker-compose.yml`'in `api` servisinin `command`'ı `002_platform_admin.sql`'i de uygulayacak şekilde güncellenir (001'den sonra, seed'den önce).
- Her test dosyası `tests/integration/auth.test.js`/`tests/integration/surgery.test.js`'in AYNI iskeletini kullanır: `supertest(app)` + `beforeEach` içinde `registry.register('<ad>', mockService)` + `signAccessToken`/yeni `signPlatformAdminAccessToken` ile token üretimi — gerçek bir Postgres bağlantısı GEREKMEZ, testler `npm test` ile (Docker/DB ayağa kalkmadan) çalışır.

## Review Focus

- Bir platform-admin token'ı herhangi bir hastane-scoped rotaya (`authorize(...)` korumalı) sunulduğunda REDDEDİLMELİ (payload'da `roleId` yok → `authorize()`'ın `roleIds.includes(undefined)` kontrolü zaten false döner, ama bunu açıkça test etmeden "çalışır" denemez). Aynı şekilde bir hastane token'ı `authorizePlatformAdmin(...)`'e sunulduğunda reddedilmeli.
- Bir kurum `is_active=FALSE` yapıldığında SADECE yeni login değil, o kurumun kullanıcılarının MEVCUT refresh token'larıyla yeni access token alması da reddedilmeli (`refreshTokens()` zaten `users.is_active`'i kontrol ediyor ama kurumun kendi `is_active`'ini kontrol etmiyor — bu plan bunu da ekler).
- Kurum oluşturulurken verilen iletişim e-postası zaten `users` tablosunda başka bir kullanıcıya aitse (UNIQUE ihlali), kurum kaydı YARI TAMAMLANMIŞ kalmamalı — servis katmanı `db.transaction` (mevcut `src/utils/db.js`'in `transaction` fonksiyonu — Task 3'te implementer bunun imzasını kontrol eder) içinde kurum+kullanıcı+trial'ı tek birim yapar.
- Bir support ticket yorumunu ekleyen platform-admin hesabı sonradan pasife alınırsa (silinmezse — soft-delete/`is_active=FALSE`), o yorum geçmişte görünmeye devam etmeli (FK bozulmamalı).
- Aktif tek Süper Yönetici (`group_slug='super'`, `is_active=TRUE`) hesabı pasife alınmaya/silinmeye çalışılırsa reddedilmeli — platformu yönetecek hiç kimse kalmamasını önler.

---

### Task 1: Migration + Docker + Seed

**Files:**
- Create: `migrations/002_platform_admin.sql`
- Modify: `docker-compose.yml` (api servisinin `command`'ı)
- Modify: `prisma/seed.js` (platform_admin_groups + ilk platform-admin hesabı seed'i)

**Interfaces:**
- Produces: aşağıdaki tablolar/kolonlar, sonraki TÜM task'ların servis dosyalarının `db.query`'lerinin üzerine yazdığı gerçek şema.

**Doğrulama bu task'ta vitest testi DEĞİL, manuel adımdır** (bu kod tabanında migration dosyaları hiç vitest ile test edilmiyor — ne `001_init.sql` ne de mevcut hiçbir tablo için bir migration testi var; `other.routes.js`'in rooms/patients/audit rotaları da aynı nedenle sıfır test kapsamına sahip, bu PLANIN KENDİSİNİN DÜZELTTİĞİ "test edilmeyen route" deseninin tam tersi migration dosyası için geçerli değil — migration'lar bu projede hep manuel doğrulanıyor):

- [ ] **Step 1: `migrations/002_platform_admin.sql`'i yaz**

Mevcut `001_init.sql`'deki stil/idempotency deseniyle (`uuid_generate_v4()`, `CREATE TABLE IF NOT EXISTS`, enum'lar için bare `CREATE TYPE ... AS ENUM`, mevcut tabloların AYNI kolon şekli):

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

- [ ] **Step 2: `docker-compose.yml`'in `api` servisinin `command`'ını güncelle**

```yaml
command: >
  sh -c "
    psql \"$$DATABASE_URL\" -f migrations/001_init.sql &&
    psql \"$$DATABASE_URL\" -f migrations/002_platform_admin.sql &&
    node prisma/seed.js &&
    node src/server.js
  "
```

- [ ] **Step 3: `prisma/seed.js`'e ilk platform-admin hesabını ekle**

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

- [ ] **Step 4: Manuel doğrulama (Docker ile)**

```bash
docker compose up -d --build
docker compose logs api --tail 50   # migration/seed hatasız geçti mi kontrol et
docker compose exec postgres psql -U operio -d operio_db -c "\d platform_admins"
docker compose exec postgres psql -U operio -d operio_db -c "SELECT slug FROM platform_admin_groups ORDER BY slug;"
docker compose exec postgres psql -U operio -d operio_db -c "SELECT email FROM platform_admins WHERE group_slug='super';"
```

Beklenen: `platform_admins` tablosu doğru kolonlarla var; 4 grup slug'ı (`destek,finans,icerik,super`) listelenir; `super@operio.com` satırı döner.

- [ ] **Step 5: Commit**

```bash
git add migrations/002_platform_admin.sql docker-compose.yml prisma/seed.js
git commit -m "feat(platform-admin): add migration, seed, and docker-compose wiring"
```

---

### Task 2: Platform-Admin Kimlik Doğrulama Katmanı

**Files:**
- Create: `src/utils/platformAdminJwt.js`
- Create: `src/middleware/platformAdminAuth.js`
- Create: `src/utils/platformAdminAudit.js`
- Create: `src/services/platformAdminAuth.service.js`
- Create: `src/routes/platformAdminAuth.routes.js`
- Modify: `src/app.js` (route mount: `app.use('/api/platform-admin/auth', platformAdminAuthRoutes)`)
- Modify: `src/validators/schemas.js` (yeni zod şemaları ekle, mevcut diziye ekle)
- Modify: `tests/setup.js` (yeni platform-admin JWT secret'ları için test env değişkenleri)
- Test: `tests/integration/platformAdminAuth.test.js`

**Interfaces:**
- Consumes: Task 1'in `platform_admins`/`platform_admin_refresh_tokens`/`platform_admin_groups` tabloları.
- Produces: `authenticatePlatformAdmin` (middleware, `req.platformAdmin = {sub,email,groupSlug}` atar — DİKKAT: `req.user` DEĞİL), `authorizePlatformAdmin(...groupSlugs)` (middleware factory), `auditPlatformAdmin(opts)` (Task 3-7'nin TÜM yazma işlemlerinde kullanacağı denetim-kaydı fonksiyonu, `opts.adminId` → `admin_id` diğer alanlar mevcut `audit()` ile aynı isimler) — Task 3-7 bunların hepsini import eder.

- [ ] **Step 1: Write the failing tests**

`tests/integration/platformAdminAuth.test.js` — `tests/integration/auth.test.js`'in AYNI iskeleti (supertest + `registry.register('platformAdminAuth', mockService)`):

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import registry from '../../src/services/_registry.js';
import app from '../../src/app.js';
import { signAccessToken } from '../../src/utils/jwt.js';
import { signPlatformAdminAccessToken } from '../../src/utils/platformAdminJwt.js';

const request = supertest(app);
const mockAuth = { login: vi.fn(), refreshTokens: vi.fn(), logout: vi.fn() };
beforeEach(() => { vi.clearAllMocks(); registry.register('platformAdminAuth', mockAuth); });

describe('POST /api/platform-admin/auth/login', () => {
  it('başarılı login → 200, accessToken/refreshToken döner', async () => {
    mockAuth.login.mockResolvedValueOnce({ accessToken:'pa-acc', refreshToken:'pa-ref', admin:{id:'a1',email:'super@operio.com',groupSlug:'super'} });
    const res = await request.post('/api/platform-admin/auth/login').send({ email:'super@operio.com', password:'PlatformAdmin123!' });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBe('pa-acc');
  });
  it('yanlış şifre → 401', async () => {
    mockAuth.login.mockRejectedValueOnce(Object.assign(new Error('Hatalı'), { statusCode:401 }));
    expect((await request.post('/api/platform-admin/auth/login').send({ email:'super@operio.com', password:'yanlis' })).status).toBe(401);
  });
});

describe('Cross-boundary token rejection (Review Focus)', () => {
  it('platform-admin access token, authorize() korumalı bir hastane rotasına (GET /api/surgeries) erişemez', async () => {
    const paToken = signPlatformAdminAccessToken({ sub:'a1', email:'super@operio.com', groupSlug:'super' });
    const res = await request.get('/api/surgeries').set('Authorization', `Bearer ${paToken}`);
    expect([401,403]).toContain(res.status);
  });
  it('hastane access token, authorizePlatformAdmin() korumalı bir rotaya (GET /api/platform-admin/auth/me) erişemez', async () => {
    const hospToken = signAccessToken({ sub:'u1', email:'a@t.com', roleId:0, institutionId:'inst' });
    const res = await request.get('/api/platform-admin/auth/me').set('Authorization', `Bearer ${hospToken}`);
    expect([401,403]).toContain(res.status);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- platformAdminAuth`
Expected: FAIL

- [ ] **Step 3: `src/utils/platformAdminJwt.js`'i mevcut `src/utils/jwt.js`'in AYNI şekliyle yaz, AYRI env secret'larla**

`signPlatformAdminAccessToken(payload)` — payload: `{sub, email, groupSlug}` (ASLA `roleId`/`institutionId` alanı yok). `signPlatformAdminRefreshToken(adminId)`, `verifyPlatformAdminAccessToken`, `verifyPlatformAdminRefreshToken`, `platformAdminRefreshTokenExpiresAt` — `jwt.js`'deki fonksiyonların birebir aynısı, sadece `PLATFORM_ADMIN_ACCESS_SECRET`/`PLATFORM_ADMIN_REFRESH_SECRET` env değişkenlerini (varsayılan: `'operio-platform-admin-access-secret'`/`'...refresh-secret'`) kullanır. `tests/setup.js`'e bu iki env değişkeni için test-sabit değerler eklenmeli (mevcut `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` satırlarının yanına) — implementer bunu fark edip ekler.

- [ ] **Step 4: `src/middleware/platformAdminAuth.js`'i `src/middleware/auth.js`'in AYNI şekliyle yaz**

`authenticatePlatformAdmin(req,res,next)` → `req.platformAdmin = payload` atar. `authorizePlatformAdmin(...groupSlugs)` → `req.platformAdmin.groupSlug`'ı kontrol eder.

- [ ] **Step 5: `src/utils/platformAdminAudit.js`'i `src/utils/audit.js`'in AYNI şekliyle yaz**

`auditPlatformAdmin(opts)` → `platform_admin_audit_logs`'a yazar.

- [ ] **Step 6: `src/services/platformAdminAuth.service.js`'i `src/services/auth.service.js`'in AYNI şekliyle yaz**

`login({email,password,req})` — `platform_admins`'ten `is_active=TRUE` ile çeker (lockout/2FA YOK — bu turda bilerek bırakıldı), `verifyPassword` ile doğrular, `signPlatformAdminAccessToken`+`signPlatformAdminRefreshToken` üretir, `platform_admin_refresh_tokens`'a INSERT eder, `auditPlatformAdmin({adminId, action:'LOGIN', resource:'platform_admin', resourceId:adminId, req})` çağırır. `refreshTokens({refreshToken,req})` ve `logout({refreshToken,adminId,req})` — `auth.service.js`'in aynı fonksiyonlarının birebir platform-admin karşılığı.

- [ ] **Step 7: `src/routes/platformAdminAuth.routes.js`'i yaz**

`POST /login` (`authLimiter`'ın aynısı — mevcut `express-rate-limit` import'u yeniden kullanılır), `POST /refresh`, `POST /logout` (`authenticatePlatformAdmin` korur), `GET /me` (`authenticatePlatformAdmin` korur, `registry.get('platformAdminAuth', () => require('../services/platformAdminAuth.service'))` ile servise erişir — `auth.routes.js`'in 4 route'uyla AYNI yapı.

- [ ] **Step 8: `src/validators/schemas.js`'e `platformAdminLoginSchema` ekle** (mevcut `loginSchema`'yı yeniden kullanmak da kabul edilebilir, implementer karar verir).

- [ ] **Step 9: `src/app.js`'e mount et**

- [ ] **Step 10: Run tests to verify they pass**

Run: `npm test -- platformAdminAuth`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add src/utils/platformAdminJwt.js src/middleware/platformAdminAuth.js src/utils/platformAdminAudit.js src/services/platformAdminAuth.service.js src/routes/platformAdminAuth.routes.js src/app.js src/validators/schemas.js tests/setup.js tests/integration/platformAdminAuth.test.js
git commit -m "feat(platform-admin): add isolated auth layer (jwt, middleware, service, login/refresh/logout)"
```

---

### Task 3: Kurumlar (Institutions) CRUD + İlk Kullanıcı + Trial

**Files:**
- Create: `src/services/institution.service.js`
- Create: `src/routes/institutions.routes.js`
- Modify: `src/validators/schemas.js` (mevcut `institutionCreateSchema`'yı yeni alanlarla genişlet — `bedCount`, `city`, `district`, `contactName`; `institutionUpdateSchema` ekle; `institutionStatusSchema` ekle)
- Modify: `src/app.js` (mount: `/api/platform-admin/institutions`)
- Modify: `src/services/auth.service.js` (`login`/`refreshTokens`'a kurum is_active kontrolü)
- Test: `tests/integration/institutions.routes.test.js`
- Test: `tests/unit/authService.institutionActive.test.js`

**Interfaces:**
- Consumes: Task 2'nin `authenticatePlatformAdmin`/`authorizePlatformAdmin`/`auditPlatformAdmin`. Mevcut `src/services/subscription.service.js`'in `startTrial({institutionId, planSlug, trialDays})` fonksiyonu (gerçek fonksiyon, mock DEĞİL — route testleri `institution` servisinin KENDİSİNİ mock'ladığı için `startTrial`'ın gerçekten çağrılıp çağrılmadığı route testinde görünmez, bu institution.service.js'in iç mantığına güvenilir).
- Produces: bu task sonrası `institutions` tablosu platform-admin'den gerçekten yazılabilir — Task 4 (Kurum Grupları) bu route'un `group_id` alanını okur/günceller.

- [ ] **Step 1: Write the failing tests**

`tests/integration/institutions.routes.test.js` — `tests/integration/surgery.test.js`'in AYNI iskeleti:

```js
const mockService = {
  listInstitutions: vi.fn(), getInstitution: vi.fn(), createInstitution: vi.fn(),
  updateInstitution: vi.fn(), setInstitutionStatus: vi.fn(),
};
beforeEach(() => { vi.clearAllMocks(); registry.register('institution', mockService); });

describe('POST /api/platform-admin/institutions', () => {
  it('super kurum oluşturabilir, servis çağrısı doğru argümanlarla yapılır', async () => {
    mockService.createInstitution.mockResolvedValueOnce({ id:'inst1', name:'Test Hastanesi' });
    const res = await request.post('/api/platform-admin/institutions').set('Authorization', `Bearer ${superToken}`)
      .send({ name:'Test Hastanesi', contactName:'Ayşe Yılmaz', email:'ayse@test-hastane.tr' });
    expect(res.status).toBe(201);
    expect(mockService.createInstitution).toHaveBeenCalledOnce();
  });
  it('finans grubu POST yapamaz (403)', async () => { /* finansToken ile dene */ });
  it('icerik grubu hiçbir institutions rotasına erişemez (403)', async () => {});
  it('servis "e-posta zaten kayıtlı" hatası fırlatırsa (statusCode 409) → 409 döner', async () => {
    mockService.createInstitution.mockRejectedValueOnce(Object.assign(new Error('Bu e-posta zaten kayıtlı'), { statusCode:409 }));
    const res = await request.post('/api/platform-admin/institutions').set('Authorization', `Bearer ${superToken}`).send({ name:'X', contactName:'Y', email:'ayse@test-hastane.tr' });
    expect(res.status).toBe(409);
  });
});

describe('PATCH /api/platform-admin/institutions/:id', () => {
  it('finans grubu SADECE planSlug alanını gönderebilir — başka alan gönderirse 400/403', async () => {});
  it('destek grubu PATCH yapamaz (403)', async () => {});
});
```

`tests/unit/authService.institutionActive.test.js` — `auth.service.js`'i DOĞRUDAN import eder (registry/route KULLANMAZ, çünkü route testi service'i mock'ladığı için servisin GERÇEK kodu hiç çalışmaz):

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
// db.js'i vi.mock ile taklit et — test dosyası auth.service.js'i DOĞRUDAN import ettiği
// için (tek hop), tests/unit/kioskService.recordTimeoutRead.test.js'in belgelediği
// "nested require'a vi.mock ulaşmıyor" sorunu burada YAŞANMAMALI; implementer npm test
// ile doğrular, çalışmazsa aynı dosyanın require.cache enjeksiyon tekniğine geçer.
vi.mock('../../src/utils/db.js', () => ({ default: { query: vi.fn() } }));

describe('auth.service login/refreshTokens — kurum is_active kontrolü', () => {
  it('kurum pasifse login reddedilir (401)', async () => {});
  it('kurum pasifse MEVCUT refresh token da reddedilir (401)', async () => {});
  it('kullanıcının institution_id değeri yoksa (misafir hekim gibi) etkilenmez', async () => {});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- institutions.routes authService`
Expected: FAIL

- [ ] **Step 3: `src/validators/schemas.js`'i genişlet**

`institutionCreateSchema`'ya ekle: `bedCount` (optional int, positive), `city`/`district` (optional string ≤100), `contactName` (REQUIRED string, min 2 — ilk kullanıcı bu isimle oluşturulacağı için zorunlu). `institutionUpdateSchema = institutionCreateSchema.partial()`. `institutionStatusSchema = z.object({isActive: z.boolean()})`.

- [ ] **Step 4: `src/services/institution.service.js`'i yaz**

`listInstitutions({page,limit})`, `getInstitution({id})` (+ `getSubscription(id)` join — `subscription.service.js`'den import), `createInstitution({data, actorId, req})` — implementer önce `src/utils/db.js`'in `transaction` fonksiyonunun TAM imzasını okur, sonra onun içinde: kurum INSERT, `users`'a ilk kullanıcı INSERT (`role_id=0`, `data.email`, `crypto.randomBytes(12).toString('hex')` ile geçici şifre üret + `hashPassword` ile sakla — şifreyi response'ta DÖNDÜRÜR, DB'de sadece hash tutulur), `startTrial({institutionId, planSlug:'pro', trialDays:14})` çağrılır (gerçek fonksiyon, `require('./subscription.service')`). Email zaten `users`'ta varsa transaction başlamadan ÖNCE kontrol edilip `409` fırlatılır (Review Focus). `updateInstitution({id,data,actorGroupSlug,req})` — `actorGroupSlug==='finans'` ise SADECE `data.planSlug` kabul edilir (başka alan varsa 400 fırlatılır), `'super'` ise tüm alanlar. `setInstitutionStatus({id,isActive,req})`. Her yazmada `auditPlatformAdmin(...)` çağrılır.

- [ ] **Step 5: `src/routes/institutions.routes.js`'i yaz**

`GET /` (`authorizePlatformAdmin('super','destek','finans')`), `GET /:id` (aynı), `POST /` (`authorizePlatformAdmin('super')`), `PATCH /:id` (`authorizePlatformAdmin('super','finans')`), `PATCH /:id/status` (`authorizePlatformAdmin('super')`) — hepsi `registry.get('institution', () => require('../services/institution.service'))` ile servise devreder, hata `err.statusCode`'a göre `badRequest/conflict/forbidden/serverError`'a map edilir.

- [ ] **Step 6: `src/services/auth.service.js`'in `login`/`refreshTokens`'ına kurum is_active kontrolü ekle**

`login()`'deki mevcut kullanıcı sorgusuna bir `LEFT JOIN institutions i ON u.institution_id=i.id` ekle, `WHERE` koşuluna `AND (u.institution_id IS NULL OR i.is_active=TRUE)` ekle (misafir hekim gibi `institution_id IS NULL` olabilecek kullanıcılar etkilenmez — implementer `users.institution_id`'nin gerçekten nullable olup olmadığını `001_init.sql`'den kontrol eder). `refreshTokens()`'daki kullanıcı sorgusuna da aynı kontrol eklenir.

- [ ] **Step 7: `src/app.js`'e mount et**

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm test -- institutions.routes authService auth`
Expected: PASS (mevcut `auth.test.js`'in de hâlâ geçtiğini doğrula)

- [ ] **Step 9: Commit**

```bash
git add src/services/institution.service.js src/routes/institutions.routes.js src/validators/schemas.js src/app.js src/services/auth.service.js tests/integration/institutions.routes.test.js tests/unit/authService.institutionActive.test.js
git commit -m "feat(platform-admin): real institutions CRUD + auto-bootstrap first user + trial + institution-suspend login gate"
```

---

### Task 4: Kurum Grupları (Institution Groups)

**Files:**
- Create: `src/services/institutionGroup.service.js`
- Create: `src/routes/institutionGroups.routes.js`
- Modify: `src/validators/schemas.js` (`institutionGroupCreateSchema`)
- Modify: `src/app.js`
- Test: `tests/integration/institutionGroups.routes.test.js`

**Interfaces:**
- Consumes: Task 2'nin middleware/audit'i, Task 1'in `institution_groups` tablosu ve `institutions.group_id` kolonu.

- [ ] **Step 1: Write the failing tests** (`registry.register('institutionGroup', mockService)` deseniyle, Task 3'ün testiyle AYNI iskelet)

```js
describe('Kurum Grupları CRUD', () => {
  it('super grup oluşturabilir', async () => {});
  it('bir kurumu bir gruba atama servis çağrısı yapılır (tek grup kuralı servis katmanında)', async () => {});
  it('finans/destek/icerik erişemez (sadece super)', async () => {});
});
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: `institutionGroupCreateSchema` ekle** (`name`: string 2-200)

- [ ] **Step 4: `src/services/institutionGroup.service.js`'i yaz**

`listGroups()` (her grup + `institutions WHERE group_id=$1` ile üye kurum listesi), `createGroup({name,req})`, `updateGroup({id,name,req})`, `deleteGroup({id,req})` (önce `UPDATE institutions SET group_id=NULL WHERE group_id=$1`, sonra grup DELETE — tek transaction), `assignInstitution({groupId,institutionId,req})` (`UPDATE institutions SET group_id=$1 WHERE id=$2` — zaten bir grupta ise otomatik taşır), `removeInstitution({institutionId,req})` (`group_id=NULL`).

- [ ] **Step 5: `src/routes/institutionGroups.routes.js`'i yaz**

`GET /`, `POST /`, `PATCH /:id`, `DELETE /:id`, `POST /:groupId/institutions/:institutionId`, `DELETE /:groupId/institutions/:institutionId` — tümü `authorizePlatformAdmin('super')`.

- [ ] **Step 6: `src/app.js`'e mount et**

- [ ] **Step 7: Run tests to verify they pass**

- [ ] **Step 8: Commit**

```bash
git add src/services/institutionGroup.service.js src/routes/institutionGroups.routes.js src/validators/schemas.js src/app.js tests/integration/institutionGroups.routes.test.js
git commit -m "feat(platform-admin): institution groups CRUD (single-group-per-institution)"
```

---

### Task 5: Kurum Talepleri (Support Tickets)

**Files:**
- Create: `src/services/supportTicket.service.js`
- Create: `src/routes/supportTickets.routes.js`
- Modify: `src/validators/schemas.js` (`supportTicketCreateSchema`, `supportTicketUpdateSchema`, `supportTicketCommentSchema`)
- Modify: `src/app.js`
- Test: `tests/integration/supportTickets.routes.test.js`

**Interfaces:**
- Consumes: Task 2, Task 1'in `institution_support_tickets`/`_comments` tabloları.

**Implementer'a not:** `operio-react/operio/src/pages/KurumTalepleri.jsx`'i oku (frontend repo, read-only referans) — `durum`/`öncelik`/`tip` için kullanılan TAM Türkçe değerleri bul; bu backend task'ı sadece İngilizce enum'ları (`OPEN/IN_PROGRESS/CLOSED`, `LOW/MEDIUM/HIGH`, `TECHNICAL/FEATURE_REQUEST/BILLING/SALES`) kapsar — TR↔EN çeviri tablosu frontend plan'ında yazılır, burada SADECE backend'in enum'larının gelecekteki frontend işiyle tutarlı/yeterli olduğunu doğrula.

- [ ] **Step 1: Write the failing tests**

```js
describe('Kurum Talepleri', () => {
  it('destek grubu talep listesini görür, yorum ekleyebilir, durum güncelleyebilir', async () => {});
  it('finans/icerik erişemez (403) — super her zaman erişir', async () => {});
  it('yorum ekleyen admin sonradan is_active=FALSE olsa da yorum servis seviyesinde görünmeye devam eder (Review Focus — servis LEFT JOIN kullanır, filtre yok)', async () => {});
});
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Şemaları ekle**

- [ ] **Step 4: `src/services/supportTicket.service.js`'i yaz**

`listTickets({status,type,institutionId,page,limit})`, `getTicket({id})` (+ `LEFT JOIN platform_admins` ile yorumcu adı — `is_active` filtresi YOK), `updateStatus({id,status,req})`, `addComment({ticketId,adminId,message,req})`.

- [ ] **Step 5: `src/routes/supportTickets.routes.js`'i yaz**

`GET /` (`authorizePlatformAdmin('super','destek')`), `GET /:id` (aynı), `PATCH /:id/status` (aynı), `POST /:id/comments` (aynı).

- [ ] **Step 6: `src/app.js`'e mount et**

- [ ] **Step 7: Run tests to verify they pass**

- [ ] **Step 8: Commit**

```bash
git add src/services/supportTicket.service.js src/routes/supportTickets.routes.js src/validators/schemas.js src/app.js tests/integration/supportTickets.routes.test.js
git commit -m "feat(platform-admin): support tickets CRUD + comments"
```

---

### Task 6: Sistem Ayarları (Platform Settings)

**Files:**
- Create: `src/services/platformSettings.service.js`
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
  it('destek/finans/icerik erişemez (403) — sadece super', async () => {});
});
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: `platformSettingsUpdateSchema` ekle** (tüm alanlar `.partial()`, `maintenanceMode`/`autoBilling` boolean, `trialDays` positive int, email alanları `.email()`)

- [ ] **Step 4: `src/services/platformSettings.service.js`'i yaz**

`getSettings()` (her zaman `id=1` satırını döner), `updateSettings({data,req})` (`UPDATE platform_settings SET ... WHERE id=1`).

- [ ] **Step 5: `src/routes/platformSettings.routes.js`'i yaz**

`GET /`, `PATCH /` — ikisi de `authorizePlatformAdmin('super')`.

- [ ] **Step 6: `src/app.js`'e mount et**

- [ ] **Step 7: Run tests to verify they pass**

- [ ] **Step 8: Commit**

```bash
git add src/services/platformSettings.service.js src/routes/platformSettings.routes.js src/validators/schemas.js src/app.js tests/integration/platformSettings.routes.test.js
git commit -m "feat(platform-admin): platform settings single-row CRUD"
```

---

### Task 7: Platform-Admin Hesap/Grup Yönetimi

**Files:**
- Create: `src/services/platformAdminAccount.service.js`
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
  it('geçersiz bir group_slug (örn. "yeni-grup") ile hesap oluşturma 400 döner', async () => {});
  it('destek/finans/icerik erişemez (sadece super)', async () => {});
  it('tek aktif süper yönetici pasife alınmaya/silinmeye çalışılırsa servis 409/400 fırlatır, route bunu yansıtır (Review Focus)', async () => {
    mockService.updateAccount.mockRejectedValueOnce(Object.assign(new Error('Son aktif süper yönetici pasife alınamaz'), { statusCode:409 }));
    const res = await request.patch(`/api/platform-admin/accounts/${lastSuperId}`).set('Authorization',`Bearer ${superToken}`).send({ isActive:false });
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Şemaları ekle**

`groupSlug` alanı `z.enum(['super','destek','finans','icerik'])`.

- [ ] **Step 4: `src/services/platformAdminAccount.service.js`'i yaz**

`listGroups()` (sabit 4 satır + her birinin `kullaniciSayisi`'si için `COUNT(*) FROM platform_admins WHERE group_slug=... AND is_active=TRUE`), `listAccounts()`, `createAccount({data,req})` (`crypto.randomBytes` ile geçici şifre üretir, response'ta BİR KEZ döner, DB'de hash), `updateAccount({id,data,req})` — `data.isActive===false` VEYA hesap silinecekse ÖNCE "bu son aktif süper yönetici mi?" kontrolü (`SELECT COUNT(*) FROM platform_admins WHERE group_slug='super' AND is_active=TRUE` → 1 ve hedef bu hesapsa `Object.assign(new Error(...), {statusCode:409})` fırlatır).

- [ ] **Step 5: `src/routes/platformAdminAccounts.routes.js`'i yaz**

`GET /groups`, `GET /`, `POST /`, `PATCH /:id` — tümü `authorizePlatformAdmin('super')`.

- [ ] **Step 6: `src/app.js`'e mount et**

- [ ] **Step 7: Run full backend test suite (regresyon)**

Run: `npm test`
Expected: PASS (Task 3'ün hastane `login`/`refreshTokens` değişikliğinin mevcut hiçbir testi bozmadığını özellikle doğrula)

- [ ] **Step 8: Commit**

```bash
git add src/services/platformAdminAccount.service.js src/routes/platformAdminAccounts.routes.js src/validators/schemas.js src/app.js tests/integration/platformAdminAccounts.routes.test.js
git commit -m "feat(platform-admin): admin account management (fixed 4 groups, last-super-admin guard)"
```
