# Operio Vision — Sterilizasyon Alet Sayımı Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sterilizasyon biriminin kirli-teslim alet sayımını (`SetTakip.jsx`'teki `SayimModal`), fotoğraf + Claude görsel analiziyle öneri üreten ama insan onayı olmadan hiçbir şey kalıcılaştırmayan bir akışla, gerçek backend'e (`sterile_sets`/`set_instruments`) bağlamak.

**Architecture:** Backend'de zaten var ama hiç tüketilmeyen `sterile_sets`/`set_instruments` modeline iki parça eklenir: (1) `ai.service.js`'e, mevcut Anthropic istemcisini görsel girdiyle kullanan `countInstruments()`; (2) `sterileSet.service.js`'e, AI önerisini (`last_suggested_count`) ve insan-onaylı sayımı (`current_count` + eksik-alet notu) ayrı tutan iki fonksiyon. Frontend'de `SayimModal`, mock kabuk (kart listesi/navigasyon değişmiyor) + gerçek yaprak (sayım adımının kendisi) ilkesiyle, sabit `backendSetId` üzerinden gerçek API'yi çağırır.

**Tech Stack:** Node/Express/Prisma-siz raw SQL (`pg`) backend, Zod validation, Anthropic SDK (görsel girdi); React 19 + Vite frontend, Vitest + Testing Library, `getUserMedia`/canvas sıkıştırma.

**Spec:** [docs/superpowers/specs/2026-11-22-operio-vision-alet-sayimi-design.md](../specs/2026-11-22-operio-vision-alet-sayimi-design.md)

## Global Constraints

- Hiçbir AI önerisi insan onayı olmadan `set_instruments.current_count`'a yazılmaz — öneri her zaman `last_suggested_count`'a gider (spec "Anti-goals").
- Eksik alet tespiti aşama geçişini (yıkamaya) ENGELLEMEZ — sadece not düşer (spec "Anti-goals").
- Yeni vendor/dependency yok — görsel analiz mevcut Anthropic `client`/`MODEL` ile yapılır (spec "Yaklaşımlar").
- `/api/sterile-sets/:id/vision-count` dışındaki hiçbir route'un body limiti değişmez — küresel limit 512kb'de kalır (spec "Fotoğraf boyutu / transport").
- SetTakip.jsx'in diğer aşamaları, SterilSetler.jsx ve `/steril` endpoint'i bu plan kapsamında dokunulmaz (spec "Non-goals").
- `addTrackingLog`'a geçirilen `counts`, yalnızca `instrumentId` VE `set_id` ikisi birden eşleşirse o `set_instruments` satırını güncelleyebilir — başka bir sete ait id asla güncellenmez (spec'in zımni güvenlik gereği; aşağıda Review Focus #4).

## Review Focus

1. **Claude görsel analizden JSON-dışı/bozuk bir yanıt dönerse** — `countInstruments` fırlatmaz, `{suggestions:[], parsed:false}` döner; sayım AI önerisi olmadan elle devam edilebilir (Task 2).
2. **4mb route-limitini aşan bir fotoğraf gönderilirse** — Express'in body-parser hatası ham/kontrolsüz bir 500 değil, mevcut `errorHandler`'dan geçen düzgün bir JSON hata yanıtı üretir (Task 4).
3. **Bir setin `set_instruments` listesi boşsa** (örn. henüz alet tanımlanmamış) — `countInstruments` boş liste ile çağrılabilir, çökmez, boş öneri döner (Task 2).
4. **`/tracking`'e başka bir sete ait `instrumentId` gönderilirse** (tampered/karışmış id) — o satır güncellenmez (0 satır), başka setin `current_count`'u asla değişmez (Task 3).
5. **`vision_counting` modülü aktif ama rolü `authorize(0,1,8,9)` dışında bir kullanıcı** (örn. Doktor roleId=6) `/vision-count` çağırırsa — 403, `requireModule`'e hiç ulaşmadan `authorize` tarafından reddedilir (Task 4).

---

### Task 1: Veri modeli — modül + kolon + demo seed (`migrations/001_init.sql`)

**Files:**
- Modify: `operio-backend/migrations/001_init.sql`
- Modify: `operio-backend/tests/unit/migrations.test.js`

**Interfaces:**
- Produces: `vision_counting` modül satırı; `set_instruments.last_suggested_count SMALLINT` kolonu; 6 sabit-UUID `sterile_sets` satırı ve bunların `set_instruments` satırları — aşağıdaki tam liste, Task 5 ve Task 6'nın `backendSetId` eşlemesi bu UUID'lere birebir bağlıdır, değiştirilemez.

Not: Bu proje `prisma migrate` kullanıyor ama `001_init.sql` Prisma'nın dışında, ayrı elle/CI betiğiyle uygulanan bir dosya (`prisma/seed.js`'teki yorum: "Güvenlik tabloları migration/001_init.sql içinde tanımlıdır") — [migrations.test.js](../../../operio-backend/tests/unit/migrations.test.js) bu dosyayı canlı bir veritabanına UYGULAMADAN, sadece dosya İÇERİĞİNİ (`readFileSync` + regex) doğruluyor. Bu task AYNI kurulan konvansiyonu takip eder; yeni bir "migration'ı veritabanına uygula" adımı İCAT ETMEZ.

- [ ] **Step 1: Testi genişlet — `tests/unit/migrations.test.js`**

Mevcut testin ([migrations.test.js](../../../operio-backend/tests/unit/migrations.test.js)) yanına, aynı `readFileSync('migrations/001_init.sql','utf8')` + regex deseniyle:

