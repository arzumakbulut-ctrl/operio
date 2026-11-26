# Operio Voice — Kurucuya Özel Karşılama (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kiosk'ta "Operio" wake-word'üyle konuşan kişi, gerçek Speaker-ID ile sistemin kurucusu/tasarımcısı olarak tanınırsa (herhangi bir kurum, aktif ameliyat olan oda), normal komut/NLU akışına hiç girmeden sabit bir karşılama havuzundan rastgele bir cümleyle yanıtlanır.

**Architecture:** Mevcut `kiosk.routes.js`'in `UNKNOWN` dalına (komut/spotify/arama/time-out'a ayrışmayan serbest konuşma), `kioskSpeakerAuth` middleware'inin BLOKLAYICI (403 fırlatan) semantiğini hiç kullanmayan, kendi içinde hataları yutan, best-effort bir "bu konuşan tasarımcı mı?" kontrolü eklenir. Eşleşirse NLU'ya hiç girilmeden sabit bir karşılama döner; eşleşmezse (ya da kontrol herhangi bir sebeple başarısız olursa) mevcut UNKNOWN davranışı DEĞİŞMEDEN devam eder. Tasarımcı hesabı (`role_id=0`, `institution_id=NULL`) bir kerelik bir provisioning script'iyle oluşturulur — git'e şifre hash'i YAZILMAZ.

**Tech Stack:** Node/Express, Vitest (mevcut altyapı — yeni bağımlılık yok).

**Spec:** `docs/superpowers/specs/2026-11-24-operio-voice-designer-greeting-design.md`

## Global Constraints

