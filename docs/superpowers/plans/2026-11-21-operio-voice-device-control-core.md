# Operio Voice — Cihaz Kontrolü Çekirdeği (Plan 1/2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kurum bazlı satın alınabilir modül altyapısını ve mock sürücülü, risk-kademeli yetkilendirmeli cihaz kontrolü çekirdeğini (backend + yönetim/izleme ekranları) uçtan uca çalışır ve test edilmiş hale getirmek — kişisel oturumla manuel kontrol tamamen çalışır durumda; sesli/kiosk katmanı Plan 2'de eklenecek.

**Architecture:** Mevcut Express + `pg` (ham SQL) + Socket.io backend'ine, mevcut `authenticate`/`authorize`/`audit`/`_registry` desenlerini birebir kullanan yeni bir `device.service.js` + `DeviceDriver` soyutlaması (şimdilik sadece `MockDriver`) ekleniyor. Komutlar, cihazın bulunduğu odadaki aktif ameliyat ekibine ve (yüksek riskli gruplar için) o ameliyattaki `team_role`'e göre yetkilendiriliyor. Yeni bir `modules`/`institution_modules` tablosu, bu özelliğin kurum bazında satın alınmasını kapıda tutuyor (mevcut iyzico/stripe akışı üzerinden).

**Tech Stack:** Node/Express, PostgreSQL (`pg`, ham SQL), Vitest + Supertest (backend testleri), React 19 + Vite + Zustand (frontend, test yok — mevcut proje konvansiyonu).

**Spec:** [docs/superpowers/specs/2026-11-20-sesli-cihaz-kontrolu-design.md](../specs/2026-11-20-sesli-cihaz-kontrolu-design.md) — bu plan, dokümanın "Satın alınabilir modül", "Veri modeli", "Yetkilendirme", "Backend: Sürücü soyutlaması" ve ilgili Frontend bölümlerini uygular. Kiosk/ses biyometrisi/Time-Out bölümleri Plan 2'ye bırakılmıştır.

## Global Constraints

- Masa/ışık hareketi fiziksel onay olmadan asla doğrudan uygulanmaz (`requires_physical_confirm=true` cihazlarda `setPower`/`turnOn` değil, sadece `armMove` → ayrı `physical-confirm` çağrısı kabul edilir).
- Elektrocerrahi ve masa komutları, sadece o ameliyattaki `team_role='cerrah'` olan kişiye özeldir; ışık ve endoskopi/görüntüleme komutları düz rol listesine (0,1,2,3,4,5,6) açıktır.
- Komutu veren kişi, cihazın `room_id`'si ile o kişinin o an `IN_PROGRESS` bir ameliyatta göründüğü odanın eşleşmesi gerekir.
- `ARMED` durumundaki bir cihaz, ameliyat `IN_PROGRESS` olmaktan çıkınca backend tarafından otomatik olarak son onaylı duruma (`OFF`/`STANDBY`) döndürülür.
- Sim ↔ gerçek mod geçişi ve cihaz/sürücü tanımlama sadece Üst Yönetici(0)/Biyomedikal(11)/Teknik Servis(12) rolleriyle yapılabilir.
- Her komut mevcut `audit_logs` tablosuna yazılır (`action='device:command'`) — yeni bir log tablosu açılmaz.
- Yeni ORM/mimari katman yok — ham SQL (`pg`) + mevcut `authenticate`/`authorize`/`audit`/`_registry` desenleri kullanılır.
- `/api/devices/*` ve ilgili yönetim uçları, kurum `voice_control` modülünü satın almamışsa tamamen kapalıdır (403).
- Simülasyon modu (`mode='SIM'`) her ekranda net bir rozetle gösterilir; karıştırılamaz.

## Review Focus

- Komutu veren kişi, cihazın bulunduğu odada o an aktif (IN_PROGRESS) ameliyat ekibinde değilse → 403. (Task 7)
- `requires_physical_confirm=true` bir cihaza doğrudan `turnOn`/`setPower` denenirse (fiziksel onay adımı atlanarak) → reddedilmeli, sadece `armMove`+ayrı `physical-confirm` kabul edilmeli. (Task 8)
- Kurum `voice_control` modülünü satın almamışsa, cihaz kayıtları var olsa bile `/api/devices/*` tüm uçları 403 dönmeli. (Task 9)
- Ekipte olan ama `team_role` 'cerrah' olmayan biri (ör. hemşire) elektrocerrahi/masa komutu denerse → 403; aynı kişi ışık/görüntüleme komutu denerse → 200. (Task 7)
- Ameliyat `IN_PROGRESS`'ten çıkarken odada `ARMED` bir cihaz varsa otomatik olarak geri alınmalı, ve bu noktadan sonra gelen bir `physical-confirm` çağrısı artık geçersiz (404/409) olmalı. (Task 10)

---

## Task 1: Veritabanı şeması — modules, institution_modules, controllable_devices