```js
test('001_init.sql defines vision_counting module, last_suggested_count column, and 6 seeded demo sets', () => {
  const sql = readFileSync('migrations/001_init.sql', 'utf8');
  expect(sql).toMatch(/INSERT INTO modules[\s\S]*?'vision_counting'/);
  expect(sql).toMatch(/ALTER TABLE set_instruments ADD COLUMN IF NOT EXISTS last_suggested_count SMALLINT/);
  for (let n = 1; n <= 6; n++) {
    expect(sql).toContain(`10000000-0000-0000-0000-00000000000${n}`);
  }
});
```

- [ ] **Step 2: Testi çalıştır, fail ettiğini doğrula**

Run: `npm test -- tests/unit/migrations.test.js`
Expected: FAIL — yeni eklenen assertion'lar henüz dosyada yok

- [ ] **Step 3: `modules` tablosuna `vision_counting` satırını ekle**

Mevcut `voice_control` INSERT'inin ([001_init.sql:401-403](../../../operio-backend/migrations/001_init.sql)) hemen altına ekle:

```sql
INSERT INTO modules (slug, name, description, price_try, price_usd)
VALUES ('vision_counting', 'Görsel Alet Sayımı', 'Yapay zeka ile cerrahi alet sayım doğrulaması', 400000, 12000)
ON CONFLICT (slug) DO NOTHING;
```

- [ ] **Step 4: `set_instruments`'a `last_suggested_count` kolonunu ekle**

`set_instruments` tablo tanımının ([001_init.sql:140-146](../../../operio-backend/migrations/001_init.sql)) hemen altına:

```sql
ALTER TABLE set_instruments ADD COLUMN IF NOT EXISTS last_suggested_count SMALLINT;
```

- [ ] **Step 5: 6 demo seti ve aletlerini ekle**

Aynı dosyanın sonuna (veya `set_instruments` tanımına yakın bir yere) ekle — isimler ve adetler `mockData.js`'teki `STERIL_SETLER_V2` ile birebir aynı olmalı:

```sql
INSERT INTO sterile_sets (id, code, name, total_count, sterile_count, status) VALUES
  ('10000000-0000-0000-0000-000000000001','VISION-DEMO-1','Laparoskopi Seti A',5,5,'STERILE'),
  ('10000000-0000-0000-0000-000000000002','VISION-DEMO-2','Apendektomi Seti',4,0,'STERILIZING'),
  ('10000000-0000-0000-0000-000000000003','VISION-DEMO-3','TDA Ortopedi Seti',5,5,'STERILE'),
  ('10000000-0000-0000-0000-000000000004','VISION-DEMO-4','Boyun Cerrahi Seti',4,4,'STERILE'),
  ('10000000-0000-0000-0000-000000000005','VISION-DEMO-5','Fakoemülsifikasyon',4,4,'STERILE'),
  ('10000000-0000-0000-0000-000000000006','VISION-DEMO-6','Laparoskopi Seti B',4,4,'STERILE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO set_instruments (set_id, name, expected_count) VALUES
  ('10000000-0000-0000-0000-000000000001','Trokar 10mm',1),
  ('10000000-0000-0000-0000-000000000001','Trokar 5mm',2),
  ('10000000-0000-0000-0000-000000000001','Laparoskop 30°',1),
  ('10000000-0000-0000-0000-000000000001','Grasper',1),
  ('10000000-0000-0000-0000-000000000001','Koter Elektrotu',1),
  ('10000000-0000-0000-0000-000000000002','Endoloop',2),
  ('10000000-0000-0000-0000-000000000002','Trokar 5mm',2),
  ('10000000-0000-0000-0000-000000000002','Disektör',1),
  ('10000000-0000-0000-0000-000000000002','Grasper',1),
  ('10000000-0000-0000-0000-000000000003','Retraktör',2),
  ('10000000-0000-0000-0000-000000000003','Kemik Raspa',1),
  ('10000000-0000-0000-0000-000000000003','Osteotom',3),
  ('10000000-0000-0000-0000-000000000003','Turnike',1),
  ('10000000-0000-0000-0000-000000000003','Çimento Karıştırıcı',1),
  ('10000000-0000-0000-0000-000000000004','Nöromonitor Prob',1),
  ('10000000-0000-0000-0000-000000000004','Retraktör',2),
  ('10000000-0000-0000-0000-000000000004','Disektör',1),
  ('10000000-0000-0000-0000-000000000004','Klip Aplikatörü',1),
  ('10000000-0000-0000-0000-000000000005','Fakoemülsifikatör',1),
  ('10000000-0000-0000-0000-000000000005','İrigasyon Kılıfı',1),
  ('10000000-0000-0000-0000-000000000005','Göz Spekülümü',1),
  ('10000000-0000-0000-0000-000000000005','BSS Kanülü',2),
  ('10000000-0000-0000-0000-000000000006','Trokar 10mm',1),
  ('10000000-0000-0000-0000-000000000006','Trokar 5mm',1),
  ('10000000-0000-0000-0000-000000000006','Laparoskop 0°',1),
  ('10000000-0000-0000-0000-000000000006','Endoloop',2);
```

`set_instruments`'ın doğal bir anahtarı olmadığı için (`id` varsayılan `uuid_generate_v4()`), bu INSERT mevcut `plans` tablosu seed'iyle ([001_init.sql:343-346](../../../operio-backend/migrations/001_init.sql)) aynı şekilde `ON CONFLICT` korumasız bırakılıyor — bu dosya zaten tek-seferlik init script'i olarak tasarlanmış, projede bunun aksi bir örüntü yok.

- [ ] **Step 6: Testi çalıştır, geçtiğini doğrula**

Run: `npm test -- tests/unit/migrations.test.js`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add migrations/001_init.sql tests/unit/migrations.test.js
git commit -m "feat(vision): seed vision_counting module and demo sterile sets" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `ai.service.js` — `countInstruments()`

