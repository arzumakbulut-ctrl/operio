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

**Files:**
- Modify: `operio-backend/operio-backend/migrations/001_init.sql` (sona ekle)
- Test: `operio-backend/operio-backend/tests/integration/schema.devicemodule.test.js`

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

- [ ] **Step 2: Test veritabanına migration'ı uygula ve tabloların/kısıtların varlığını doğrula**

```js
import { describe, it, expect, beforeAll } from 'vitest';
import db from '../../src/utils/db.js';

describe('Schema — modules/institution_modules/controllable_devices', () => {
  it('üç tablo da information_schema\'da görünmeli', async () => {
    const { rows } = await db.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_name IN ('modules','institution_modules','controllable_devices')`
    );
    expect(rows.map(r => r.table_name).sort())
      .toEqual(['controllable_devices','institution_modules','modules']);
  });

  it('institution_modules (institution_id, module_slug) üzerinde UNIQUE olmalı', async () => {
    const { rows } = await db.query(
      `SELECT conname FROM pg_constraint WHERE conrelid = 'institution_modules'::regclass AND contype='u'`
    );
    expect(rows.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Testi çalıştır ve geçtiğini doğrula**

Run: `npm run test:integration -- schema.devicemodule`
Expected: PASS (migration zaten `docker-compose`'un `psql -f migrations/001_init.sql` adımıyla test DB'sine uygulanmış olmalı — gerekirse önce `npm run docker:up` veya mevcut test DB bootstrap scriptini çalıştır)

- [ ] **Step 4: Commit**

```bash
git add migrations/001_init.sql tests/integration/schema.devicemodule.test.js
git commit -m "feat(db): add modules, institution_modules, controllable_devices tables"
```

---

## Task 2: `requireModule` middleware

**Files:**
- Create: `operio-backend/operio-backend/src/middleware/requireModule.js`
- Test: `operio-backend/operio-backend/tests/unit/requireModule.test.js`

**Interfaces:**
- Consumes: `req.user.institutionId` (authenticate middleware'den sonra dolu), `db.query` (`src/utils/db.js`).
- Produces: `requireModule(slug: string) => (req, res, next) => void`. Sonraki task'larda `device.routes.js` tarafından `authenticate` sonrası kullanılır.

- [ ] **Step 1: Başarısız testi yaz**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/utils/db.js', () => ({ default: { query: vi.fn() } }));
const db = (await import('../../src/utils/db.js')).default;
const { requireModule } = await import('../../src/middleware/requireModule.js');

describe('requireModule', () => {
  beforeEach(() => vi.clearAllMocks());

  it('kurum modülü almışsa next() çağırmalı', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ status: 'active' }] });
    const req = { user: { institutionId: 'inst-1' } };
    const next = vi.fn();
    await requireModule('voice_control')(req, {}, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('kurum modülü almamışsa 403 dönmeli', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
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

Run: `npm run test:unit -- requireModule`
Expected: FAIL — `src/middleware/requireModule.js` bulunamadı

- [ ] **Step 3: `requireModule(slug)` fonksiyonunu yaz**

`src/middleware/requireModule.js` — `src/middleware/auth.js`'teki `authorize()` ile aynı üslupta: `institution_modules`'ta `institution_id=$1 AND module_slug=$2 AND status='active'` sorgusu çalıştırır; satır yoksa `forbidden(res, 'Bu modül satın alınmamış')` (`utils/response.js`'ten), varsa `next()`.

- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**

Run: `npm run test:unit -- requireModule`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/middleware/requireModule.js tests/unit/requireModule.test.js
git commit -m "feat(auth): add requireModule entitlement middleware"
```

---

## Task 3: `module.service.js` ve satın alma uçları

**Files:**
- Create: `operio-backend/operio-backend/src/services/module.service.js`
- Modify: `operio-backend/operio-backend/src/routes/billing.routes.js`
- Test: `operio-backend/operio-backend/tests/integration/module.test.js`

**Interfaces:**
- Consumes: `db.query` (`utils/db.js`), `payment.provider.js`'teki mevcut `iyzico`/`stripe` yardımcıları (sadece referans olarak çağrılır — gerçek ödeme entegrasyonunun detayları builder'a bırakılmıştır, bu task sadece DB satırını oluşturur ve var olan sağlayıcı fonksiyonunu **çağırmadan** stub bir "purchased" kaydı açar; gerçek ödeme akışı mevcut `subscription.service.js`'teki desenle aynı şekilde ayrı bir iştir).
- Produces: `module.service.js` → `{ getModules, getInstitutionModules, purchaseModule({ institutionId, slug }) }`. `billing.routes.js`'e eklenen `GET /api/billing/modules`, `GET /api/billing/modules/mine`, `POST /api/billing/modules/:slug/purchase`.

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

**Files:**
- Create: `operio-backend/operio-backend/src/services/device.service.js`
- Test: `operio-backend/operio-backend/tests/integration/device.service.test.js`

**Interfaces:**
- Consumes: `db.query` (`utils/db.js`), `audit` (`utils/audit.js`).
- Produces: `{ listDevices({ institutionId, roomId }), getDevice({ id, institutionId }), createDevice({ data, institutionId, userId, req }), updateDeviceConfig({ id, data, institutionId, userId, req }) }`. Task 6/7/8 bu modülü genişletir (aynı dosyaya eklenir).

- [ ] **Step 1: Başarısız testi yaz**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import db from '../../src/utils/db.js';
const svc = await import('../../src/services/device.service.js');

describe('device.service — CRUD', () => {
  const institutionId = 'test-inst-device-crud';

  beforeEach(async () => {
    await db.query(`INSERT INTO institutions (id, name) VALUES ($1,'Test') ON CONFLICT (id) DO NOTHING`, [institutionId]);
  });

  it('createDevice sonrası getDevice aynı kaydı dönmeli', async () => {
    const created = await svc.createDevice({
      data: { name: 'Elektrokoter Test', deviceGroup: 'electrosurgery', deviceType: 'cautery' },
      institutionId, userId: 'u1', req: {},
    });
    const fetched = await svc.getDevice({ id: created.id, institutionId });
    expect(fetched.name).toBe('Elektrokoter Test');
    expect(fetched.mode).toBe('SIM');
  });

  it('updateDeviceConfig driver_key/mode güncelleyebilmeli', async () => {
    const created = await svc.createDevice({
      data: { name: 'Test2', deviceGroup: 'light', deviceType: 'or_light' },
      institutionId, userId: 'u1', req: {},
    });
    const updated = await svc.updateDeviceConfig({
      id: created.id, institutionId, userId: 'u1', req: {},
      data: { driverKey: 'mock', mode: 'SIM' },
    });
    expect(updated.driver_key).toBe('mock');
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm run test:integration -- device.service.test`
Expected: FAIL — `src/services/device.service.js` yok

- [ ] **Step 3: CRUD fonksiyonlarını yaz**

`room.service.js`'teki desenle aynı (ham SQL, `audit()` çağrısı her create/update'te). `createDevice`/`updateDeviceConfig` sonunda `audit({ userId, action:'CREATE'|'UPDATE', resource:'controllable_devices', resourceId, newData, req })`.

- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**

Run: `npm run test:integration -- device.service.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/device.service.js tests/integration/device.service.test.js
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

**Files:**
- Modify: `operio-backend/operio-backend/src/services/device.service.js`
- Modify: `operio-backend/operio-backend/src/socket.js` (EVENTS'e `DEVICE_STATUS_CHANGED` ekle)
- Test: `operio-backend/operio-backend/tests/integration/deviceCommand.test.js`

**Interfaces:**
- Consumes: `getDriver` (`drivers/registry.js`), `checkDeviceAuthorization` (Task 6), `audit`, `emitToInstitution`/`EVENTS` (`socket.js`), ayrıca aktif oda/ekip bilgisini çekmek için yeni bir yardımcı sorgu (bu task içinde yazılır): `getActiveAssignment({ userId, institutionId }) => { roomId, teamRole } | null` (kullanıcının o an `IN_PROGRESS` bir `surgery_teams` kaydı var mı).
- Produces: `executeCommand({ deviceId, institutionId, userId, action, value, req }) => device` (action: `'turn_on'|'turn_off'|'set_power'|'arm_move'|'invoke_action'`). `physicalConfirm({ deviceId, institutionId, userId, req }) => device`. Task 8 (route'lar) bunları çağırır.

- [ ] **Step 1: Başarısız testi yaz**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import db from '../../src/utils/db.js';
const svc = await import('../../src/services/device.service.js');

describe('device.service — executeCommand', () => {
  const institutionId = 'test-inst-cmd';
  let roomId, surgeryId, device;

  beforeEach(async () => {
    await db.query(`INSERT INTO institutions (id, name) VALUES ($1,'Test') ON CONFLICT (id) DO NOTHING`, [institutionId]);
    const room = await db.query(`INSERT INTO operating_rooms (institution_id, name, room_number) VALUES ($1,'Salon T',99) RETURNING id`, [institutionId]);
    roomId = room.rows[0].id;
    const surgery = await db.query(
      `INSERT INTO surgeries (institution_id, room_id, title, status) VALUES ($1,$2,'Test Op','IN_PROGRESS') RETURNING id`,
      [institutionId, roomId]
    );
    surgeryId = surgery.rows[0].id;
    await db.query(`INSERT INTO surgery_teams (surgery_id, user_id, team_role) VALUES ($1,$2,'cerrah')`, [surgeryId, 'user-cerrah']);
    device = await svc.createDevice({
      data: { name: 'Koter', deviceGroup: 'electrosurgery', deviceType: 'cautery', roomId },
      institutionId, userId: 'admin', req: {},
    });
  });

  it('yetkili cerrah → turn_on kabul edilmeli, power_state ON olmalı', async () => {
    const updated = await svc.executeCommand({
      deviceId: device.id, institutionId, userId: 'user-cerrah', action: 'turn_on', req: {},
    });
    expect(updated.power_state).toBe('ON');
  });

  it('ekipte olmayan biri → reddedilmeli (hata fırlatmalı)', async () => {
    await expect(svc.executeCommand({
      deviceId: device.id, institutionId, userId: 'user-yabanci', action: 'turn_on', req: {},
    })).rejects.toThrow();
  });

  it('requires_physical_confirm=true cihazda turn_on denenirse reddedilmeli, sadece arm_move kabul', async () => {
    const tableDevice = await svc.createDevice({
      data: { name: 'Masa', deviceGroup: 'table', deviceType: 'or_table', roomId, requiresPhysicalConfirm: true },
      institutionId, userId: 'admin', req: {},
    });
    await expect(svc.executeCommand({
      deviceId: tableDevice.id, institutionId, userId: 'user-cerrah', action: 'turn_on', req: {},
    })).rejects.toThrow();

    const armed = await svc.executeCommand({
      deviceId: tableDevice.id, institutionId, userId: 'user-cerrah', action: 'arm_move', value: 'yatir', req: {},
    });
    expect(armed.power_state).toBe('ARMED');

    const confirmed = await svc.physicalConfirm({ deviceId: tableDevice.id, institutionId, userId: 'user-cerrah', req: {} });
    expect(confirmed.power_state).toBe('ON');
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm run test:integration -- deviceCommand.test`
Expected: FAIL

- [ ] **Step 3: `getActiveAssignment`, `executeCommand`, `physicalConfirm`'ı yaz; `socket.js`'e event ekle**

`socket.js`'teki `EVENTS` nesnesine `DEVICE_STATUS_CHANGED: 'device:status_changed'` ekle. `executeCommand`: cihazı çek → `getActiveAssignment` ile oda/takım-rolünü çek → `checkDeviceAuthorization` çağır, reddedilirse `throw` (mesajda `reason`) → `requires_physical_confirm && action !== 'arm_move'` ise reddet → `getDriver(device)` ile ilgili metodu çağır → DB'de `power_state`/`power_level` güncelle → `audit({ action:'device:command', resource:'controllable_devices', resourceId: deviceId, newData:{ action, value, driverKey: device.driver_key } })` → `emitToInstitution(institutionId, EVENTS.DEVICE_STATUS_CHANGED, { device })` → güncel cihazı döndür. `physicalConfirm`: cihaz `ARMED` değilse `throw`; driver'ın `confirmPhysical()`'ını çağır, aynı şekilde güncelle/logla/yayınla.

- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**

Run: `npm run test:integration -- deviceCommand.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/device.service.js src/socket.js tests/integration/deviceCommand.test.js
git commit -m "feat(devices): add executeCommand/physicalConfirm with room+role+team authorization"
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
const mockModuleService = { getModules: vi.fn(), getInstitutionModules: vi.fn().mockResolvedValue([{ module_slug: 'voice_control', status: 'active' }]) };
const mockDeviceService = { listDevices: vi.fn(), getDevice: vi.fn(), createDevice: vi.fn(), updateDeviceConfig: vi.fn(), executeCommand: vi.fn(), physicalConfirm: vi.fn() };
const tok = (roleId) => signAccessToken({ sub: 'u1', email: 'e@t.com', roleId, institutionId: 'inst-1' });

beforeEach(() => {
  vi.clearAllMocks();
  registry.register('module', mockModuleService);
  registry.register('device', mockDeviceService);
});

describe('GET /api/devices', () => {
  it('modül satın alınmamışsa 403', async () => {
    mockModuleService.getInstitutionModules.mockResolvedValueOnce([]);
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

**Files:**
- Modify: `operio-backend/operio-backend/src/services/surgery.service.js`
- Test: `operio-backend/operio-backend/tests/integration/armedRevert.test.js`

**Interfaces:**
- Consumes: `updateSurgery` (mevcut `surgery.service.js` fonksiyonu — bu task onu değiştirir).
- Produces: `updateSurgery` artık, `status` `IN_PROGRESS`'ten başka bir şeye değişirse, o `room_id`'deki tüm `ARMED` cihazları `OFF`'a çeken bir yan etki içerir (yeni bir dışa açık fonksiyon gerekmez — mevcut fonksiyonun davranışı genişler).

- [ ] **Step 1: Başarısız testi yaz**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import db from '../../src/utils/db.js';
const surgerySvc = await import('../../src/services/surgery.service.js');
const deviceSvc  = await import('../../src/services/device.service.js');

describe('ARMED cihaz otomatik geri alma', () => {
  const institutionId = 'test-inst-armed';
  let roomId, surgeryId, tableDevice;

  beforeEach(async () => {
    await db.query(`INSERT INTO institutions (id, name) VALUES ($1,'Test') ON CONFLICT (id) DO NOTHING`, [institutionId]);
    const room = await db.query(`INSERT INTO operating_rooms (institution_id, name, room_number) VALUES ($1,'Salon A',98) RETURNING id`, [institutionId]);
    roomId = room.rows[0].id;
    const surgery = await db.query(`INSERT INTO surgeries (institution_id, room_id, title, status) VALUES ($1,$2,'Op','IN_PROGRESS') RETURNING id`, [institutionId, roomId]);
    surgeryId = surgery.rows[0].id;
    await db.query(`INSERT INTO surgery_teams (surgery_id, user_id, team_role) VALUES ($1,'user-cerrah','cerrah')`, [surgeryId]);
    tableDevice = await deviceSvc.createDevice({
      data: { name: 'Masa', deviceGroup: 'table', deviceType: 'or_table', roomId, requiresPhysicalConfirm: true },
      institutionId, userId: 'admin', req: {},
    });
    await deviceSvc.executeCommand({ deviceId: tableDevice.id, institutionId, userId: 'user-cerrah', action: 'arm_move', value: 'yatir', req: {} });
  });

  it('ameliyat COMPLETED olunca ARMED cihaz otomatik OFF olmalı', async () => {
    await surgerySvc.updateSurgery({ id: surgeryId, data: { status: 'COMPLETED' }, institutionId, userId: 'user-cerrah', req: {} });
    const device = await deviceSvc.getDevice({ id: tableDevice.id, institutionId });
    expect(device.power_state).toBe('OFF');
  });

  it('bu noktadan sonra physical-confirm çağrısı reddedilmeli', async () => {
    await surgerySvc.updateSurgery({ id: surgeryId, data: { status: 'COMPLETED' }, institutionId, userId: 'user-cerrah', req: {} });
    await expect(deviceSvc.physicalConfirm({ deviceId: tableDevice.id, institutionId, userId: 'user-cerrah', req: {} }))
      .rejects.toThrow();
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `npm run test:integration -- armedRevert.test`
Expected: FAIL

- [ ] **Step 3: `surgery.service.js`'teki `updateSurgery`'yi genişlet**

`status` eski değerden `'IN_PROGRESS'` idi ve yeni değer `'IN_PROGRESS'` değilse: `UPDATE controllable_devices SET power_state='OFF', power_level=0 WHERE room_id=$1 AND power_state='ARMED'` çalıştır (döngüsel bağımlılığı önlemek için `device.service.js`'i import etmek yerine doğrudan SQL ile; `device.service.js`'teki driver soyutlamasını atlamak burada kasıtlı — bu bir güvenlik temizliği, cihazın kendi "kapatma" mantığından bağımsız olmalı).

- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**

Run: `npm run test:integration -- armedRevert.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/surgery.service.js tests/integration/armedRevert.test.js
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