- "Operio" wake-word'ü ve frontend DEĞİŞMEZ — bu plan tamamen backend'dedir.
- Bu hesap üzerinden gerçek cihaz komutu VERİLEMEZ — kontrol SADECE `UNKNOWN` dalında çalışır, `DEVICE_COMMAND`/`SPOTIFY_PLAY`/`WEB_SEARCH`/`TIMEOUT`/onay dallarına HİÇ dokunulmaz.
- LLM tabanlı, hafızalı, çok-turlu sohbet YOK — sabit, önceden yazılmış 5 cümlelik bir havuzdan rastgele seçim.
- Kontrol SADECE `kiosk_mock_config.mode === 'real'` olan kurumlarda çalışır; demo/mock modlarında (örn. `always_match`) ASLA tetiklenmez — `MockSpeakerVerifier.identify`'ın `candidateUserIds[0]`'ı "always_match" modunda körlemesine eşleştirmesi, tek-elemanlı bir aday listesiyle (sadece tasarımcının id'si) çağrılırsa HER ZAMAN yanlış-pozitif üretir; bu yüzden mode kontrolü verifier'ı çağırmadan ÖNCE yapılır.
- Mevcut `kioskSpeakerAuth.js` middleware'i ve onun 403 `unrecognized`/`not_in_team` semantiği DEĞİŞMEZ.
- Yeni bir migration YOK — `migrations/001_init.sql` dosyasına dokunulmaz (tasarımcı hesabı normal bir `users` satırı; `institution_id` zaten nullable).
- Tasarımcı hesabının e-posta/şifresi KOD/GİT'E YAZILMAZ — provisioning script'i bunları ortam değişkenlerinden okur.
- `DESIGNER_USER_ID` ortam değişkeni ayarlanmamışsa (hesap henüz provision edilmemiş) sistem ESKİ davranışına sessizce devam eder — hiçbir hata, hiçbir regresyon.

## Review Focus

- Demo/mock-mode kurumlarda (`config.mode !== 'real'`) karşılama ASLA tetiklenmemeli, `always_match` modu dahil (yukarıdaki yanlış-pozitif riski) — Task 1 ve Task 2'de test edilir.
- `DESIGNER_USER_ID` hiç ayarlanmamışsa davranış tamamen eskisi gibi olmalı, `getMockConfig`/verifier'a hiç gidilmemeli — Task 1'de test edilir.
- Karşılama tetiklendiğinde `UNKNOWN_STREAK` artmamalı/sıfırlanmalı — ardından gelen GERÇEK bir anlaşılamayan konuşma yine 1. seviye mesajı almalı, 2. seviyeye atlamamalı — Task 2'de test edilir.
- `getMockConfig()` veya `verifier.identify()` beklenmedik şekilde hata fırlatırsa (örn. DB bağlantı sorunu) bu YUTULMALI, asla 500/crash üretilmemeli, normal UNKNOWN akışına sessizce devam edilmeli — Task 1'de test edilir.
- Tasarımcının sesi `DEVICE_COMMAND`/`SPOTIFY_PLAY`/`WEB_SEARCH`/`TIMEOUT`/onay dallarına denk gelirse bu değişiklik hiç devreye girmemeli (o dallar hiç dokunulmaz) — mevcut test paketinin tamamının (Task 2 sonunda) yeşil kalması bunu doğrular.

---

### Task 1: Karşılama havuzu + best-effort tanıma yardımcı modülü

**Files:**
- Create: `src/utils/designerGreeting.js`
- Modify: `.env.example` (DESIGNER_USER_ID satırı eklenir)
- Test: `tests/unit/designerGreeting.test.js`

**Interfaces:**
- Consumes: `getSpeakerVerifier(config)` (`src/middleware/kioskSpeakerAuth.js`, mevcut, değişmez — `config.mode==='real'` ise `RealSpeakerVerifier`, aksi halde `MockSpeakerVerifier` döner); `registry.get('kiosk', ...)` → `kiosk.service.getMockConfig(institutionId): Promise<{mode, cycleIndex?}>` (mevcut, değişmez).
- Produces: `GREETING_POOL: string[]` (5 eleman, aşağıda tam metinleriyle); `pickDesignerGreeting(): string`; `isDesignerSpeaking(req: {kiosk:{institutionId}, body:{audio}}): Promise<boolean>` — Task 2 bu üçünü kullanır.

- [ ] **Step 1: Write the failing tests**

`tests/unit/designerGreeting.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import registry from '../../src/services/_registry.js';

const require = createRequire(import.meta.url);
const { RealSpeakerVerifier } = require('../../src/drivers/RealSpeakerVerifier.js');
const { GREETING_POOL, pickDesignerGreeting, isDesignerSpeaking } =
  require('../../src/utils/designerGreeting.js');

const mockKioskService = { getMockConfig: vi.fn() };

function makeReq(overrides = {}) {
  return {
    kiosk: { institutionId: 'inst-1' },
    body: { audio: Buffer.from('mock-audio') },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  registry.register('kiosk', mockKioskService);
  delete process.env.DESIGNER_USER_ID;
});

afterEach(() => {
  delete process.env.DESIGNER_USER_ID;
});

describe('pickDesignerGreeting', () => {
  it('Math.random 0 ise GREETING_POOL[0] döner', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(pickDesignerGreeting()).toBe(GREETING_POOL[0]);
    spy.mockRestore();
  });

  it('Math.random 0.999 ise GREETING_POOL son elemanını döner', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.999);
    expect(pickDesignerGreeting()).toBe(GREETING_POOL[GREETING_POOL.length - 1]);
    spy.mockRestore();
  });

  it('GREETING_POOL en az 4 farklı cümle içerir (Anti-goal: "hep aynı" hissi)', () => {
    expect(new Set(GREETING_POOL).size).toBeGreaterThanOrEqual(4);
  });
});

describe('isDesignerSpeaking', () => {
  it('DESIGNER_USER_ID ayarlanmamışsa false döner, getMockConfig hiç çağrılmaz', async () => {
    const result = await isDesignerSpeaking(makeReq());
    expect(result).toBe(false);
    expect(mockKioskService.getMockConfig).not.toHaveBeenCalled();
  });

  it('audio yoksa false döner', async () => {
    process.env.DESIGNER_USER_ID = 'designer-1';
    const result = await isDesignerSpeaking(makeReq({ body: {} }));
    expect(result).toBe(false);
  });

  it('config.mode "real" DEĞİLSE (always_match dahil) false döner — identify() HİÇ çağrılmaz', async () => {
    process.env.DESIGNER_USER_ID = 'designer-1';
    mockKioskService.getMockConfig.mockResolvedValueOnce({ mode: 'always_match', cycleIndex: 0 });
    const spy = vi.spyOn(RealSpeakerVerifier.prototype, 'identify');

    const result = await isDesignerSpeaking(makeReq());

    expect(result).toBe(false);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('config.mode "real" ve identify() designer id ile eşleşirse true döner, identify tek adayla çağrılır', async () => {
    process.env.DESIGNER_USER_ID = 'designer-1';
    mockKioskService.getMockConfig.mockResolvedValueOnce({ mode: 'real' });
    const spy = vi
      .spyOn(RealSpeakerVerifier.prototype, 'identify')
      .mockResolvedValueOnce({ userId: 'designer-1', confidence: 0.9 });

    const result = await isDesignerSpeaking(makeReq());

    expect(result).toBe(true);
    expect(spy).toHaveBeenCalledWith(expect.anything(), ['designer-1'], { mode: 'real' });
    spy.mockRestore();
  });

  it('config.mode "real" ama identify() null dönerse (tanınamadı) false döner', async () => {
    process.env.DESIGNER_USER_ID = 'designer-1';
    mockKioskService.getMockConfig.mockResolvedValueOnce({ mode: 'real' });
    const spy = vi.spyOn(RealSpeakerVerifier.prototype, 'identify').mockResolvedValueOnce(null);

    const result = await isDesignerSpeaking(makeReq());

    expect(result).toBe(false);
    spy.mockRestore();
  });

  it('getMockConfig fırlatırsa false döner, hata yutulur (FIRLATMAZ)', async () => {
    process.env.DESIGNER_USER_ID = 'designer-1';
    mockKioskService.getMockConfig.mockRejectedValueOnce(new Error('DB down'));

    const result = await isDesignerSpeaking(makeReq());

    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/designerGreeting.test.js`
Expected: FAIL (`Cannot find module '../../src/utils/designerGreeting.js'`)

- [ ] **Step 3: Implement `src/utils/designerGreeting.js`**

Tam metinleriyle `GREETING_POOL` (sırayla, tasarım dokümanındaki taslak — değiştirilmeden):

```js
const GREETING_POOL = [
  'Merhaba patron, sana nasıl yardımcı olabilirim?',
  'Patron geldi! Bugün ne yapalım?',
  'Seni duymak güzel patron, her şey senin tasarladığın gibi işliyor.',
  'Merhaba patron. Böyle bir sistemi senin gibi birinin tasarlamış olması hiç şaşırtıcı değil.',
  'Hoş geldin patron, emrini bekliyorum.',
];
```

`pickDesignerGreeting()`: `GREETING_POOL[Math.floor(Math.random() * GREETING_POOL.length)]` döner.

`isDesignerSpeaking(req)`: `process.env.DESIGNER_USER_ID`'yi HER ÇAĞRIDA taze okur (modül yüklenirken ÖNBELLEĞE ALINMAZ — testlerin `process.env`'i çağrı-bazlı değiştirebilmesi için kasıtlı). Yoksa `false`. `req.body?.audio` yoksa `false`. Aksi halde `try/catch` içinde: `getKioskService().getMockConfig(req.kiosk.institutionId)` çağrılır; `config?.mode !== 'real'` ise `false` (verifier'a HİÇ gidilmez — Global Constraints'teki yanlış-pozitif riski). Aksi halde `getSpeakerVerifier(config)` ile sürücü alınır, `verifier.identify(audio, [designerUserId], config)` çağrılır, sonuç `result?.userId === designerUserId` ise `true`, aksi halde `false`. `catch` bloğunda `console.error('[designerGreeting] isDesignerSpeaking hatası:', err.message)` loglanır ve `false` döner (asla fırlatmaz).