**Files:**
- Modify: `operio-backend/src/services/ai.service.js`
- Test: `operio-backend/tests/unit/aiService.countInstruments.test.js`

**Interfaces:**
- Consumes: mevcut modül-seviyesi `client`/`MODEL`/`MAX_TOKENS` ([ai.service.js:1-9](../../../operio-backend/src/services/ai.service.js)).
- Produces: `async function countInstruments(imageBase64, mediaType, expectedInstruments)` → `Promise<{ suggestions: Array<{instrumentId, name, expectedCount, detectedCount: number|null}>, parsed: boolean }>`. `expectedInstruments: Array<{instrumentId, name, expectedCount}>`. `module.exports`'a eklenir: `{ streamChat, chat, buildContext, webSearch, countInstruments }`. Task 4 bu imzayı doğrudan çağırır.

- [ ] **Step 1: Testi yaz — `tests/unit/aiService.countInstruments.test.js`**

`aiService.webSearch.test.js`'teki ([tests/unit/aiService.webSearch.test.js](../../../operio-backend/tests/unit/aiService.webSearch.test.js)) `requireFreshService(createMock)` + `require.cache` enjeksiyon tekniğini BİREBİR aynı şekilde kullan (yeni bir mock teknik icat etme). Üç senaryo:

```js
it('Claude geçerli ```json bloğu dönerse, her beklenen alet için detectedCount eşler', async () => {
  const createMock = vi.fn().mockResolvedValue({
    content: [{ type: 'text', text: '```json\n{"counts":[{"name":"Trokar 10mm","detectedCount":1},{"name":"Grasper","detectedCount":0}]}\n```' }],
  });
  const { countInstruments } = requireFreshService(createMock);
  const result = await countInstruments('base64data', 'image/jpeg', [
    { instrumentId: 'i1', name: 'Trokar 10mm', expectedCount: 1 },
    { instrumentId: 'i2', name: 'Grasper', expectedCount: 1 },
  ]);
  expect(result.parsed).toBe(true);
  expect(result.suggestions).toEqual([
    { instrumentId: 'i1', name: 'Trokar 10mm', expectedCount: 1, detectedCount: 1 },
    { instrumentId: 'i2', name: 'Grasper', expectedCount: 1, detectedCount: 0 },
  ]);
  expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
    messages: [{
      role: 'user',
      content: expect.arrayContaining([
        expect.objectContaining({ type: 'image', source: expect.objectContaining({ type: 'base64', media_type: 'image/jpeg', data: 'base64data' }) }),
      ]),
    }],
  }));
});

it('yanıt parse edilemezse (json bloğu yok) fırlatmaz, parsed:false + boş suggestions döner', async () => {
  const createMock = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'anlayamadım' }] });
  const { countInstruments } = requireFreshService(createMock);
  const result = await countInstruments('x', 'image/jpeg', [{ instrumentId: 'i1', name: 'A', expectedCount: 1 }]);
  expect(result).toEqual({ suggestions: [], parsed: false });
});

it('expectedInstruments boşsa çökmez, boş suggestions döner', async () => {
  const createMock = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: '```json\n{"counts":[]}\n```' }] });
  const { countInstruments } = requireFreshService(createMock);
  const result = await countInstruments('x', 'image/jpeg', []);
  expect(result).toEqual({ suggestions: [], parsed: true });
});
```

- [ ] **Step 2: Testleri çalıştır, fail ettiklerini doğrula**

Run: `npm test -- tests/unit/aiService.countInstruments.test.js`
Expected: FAIL — `countInstruments is not a function`

- [ ] **Step 3: `countInstruments(imageBase64, mediaType, expectedInstruments)`'ı `ai.service.js`'e ekle**

`webSearch`'ün ([ai.service.js:229-242](../../../operio-backend/src/services/ai.service.js)) hemen altına. `client.messages.create` çağırır — `tools` YOK, `messages[0].content` bir dizi: `[{type:'image', source:{type:'base64', media_type:mediaType, data:imageBase64}}, {type:'text', text:prompt}]`. Prompt metni: beklenen alet listesini (`name` + `expectedCount`) okunabilir şekilde sıralayıp, modelden SADECE ` ```json\n{"counts":[{"name":"...","detectedCount":N}]}\n``` ` formatında yanıt istemelidir (tam prompt metni sana bırakıldı — spec'in "Builder'a bırakılanlar" bölümü). Yanıttaki text bloklarını `webSearch`'teki gibi birleştir, ` ```json\n([\s\S]*?)\n``` ` regex'iyle yakala; eşleşme yoksa veya `JSON.parse` hata verirse `{suggestions:[], parsed:false}` döndür (try/catch ile, hiçbir durumda fırlatma). Eşleşirse, HER `expectedInstruments` öğesi için (parse edilen `counts`'ta `name`'i eşleşeni bul, yoksa `detectedCount:null`) `{instrumentId, name, expectedCount, detectedCount}` üret.

- [ ] **Step 4: `module.exports`'u güncelle**

`module.exports = { streamChat, chat, buildContext, webSearch, countInstruments };`

- [ ] **Step 5: Testleri çalıştır, geçtiklerini doğrula**

Run: `npm test -- tests/unit/aiService.countInstruments.test.js`
Expected: PASS (3/3)

- [ ] **Step 6: Commit**

```bash
git add src/services/ai.service.js tests/unit/aiService.countInstruments.test.js
git commit -m "feat(vision): add countInstruments to ai.service using Claude vision input" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `sterileSet.service.js` — AI önerisi kaydı + onaylı sayım genişletmesi