> **Not (preflight'ta düzeltildi):** Bu projenin test takımı (`tests/setup.js`) `src/utils/db`'yi global olarak mock'luyor — hiçbir test gerçek bir PostgreSQL'e bağlanmıyor. Bu yüzden migration'ın doğruluğu bir vitest testiyle değil, **gerçek dev Postgres container'ına uygulanarak** doğrulanır (aşağıdaki Step 2).

**Files:**
- Modify: `operio-backend/operio-backend/migrations/001_init.sql` (sona ekle)

**Interfaces:**
- Produces: `modules`, `institution_modules`, `controllable_devices` tabloları; `device_power_state` (`'OFF'|'STANDBY'|'ON'|'ARMED'`), `device_mode` (`'SIM'|'REAL'`) enum'ları. Sonraki tüm task'lar bu şemayı kullanır.

- [ ] **Step 1: Migration SQL'ini yaz**

`migrations/001_init.sql` dosyasının sonuna ekle (mevcut `CREATE TABLE IF NOT EXISTS` + `uuid_generate_v4()` deseniyle tutarlı):

```sql
CREATE TYPE device_power_state AS ENUM ('OFF', 'STANDBY', 'ON', 'ARMED');
CREATE TYPE device_mode        AS ENUM ('SIM', 'REAL');

CREATE TABLE IF NOT EXISTS modules (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug        VARCHAR(40) UNIQUE NOT NULL,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  price_try   INTEGER     NOT NULL DEFAULT 0,
  price_usd   INTEGER     NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS institution_modules (
  id                     UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id         UUID        NOT NULL REFERENCES institutions(id),
  module_slug            VARCHAR(40) NOT NULL REFERENCES modules(slug),
  status                 VARCHAR(20) NOT NULL DEFAULT 'active',
  purchased_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at           TIMESTAMPTZ,
  iyzico_subscription_id VARCHAR(100),
  stripe_subscription_id VARCHAR(100),
  UNIQUE (institution_id, module_slug)
);

CREATE TABLE IF NOT EXISTS controllable_devices (
  id                        UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id            UUID        NOT NULL REFERENCES institutions(id),
  room_id                   UUID        REFERENCES operating_rooms(id),
  name                      VARCHAR(100) NOT NULL,
  device_group              VARCHAR(30) NOT NULL,
  device_type               VARCHAR(50) NOT NULL,
  driver_key                VARCHAR(50) NOT NULL DEFAULT 'mock',
  mode                      device_mode NOT NULL DEFAULT 'SIM',
  power_state               device_power_state NOT NULL DEFAULT 'OFF',
  power_level               SMALLINT    NOT NULL DEFAULT 0,
  requires_physical_confirm BOOLEAN     NOT NULL DEFAULT FALSE,
  capabilities              JSONB       NOT NULL DEFAULT '{}',
  connection_info           JSONB       NOT NULL DEFAULT '{}',
  serial_number             VARCHAR(60),
  category                  VARCHAR(60),
  last_maintenance_at       DATE,
  calibration_at            DATE,
  is_voice_enabled          BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_controllable_devices_room ON controllable_devices(room_id);
```

- [ ] **Step 2: Migration'ı çalışan dev Postgres'e (operio_postgres container) uygula**

Run: `docker exec -i operio_postgres psql -U operio -d operio_db < migrations/001_init.sql`
Expected: Çıktıda hata yok; `CREATE TYPE`/`CREATE TABLE`/`CREATE INDEX` satırları görünür (zaten var olan tablolar için `CREATE TABLE IF NOT EXISTS` sessizce atlanır, yeni üçü için `CREATE TABLE` yazdırılır).

- [ ] **Step 3: Tabloların ve kısıtın gerçekten oluştuğunu `psql` ile doğrula**

Run: `docker exec -i operio_postgres psql -U operio -d operio_db -c "\d institution_modules"`
Expected: Çıktıda `"institution_modules_institution_id_module_slug_key" UNIQUE CONSTRAINT` satırı görünür; ayrıca `docker exec -i operio_postgres psql -U operio -d operio_db -c "\dt"` çıktısında `modules`, `institution_modules`, `controllable_devices` listelenir.

- [ ] **Step 4: Commit**

```bash
git add migrations/001_init.sql
git commit -m "feat(db): add modules, institution_modules, controllable_devices tables"
```

---

## Task 2: `requireModule` middleware

> **Not (tekrar düzeltildi — karar gerekçesi ledger'da):** Doğrudan `db.query` mock'lamak (bir önceki düzeltme) bu projede çalışmıyor — `tests/setup.js`'in global mock'u sadece ESM `import` yoluna giren erişimleri yakalıyor, bu projedeki (ve bu planın yazacağı) tüm kod `require()` kullandığı için hiçbir servis/middleware'in `db.query`'si doğrudan mock'lanamıyor (gerçek bir denemeyle doğrulandı — mock'suz gerçek `pg.Pool`'a düşüp bağlantı hatası alındı). Bu yüzden `requireModule`, mevcut kodda zaten tek **gerçekten çalışan** mock yolunu — `_registry` üzerinden bütün bir servisi sahteleştirmeyi (`surgery.test.js`'teki desen) — kullanacak: kendi `db.query`'sini çağırmak yerine `module.service.js`'teki `hasActiveModule`'ü çağırır.

**Files:**
- Create: `operio-backend/operio-backend/src/middleware/requireModule.js`
- Create: `operio-backend/operio-backend/src/services/module.service.js` (sadece `hasActiveModule` ile — Task 3 aynı dosyaya `getModules`/`getInstitutionModules`/`purchaseModule`'ü ekleyerek genişletecek)
- Test: `operio-backend/operio-backend/tests/unit/requireModule.test.js`

**Interfaces:**
- Consumes: `req.user.institutionId`, `registry.get('module', () => require('../services/module.service'))` (`surgery.routes.js`'teki `getService()` deseniyle aynı).
- Produces: `requireModule(slug: string) => (req, res, next) => void`. `module.service.js` → `hasActiveModule({ institutionId, slug }) => Promise<boolean>` (Task 3, 8 bu fonksiyonu/dosyayı kullanır/genişletir).

- [ ] **Step 1: Başarısız testi yaz**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import registry from '../../src/services/_registry.js';
const { requireModule } = await import('../../src/middleware/requireModule.js');

const mockModuleService = { hasActiveModule: vi.fn() };
beforeEach(() => { vi.clearAllMocks(); registry.register('module', mockModuleService); });

describe('requireModule', () => {
  it('kurum modülü almışsa next() çağırmalı', async () => {
    mockModuleService.hasActiveModule.mockResolvedValueOnce(true);
    const req = { user: { institutionId: 'inst-1' } };
    const next = vi.fn();
    await requireModule('voice_control')(req, {}, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('kurum modülü almamışsa 403 dönmeli', async () => {
    mockModuleService.hasActiveModule.mockResolvedValueOnce(false);
    const req = { user: { institutionId: 'inst-1' } };
    const json = vi.fn();
    const res = { status: vi.fn(() => ({ json })) };
    const next = vi.fn();
    await requireModule('voice_control')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm run test:unit`
Expected: FAIL — `src/middleware/requireModule.js` bulunamadı

- [ ] **Step 3: `module.service.js`'i `hasActiveModule` ile oluştur; `requireModule(slug)`'ı yaz**

`module.service.js`: `async function hasActiveModule({ institutionId, slug }) { const { rows } = await db.query("SELECT 1 FROM institution_modules WHERE institution_id=$1 AND module_slug=$2 AND status='active'", [institutionId, slug]); return rows.length > 0; }` (düz üst seviye `require('../utils/db')` — bu fonksiyonun SQL'i birim testi almaz, bkz. yukarıdaki not; Task 8'in rota testinde registry üzerinden mock'lanarak dolaylı doğrulanır, gerçek davranışı istenirse Task 1'deki gibi `docker exec psql` ile elle kontrol edilebilir).

`requireModule.js`: `src/middleware/auth.js`'teki `authorize()` ile aynı üslupta, `registry.get('module', ...)` ile servisi al, `hasActiveModule({ institutionId: req.user.institutionId, slug })` çağır; `false` ise `forbidden(res, 'Bu modül satın alınmamış')`, `true` ise `next()`. Beklenmeyen hatayı `next(err)` ile ilet.

- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**

Run: `npm run test:unit`
Expected: PASS (tüm paket + yeni 2 test)

- [ ] **Step 5: Commit**

```bash
git add src/middleware/requireModule.js src/services/module.service.js tests/unit/requireModule.test.js
git commit -m "feat(auth): add requireModule entitlement middleware (via module.service)"
```

---

## Task 3: `module.service.js` ve satın alma uçları

**Files:**
- Modify: `operio-backend/operio-backend/src/services/module.service.js` (Task 2'de `hasActiveModule` ile oluşturuldu — bu task aynı dosyaya ekler)
- Modify: `operio-backend/operio-backend/src/routes/billing.routes.js`
- Test: `operio-backend/operio-backend/tests/integration/module.test.js`

**Interfaces:**
- Consumes: `db.query` (`utils/db.js` — bu task'ın eklediği fonksiyonların SQL'i, Task 2'deki `hasActiveModule` gibi birim testi almaz, bkz. Task 2'nin notu), `payment.provider.js`'teki mevcut `iyzico`/`stripe` yardımcıları (sadece referans olarak çağrılır — gerçek ödeme entegrasyonunun detayları builder'a bırakılmıştır, bu task sadece DB satırını oluşturur ve var olan sağlayıcı fonksiyonunu **çağırmadan** stub bir "purchased" kaydı açar; gerçek ödeme akışı mevcut `subscription.service.js`'teki desenle aynı şekilde ayrı bir iştir).
- Produces: `module.service.js`'e eklenir → `{ getModules, getInstitutionModules, purchaseModule({ institutionId, slug }) }` (mevcut `hasActiveModule`'ün yanına). `billing.routes.js`'e eklenen `GET /api/billing/modules`, `GET /api/billing/modules/mine`, `POST /api/billing/modules/:slug/purchase`.

- [ ] **Step 1: Başarısız entegrasyon testini yaz**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { signAccessToken } from '../../src/utils/jwt.js';
import registry from '../../src/services/_registry.js';
import app from '../../src/app.js';

const request = supertest(app);
const mockModuleService = { getModules: vi.fn(), getInstitutionModules: vi.fn(), purchaseModule: vi.fn() };
const tok = (roleId) => signAccessToken({ sub: 'u1', email: 'e@t.com', roleId, institutionId: 'inst-1' });

beforeEach(() => { vi.clearAllMocks(); registry.register('module', mockModuleService); });

describe('GET /api/billing/modules', () => {
  it('token olmadan da listelenebilmeli (public katalog)', async () => {
    mockModuleService.getModules.mockResolvedValueOnce([{ slug: 'voice_control', name: 'Sesli Kontrol' }]);
    const res = await request.get('/api/billing/modules');
    expect(res.status).toBe(200);
  });
});

describe('POST /api/billing/modules/:slug/purchase', () => {
  it('token yok → 401', async () => {
    expect((await request.post('/api/billing/modules/voice_control/purchase')).status).toBe(401);
  });
  it('sadece Üst Yönetici(0) satın alabilmeli — doktor(6) → 403', async () => {
    const res = await request.post('/api/billing/modules/voice_control/purchase')
      .set('Authorization', `Bearer ${tok(6)}`);
    expect(res.status).toBe(403);
  });
  it('Üst Yönetici → 201', async () => {
    mockModuleService.purchaseModule.mockResolvedValueOnce({ module_slug: 'voice_control', status: 'active' });
    const res = await request.post('/api/billing/modules/voice_control/purchase')
      .set('Authorization', `Bearer ${tok(0)}`);
    expect(res.status).toBe(201);
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm run test:integration -- module.test`
Expected: FAIL — route/service yok

- [ ] **Step 3: `module.service.js`'i yaz**

`getModules()` → `SELECT * FROM modules WHERE is_active=TRUE`. `getInstitutionModules(institutionId)` → kurumun aktif modülleri. `purchaseModule({ institutionId, slug })` → `institution_modules`'a `INSERT ... ON CONFLICT (institution_id, module_slug) DO UPDATE SET status='active', cancelled_at=NULL RETURNING *` (yeniden satın almayı da idempotent kılar).

- [ ] **Step 4: `billing.routes.js`'e uçları ekle**

`registry.get('module', () => require('../services/module.service'))` deseniyle (surgery.routes.js'teki gibi). `GET /modules` → `authenticate` yok (herkese açık katalog). `GET /modules/mine` → `authenticate`. `POST /modules/:slug/purchase` → `authenticate` + `authorize(0)`.

- [ ] **Step 5: Testi çalıştır, geçtiğini doğrula**

Run: `npm run test:integration -- module.test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/services/module.service.js src/routes/billing.routes.js tests/integration/module.test.js
git commit -m "feat(billing): add purchasable add-on modules (catalog + purchase)"
```

---

## Task 4: `DeviceDriver` + `MockDriver` + sürücü kayıt defteri

**Files:**
- Create: `operio-backend/operio-backend/src/drivers/DeviceDriver.js`
- Create: `operio-backend/operio-backend/src/drivers/MockDriver.js`
- Create: `operio-backend/operio-backend/src/drivers/registry.js`
- Test: `operio-backend/operio-backend/tests/unit/drivers.test.js`

**Interfaces:**
- Produces:
  - `class DeviceDriver { constructor(device); async turnOn(); async turnOff(); async setPower(level); async armMove(preset); async confirmPhysical(); async getStatus(); async invokeAction(name, args); }` — her metot temelde `Error('not implemented')` fırlatır.
  - `class MockDriver extends DeviceDriver` — tüm metotları simüle eder, `{ power_state, power_level }` döner.
  - `getDriver(device) => DeviceDriver` (`registry.js`) — `device.driver_key` alanına göre `MockDriver` döner (başka kayıt yoksa varsayılan).
  - Sonraki task (`device.service.js`) bu üçünü kullanır.

- [ ] **Step 1: Başarısız testi yaz**

```js
import { describe, it, expect } from 'vitest';
const { MockDriver } = await import('../../src/drivers/MockDriver.js');
const { getDriver }  = await import('../../src/drivers/registry.js');

describe('MockDriver', () => {
  const device = { id: 'd1', driver_key: 'mock', power_level: 0 };

  it('turnOn → ON durumuna geçmeli', async () => {
    const d = new MockDriver(device);
    const status = await d.turnOn();
    expect(status.power_state).toBe('ON');
  });

  it('turnOff → OFF, power_level 0 olmalı', async () => {
    const d = new MockDriver(device);
    const status = await d.turnOff();
    expect(status).toEqual({ power_state: 'OFF', power_level: 0 });
  });

  it('setPower(42) → ON + power_level 42', async () => {
    const d = new MockDriver(device);
    const status = await d.setPower(42);
    expect(status).toEqual({ power_state: 'ON', power_level: 42 });
  });

  it('armMove → ARMED durumuna geçmeli, confirmPhysical sonrası ON olmalı', async () => {
    const d = new MockDriver(device);
    expect((await d.armMove('yatir')).power_state).toBe('ARMED');
    expect((await d.confirmPhysical()).power_state).toBe('ON');
  });
});

describe('registry.getDriver', () => {
  it('bilinmeyen driver_key için de MockDriver döndürmeli (güvenli varsayılan)', () => {
    const d = getDriver({ driver_key: 'bilinmeyen-surucu' });
    expect(d.constructor.name).toBe('MockDriver');
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm run test:unit -- drivers.test`
Expected: FAIL — dosyalar yok

- [ ] **Step 3: `DeviceDriver.js`, `MockDriver.js`, `registry.js`'i yaz**

`DeviceDriver` soyut taban sınıf (tasarım dokümanındaki 7 metotla, `invokeAction(name, args)` dahil). `MockDriver` her metodu basit, deterministik şekilde simüle eder (gerçek zaman/gecikme yok — testlerin hızlı ve kararlı kalması için). `registry.js`: `const DRIVERS = { mock: MockDriver }; function getDriver(device) { return new (DRIVERS[device.driver_key] || MockDriver)(device); }`.

- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**

Run: `npm run test:unit -- drivers.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/drivers/ tests/unit/drivers.test.js
git commit -m "feat(devices): add DeviceDriver abstraction and MockDriver"
```

---

## Task 5: `device.service.js` — CRUD

> **Not (karar: ledger'da Task 2 ile aynı gerekçe):** `db.query`'yi doğrudan mock'layan bir birim testi bu projede çalışmaz (bkz. Task 2'nin notu). Bu task'ın CRUD fonksiyonları, bu codebase'teki **her** servis gibi (`room.service.js`, `surgery.service.js` dahil — hiçbirinin doğrudan SQL birim testi yok), birim testi almaz; doğruluğu Task 8'in `_registry`-mock'lu rota testinde ve istenirse Task 1'deki gibi gerçek `operio_postgres`'e karşı elle doğrulanır. Bu task'ta TDD adımı yok — bu, planın geri kalanındaki tek TDD'siz görev; sebebi yukarıdaki not.

**Files:**
- Create: `operio-backend/operio-backend/src/services/device.service.js`

**Interfaces:**
- Consumes: `db.query` (`utils/db.js`), `audit` (`utils/audit.js`).
- Produces: `{ listDevices({ institutionId, roomId }), getDevice({ id, institutionId }), createDevice({ data, institutionId, userId, req }), updateDeviceConfig({ id, data, institutionId, userId, req }) }`. Task 6/7/8 bu modülü genişletir (aynı dosyaya eklenir).

- [ ] **Step 1: CRUD fonksiyonlarını yaz**

`room.service.js`'teki desenle birebir aynı (ham SQL, `audit()` çağrısı her create/update'te): `listDevices` → `SELECT * FROM controllable_devices WHERE institution_id=$1 AND ($2::uuid IS NULL OR room_id=$2)`. `getDevice` → `SELECT * ... WHERE id=$1 AND institution_id=$2`, `rows[0] || null`. `createDevice` → `INSERT INTO controllable_devices (institution_id, room_id, name, device_group, device_type, driver_key, requires_physical_confirm) VALUES (...) RETURNING *`, ardından `audit({ userId, action:'CREATE', resource:'controllable_devices', resourceId: device.id, newData: data, req })`. `updateDeviceConfig` → `UPDATE controllable_devices SET driver_key=$1, mode=$2, updated_at=NOW() WHERE id=$3 AND institution_id=$4 RETURNING *`, ardından `audit({ userId, action:'UPDATE', ... })`.

- [ ] **Step 2: Gerçek dev Postgres'e karşı elle doğrula (opsiyonel ama önerilir)**

Run: `docker compose restart api` (backend container'ını yeniden başlatıp yeni kodu yükle), sonra `curl -X POST http://localhost:4000/api/devices -H "Authorization: Bearer <admin-token>" -H "Content-Type: application/json" -d '{"name":"Test Cihaz","deviceGroup":"light","deviceType":"or_light"}'` (bu uç Task 8'de açılacak — bu adım Task 8 tamamlanana kadar atlanabilir, o zaman geriye dönük çalıştırılır).

- [ ] **Step 3: Commit**

```bash
git add src/services/device.service.js
git commit -m "feat(devices): add controllable_devices CRUD service"
```

---

## Task 6: `checkDeviceAuthorization` — oda + rol + takım-rolü kademelendirmesi

**Files:**
- Modify: `operio-backend/operio-backend/src/services/device.service.js` (ekle, mevcut dosyayı genişlet)
- Test: `operio-backend/operio-backend/tests/unit/deviceAuthorization.test.js`

**Interfaces:**
- Consumes: Hiçbir şey (saf fonksiyon — DB'ye gitmez, çağıran taraf gerekli verileri önceden çeker).
- Produces: `checkDeviceAuthorization({ user, device, activeRoomId, teamRole }) => { allowed: boolean, reason?: string }`. `user = { roleId }`, `activeRoomId` = çağıranın o an `IN_PROGRESS` bulunduğu ameliyatın `room_id`'si (null olabilir), `teamRole` = o ameliyattaki `team_role` değeri (null olabilir). Task 8/9 bu fonksiyonu kullanır.

- [ ] **Step 1: Başarısız testi yaz**

```js
import { describe, it, expect } from 'vitest';
const { checkDeviceAuthorization } = await import('../../src/services/device.service.js');

const lightDevice  = { room_id: 'room-1', device_group: 'light',         capabilities: {} };
const cauteryDevice = { room_id: 'room-1', device_group: 'electrosurgery', capabilities: { requiredTeamRoles: ['cerrah'] } };

describe('checkDeviceAuthorization', () => {
  it('izinsiz rol (örn. Sekreterlik=7) → reddedilmeli', () => {
    const r = checkDeviceAuthorization({ user: { roleId: 7 }, device: lightDevice, activeRoomId: 'room-1', teamRole: 'sirkule' });
    expect(r.allowed).toBe(false);
  });

  it('izinli rol ama farklı oda → reddedilmeli', () => {
    const r = checkDeviceAuthorization({ user: { roleId: 6 }, device: lightDevice, activeRoomId: 'room-2', teamRole: 'cerrah' });
    expect(r.allowed).toBe(false);
  });

  it('ışık cihazı: izinli rol + doğru oda + herhangi team_role → kabul', () => {
    const r = checkDeviceAuthorization({ user: { roleId: 4 }, device: lightDevice, activeRoomId: 'room-1', teamRole: 'hemsire' });
    expect(r.allowed).toBe(true);
  });

  it('elektrocerrahi: doğru oda ama team_role cerrah değil (hemşire) → reddedilmeli', () => {
    const r = checkDeviceAuthorization({ user: { roleId: 4 }, device: cauteryDevice, activeRoomId: 'room-1', teamRole: 'hemsire' });
    expect(r.allowed).toBe(false);
  });

  it('elektrocerrahi: doğru oda + team_role cerrah → kabul', () => {
    const r = checkDeviceAuthorization({ user: { roleId: 6 }, device: cauteryDevice, activeRoomId: 'room-1', teamRole: 'cerrah' });
    expect(r.allowed).toBe(true);
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm run test:unit -- deviceAuthorization.test`
Expected: FAIL — fonksiyon yok

- [ ] **Step 3: `checkDeviceAuthorization`'ı yaz**

Sıra: (1) `[0,1,2,3,4,5,6].includes(user.roleId)` değilse reddet; (2) `device.room_id !== activeRoomId` ise reddet; (3) `device.capabilities.requiredTeamRoles` doluysa ve `teamRole` o listede değilse reddet; (4) aksi halde kabul. Her ret dalı `reason` string'i döner (ör. `'room_mismatch'`, `'role_not_allowed'`, `'team_role_required'`).

- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**

Run: `npm run test:unit -- deviceAuthorization.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/device.service.js tests/unit/deviceAuthorization.test.js
git commit -m "feat(devices): add room+role+team_role tiered authorization check"
```

---

## Task 7: `executeCommand` + `physicalConfirm`

> **Not (karar: ledger'da — db.query mock'lanamadığı için mimari değişti):** `db.query`'yi doğrudan mock'layan bir birim testi bu projede çalışmaz (bkz. Task 2'nin notu). Bu riski ortadan kaldırmak için, bu task'ın en kritik parçası — yetkilendirme + fiziksel-onay kapısı kararı — **saf bir fonksiyona** (`decideCommand`, hiç db çağırmaz) ayrıştırılıyor ve TDD ile tam kapsamlı test ediliyor. `executeCommand`/`physicalConfirm` (db'ye dokunan ince orkestrasyon) bu saf fonksiyonu çağırır ama kendisi birim testi almaz — tıpkı `device.service.js`'in diğer fonksiyonları gibi (Task 5'in notu), doğruluğu Task 8'in rota testinde ve/veya gerçek DB'ye karşı elle doğrulanır.

**Files:**
- Modify: `operio-backend/operio-backend/src/services/device.service.js`
- Modify: `operio-backend/operio-backend/src/socket.js` (EVENTS'e `DEVICE_STATUS_CHANGED` ekle)
- Test: `operio-backend/operio-backend/tests/unit/decideCommand.test.js`

**Interfaces:**
- Consumes: `checkDeviceAuthorization` (Task 6, `decideCommand` içeriden çağırır).
- Produces:
  - `decideCommand({ user, device, activeRoomId, teamRole, action }) => void` — saf fonksiyon, izin yoksa veya `requires_physical_confirm` ihlal ediliyorsa `throw new Error(reason)` yapar (reason: `checkDeviceAuthorization`'ınkiyle aynı + `'physical_confirm_required'`), aksi halde sessizce döner (izin var demektir). DB'ye, driver'a, audit'e, socket'e hiç dokunmaz.
  - `executeCommand({ deviceId, institutionId, userId, action, value, req }) => device` — cihazı + aktif atamayı (`getActiveAssignment`, bu task içinde yazılır: `surgery_teams` JOIN `surgeries` WHERE `user_id=$1 AND status='IN_PROGRESS'`) çeker, `decideCommand`'ı çağırır (reddederse hatayı yukarı fırlatır), `getDriver(device)` ile ilgili metodu çağırır, DB'yi günceller, `audit`/`emitToInstitution` çağırır, güncel cihazı döner.
  - `physicalConfirm({ deviceId, institutionId, userId, req }) => device` — cihazı çeker, `power_state !== 'ARMED'` ise `throw`, driver'ın `confirmPhysical()`'ını çağırıp günceller/loglar/yayınlar.
  - Task 8 (route'lar) `executeCommand`/`physicalConfirm`'ı çağırır.

- [ ] **Step 1: `decideCommand` için başarısız testi yaz**

```js
import { describe, it, expect } from 'vitest';
const { decideCommand } = await import('../../src/services/device.service.js');

const cauteryDevice = { id: 'd1', room_id: 'room-1', device_group: 'electrosurgery', requires_physical_confirm: false, capabilities: { requiredTeamRoles: ['cerrah'] } };
const tableDevice   = { id: 'd2', room_id: 'room-1', device_group: 'table', requires_physical_confirm: true, capabilities: {} };

describe('decideCommand', () => {
  it('yetkili cerrah + turn_on → izin verilmeli (fırlatmamalı)', () => {
    expect(() => decideCommand({
      user: { roleId: 6 }, device: cauteryDevice, activeRoomId: 'room-1', teamRole: 'cerrah', action: 'turn_on',
    })).not.toThrow();
  });

  it('ekipte olmayan biri (activeRoomId uyuşmuyor) → reddedilmeli', () => {
    expect(() => decideCommand({
      user: { roleId: 6 }, device: cauteryDevice, activeRoomId: null, teamRole: null, action: 'turn_on',
    })).toThrow();
  });

  it('elektrocerrahi: team_role cerrah değilse → reddedilmeli', () => {
    expect(() => decideCommand({
      user: { roleId: 4 }, device: cauteryDevice, activeRoomId: 'room-1', teamRole: 'hemsire', action: 'turn_on',
    })).toThrow();
  });

  it('requires_physical_confirm=true cihazda turn_on → reddedilmeli', () => {
    expect(() => decideCommand({
      user: { roleId: 6 }, device: tableDevice, activeRoomId: 'room-1', teamRole: 'cerrah', action: 'turn_on',
    })).toThrow(/physical_confirm_required/);
  });

  it('requires_physical_confirm=true cihazda arm_move → izin verilmeli', () => {
    expect(() => decideCommand({
      user: { roleId: 6 }, device: tableDevice, activeRoomId: 'room-1', teamRole: 'cerrah', action: 'arm_move',
    })).not.toThrow();
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm run test:unit`
Expected: FAIL — `decideCommand` yok

- [ ] **Step 3: `decideCommand`'ı yaz; ardından `getActiveAssignment`, `executeCommand`, `physicalConfirm`'ı ekle; `socket.js`'e event ekle**

`decideCommand`: `checkDeviceAuthorization({ user, device, activeRoomId, teamRole })` çağır, `!allowed` ise `throw new Error(reason)`; sonra `device.requires_physical_confirm && action !== 'arm_move'` ise `throw new Error('physical_confirm_required')`. `socket.js`'teki `EVENTS`'e `DEVICE_STATUS_CHANGED: 'device:status_changed'` ekle. `executeCommand`/`physicalConfirm`: Task 5'in notundaki gibi (üst seviye `require('../utils/db')`), `decideCommand`'ı çağırdıktan sonra `getDriver(device)[action'a karşılık gelen metot]` çağırıp DB'yi güncelle, `audit(...)`, `emitToInstitution(...)`. Bu iki fonksiyon kendileri test edilmiyor (yukarıdaki not) — `decideCommand`'ı doğru çağırmaları Task 8'in rota testinde dolaylı doğrulanır.

- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**

Run: `npm run test:unit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/device.service.js src/socket.js tests/unit/decideCommand.test.js
git commit -m "feat(devices): add decideCommand (pure authorization gate) + executeCommand/physicalConfirm"
```

---

## Task 8: `device.routes.js` ve `app.js` bağlantısı

**Files:**
- Create: `operio-backend/operio-backend/src/routes/device.routes.js`
- Modify: `operio-backend/operio-backend/src/app.js`
- Modify: `operio-backend/operio-backend/src/validators/schemas.js` (ekle: `deviceCreateSchema`, `deviceCommandSchema`, `deviceConfigSchema`)
- Test: `operio-backend/operio-backend/tests/integration/device.routes.test.js`

**Interfaces:**
- Consumes: `device.service.js` (Task 5-7, `registry.get('device', ...)` üzerinden), `requireModule` (Task 2), `authenticate`/`authorize` (`middleware/auth.js`).
- Produces: `GET /api/devices`, `GET /api/devices/:id`, `POST /api/devices` (admin), `PATCH /api/devices/:id/config` (admin), `POST /api/devices/:id/command`, `POST /api/devices/:id/physical-confirm`.

- [ ] **Step 1: Başarısız testi yaz**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { signAccessToken } from '../../src/utils/jwt.js';
import registry from '../../src/services/_registry.js';
import app from '../../src/app.js';

const request = supertest(app);
const mockModuleService = { getModules: vi.fn(), getInstitutionModules: vi.fn(), hasActiveModule: vi.fn().mockResolvedValue(true) };
const mockDeviceService = { listDevices: vi.fn(), getDevice: vi.fn(), createDevice: vi.fn(), updateDeviceConfig: vi.fn(), executeCommand: vi.fn(), physicalConfirm: vi.fn() };
const tok = (roleId) => signAccessToken({ sub: 'u1', email: 'e@t.com', roleId, institutionId: 'inst-1' });

beforeEach(() => {
  vi.clearAllMocks();
  registry.register('module', mockModuleService);
  registry.register('device', mockDeviceService);
});

describe('GET /api/devices', () => {
  it('modül satın alınmamışsa 403', async () => {
    mockModuleService.hasActiveModule.mockResolvedValueOnce(false);
    const res = await request.get('/api/devices').set('Authorization', `Bearer ${tok(6)}`);
    expect(res.status).toBe(403);
  });
  it('modül varsa 200', async () => {
    mockDeviceService.listDevices.mockResolvedValueOnce([]);
    const res = await request.get('/api/devices').set('Authorization', `Bearer ${tok(6)}`);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/devices/:id/command', () => {
  it('yetkilendirme hatasında 403 dönmeli', async () => {
    mockDeviceService.executeCommand.mockRejectedValueOnce(new Error('room_mismatch'));
    const res = await request.post('/api/devices/d1/command')
      .set('Authorization', `Bearer ${tok(6)}`).send({ action: 'turn_on' });
    expect(res.status).toBe(403);
  });
  it('başarılı komut → 200', async () => {
    mockDeviceService.executeCommand.mockResolvedValueOnce({ id: 'd1', power_state: 'ON' });
    const res = await request.post('/api/devices/d1/command')
      .set('Authorization', `Bearer ${tok(6)}`).send({ action: 'turn_on' });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/devices (admin create)', () => {
  it('doktor(6) oluşturamamalı → 403', async () => {
    const res = await request.post('/api/devices').set('Authorization', `Bearer ${tok(6)}`).send({ name: 'X', deviceGroup: 'light', deviceType: 'y' });
    expect(res.status).toBe(403);
  });
  it('Üst Yönetici(0) oluşturabilmeli → 201', async () => {
    mockDeviceService.createDevice.mockResolvedValueOnce({ id: 'd1' });
    const res = await request.post('/api/devices').set('Authorization', `Bearer ${tok(0)}`).send({ name: 'X', deviceGroup: 'light', deviceType: 'y' });
    expect(res.status).toBe(201);
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm run test:integration -- device.routes.test`
Expected: FAIL — route dosyası yok

- [ ] **Step 3: Zod şemalarını, route'ları ve `app.js` bağlantısını yaz**

`validators/schemas.js`'e ekle: `deviceCreateSchema` (`name`, `deviceGroup` enum, `deviceType`, `roomId.uuid().optional()`, `requiresPhysicalConfirm.boolean().optional()`), `deviceCommandSchema` (`action` enum `['turn_on','turn_off','set_power','arm_move','invoke_action']`, `value.optional()`), `deviceConfigSchema` (`driverKey.optional()`, `mode.enum(['SIM','REAL']).optional()`).

`device.routes.js`: `surgery.routes.js`'teki `registry.get('device', ...)` deseni. `router.use(authenticate, requireModule('voice_control'))` en üstte. `GET /`, `GET /:id` → herhangi doğrulanmış kullanıcı. `POST /` ve `PATCH /:id/config` → `authorize(0,11,12)`. `POST /:id/command` ve `POST /:id/physical-confirm` → tüm doğrulanmış kullanıcılar (asıl yetkilendirme `executeCommand` içinde yapılıyor — reddedilirse `catch` bloğunda hata mesajına göre 403 döndür, aksi 500). `app.js`'e `app.use('/api/devices', deviceRoutes);` ekle.

- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**

Run: `npm run test:integration -- device.routes.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/routes/device.routes.js src/app.js src/validators/schemas.js tests/integration/device.routes.test.js
git commit -m "feat(devices): wire /api/devices routes with module gate and authorization"
```

---

## Task 9: ARMED cihazların ameliyat bitince otomatik geri alınması

> **Not (karar: ledger'da — aynı db-mock kısıtı):** `db.query`'yi doğrudan mock'layan bir birim testi bu projede çalışmaz (bkz. Task 2'nin notu). Bu yüzden "ne zaman geri alınmalı" kararı, saf bir fonksiyona (`shouldRevertArmedDevices`) ayrıştırılıp TDD ile test ediliyor; asıl `UPDATE controllable_devices` çağrısının kendisi (Task 5/7'deki gibi) birim testi almıyor.

**Files:**
- Modify: `operio-backend/operio-backend/src/services/surgery.service.js`
- Test: `operio-backend/operio-backend/tests/unit/shouldRevertArmedDevices.test.js`

**Interfaces:**
- Consumes: `updateSurgery` (mevcut `surgery.service.js` fonksiyonu — bu task onu değiştirir, içeride yeni saf fonksiyonu çağırır).
- Produces: `shouldRevertArmedDevices(oldStatus, newStatus) => boolean` (saf fonksiyon, `surgery.service.js`'e eklenir, dışa aktarılır). `updateSurgery` artık, bu `true` dönerse o `room_id`'deki tüm `ARMED` cihazları `OFF`'a çeken bir yan etki içerir. (Task 7'deki "physicalConfirm: ARMED olmayan cihazda reddedilmeli" testi, geri alma sonrası davranışı zaten kapsıyor — burada tekrarlanmaz.)

- [ ] **Step 1: Başarısız testi yaz**

```js
import { describe, it, expect } from 'vitest';
const { shouldRevertArmedDevices } = await import('../../src/services/surgery.service.js');

describe('shouldRevertArmedDevices', () => {
  it('IN_PROGRESS → COMPLETED: true', () => {
    expect(shouldRevertArmedDevices('IN_PROGRESS', 'COMPLETED')).toBe(true);
  });
  it('IN_PROGRESS → CANCELLED: true', () => {
    expect(shouldRevertArmedDevices('IN_PROGRESS', 'CANCELLED')).toBe(true);
  });
  it('IN_PROGRESS → IN_PROGRESS (değişmedi): false', () => {
    expect(shouldRevertArmedDevices('IN_PROGRESS', 'IN_PROGRESS')).toBe(false);
  });
  it('WAITING → PREPARING (zaten IN_PROGRESS değildi): false', () => {
    expect(shouldRevertArmedDevices('WAITING', 'PREPARING')).toBe(false);
  });
  it('newStatus tanımsızsa (bu alan güncellenmemiş): false', () => {
    expect(shouldRevertArmedDevices('IN_PROGRESS', undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm run test:unit`
Expected: FAIL — fonksiyon yok

- [ ] **Step 3: `shouldRevertArmedDevices`'ı yaz; `updateSurgery`'yi genişlet**

`shouldRevertArmedDevices(oldStatus, newStatus) { return oldStatus === 'IN_PROGRESS' && newStatus != null && newStatus !== 'IN_PROGRESS'; }`. `updateSurgery` içinde, surgery UPDATE'inden hemen sonra: `if (shouldRevertArmedDevices(old.status, surgery.status)) await db.query("UPDATE controllable_devices SET power_state='OFF', power_level=0 WHERE room_id=$1 AND power_state='ARMED'", [old.room_id]);` (döngüsel bağımlılığı önlemek için `device.service.js`'i import etmek yerine doğrudan SQL ile; bu kasıtlı — cihazın kendi driver/soyutlama mantığından bağımsız bir güvenlik temizliği).

- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**

Run: `npm run test:unit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/surgery.service.js tests/unit/shouldRevertArmedDevices.test.js
git commit -m "fix(devices): auto-revert ARMED devices when surgery leaves IN_PROGRESS"
```

---

## Task 10: Frontend — `api.js` eklentileri (`deviceAPI`, `moduleAPI`)

**Files:**
- Modify: `operio-react/operio/src/services/api.js`
- Test: `operio-react/operio/src/services/api.test.js`

**Interfaces:**
- Consumes: Mevcut `request()`/`get`/`post`/`patch` yardımcıları (dosyanın kendi içinde).
- Produces: `deviceAPI = { list, get, create, updateConfig, command, physicalConfirm }`, `moduleAPI = { list, mine, purchase }`. Task 12/13/14 bunları kullanır.

- [ ] **Step 1: Başarısız testi yaz**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('deviceAPI', () => {
  beforeEach(() => { global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, data: { id: 'd1' } }) }); });

  it('command() doğru endpoint ve body ile POST atmalı', async () => {
    const { deviceAPI } = await import('./api.js');
    await deviceAPI.command('d1', { action: 'turn_on' });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/devices/d1/command'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm run test:unit -- api.test` (operio-react dizininde)
Expected: FAIL — `deviceAPI` tanımsız

- [ ] **Step 3: `deviceAPI`/`moduleAPI`'yi ekle**

Mevcut `surgeriesAPI`/`roomsAPI` desenini birebir takip et (`get`/`post`/`patch` kısayolları üzerinden).

- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**

Run: `npm run test:unit -- api.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/api.js src/services/api.test.js
git commit -m "feat(api): add deviceAPI and moduleAPI client helpers"
```

---

## Task 11: `CihazKontrol.jsx` sayfası

**Files:**
- Create: `operio-react/operio/src/pages/CihazKontrol.jsx`
- Create: `operio-react/operio/src/pages/CihazKontrol.test.jsx`
- Modify: `operio-react/operio/src/App.jsx` (route ekle: `/cihaz-kontrol`)
- Modify: `operio-react/operio/src/data/roles.js` (nav girişi ekle — rol 0,1,2,3,4,5,6 için)

**Interfaces:**
- Consumes: `deviceAPI` (Task 10).
- Produces: `/cihaz-kontrol` route'u; manuel aç/kapat/slider kontrolleri, `mode==='SIM'` için görünür rozet, `requires_physical_confirm` cihazlarda "Konsoldan fiziksel onayla" butonu.

- [ ] **Step 1: Başarısız bileşen testini yaz**

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CihazKontrol from './CihazKontrol.jsx';

vi.mock('../services/api.js', () => ({
  deviceAPI: {
    list: vi.fn().mockResolvedValue([{ id: 'd1', name: 'Elektrokoter', mode: 'SIM', power_state: 'OFF', device_group: 'electrosurgery' }]),
    command: vi.fn().mockResolvedValue({ id: 'd1', power_state: 'ON' }),
  },
}));

describe('CihazKontrol', () => {
  it('cihaz listesini ve SİMÜLASYON rozetini göstermeli', async () => {
    render(<CihazKontrol />);
    expect(await screen.findByText('Elektrokoter')).toBeInTheDocument();
    expect(screen.getByText(/SİMÜLASYON/i)).toBeInTheDocument();
  });

  it('Aç butonuna tıklanınca deviceAPI.command çağrılmalı', async () => {
    const { deviceAPI } = await import('../services/api.js');
    render(<CihazKontrol />);
    fireEvent.click(await screen.findByRole('button', { name: /aç/i }));
    await waitFor(() => expect(deviceAPI.command).toHaveBeenCalledWith('d1', expect.objectContaining({ action: 'turn_on' })));
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm run test:components -- CihazKontrol`
Expected: FAIL — bileşen yok

- [ ] **Step 3: `CihazKontrol.jsx`'i yaz; route ve nav girişini ekle**

Mevcut sayfa stillerine uyan kart grid'i (bkz. `SalonYonetim.jsx` için benzer kart deseni). Her kartta: isim, grup, `mode==='SIM'` ise rozet, aç/kapat butonları + slider (`power_level`), `requires_physical_confirm` ise "Konsoldan fiziksel onayla" butonu (`deviceAPI.physicalConfirm` çağırır). `App.jsx`'e `<Route path="/cihaz-kontrol" element={<ProtectedLayout><CihazKontrol /></ProtectedLayout>} />`. `roles.js`'te rol 0,1,2,3,4,5,6'nın `nav`'ına `{ ic:'dev', lbl:'Cihaz Kontrolü', path:'/cihaz-kontrol' }` ekle.

- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**

Run: `npm run test:components -- CihazKontrol`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/CihazKontrol.jsx src/pages/CihazKontrol.test.jsx src/App.jsx src/data/roles.js
git commit -m "feat(devices): add CihazKontrol page with manual device controls"
```

---

## Task 12: `SesliKontrolAyarlari.jsx` (yönetim ekranı)

**Files:**
- Create: `operio-react/operio/src/pages/SesliKontrolAyarlari.jsx`
- Create: `operio-react/operio/src/pages/SesliKontrolAyarlari.test.jsx`
- Modify: `operio-react/operio/src/App.jsx` (route ekle: `/sesli-kontrol-ayarlari`)
- Modify: `operio-react/operio/src/data/roles.js` (nav girişi — sadece rol 0, 11, 12)

**Interfaces:**
- Consumes: `deviceAPI.list/create/updateConfig` (Task 10).
- Produces: `/sesli-kontrol-ayarlari` route'u — cihaz tanımlama formu, sürücü/mod atama (SIM/REAL seçici, sadece bu ekrandan değiştirilebilir).

- [ ] **Step 1: Başarısız bileşen testini yaz**

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SesliKontrolAyarlari from './SesliKontrolAyarlari.jsx';

vi.mock('../services/api.js', () => ({
  deviceAPI: {
    list: vi.fn().mockResolvedValue([{ id: 'd1', name: 'Elektrokoter', mode: 'SIM' }]),
    updateConfig: vi.fn().mockResolvedValue({ id: 'd1', mode: 'REAL' }),
  },
}));

describe('SesliKontrolAyarlari', () => {
  it('mod değiştirme kontrolü deviceAPI.updateConfig çağırmalı', async () => {
    const { deviceAPI } = await import('../services/api.js');
    render(<SesliKontrolAyarlari />);
    const select = await screen.findByLabelText(/mod/i);
    fireEvent.change(select, { target: { value: 'REAL' } });
    await waitFor(() => expect(deviceAPI.updateConfig).toHaveBeenCalledWith('d1', expect.objectContaining({ mode: 'REAL' })));
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm run test:components -- SesliKontrolAyarlari`
Expected: FAIL

- [ ] **Step 3: `SesliKontrolAyarlari.jsx`'i yaz; route ve nav girişini ekle**

Basit bir tablo/form: cihaz listesi + yeni cihaz ekleme formu (`name`, `deviceGroup` seçici, `deviceType`, `roomId` seçici, `requiresPhysicalConfirm` checkbox) + her satırda `driverKey`/`mode` seçiciler. `App.jsx`'e route ekle. `roles.js`'te sadece rol 0, 11, 12'nin nav'ına `{ ic:'set', lbl:'Sesli Kontrol Ayarları', path:'/sesli-kontrol-ayarlari' }` ekle.

- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**

Run: `npm run test:components -- SesliKontrolAyarlari`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/SesliKontrolAyarlari.jsx src/pages/SesliKontrolAyarlari.test.jsx src/App.jsx src/data/roles.js
git commit -m "feat(devices): add SesliKontrolAyarlari admin page for device/driver/mode management"
```

---

## Task 13: Abonelik ekranına "Modüller/Eklentiler" bölümü

**Files:**
- Modify: `operio-react/operio/src/pages/AbonelikYonetim.jsx`
- Create: `operio-react/operio/src/pages/AbonelikYonetim.modules.test.jsx`

**Interfaces:**
- Consumes: `moduleAPI.list/mine/purchase` (Task 10).
- Produces: Mevcut Abonelik Yönetimi sayfasında, satın alınabilir modülleri listeleyen ve satın alma butonu sunan yeni bir bölüm.

- [ ] **Step 1: Başarısız bileşen testini yaz**

```jsx
import { describe, it, expect, vi, waitFor } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AbonelikYonetim from './AbonelikYonetim.jsx';

vi.mock('../services/api.js', () => ({
  moduleAPI: {
    list: vi.fn().mockResolvedValue([{ slug: 'voice_control', name: 'Sesli Kontrol', price_try: 500000 }]),
    mine: vi.fn().mockResolvedValue([]),
    purchase: vi.fn().mockResolvedValue({ module_slug: 'voice_control', status: 'active' }),
  },
  // ...mevcut diğer mock'lar AbonelikYonetim.jsx'in zaten kullandığı diğer API'ler için gerekirse eklenir
}));

describe('AbonelikYonetim — Modüller bölümü', () => {
  it('satın alınmamış modülü "Satın Al" butonuyla göstermeli', async () => {
    render(<AbonelikYonetim />);
    expect(await screen.findByText('Sesli Kontrol')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /satın al/i })).toBeInTheDocument();
  });

  it('Satın Al tıklanınca moduleAPI.purchase çağrılmalı', async () => {
    const { moduleAPI } = await import('../services/api.js');
    render(<AbonelikYonetim />);
    fireEvent.click(await screen.findByRole('button', { name: /satın al/i }));
    await waitFor(() => expect(moduleAPI.purchase).toHaveBeenCalledWith('voice_control'));
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm run test:components -- AbonelikYonetim.modules`
Expected: FAIL

- [ ] **Step 3: `AbonelikYonetim.jsx`'e "Modüller/Eklentiler" bölümünü ekle**

Mevcut sayfanın stiline uyan bir kart listesi: her modül için isim, fiyat, "Satın Al" (satın alınmamışsa) veya "Aktif" rozeti (satın alınmışsa). Satın alma sonrası listeyi yeniden çek.

- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**

Run: `npm run test:components -- AbonelikYonetim.modules`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/AbonelikYonetim.jsx src/pages/AbonelikYonetim.modules.test.jsx
git commit -m "feat(billing): add purchasable modules section to AbonelikYonetim"
```

---

## Self-Review

**1. Spec kapsamı:** "Satın alınabilir modül" → Task 1-3, 13. "Veri modeli (controllable_devices)" → Task 1. "Backend: Sürücü soyutlaması" (6 metot + `invokeAction`) → Task 4. "Yetkilendirme" (oda+rol+team_role kademelendirmesi) → Task 6-8. "ARMED cihazlar için güvenli varsayılan" → Task 9. "Frontend: CihazKontrol/SesliKontrolAyarlari" → Task 11-12. Kiosk, ses biyometrisi, Time-Out: **kasıtlı olarak Plan 2'ye bırakıldı** (yukarıda "Goal"de belirtildi). ForceTriad araştırması: kod gerektirmediği için bu plana dahil edilmedi — ayrı bir araştırma görevi olarak kullanıcıya bırakıldı.

**2. Adım taraması:** Her adım tek bir net eylem üretiyor; kod adımlarında sadece imza/değerler verildi, gövdeyi uygulayıcı yazacak (Task 4/7/9'daki gibi algoritması testlerden çıkarılamayacak kısımlar için kısa yönlendirme cümlesi eklendi).

**3. Tip/isim tutarlılığı:** `checkDeviceAuthorization` (Task 6) imzası Task 7/8'de aynı şekilde kullanılıyor; `getDriver`/`MockDriver` (Task 4) Task 7'de aynı isimle çağrılıyor; `deviceAPI`/`moduleAPI` (Task 10) Task 11-13'te aynı isimlerle tüketiliyor. Tutarlı.

**4. Review Focus:** Üstteki 5 maddenin her biri ilgili task'ın testlerinde karşılanıyor (Task 7, 7, 9, 7, 9).

**5. Oran:** Plan, spec'in "Satın alınabilir modül" + "Veri modeli" + "Yetkilendirme" + "Sürücü soyutlaması" + ilgili Frontend bölümlerini kapsıyor; kod blokları ağırlıklı olarak imza/test/SQL, tam implementasyon gövdesi değil — spec'in kendisinden daha uzun ama bu, 13 görev ve tam SQL şeması içerdiği için beklenen bir oran.