`getKioskService` için `kiosk.routes.js`'teki AYNI registry deseni kullanılır: `const registry = require('../services/_registry'); const getKioskService = () => registry.get('kiosk', () => require('../services/kiosk.service'));`. `getSpeakerVerifier` için: `const { getSpeakerVerifier } = require('../middleware/kioskSpeakerAuth');`.

`module.exports = { GREETING_POOL, pickDesignerGreeting, isDesignerSpeaking };`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/unit/designerGreeting.test.js`
Expected: PASS (9 tests)

- [ ] **Step 5: `.env.example`'a belgeleme satırı ekle**

`SPEAKER_ID_TIMEOUT_MS` bloğundan sonra, uygun bir başlık altına:

```
# ─── TASARIMCI KARŞILAMASI (easter-egg) ─────────────────────
# Tasarımcının sesi gerçek Speaker-ID ile tanınınca (SADECE kiosk_mock_config.
# mode='real' olan kurumlarda) komut akışına girmeden sabit bir karşılama
# döner — bkz. docs/superpowers/specs/2026-11-24-operio-voice-designer-
# greeting-design.md. Boşsa özellik tamamen devre dışıdır.
# scripts/provision-designer-account.js'in bastığı id buraya yazılır.
DESIGNER_USER_ID=
```

- [ ] **Step 6: Commit**

```bash
git add src/utils/designerGreeting.js tests/unit/designerGreeting.test.js .env.example
git commit -m "feat(kiosk): add designer-greeting pool and best-effort speaker check"
```

---

### Task 2: UNKNOWN dalına kablolama

**Files:**
- Modify: `src/routes/kiosk.routes.js` (import + `UNKNOWN` dalı, satır ~453-459'daki mevcut blok)
- Test: `tests/integration/kioskVoiceCommand.designerGreeting.test.js`

**Interfaces:**
- Consumes: Task 1'in `isDesignerSpeaking(req)`, `pickDesignerGreeting()`.
- Produces: `UNKNOWN` dalında, tasarımcı tanınırsa `{ type: 'GREETING', say: <GREETING_POOL'dan biri> }` yanıtı (yeni bir `type` değeri — frontend zaten `say` alanı dolu her yanıtı genel dalda TTS ile okur, bkz. `useVoiceDeviceControl.js`'in `handleResponse`'ı; bu plan frontend'e dokunmaz).