**Files:**
- Modify: `operio-backend/src/services/sterileSet.service.js`
- Test: `operio-backend/tests/unit/sterileSetService.visionCount.test.js`

**Interfaces:**
- Consumes: mevcut `db.query`/`db.transaction` ([utils/db.js]), mevcut `audit()` ([utils/audit.js]), mevcut `emitToInstitution`/`EVENTS`.
- Produces: `async function recordVisionSuggestion({ setId, suggestions, userId, req })` → `Promise<{ updated: number }>`. `addTrackingLog({ setId, stage, operator, notes, counts, userId, req, institutionId })` — **genişletilmiş imza**, `counts` artık opsiyonel 5. parametre: `Array<{instrumentId, count}>|undefined`. İkisi de `module.exports`'a eklenir/zaten var. Task 4 bu iki fonksiyonu doğrudan çağırır.

- [ ] **Step 1: Testi yaz — `tests/unit/sterileSetService.visionCount.test.js`**

Bu projenin önceki planlarında kurulmuş, `db`'yi bir hop ötede mock'lamak için kullanılan `require.cache` enjeksiyon tekniğini (ör. `kioskService.recordTimeoutRead.test.js`'teki desen) kullan — `vi.mock('../../src/utils/db')` burada da `sterileSet.service.js`'in kendi `require('../utils/db')` çağrısını yakalamaz.

```js
it('recordVisionSuggestion: her suggestion için last_suggested_count güncellenir, detectedCount null olanlar atlanır, bir audit() çağrısı yapılır', async () => {
  // queryMock çağrılarını assert et: UPDATE set_instruments SET last_suggested_count=$1 WHERE id=$2
  // detectedCount:null olan suggestion için query ÇAĞRILMAMALI
  // auditMock bir kez, action:'AI_COUNT_SUGGESTION' ile çağrılmalı
});

it('addTrackingLog: counts verilirse ilgili set_instruments.current_count güncellenir', async () => {
  // counts: [{instrumentId:'i1', count:1}] → UPDATE ... WHERE id='i1' AND set_id=setId
});

it('addTrackingLog: count beklenenden azsa notes alanına eksik-alet uyarısı eklenir, AMA stage geçişi/status update ENGELLENMEZ', async () => {
  // set_instruments'tan expected_count=2 dönecek şekilde mock'la, counts:[{instrumentId:'i1',count:1}]
  // notes'un '⚠' içerdiğini VE sterile_sets UPDATE'in (statusMap'e göre) hâlâ çalıştığını doğrula
});

it('addTrackingLog: counts içindeki instrumentId başka bir sete aitse (set_id eşleşmiyor) o satır güncellenmez', async () => {
  // UPDATE sorgusunun WHERE id=$1 AND set_id=$2 ile çağrıldığını, yanlış set_id'de 0 satır etkilendiğini doğrula
});
```

- [ ] **Step 2: Testleri çalıştır, fail ettiklerini doğrula**

Run: `npm test -- tests/unit/sterileSetService.visionCount.test.js`
Expected: FAIL — `recordVisionSuggestion is not a function` / `counts` davranışı yok

- [ ] **Step 3: `recordVisionSuggestion({ setId, suggestions, userId, req })`'ı ekle**

`addTrackingLog`'un ([sterileSet.service.js:119-150](../../../operio-backend/src/services/sterileSet.service.js)) üstüne/altına. `suggestions.filter(s => s.detectedCount != null)` üzerinde döner, her biri için `UPDATE set_instruments SET last_suggested_count=$1 WHERE id=$2` çalıştırır (ayrı transaction gerekmez, bağımsız satırlar). Sonra `audit({ userId, action:'AI_COUNT_SUGGESTION', resource:'sterile_set', resourceId:setId, newData:{suggestions}, req })`. `{ updated: <güncellenen satır sayısı> }` döner.

- [ ] **Step 4: `addTrackingLog`'u `counts` parametresiyle genişlet**

Mevcut imza `addTrackingLog({ setId, stage, operator, notes, userId, req, institutionId })`'a `counts` eklenir (opsiyonel, `undefined` ise davranış TAMAMEN değişmeden kalır — mevcut üç test senaryosuz çağrı yolu bozulmaz). `counts` verilmişse, fonksiyonun EN BAŞINDA (tracking log insert'ten önce) `db.transaction` içine al:
1. `SELECT id, expected_count FROM set_instruments WHERE set_id=$1` ile beklenen listeyi çek.
2. Her `counts` öğesi için `UPDATE set_instruments SET current_count=$1 WHERE id=$2 AND set_id=$3` (iki koşul BİRDEN — Review Focus #4).
3. `expected_count`'tan düşük olanları topla; varsa `notes = (notes ? notes + ' | ' : '') + '⚠ Eksik alet: ' + eksikAletİsimleri.join(', ')`.
4. Mevcut tracking-log-insert + statusMap-update + emit mantığının AYNISI, değiştirilmeden, bu transaction'ın içinde devam eder.

- [ ] **Step 5: `module.exports`'u güncelle**

`module.exports = { listSets, getSet, createSet, updateSet, addTrackingLog, recordVisionSuggestion, setCurrentInstitution };`

- [ ] **Step 6: Testleri çalıştır, geçtiklerini doğrula**

Run: `npm test -- tests/unit/sterileSetService.visionCount.test.js`
Expected: PASS (4/4)

- [ ] **Step 7: Commit**

```bash
git add src/services/sterileSet.service.js tests/unit/sterileSetService.visionCount.test.js
git commit -m "feat(vision): record AI count suggestions separately from human-confirmed counts" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Backend route'ları — `/vision-count`, genişletilmiş `/tracking`, body-limit

**Files:**
- Modify: `operio-backend/src/routes/other.routes.js`
- Modify: `operio-backend/src/validators/schemas.js`
- Modify: `operio-backend/src/app.js`
- Test: `operio-backend/tests/integration/sterileSets.visionCount.test.js`

**Interfaces:**
- Consumes: Task 2'nin `aiService.countInstruments(imageBase64, mediaType, expectedInstruments)`; Task 3'ün `sterileSetService.recordVisionSuggestion({setId,suggestions,userId,req})` ve genişletilmiş `addTrackingLog`; mevcut `requireModule(slug)` ([middleware/requireModule.js]); mevcut `registry` ([services/_registry.js], `device.routes.js`'teki `getService()/setService()` deseniyle aynı).
- Produces: `POST /api/sterile-sets/:id/vision-count`, genişletilmiş `POST /api/sterile-sets/:id/tracking` (artık opsiyonel `counts` kabul eder). Task 6 (frontend) bu iki endpoint'i çağırır.

- [ ] **Step 1: Testi yaz — `tests/integration/sterileSets.visionCount.test.js`**

`device.routes.test.js`'teki ([tests/integration/device.routes.test.js](../../../operio-backend/tests/integration/device.routes.test.js)) `registry.register(...)` + `supertest(app)` desenini kullan.

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { signAccessToken } from '../../src/utils/jwt.js';
import registry from '../../src/services/_registry.js';
import app from '../../src/app.js';

const request = supertest(app);
const mockModuleService = { hasActiveModule: vi.fn().mockResolvedValue(true) };
const mockSterileSetService = {
  getSet: vi.fn(), recordVisionSuggestion: vi.fn(), addTrackingLog: vi.fn(),
  listSets: vi.fn(), createSet: vi.fn(), updateSet: vi.fn(),
};
const mockAiService = { countInstruments: vi.fn() };
const tok = (roleId) => signAccessToken({ sub:'u1', email:'e@t.com', roleId, institutionId:'inst-1' });

beforeEach(() => {
  vi.clearAllMocks();
  registry.register('module', mockModuleService);
  registry.register('sterileSet', mockSterileSetService);
  registry.register('ai', mockAiService);
});

describe('POST /api/sterile-sets/:id/vision-count', () => {
  it('modül satın alınmamışsa 403', async () => {
    mockModuleService.hasActiveModule.mockResolvedValueOnce(false);
    const res = await request.post('/api/sterile-sets/s1/vision-count')
      .set('Authorization', `Bearer ${tok(8)}`).send({ imageBase64:'x', mediaType:'image/jpeg' });
    expect(res.status).toBe(403);
  });

  it('yetkisiz rol (Doktor=6) 403 — requireModule hiç çağrılmaz', async () => {
    const res = await request.post('/api/sterile-sets/s1/vision-count')
      .set('Authorization', `Bearer ${tok(6)}`).send({ imageBase64:'x', mediaType:'image/jpeg' });
    expect(res.status).toBe(403);
    expect(mockModuleService.hasActiveModule).not.toHaveBeenCalled();
  });

  it('geçersiz mediaType 400 döner', async () => {
    const res = await request.post('/api/sterile-sets/s1/vision-count')
      .set('Authorization', `Bearer ${tok(8)}`).send({ imageBase64:'x', mediaType:'image/gif' });
    expect(res.status).toBe(400);
  });

  it('set bulunamazsa 404', async () => {
    mockSterileSetService.getSet.mockResolvedValueOnce(null);
    const res = await request.post('/api/sterile-sets/s1/vision-count')
      .set('Authorization', `Bearer ${tok(8)}`).send({ imageBase64:'x', mediaType:'image/jpeg' });
    expect(res.status).toBe(404);
  });

  it('başarılı: getSet → countInstruments → recordVisionSuggestion sırayla çağrılır, sonuç 200 döner', async () => {
    mockSterileSetService.getSet.mockResolvedValueOnce({ id:'s1', instruments:[{ id:'i1', name:'Trokar 10mm', expected_count:1 }] });
    mockAiService.countInstruments.mockResolvedValueOnce({ suggestions:[{ instrumentId:'i1', name:'Trokar 10mm', expectedCount:1, detectedCount:1 }], parsed:true });
    const res = await request.post('/api/sterile-sets/s1/vision-count')
      .set('Authorization', `Bearer ${tok(8)}`).send({ imageBase64:'x', mediaType:'image/jpeg' });
    expect(res.status).toBe(200);
    expect(mockAiService.countInstruments).toHaveBeenCalledWith('x', 'image/jpeg', [{ instrumentId:'i1', name:'Trokar 10mm', expectedCount:1 }]);
    expect(mockSterileSetService.recordVisionSuggestion).toHaveBeenCalledWith(expect.objectContaining({ setId:'s1' }));
  });

  it('4mb altı ama 512kb üstü bir body bu route için kabul edilir, başka bir route için REDDEDİLİR (413)', async () => {
    const bigPayload = { imageBase64: 'a'.repeat(700 * 1024), mediaType: 'image/jpeg' }; // ~700KB > 512kb küresel limit
    mockSterileSetService.getSet.mockResolvedValueOnce({ id:'s1', instruments:[] });
    mockAiService.countInstruments.mockResolvedValueOnce({ suggestions:[], parsed:true });
    const okRes = await request.post('/api/sterile-sets/s1/vision-count')
      .set('Authorization', `Bearer ${tok(8)}`).send(bigPayload);
    expect(okRes.status).toBe(200);

    const rejectedRes = await request.patch('/api/sterile-sets/s1')
      .set('Authorization', `Bearer ${tok(0)}`).send({ name: 'a'.repeat(700 * 1024) });
    expect(rejectedRes.status).toBe(413);
  });
});

describe('POST /api/sterile-sets/:id/tracking (genişletilmiş)', () => {
  it('counts gönderildiğinde addTrackingLog bunu geçirir', async () => {
    mockSterileSetService.addTrackingLog.mockResolvedValueOnce({ id:'log1' });
    const res = await request.post('/api/sterile-sets/s1/tracking')
      .set('Authorization', `Bearer ${tok(9)}`)
      .send({ stage:'teslim_alindi', counts:[{ instrumentId:'11111111-1111-1111-1111-111111111111', count:1 }] });
    expect(res.status).toBe(201);
    expect(mockSterileSetService.addTrackingLog).toHaveBeenCalledWith(expect.objectContaining({
      setId:'s1', stage:'teslim_alindi', counts:[{ instrumentId:'11111111-1111-1111-1111-111111111111', count:1 }],
    }));
  });
});
```

- [ ] **Step 2: Testleri çalıştır, fail ettiklerini doğrula**

Run: `npm test -- tests/integration/sterileSets.visionCount.test.js`
Expected: FAIL — route 404/yok, `registry.register('sterileSet', ...)` henüz hiçbir şeyi etkilemiyor

- [ ] **Step 3: `validators/schemas.js`'e `visionCountSchema` ekle, `setTrackingSchema`'yı genişlet**

```js
const visionCountSchema = z.object({
  imageBase64: z.string().min(1),
  mediaType:   z.enum(['image/jpeg','image/png']),
});
```

`setTrackingSchema`'ya ([schemas.js:67-71](../../../operio-backend/src/validators/schemas.js)) ekle:

```js
counts: z.array(z.object({
  instrumentId: z.string().uuid(),
  count:        z.number().int().min(0),
})).optional(),
```

`module.exports`'a `visionCountSchema` ekle.

- [ ] **Step 4: `other.routes.js`'teki `setRouter`'ı registry-getter deseniyle çağıracak şekilde değiştir**

Dosyanın üstüne ([other.routes.js:1-13](../../../operio-backend/src/routes/other.routes.js)) `const { requireModule } = require('../middleware/requireModule');` ve `device.routes.js`'teki ([device.routes.js:10-11](../../../operio-backend/src/routes/device.routes.js)) AYNI desen:

```js
const registry = require('../services/_registry');
const getSterileSetService = () => registry.get('sterileSet', () => require('../services/sterileSet.service'));
const getAiService = () => registry.get('ai', () => require('../services/ai.service'));
```

`setRouter` içindeki (sadece `setRouter`, `patientRouter`/`roomRouter`/`auditRouter` DOKUNULMAZ) her `sterileSetService.xxx(...)` çağrısını `getSterileSetService().xxx(...)` ile değiştir — davranış birebir aynı kalır, sadece çağrı yolu değişir.

- [ ] **Step 5: `setRouter.post('/:id/vision-count', ...)`'u ekle**

```js
setRouter.post('/:id/vision-count', authorize(0,1,8,9), requireModule('vision_counting'), validate(visionCountSchema), async (req,res) => {
  try {
    const set = await getSterileSetService().getSet(req.params.id);
    if (!set) return notFound(res, 'Steril Set');
    const result = await getAiService().countInstruments(
      req.body.imageBase64, req.body.mediaType,
      (set.instruments || []).map(i => ({ instrumentId: i.id, name: i.name, expectedCount: i.expected_count })),
    );
    await getSterileSetService().recordVisionSuggestion({ setId: req.params.id, suggestions: result.suggestions, userId: req.user.sub, req });
    return ok(res, result);
  } catch (err) { return serverError(res, err); }
});
```

- [ ] **Step 6: `app.js`'e route'a özel body-limit ekle**

`app.use(express.json({ limit: '512kb' }));` satırının ([app.js:98](../../../operio-backend/src/app.js)) HEMEN ÖNÜNE:

```js
app.use('/api/sterile-sets/:id/vision-count', express.json({ limit: '4mb' }));
```

- [ ] **Step 7: Testleri çalıştır, geçtiklerini doğrula**

Run: `npm test -- tests/integration/sterileSets.visionCount.test.js`
Expected: PASS (hepsi)

- [ ] **Step 8: Tüm backend test paketini çalıştır (regresyon yok mu)**

Run: `npm test`
Expected: Tüm testler PASS (önceki Voice/Operia Kiosk testleri dahil)

- [ ] **Step 9: Commit**

```bash
git add src/routes/other.routes.js src/validators/schemas.js src/app.js tests/integration/sterileSets.visionCount.test.js
git commit -m "feat(vision): add POST /sterile-sets/:id/vision-count and extend tracking with counts" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Frontend — `SayimModal`'ı gerçek backend'e bağla (AI olmadan)

**Files:**
- Modify: `operio-react/operio/src/data/mockData.js`
- Modify: `operio-react/operio/src/services/api.js`
- Modify: `operio-react/operio/src/pages/SetTakip.jsx`
- Test: `operio-react/operio/tests/components/SetTakip.realBackend.test.jsx`

**Interfaces:**
- Consumes: Task 4'ün `POST /sterile-sets/:id/tracking` (artık `counts` kabul ediyor), mevcut `GET /sterile-sets/:id`.
- Produces: her `STERIL_SETLER_V2` öğesinde `backendSetId` alanı (Task 1'in ürettiği UUID'lerle birebir); `sterileSetsAPI.get(id)` kullanımı (zaten tanımlı, çağıran yoktu). Task 6, `SayimModal`'ın bu task'ta kurulan `realInstruments`/`sayimlar` state şekline AI-önerisi dolduracak.

- [ ] **Step 1: `mockData.js`'teki her `STERIL_SETLER_V2` öğesine `backendSetId` ekle**

[mockData.js:160-171](../../../operio-react/operio/src/data/mockData.js)'teki 6 öğeye, Task 1'in sırasıyla ürettiği UUID'lerle (id:1→`10000000-...0001`, id:2→`...0002`, ... id:6→`...0006`):

```js
{ id:1, name:'Laparoskopi Seti A', ..., backendSetId:'10000000-0000-0000-0000-000000000001', aletler:[...] },
```

(diğer 5 öğe için aynı şekilde, sırayla `...0002` → `...0006`)

- [ ] **Step 2: Testi yaz — `tests/components/SetTakip.realBackend.test.jsx`**

`SesliKontrolAyarlari.kiosk.test.jsx`'teki ([tests/components/SesliKontrolAyarlari.kiosk.test.jsx](../../../operio-react/operio/tests/components/SesliKontrolAyarlari.kiosk.test.jsx)) `vi.mock('../../src/services/api.js', ...)` + RTL deseniyle:

```js
vi.mock('../../src/services/api.js', () => ({
  sterileSetsAPI: {
    get: vi.fn(),
    addTracking: vi.fn().mockResolvedValue({ id: 'log1' }),
  },
}));

it('SayimModal açılınca sterileSetsAPI.get(backendSetId) çağrılır ve gerçek set_instruments gösterilir', async () => {
  const { sterileSetsAPI } = await import('../../src/services/api.js');
  sterileSetsAPI.get.mockResolvedValueOnce({
    id: '10000000-0000-0000-0000-000000000001',
    instruments: [
      { id:'i1', name:'Trokar 10mm', expected_count:1, current_count:1 },
      { id:'i2', name:'Trokar 5mm', expected_count:2, current_count:2 },
    ],
  });
  // render SetTakip, aktif seti 1 yap, "Kirli Teslim Alma" adımını tıkla (SayimModal açılır)
  // expect sterileSetsAPI.get toHaveBeenCalledWith('10000000-0000-0000-0000-000000000001')
  // expect ekranda "Trokar 10mm" ve "Trokar 5mm" görünür
});

it('"Sayımı Onayla" tıklanınca addTracking gerçek instrumentId\'lerle çağrılır', async () => {
  // sayaçları varsayılan (expected) değerde bırak, Teslim Eden + Salon doldur, Onayla'ya bas
  // expect sterileSetsAPI.addTracking toHaveBeenCalledWith('10000000-...0001', expect.objectContaining({
  //   stage:'teslim_alindi', counts: [{instrumentId:'i1',count:1},{instrumentId:'i2',count:2}],
  // }))
});

it('backendSetId olmayan bir set için (varsayımsal) buton "AI sayım henüz tanımlı değil" ile pasifleşir', async () => {
  // store'a backendSetId:undefined olan sahte bir set ekle, modalın eski-mock-davranışa
  // (sadece yerel state, API çağrısı yok) düştüğünü doğrula
});
```

- [ ] **Step 3: Testleri çalıştır, fail ettiklerini doğrula**

Run: `npm test -- tests/components/SetTakip.realBackend.test.jsx`
Expected: FAIL

- [ ] **Step 4: `SayimModal`'ı gerçek veriye bağla**

[SetTakip.jsx:13-120](../../../operio-react/operio/src/pages/SetTakip.jsx)'teki `SayimModal`'ı değiştir:
- Açılışta (`useEffect`), `s.backendSetId` VARSA `sterileSetsAPI.get(s.backendSetId)` çağrılır, dönen `instruments` dizisi `realInstruments` state'ine yazılır; `sayimlar` state'i artık `{[instrument.id]: instrument.expected_count}` şeklinde (array index DEĞİL, gerçek UUID ile) başlatılır.
- `s.backendSetId` YOKSA: mevcut davranış (tamamen mock, `s.aletler`/array-index tabanlı) DEĞİŞMEDEN kalır — bu, geriye dönük uyumluluk için korunan dal.
- Alet sayım tablosu artık `realInstruments`'ı (varsa) render eder — her satırda `instrument.name`, `instrument.expected_count`, +/- sayaç (state key: `instrument.id`).
- `kaydet()`: `backendSetId` VARSA, `sterileSetsAPI.addTracking(s.backendSetId, { stage:'teslim_alindi', operator:teslimEden, notes:notlar, counts: realInstruments.map(i => ({instrumentId:i.id, count:sayimlar[i.id]})) })` çağırır (önceki `updateSterilAkis`/`sterilAkisGecis` mock-store çağrıları, görsel akış göstergesini güncellemek için AYNEN kalır — ikisi birlikte çalışır, biri gerçek backend'e yazar, diğeri sayfanın mock akış UI'ını ilerletir).

- [ ] **Step 5: Testleri çalıştır, geçtiklerini doğrula**

Run: `npm test -- tests/components/SetTakip.realBackend.test.jsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/data/mockData.js src/pages/SetTakip.jsx tests/components/SetTakip.realBackend.test.jsx
git commit -m "feat(vision): wire SayimModal instrument counting to real sterile-sets backend" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Frontend — AI ile fotoğrafla sayım + modül CTA

**Files:**
- Modify: `operio-react/operio/src/services/api.js`
- Modify: `operio-react/operio/src/pages/SetTakip.jsx`
- Test: `operio-react/operio/tests/components/SetTakip.visionCount.test.jsx`

**Interfaces:**
- Consumes: Task 4'ün `POST /sterile-sets/:id/vision-count`; mevcut `moduleAPI.mine()` ([api.js:217](../../../operio-react/operio/src/services/api.js)); Task 5'in `realInstruments`/`sayimlar` state'i.
- Produces: `sterileSetsAPI.visionCount(id, {imageBase64, mediaType})` — Task 5'in kurduğu modal akışının son parçası, bundan sonra başka bir task bu dosyalara dokunmuyor.

- [ ] **Step 1: Testi yaz — `tests/components/SetTakip.visionCount.test.jsx`**

```js
vi.mock('../../src/services/api.js', () => ({
  sterileSetsAPI: { get: vi.fn(), addTracking: vi.fn(), visionCount: vi.fn() },
  moduleAPI: { mine: vi.fn() },
}));

it('vision_counting aktif değilse "📷 Fotoğrafla Say" yerine CTA gösterilir', async () => {
  const { moduleAPI, sterileSetsAPI } = await import('../../src/services/api.js');
  moduleAPI.mine.mockResolvedValueOnce([{ slug:'voice_control' }]); // vision_counting YOK
  sterileSetsAPI.get.mockResolvedValueOnce({ id:'10000000-0000-0000-0000-000000000001', instruments:[] });
  // modalı aç → "📷 Fotoğrafla Say" butonu YOK, CTA metni var
});

it('vision_counting aktifse buton görünür; dosya seçilince visionCount çağrılır ve dönen detectedCount sayaçları doldurur', async () => {
  const { moduleAPI, sterileSetsAPI } = await import('../../src/services/api.js');
  moduleAPI.mine.mockResolvedValueOnce([{ slug:'vision_counting' }]);
  sterileSetsAPI.get.mockResolvedValueOnce({
    id:'10000000-0000-0000-0000-000000000001',
    instruments:[{ id:'i1', name:'Trokar 10mm', expected_count:1, current_count:1 }],
  });
  sterileSetsAPI.visionCount.mockResolvedValueOnce({
    suggestions:[{ instrumentId:'i1', name:'Trokar 10mm', expectedCount:1, detectedCount:0 }], parsed:true,
  });
  // modalı aç, dosya input'una sahte bir File ver (fireEvent.change)
  // expect sterileSetsAPI.visionCount toHaveBeenCalledWith('10000000-...0001', expect.objectContaining({mediaType: expect.stringMatching(/image\//)}))
  // expect "i1" sayacının artık 0 gösterdiğini (kullanıcı hâlâ elle +'ya basabilir)
});

it('AI öneri hatası (parsed:false) elle sayımı engellemez — sayaçlar expected_count\'ta kalır, hata toast\'ı gösterilir', async () => {
  // visionCount.mockResolvedValueOnce({ suggestions:[], parsed:false })
  // sayaçların DEĞİŞMEDİĞİNİ ve bir uyarı toast'ının göründüğünü doğrula
});
```

- [ ] **Step 2: Testleri çalıştır, fail ettiklerini doğrula**

Run: `npm test -- tests/components/SetTakip.visionCount.test.jsx`
Expected: FAIL

- [ ] **Step 3: `api.js`'e `sterileSetsAPI.visionCount` ekle**

[api.js:182-190](../../../operio-react/operio/src/services/api.js)'teki `sterileSetsAPI` nesnesine:

```js
visionCount: (id, body) => post(`/sterile-sets/${id}/vision-count`, body).then(r => r.data),
```

- [ ] **Step 4: `SayimModal`'a modül-CTA kontrolü ve fotoğraf-ile-say akışını ekle**

`backendSetId` dalı içinde (Task 5'in kurduğu):
- Modal açılışında `moduleAPI.mine()` çağrılır; dönen listede `slug==='vision_counting'` yoksa, `CihazKontrol.jsx`'teki ([CihazKontrol.jsx:102-114](../../../operio-react/operio/src/pages/CihazKontrol.jsx)) "empty" CTA bloğuyla AYNI görsel dilde ("Görsel Alet Sayımı modülü bu kurum için aktif değil." + Üst Yönetici'ye `/abonelik`'e git butonu) "📷 Fotoğrafla Say" butonunun YERİNE gösterilir.
- Modül aktifse: "📷 Fotoğrafla Say" butonu iki seçenek açar — `<input type="file" accept="image/*" capture="environment">` (Dosyadan Yükle/Kamera) VE `getUserMedia` ile canlı önizleme + "Çek" butonu (SetTakip.jsx'in üstteki `qr-zone` bileşeniyle ([SetTakip.jsx:266-277](../../../operio-react/operio/src/pages/SetTakip.jsx)) tutarlı görsel dilde — tam görsel tasarım builder'a bırakıldı).
- İkisi de ortak bir `handleImageCaptured(blob)`'a gider: canvas'a çizilip maks. 1280px genişliğe indirilir, JPEG quality ~0.7 ile sıkıştırılır, base64'e çevrilir (data URL prefix'i soyulur), `sterileSetsAPI.visionCount(s.backendSetId, { imageBase64, mediaType:'image/jpeg' })` çağrılır.
- Dönen `result.parsed===true` ise, `result.suggestions`'taki her `detectedCount!=null` olan öğe için `sayimlar[instrumentId] = detectedCount` (sayaçları DOLDURUR, kullanıcı hâlâ +/- ile düzeltebilir — hiçbir otomatik onay yok).
- `result.parsed===false` ise, sayaçlar DEĞİŞMEZ, `showToast('AI sayamadı, lütfen elle sayın')`.

- [ ] **Step 5: Testleri çalıştır, geçtiklerini doğrula**

Run: `npm test -- tests/components/SetTakip.visionCount.test.jsx`
Expected: PASS

- [ ] **Step 6: Tüm frontend test paketini çalıştır (regresyon yok mu)**

Run: `npm test`
Expected: Tüm testler PASS

- [ ] **Step 7: Commit**

```bash
git add src/services/api.js src/pages/SetTakip.jsx tests/components/SetTakip.visionCount.test.jsx
git commit -m "feat(vision): add AI photo-based instrument counting with module-gated CTA" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