- [ ] **Step 1: Write the failing tests**

`tests/integration/kioskVoiceCommand.designerGreeting.test.js` (mevcut `kioskVoiceCommand.device.test.js`'teki supertest/registry/kiosk-token kurulum deseniyle AYNI):

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import supertest from 'supertest';
import registry from '../../src/services/_registry.js';
import { signKioskToken } from '../../src/utils/kioskJwt.js';
import app from '../../src/app.js';

const require = createRequire(import.meta.url);
const { RealSpeakerVerifier } = require('../../src/drivers/RealSpeakerVerifier.js');
const { GREETING_POOL } = require('../../src/utils/designerGreeting.js');

const request = supertest(app);
const DESIGNER_ID = 'designer-1';

const mockKioskService = {
  isTokenRevoked: vi.fn(),
  getActiveSurgeryForRoom: vi.fn(),
  getMockConfig: vi.fn(),
  incrementMockCycleIndex: vi.fn(),
};
const mockModuleService = { hasActiveModule: vi.fn() };

const activeSurgery = {
  id: 'surgery-1',
  surgeryTeams: [{ userId: 'speaker-1', fullName: 'Ayşe Yılmaz', roleId: 6, teamRole: 'cerrah' }],
};

function authHeader(roomId = 'room-1') {
  const token = signKioskToken({ institutionId: 'inst-1', roomId, jti: 'jti-1' });
  return `Bearer ${token}`;
}

function sendVoiceCommand(body, roomId = 'room-1') {
  return request
    .post(`/api/kiosk/rooms/${roomId}/voice-command`)
    .set('Authorization', authHeader(roomId))
    .send({ audio: 'base64-audio-stub', ...body });
}

beforeEach(() => {
  vi.clearAllMocks();
  registry.register('kiosk', mockKioskService);
  registry.register('module', mockModuleService);
  mockKioskService.isTokenRevoked.mockResolvedValue(false);
  mockModuleService.hasActiveModule.mockResolvedValue(true);
  mockKioskService.getActiveSurgeryForRoom.mockResolvedValue(activeSurgery);
  process.env.DESIGNER_USER_ID = DESIGNER_ID;
});

afterEach(() => {
  delete process.env.DESIGNER_USER_ID;
});

describe('POST /api/kiosk/rooms/:roomId/voice-command — designer greeting', () => {
  it('(a) mode "real" + identify() designer ile eşleşirse → 200, type GREETING, say havuzdan', async () => {
    mockKioskService.getMockConfig.mockResolvedValueOnce({ mode: 'real' });
    const spy = vi
      .spyOn(RealSpeakerVerifier.prototype, 'identify')
      .mockResolvedValueOnce({ userId: DESIGNER_ID, confidence: 0.9 });

    const res = await sendVoiceCommand({ transcript: 'naber' });

    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe('GREETING');
    expect(GREETING_POOL).toContain(res.body.data.say);
    spy.mockRestore();
  });

  it('(b) mode "always_match" olsa bile designer selamlaması TETİKLENMEZ → normal UNKNOWN', async () => {
    mockKioskService.getMockConfig.mockResolvedValueOnce({ mode: 'always_match', cycleIndex: 0 });
    const spy = vi.spyOn(RealSpeakerVerifier.prototype, 'identify');

    const res = await sendVoiceCommand({ transcript: 'naber' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ type: 'UNKNOWN', say: 'Anlayamadım, tekrar söyler misiniz?' });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('(c) mode "real" ama identify() null dönerse → normal UNKNOWN, 403 FIRLATILMAZ', async () => {
    mockKioskService.getMockConfig.mockResolvedValueOnce({ mode: 'real' });
    const spy = vi.spyOn(RealSpeakerVerifier.prototype, 'identify').mockResolvedValueOnce(null);

    const res = await sendVoiceCommand({ transcript: 'naber' });

    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe('UNKNOWN');
    spy.mockRestore();
  });

  it('(d) selamlama UNKNOWN_STREAK\'i sıfırlar — bir ardışık "anlaşılamadı" serisini BOZAR', async () => {
    mockKioskService.getMockConfig
      .mockResolvedValueOnce({ mode: 'always_unrecognized', cycleIndex: 0 }) // 1: gerçek UNKNOWN, streak=1
      .mockResolvedValueOnce({ mode: 'real' })                               // 2: designer selamlanır
      .mockResolvedValueOnce({ mode: 'always_unrecognized', cycleIndex: 0 }); // 3: streak YENİDEN 1 olmalı
    const spy = vi
      .spyOn(RealSpeakerVerifier.prototype, 'identify')
      .mockResolvedValueOnce({ userId: DESIGNER_ID, confidence: 0.9 });

    const first = await sendVoiceCommand({ transcript: 'xyzzy' });
    expect(first.body.data.say).toBe('Anlayamadım, tekrar söyler misiniz?');

    const second = await sendVoiceCommand({ transcript: 'naber' });
    expect(second.body.data.type).toBe('GREETING');

    const third = await sendVoiceCommand({ transcript: 'xyzzy' });
    expect(third.body.data.say).toBe('Anlayamadım, tekrar söyler misiniz?'); // HÂLÂ 1. seviye

    spy.mockRestore();
  });

  it('(e) DESIGNER_USER_ID ayarlanmamışsa davranış tamamen eskisi gibidir', async () => {
    delete process.env.DESIGNER_USER_ID;
    mockKioskService.getMockConfig.mockResolvedValueOnce({ mode: 'real' });

    const res = await sendVoiceCommand({ transcript: 'naber' });

    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe('UNKNOWN');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/integration/kioskVoiceCommand.designerGreeting.test.js`
Expected: FAIL (test (a) ve (d): `res.body.data.type` `'UNKNOWN'` olur, `'GREETING'` DEĞİL — kablolama henüz yok)

- [ ] **Step 3: `src/routes/kiosk.routes.js`'i düzenle**

Dosya başındaki import bloğuna (`addressSpeaker, describeDeviceAction` satırının altına) ekle:

```js
const { isDesignerSpeaking, pickDesignerGreeting } = require('../utils/designerGreeting');
```

`// UNKNOWN (parseIntent'in döndürdüğü tek diğer tip) ...` yorumunun ve `const streak = ...` satırının TAM ÖNÜNE ekle:

```js
      // Designer easter-egg: UNKNOWN'a ayrışan (komut/spotify/arama/time-out
      // olmayan) serbest konuşmada, konuşmacı designer ise (gerçek Speaker-ID
      // ile, sadece config.mode==='real' kurumlarda — bkz. designerGreeting.js)
      // sabit komut akışına hiç girmeden bir karşılama döner. Bu bir
      // "anlayamadım" değildir — streak sıfırlanır.
      if (await isDesignerSpeaking(req)) {
        UNKNOWN_STREAK.delete(req.kiosk.roomId);
        return ok(res, { type: 'GREETING', say: pickDesignerGreeting() });
      }

```

Mevcut `const streak = ...` / `UNKNOWN_STREAK.set(...)` / `return ok(res, streak >= 2 ? ...)` satırları DEĞİŞMEDEN kalır.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/integration/kioskVoiceCommand.designerGreeting.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Tüm paketi çalıştır (regresyon)**

Run: `npm test`
Expected: PASS (462 + yeni testler — DEVICE_COMMAND/SPOTIFY_PLAY/WEB_SEARCH/TIMEOUT/onay dallarına ait HİÇBİR test kırılmaz, o dallara dokunulmadı)

- [ ] **Step 6: Commit**

```bash
git add src/routes/kiosk.routes.js tests/integration/kioskVoiceCommand.designerGreeting.test.js
git commit -m "feat(kiosk): wire designer greeting into the UNKNOWN voice-command branch"
```

---

### Task 3: Tek-seferlik provisioning script'i

**Files:**
- Create: `scripts/provision-designer-account.js`
- Test: `tests/unit/provisionDesignerAccount.test.js`

**Interfaces:**
- Consumes: `src/services/auth.service.js`'in mevcut `register({email, password, fullName, roleId, institutionId}): Promise<{id, email, full_name, role_id, institution_id, created_at}>` (DEĞİŞMEZ — şifre politikası/hash'leme/password_history zaten içinde).
- Produces: `provisionDesignerAccount({email, password, fullName}): Promise<string>` (yeni kullanıcının `id`'si) — başka hiçbir task bunu programatik olarak KULLANMAZ; operatör bu id'yi `DESIGNER_USER_ID` ortam değişkenine kendisi yazar.

- [ ] **Step 1: Write the failing test**

`tests/unit/provisionDesignerAccount.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/auth.service.js', () => ({
  register: vi.fn(),
}));

const authService = await import('../../src/services/auth.service.js');
const { provisionDesignerAccount } = await import('../../scripts/provision-designer-account.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('provisionDesignerAccount', () => {
  it('authService.register\'ı role_id=0, institution_id=null ile çağırır ve yeni id\'yi döner', async () => {
    authService.register.mockResolvedValueOnce({ id: 'designer-uuid-1', email: 'patron@operio.app' });

    const id = await provisionDesignerAccount({
      email: 'patron@operio.app',
      password: 'Gecici-Guclu-Sifre1!',
      fullName: 'Arzu',
    });

    expect(id).toBe('designer-uuid-1');
    expect(authService.register).toHaveBeenCalledWith({
      email: 'patron@operio.app',
      password: 'Gecici-Guclu-Sifre1!',
      fullName: 'Arzu',
      roleId: 0,
      institutionId: null,
    });
  });

  it('authService.register fırlatırsa (örn. e-posta zaten kayıtlı) hata YUKARI PROPAGATE olur', async () => {
    authService.register.mockRejectedValueOnce(Object.assign(new Error('Bu e-posta zaten kayıtlı'), { statusCode: 409 }));

    await expect(
      provisionDesignerAccount({ email: 'patron@operio.app', password: 'x', fullName: 'Arzu' })
    ).rejects.toThrow('Bu e-posta zaten kayıtlı');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/provisionDesignerAccount.test.js`
Expected: FAIL (`Cannot find module '../../scripts/provision-designer-account.js'`)

- [ ] **Step 3: Implement `scripts/provision-designer-account.js`**

`provisionDesignerAccount({email, password, fullName})`: `authService.register({email, password, fullName, roleId: 0, institutionId: null})` çağırır, dönen `user.id`'yi döner (hata varsa olduğu gibi fırlatır — yakalamaz).

Dosyanın sonunda, `require.main === module` ise çalışan bir `main()`:
- `process.env`'den `DESIGNER_EMAIL`, `DESIGNER_PASSWORD`, `DESIGNER_FULL_NAME` okur; biri eksikse `console.error(...)` + `process.exit(1)`.
- `provisionDesignerAccount(...)` çağırır; başarılıysa `console.log('Designer hesabı oluşturuldu. .env dosyana şunu ekle: DESIGNER_USER_ID=' + id)` + `process.exit(0)`; hata yakalanırsa `console.error('Hesap oluşturulamadı:', err.message)` + `process.exit(1)`.

`module.exports = { provisionDesignerAccount };`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/provisionDesignerAccount.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/provision-designer-account.js tests/unit/provisionDesignerAccount.test.js
git commit -m "feat(scripts): add one-off designer-account provisioning script"
```
