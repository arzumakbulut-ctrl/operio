# Backend #1 Kablolama Düzeltmesi (A+B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Frontend'in ameliyat/hasta/salon/steril-set/bildirim/aktivite-logu verilerini, artık çalışmayan "backend #2"nin beklediği yol/alan isimleri yerine, gerçek ve çalışan backend #1'in (`operio-backend/operio-backend`, Docker'lı) gerçek yol/metod/alan isimleriyle okuyup yazmasını sağlamak.

**Architecture:** Her kaynak için TEK bir paylaşılan adapter modülü (`src/services/<kaynak>Adapter.js`) — backend #1'e doğru istek atar, yanıtı mevcut Türkçe-anahtarlı UI state şekline çevirir (ve tersi yönde, yazma işlemlerinde). Şu an her sayfanın kendi bağımsız `fetch` + alan-eşleme kodu VARDI; bu plan onları adapter'ı çağıracak şekilde değiştirir. Backend #1'e (rota/şema/migration) HİÇ dokunulmaz.

**Tech Stack:** React 19 + Vite (mevcut), fetch API (mevcut, yeni kütüphane yok), Vitest + React Testing Library (mevcut test altyapısı).

**Spec:** `docs/superpowers/specs/2026-11-28-backend1-wiring-fix-design.md`

## Global Constraints

- Backend #1'in kodu (`operio-backend/operio-backend/src/**`, `migrations/001_init.sql`) HİÇ DEĞİŞTİRİLMEZ — zaten doğru ve test edilmiş.
- Mevcut Türkçe arayüz metinleri/filtre seçenekleri DEĞİŞMEZ (örn. "Bekliyor"/"Devam Ediyor"/"Tamamlandı" filtre dropdown'ları, durum rozetleri) — backend'in İngilizce enum'ları SADECE adapter'ın içinde çevrilir; kullanıcı hiçbir görsel fark görmemeli.
- `fetch` çağrıları backend #1'in gerçek zarfını (`{success, data, meta?}` — başarısızlıkta `{success:false, error:{code,message}}`) doğru ayrıştırmalı; backend #2 döneminden kalma "yanıt düz bir dizi" varsayımı HER YERDE kaldırılmalı.
- Steril set SİLME özelliği backend #1'de yok (`DELETE /api/sterile-sets/:id` rotası mevcut değil) — silme butonu/aksiyonu arayüzden kaldırılır, çağrılmaz.
- Kimlik doğrulama: tüm adapter çağrıları mevcut `localStorage.getItem("operio_access")` token'ını `Authorization: Bearer` header'ında taşır (App.jsx'teki mevcut desenle aynı).
- Ameliyat durum enum'u (backend): `WAITING|PREPARING|IN_PROGRESS|COMPLETED|CANCELLED|POSTPONED`. Arayüzün durum filtresi sadece 3 Türkçe değer biliyor: `'Bekliyor'` (WAITING+PREPARING), `'Devam Ediyor'` (IN_PROGRESS), `'Tamamlandi'` (COMPLETED) — CANCELLED/POSTPONED de `'Bekliyor'`a düşer (filtreyi bozmamak için).
- Steril set durum enum'u (backend): `STERILE|IN_USE|STERILIZING|FAULTY|RETIRED`. Arayüzün bildiği Türkçe karşılıklar: `'Steril — Hazır'`(STERILE), `'Kullanımda'`(IN_USE), `'Sterilizasyonda'`(STERILIZING), `'Arızalı'`(FAULTY|RETIRED).
- Hasta cinsiyeti backend'de tek harf: `'E'|'K'`. Mevcut arayüz formları tam kelime kullanıyorsa (ör. "Erkek"/"Kadın"), adapter'ın yazma yönünde bu çeviriyi yapması gerekir — tam kelimeler kullanılmıyorsa (zaten 'E'/'K' ise) adapter hiçbir çeviri yapmaz.

## Review Focus

- Backend'den `data: []` (boş dizi, hata değil) döndüğünde adapter'ın tükettiği sayfalar "yükleniyor" durumunda takılı kalmamalı, boş-liste durumunu doğru göstermeli.
- Backend 401/403 döndüğünde (token süresi dolmuş, yetkisiz rol) adapter sessizce `null`/boş dönmemeli — çağıran sayfa bunu "veri yok" ile karıştırmamalı; en azından konsola/hataya düşmeli, sayfa kilitlenmemeli.
- Ameliyat durumu `CANCELLED`/`POSTPONED` geldiğinde (Review Focus, backend enum'unda var ama eski Türkçe eşlemede hiç karşılığı yoktu) arayüz çökmemeli, "Bekliyor" filtresine düşmeli.
- Steril set silme butonuna tıklanırsa (artık kaldırılmış olmalı) kullanıcı var-olmayan bir uç noktaya istek atıp sessizce başarısız bir işlemle karşılaşmamalı.
- Salon ekleme formunda zorunlu `roomNumber` (sayı) alanı boş/geçersiz girilirse backend'in 400 validasyon hatası kullanıcıya anlaşılır şekilde gösterilmeli, sayfa çökmemeli.

---

### Task 1: Ameliyat (Surgery) Adapter Modülü

**Files:**
- Create: `src/services/surgeriesAdapter.js`
- Test: `tests/unit/surgeriesAdapter.test.js`

**Interfaces:**
- Consumes: hiçbiri (ilk task).
- Produces:
  - `listSurgeries(): Promise<Array<{id, saat, bitis, op, hasta, dr, salon, tarih, tarihRaw, st, brans, sure, anestezi, durum, ekip, setler, malzeme, cihaz, ilac, tags, tlbl, hastaDetay}>>`
  - `createSurgery(input: {title, roomId?, patientId?, branch?, surgeonName?, scheduledStart, scheduledEnd?, durationMin?, notes?}): Promise<ReturnType-ile-aynı-şekil-tek-obje>`
  - `updateSurgeryStatus(id: string, status: 'WAITING'|'PREPARING'|'IN_PROGRESS'|'COMPLETED'|'CANCELLED'|'POSTPONED'): Promise<object>`
  - `assignTeamMember(surgeryId: string, userId: string, teamRole: string): Promise<void>`
  - `removeTeamMember(surgeryId: string, userId: string): Promise<void>`
  - Task 2/3 bu fonksiyonları import edip kullanır — başka hiçbir dosya kendi `fetch` kodunu YAZMAZ.

- [ ] **Step 1: Write the failing tests**

`tests/unit/surgeriesAdapter.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listSurgeries, createSurgery, updateSurgeryStatus, assignTeamMember, removeTeamMember } from '../../src/services/surgeriesAdapter.js';

const BASE = 'http://localhost:4000/api';

beforeEach(() => {
  localStorage.setItem('operio_access', 'test-token');
  global.fetch = vi.fn();
});
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('listSurgeries', () => {
  it('backend zarfını açar ve alanları UI şekline çevirir (IN_PROGRESS -> Devam Ediyor)', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [{
          id: 's1', title: 'Apendektomi', branch: 'Genel Cerrahi', surgeon_name: 'Dr. Ahmet Yılmaz',
          scheduled_start: '2026-11-28T08:30:00.000Z', scheduled_end: null, duration_min: 90,
          status: 'IN_PROGRESS', notes: null, room_name: 'Salon 1', room_number: 1,
          patient_name: 'Ayşe Demir', tc_no: '12345678901', blood_type: 'A+',
        }],
        meta: { total: 1, page: 1, limit: 50, totalPages: 1 },
      }),
    });

    const result = await listSurgeries();

    expect(global.fetch).toHaveBeenCalledWith(`${BASE}/surgeries`, expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
    }));
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 's1', op: 'Apendektomi', hasta: 'Ayşe Demir', dr: 'Dr. Ahmet Yılmaz',
      salon: 'Salon 1', durum: 'Devam Ediyor', st: 'dot-active', brans: 'Genel Cerrahi',
    });
  });

  it('CANCELLED ve POSTPONED durumları "Bekliyor" filtresine düşer (Review Focus)', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: [
        { id:'s2', title:'X', status:'CANCELLED', scheduled_start:'2026-11-28T08:00:00.000Z' },
        { id:'s3', title:'Y', status:'POSTPONED', scheduled_start:'2026-11-28T08:00:00.000Z' },
      ], meta:{} }),
    });
    const result = await listSurgeries();
    expect(result[0].durum).toBe('Bekliyor');
    expect(result[1].durum).toBe('Bekliyor');
  });

  it('backend {success:false} dönerse boş dizi döner, FIRLATMAZ', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ success:false, error:{code:'UNAUTHORIZED'} }) });
    const result = await listSurgeries();
    expect(result).toEqual([]);
  });
});

describe('createSurgery', () => {
  it('doğru path+body ile POST atar', async () => {
    global.fetch.mockResolvedValueOnce({ ok:true, json: async () => ({ success:true, data:{ id:'new1', title:'Yeni Ameliyat', status:'WAITING', scheduled_start:'2026-11-28T09:00:00.000Z' } }) });
    const result = await createSurgery({ title:'Yeni Ameliyat', scheduledStart:'2026-11-28T09:00:00.000Z' });
    expect(global.fetch).toHaveBeenCalledWith(`${BASE}/surgeries`, expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ title:'Yeni Ameliyat', scheduledStart:'2026-11-28T09:00:00.000Z' }),
    }));
    expect(result.op).toBe('Yeni Ameliyat');
  });
});

describe('updateSurgeryStatus', () => {
  it('PATCH /surgeries/:id {status} atar', async () => {
    global.fetch.mockResolvedValueOnce({ ok:true, json: async () => ({ success:true, data:{ id:'s1', status:'COMPLETED', title:'X', scheduled_start:'2026-11-28T08:00:00.000Z' } }) });
    await updateSurgeryStatus('s1', 'COMPLETED');
    expect(global.fetch).toHaveBeenCalledWith(`${BASE}/surgeries/s1`, expect.objectContaining({
      method: 'PATCH', body: JSON.stringify({ status: 'COMPLETED' }),
    }));
  });
});

describe('assignTeamMember / removeTeamMember', () => {
  it('assignTeamMember POST /surgeries/:id/team {userId, teamRole} atar', async () => {
    global.fetch.mockResolvedValueOnce({ ok:true, json: async () => ({ success:true, data:{} }) });
    await assignTeamMember('s1', 'u1', 'cerrah');
    expect(global.fetch).toHaveBeenCalledWith(`${BASE}/surgeries/s1/team`, expect.objectContaining({
      method: 'POST', body: JSON.stringify({ userId: 'u1', teamRole: 'cerrah' }),
    }));
  });

  it('removeTeamMember DELETE /surgeries/:id/team/:userId atar', async () => {
    global.fetch.mockResolvedValueOnce({ ok:true, json: async () => ({ success:true, data:{} }) });
    await removeTeamMember('s1', 'u1');
    expect(global.fetch).toHaveBeenCalledWith(`${BASE}/surgeries/s1/team/u1`, expect.objectContaining({ method: 'DELETE' }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/surgeriesAdapter.test.js`
Expected: FAIL (`Cannot find module '../../src/services/surgeriesAdapter.js'`)

- [ ] **Step 3: Implement `src/services/surgeriesAdapter.js`**

- `BASE = 'http://localhost:4000/api'`, `authHeaders()` → `{'Content-Type':'application/json', Authorization:'Bearer '+localStorage.getItem('operio_access')}` (App.jsx'teki mevcut desenle aynı).
- `STATUS_TO_TR = {WAITING:'Bekliyor', PREPARING:'Bekliyor', IN_PROGRESS:'Devam Ediyor', COMPLETED:'Tamamlandi', CANCELLED:'Bekliyor', POSTPONED:'Bekliyor'}` ve `STATUS_TO_DOT = {IN_PROGRESS:'dot-active', COMPLETED:'dot-done', WAITING:'dot-wait', PREPARING:'dot-wait', CANCELLED:'dot-wait', POSTPONED:'dot-wait'}`.
- `mapSurgery(s)`: backend satırını (yukarıdaki test fixture'ındaki alanlar) mevcut UI şekline çevirir — `saat`/`bitis` `scheduled_start`/`scheduled_end`'den `toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})` ile; `tarih` `scheduled_start`'tan `toLocaleDateString('tr-TR')`; `op`←`title`, `hasta`←`patient_name||''`, `dr`←`surgeon_name||''`, `salon`←`room_name||''`, `brans`←`branch||''`, `sure`←`duration_min?(duration_min+' dk'):''`, `durum`←`STATUS_TO_TR[s.status]||'Bekliyor'`, `st`←`STATUS_TO_DOT[s.status]||'dot-wait'`, `ekip:{}`, `setler/malzeme/cihaz/ilac/tags/tlbl:[]`, `hastaDetay:{name:s.patient_name, tc:s.tc_no, bloodType:s.blood_type}`, `tarihRaw`←`s.scheduled_start||''`.
- `async function apiCall(method, path, body)`: ortak fetch yardımcısı — `fetch(BASE+path, {method, headers:authHeaders(), body: body?JSON.stringify(body):undefined})`, `.json()` ile zarfı açar; `json.success` false/yok ise (ya da `res.ok` false ise) `console.error('[surgeriesAdapter]', method, path, res.status, json?.error)` ile loglar (Review Focus: 401/403 sessizce kaybolmamalı) VE `null` döner (yine de fırlatmaz — çağıran sayfa çökmemeli, yukarıdaki test "FIRLATMAZ" gereksinimi).
- `listSurgeries()`: `apiCall('GET','/surgeries')` çağırır, `result?.data` dizisini `.map(mapSurgery)` ile döner; `result` null/data yoksa `[]` döner.
- `createSurgery(input)`: `apiCall('POST','/surgeries', input)` (input anahtarları zaten `surgeryCreateSchema`'ya uygun camelCase — `title, roomId, patientId, branch, surgeonName, scheduledStart, scheduledEnd, durationMin, notes`), dönen `data`'yı `mapSurgery` ile çevirip döner.
- `updateSurgeryStatus(id, status)`: `apiCall('PATCH', '/surgeries/'+id, {status})`, `mapSurgery(data)` döner.
- `assignTeamMember(surgeryId, userId, teamRole)`: `apiCall('POST', '/surgeries/'+surgeryId+'/team', {userId, teamRole})`.
- `removeTeamMember(surgeryId, userId)`: `apiCall('DELETE', '/surgeries/'+surgeryId+'/team/'+userId)`.
- `module.exports`/`export` hepsini (ESM — proje zaten `import`/`export` kullanıyor, `src/services/api.js`'teki desenle aynı).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/unit/surgeriesAdapter.test.js`
Expected: PASS (6 test)

- [ ] **Step 5: Commit**

```bash
git add src/services/surgeriesAdapter.js tests/unit/surgeriesAdapter.test.js
git commit -m "feat(adapter): add surgeries adapter for backend #1"
```

---

### Task 2: Ameliyat Listeleme Tüketicilerini Adapter'a Taşı

**Files:**
- Modify: `src/App.jsx` (`useApiLoader`'ın ameliyat kısmı, satır ~89, ~103-105)
- Modify: `src/components/layout/Sidebar.jsx`
- Modify: `src/pages/OnayBekleyenler.jsx`
- Modify: `src/pages/EkipPlani.jsx`
- Modify: `src/pages/Istatistik.jsx`
- Modify: `src/pages/DolulukTakvimi.jsx`
- Test: `tests/components/SurgeryListConsumers.test.jsx` (yeni, aşağıda)

**Interfaces:**
- Consumes: Task 1'in `listSurgeries()`.
- Produces: hiçbiri (tüketici task).

- [ ] **Step 1: Write the failing test**

`tests/components/SurgeryListConsumers.test.jsx` — her tüketici dosyanın artık kendi `fetch('/ameliyatlar')` YERİNE adapter'ı çağırdığını doğrular:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as surgeriesAdapter from '../../src/services/surgeriesAdapter.js';

// Her tüketici dosyanın kendi fetch'i yerine adapter'ı çağırdığını doğrulamak için
// doğrudan modülü mock'luyoruz ve dosyanın import ettiğini teyit ediyoruz.
describe('Ameliyat tüketicileri artık surgeriesAdapter kullanıyor', () => {
  beforeEach(() => { vi.spyOn(surgeriesAdapter, 'listSurgeries').mockResolvedValue([
    { id:'s1', op:'Test Ameliyat', durum:'Devam Ediyor', st:'dot-active', salon:'Salon 1', dr:'Dr. Test', saat:'08:00' },
  ]); });

  it('App.jsx useApiLoader artık doğrudan fetch("/ameliyatlar") YAPMIYOR, listSurgeries() çağırıyor', async () => {
    const src = await import('fs').then(fs => fs.readFileSync('src/App.jsx', 'utf8'));
    expect(src).not.toContain('/ameliyatlar');
    expect(src).toContain('listSurgeries');
  });

  it('Sidebar.jsx artık listSurgeries() kullanıyor, eski /ameliyatlar yolunu kullanmıyor', async () => {
    const src = await import('fs').then(fs => fs.readFileSync('src/components/layout/Sidebar.jsx', 'utf8'));
    expect(src).not.toContain('/ameliyatlar');
    expect(src).toContain('listSurgeries');
  });
});
```

(Bu task'ın her bir dosyası için aynı iki satırlık dosya-içerik kontrolü deseni tekrarlanır: OnayBekleyenler.jsx, EkipPlani.jsx, Istatistik.jsx, DolulukTakvimi.jsx — implementer bu 4 ek `it()` bloğunu aynı `describe` içine, aynı desenle ekler.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/SurgeryListConsumers.test.jsx`
Expected: FAIL (dosyalar hâlâ `/ameliyatlar` içeriyor)

- [ ] **Step 3: Her dosyayı güncelle**

Her dosyada: `fetch(...'/ameliyatlar'...)` (ve ilişkili `.then(r=>r.json())`/manuel alan-eşleme kodu) satırlarını kaldır, yerine `import { listSurgeries } from '../services/surgeriesAdapter.js'` (göreli yol dosyanın konumuna göre ayarlanır: `src/App.jsx`→`./services/...`, `src/pages/*`→`../services/...`, `src/components/layout/*`→`../../services/...`) ve `const data = await listSurgeries();` ekle. Dönen dizi zaten `{id,op,durum,st,salon,dr,saat,...}` şeklinde — her dosyanın MEVCUT render/filtre mantığı (örn. `s.durum==='Bekliyor'` karşılaştırmaları) DEĞİŞTİRİLMEDEN kalır, çünkü adapter zaten bu alan isimleriyle dönüyor.

`App.jsx`'te özel olarak: `useApiLoader` içindeki `get("/ameliyatlar")` çağrısı ve `mapSurgery` fonksiyonu (satır 89) TAMAMEN SİLİNİR; `Promise.all` dizisindeki o eleman `listSurgeries()` ile değiştirilir, sonuç doğrudan `store.loadSurgeries(result)` olarak (zaten doğru şekilde) kullanılır (artık `.map(mapSurgery)` gerekmez, adapter zaten bunu yapıyor).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/components/SurgeryListConsumers.test.jsx`
Expected: PASS

- [ ] **Step 5: Run full frontend test suite (regresyon)**

Run: `npm test`
Expected: PASS — bu dosyaların mevcut testlerinin HİÇBİRİ kırılmamalı (render mantığı değişmedi, sadece veri kaynağı).

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/components/layout/Sidebar.jsx src/pages/OnayBekleyenler.jsx src/pages/EkipPlani.jsx src/pages/Istatistik.jsx src/pages/DolulukTakvimi.jsx tests/components/SurgeryListConsumers.test.jsx
git commit -m "fix(surgeries): migrate list consumers to surgeriesAdapter"
```

---

### Task 3: Ameliyat Oluşturma/Güncelleme/Ekip Ataması

**Files:**
- Modify: `src/pages/Ameliyatlar.jsx` (ameliyat oluşturma formu)
- Modify: `src/components/ui/AmeliyatDrawer.jsx` (durum güncelleme)
- Modify: `src/pages/AmeliyatTalebi.jsx` (ameliyat oluşturma)
- Modify: `src/pages/AmeliyatDetay.jsx` (durum güncelleme + ekip ataması)
- Modify: `src/pages/SalonYonetim.jsx` (sadece ameliyat-referans kısmı — `/ameliyatlar` yolu varsa `listSurgeries()`'e çevrilir; salon-spesifik kısım Task 5'te)
- Test: `tests/components/SurgeryMutationConsumers.test.jsx` (yeni)

**Interfaces:**
- Consumes: Task 1'in `createSurgery`, `updateSurgeryStatus`, `assignTeamMember`, `removeTeamMember`.
- Produces: hiçbiri.

- [ ] **Step 1: Write the failing test**

`tests/components/SurgeryMutationConsumers.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

describe('Ameliyat yazma işlemleri artık surgeriesAdapter kullanıyor', () => {
  it.each([
    ['src/pages/Ameliyatlar.jsx', 'createSurgery'],
    ['src/components/ui/AmeliyatDrawer.jsx', 'updateSurgeryStatus'],
    ['src/pages/AmeliyatTalebi.jsx', 'createSurgery'],
    ['src/pages/AmeliyatDetay.jsx', 'updateSurgeryStatus'],
    ['src/pages/AmeliyatDetay.jsx', 'assignTeamMember'],
  ])('%s artık %s kullanıyor, eski PUT /ameliyatlar yolunu kullanmıyor', (file, fn) => {
    const src = readFileSync(file, 'utf8');
    expect(src).not.toMatch(/['"`]\/ameliyatlar/);
    expect(src).toContain(fn);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/SurgeryMutationConsumers.test.jsx`
Expected: FAIL

- [ ] **Step 3: Her dosyayı güncelle**

- `Ameliyatlar.jsx`: ameliyat oluşturma formunun `POST /ameliyatlar` çağrısı → `createSurgery({title, roomId, patientId, branch, surgeonName, scheduledStart, scheduledEnd, durationMin, notes})`. Formun mevcut alanları (`hastaId`, `doctorId`, `date`+`startTime`/`endTime`, `type`) adapter'ın beklediği camelCase alanlara eşlenir: `type`→`title`, `hastaId`→`patientId`, `doctorId`→(varsa cerrah adını `surgeonName`'e çevir, yoksa atla), `date`+`startTime`→ISO `scheduledStart` (`new Date(date+'T'+startTime).toISOString()`), `date`+`endTime`→`scheduledEnd` (benzer şekilde).
- `AmeliyatDrawer.jsx`, `AmeliyatDetay.jsx`: mevcut `PUT /ameliyatlar/:id {status:...}` çağrısı → `updateSurgeryStatus(id, backendStatus)`. Arayüzün kendi durum string'i Türkçe ise (`'Devam Ediyor'` vb.) önce backend enum'una çevrilir (Task 1'deki `STATUS_TO_TR`'nin TERSİ — implementer bunu `AmeliyatDrawer.jsx`/`AmeliyatDetay.jsx` içinde küçük bir ters-eşleme sabitiyle yapar: `{'Bekliyor':'WAITING','Devam Ediyor':'IN_PROGRESS','Tamamlandi':'COMPLETED'}`).
- `AmeliyatDetay.jsx`'teki ekip ataması: mevcut `{ekip:[...]}` PUT body'si KALDIRILIR; ekip listesindeki her üye için ayrı ayrı `assignTeamMember(surgeryId, userId, teamRole)` çağrılır (çıkarılan üyeler için `removeTeamMember`).
- `AmeliyatTalebi.jsx`: aynı `createSurgery` deseni, formun kendi alan isimleri Ameliyatlar.jsx'teki gibi eşlenir.
- `SalonYonetim.jsx`: eğer dosyada `/ameliyatlar` referansı varsa (denetim raporunda "referans" olarak not edildi) `listSurgeries()`'e çevrilir — Task 5'teki salon-spesifik değişikliklerle KARIŞTIRILMAZ, bu adım sadece ameliyat-okuma kısmını kapsar.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/components/SurgeryMutationConsumers.test.jsx`
Expected: PASS

- [ ] **Step 5: Run full frontend test suite (regresyon)**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/pages/Ameliyatlar.jsx src/components/ui/AmeliyatDrawer.jsx src/pages/AmeliyatTalebi.jsx src/pages/AmeliyatDetay.jsx src/pages/SalonYonetim.jsx tests/components/SurgeryMutationConsumers.test.jsx
git commit -m "fix(surgeries): migrate create/update/team-assignment to surgeriesAdapter"
```

---

### Task 4: Hasta (Patient) Adapter Modülü

**Files:**
- Create: `src/services/patientsAdapter.js`
- Test: `tests/unit/patientsAdapter.test.js`

**Interfaces:**
- Consumes: hiçbiri.
- Produces:
  - `listPatients(): Promise<Array<{id, ad, soyad, yas, cinsiyet, tc, tel, kan, alerjiler, tani, asaSkor, agirlik, boy, son, op, notlar}>>`
  - `getPatient(id: string): Promise<SameShape-TekObje|null>`
  - `createPatient(input: {firstName, lastName, tcNo?, dateOfBirth?, gender?, bloodType?, phone?}): Promise<SameShape>`

- [ ] **Step 1: Write the failing tests**

`tests/unit/patientsAdapter.test.js` (surgeriesAdapter.test.js'teki desenle aynı — `beforeEach`/`afterEach` ile `fetch` mock'u):

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listPatients, getPatient, createPatient } from '../../src/services/patientsAdapter.js';

const BASE = 'http://localhost:4000/api';

beforeEach(() => { localStorage.setItem('operio_access','test-token'); global.fetch = vi.fn(); });
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('listPatients', () => {
  it('backend zarfını açar, first_name/last_name/tc_no/blood_type/date_of_birth alanlarını çevirir', async () => {
    global.fetch.mockResolvedValueOnce({ ok:true, json: async () => ({ success:true, data:[{
      id:'p1', tc_no:'12345678901', first_name:'Ayşe', last_name:'Demir',
      date_of_birth:'1990-05-10', gender:'K', blood_type:'A+', phone:'5551234567',
    }], meta:{} }) });

    const result = await listPatients();

    expect(global.fetch).toHaveBeenCalledWith(`${BASE}/patients`, expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
    }));
    expect(result[0]).toMatchObject({ id:'p1', ad:'Ayşe', soyad:'Demir', tc:'12345678901', kan:'A+', cinsiyet:'K', tel:'5551234567' });
    expect(result[0].yas).toBeGreaterThan(0);
  });

  it('backend hata dönerse boş dizi döner, FIRLATMAZ', async () => {
    global.fetch.mockResolvedValueOnce({ ok:false, status:401, json: async () => ({ success:false }) });
    expect(await listPatients()).toEqual([]);
  });
});

describe('createPatient', () => {
  it('camelCase body ile POST atar', async () => {
    global.fetch.mockResolvedValueOnce({ ok:true, json: async () => ({ success:true, data:{ id:'p2', first_name:'Ali', last_name:'Veli' } }) });
    const result = await createPatient({ firstName:'Ali', lastName:'Veli', gender:'E' });
    expect(global.fetch).toHaveBeenCalledWith(`${BASE}/patients`, expect.objectContaining({
      method:'POST', body: JSON.stringify({ firstName:'Ali', lastName:'Veli', gender:'E' }),
    }));
    expect(result.ad).toBe('Ali');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/patientsAdapter.test.js`
Expected: FAIL

- [ ] **Step 3: Implement `src/services/patientsAdapter.js`**

Task 1'deki `apiCall` yardımcısının AYNISI (console.error loglaması dahil — küçük bir dosyada tekrar; iki adapter arasında ortak bir `src/services/apiAdapterBase.js` çıkarmak İSTEĞE BAĞLI bir iyileştirme, bu task'ın kapsamında ZORUNLU değil, YAGNI). `mapPatient(p)`: `ad`←`p.first_name||''`, `soyad`←`p.last_name||''`, `yas`←`p.date_of_birth?(yıl farkı hesapla):''`, `cinsiyet`←`p.gender||''`, `tc`←`p.tc_no||''`, `tel`←`p.phone||''`, `kan`←`p.blood_type||''`, `alerjiler`←`'Yok'` (backend'de bu alan yok, sabit varsayılan — Non-goal, Task kapsamında DEĞİŞTİRİLMEZ), `notlar`←`''` (aynı sebep), geri kalan alanlar (`tani,asaSkor,agirlik,boy,son,op`) boş string.
`listPatients()`/`getPatient(id)`/`createPatient(input)` — surgeriesAdapter'daki aynı `apiCall` deseniyle `/patients` yoluna.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/unit/patientsAdapter.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/patientsAdapter.js tests/unit/patientsAdapter.test.js
git commit -m "feat(adapter): add patients adapter for backend #1"
```

---

### Task 5: Hasta Tüketicilerini Adapter'a Taşı

**Files:**
- Modify: `src/App.jsx` (`useApiLoader`'ın hasta kısmı)
- Modify: `src/pages/YeniHasta.jsx`
- Modify: `src/components/ui/HastaDrawer.jsx`
- Test: `tests/components/PatientConsumers.test.jsx` (yeni)

**Interfaces:**
- Consumes: Task 4'ün `listPatients`, `getPatient`, `createPatient`.

- [ ] **Step 1: Write the failing test**

`tests/components/PatientConsumers.test.jsx` — Task 2'deki dosya-içerik-kontrolü deseniyle aynı: `App.jsx`, `YeniHasta.jsx`, `HastaDrawer.jsx`'in artık `/hastalar` İÇERMEDİĞİNİ ve ilgili adapter fonksiyonunu (`listPatients`/`createPatient`/`getPatient`) İÇERDİĞİNİ doğrulayan 3 `it()`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/PatientConsumers.test.jsx`
Expected: FAIL

- [ ] **Step 3: Her dosyayı güncelle**

`App.jsx`: `mapHasta` fonksiyonu SİLİNİR, `useApiLoader` içindeki `get("/hastalar")` → `listPatients()`. `YeniHasta.jsx`: formun `name/surname/tc/birthDate/gender(tam kelime)` alanları `createPatient`'a `firstName/lastName/tcNo/dateOfBirth/gender('E'|'K')` olarak çevrilip gönderilir (form kendi Türkçe tam-kelime cinsiyet seçiciyse, gönderirken `{'Erkek':'E','Kadın':'K'}` ile çevrilir). `HastaDrawer.jsx`: `fetch('/hastalar/:id')` → `getPatient(id)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/components/PatientConsumers.test.jsx`
Expected: PASS

- [ ] **Step 5: Run full frontend test suite (regresyon)**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/pages/YeniHasta.jsx src/components/ui/HastaDrawer.jsx tests/components/PatientConsumers.test.jsx
git commit -m "fix(patients): migrate consumers to patientsAdapter"
```

---

### Task 6: Salon (Room) Düzeltmesi

**Files:**
- Modify: `src/pages/SalonYonetim.jsx`
- Test: `tests/components/SalonYonetim.rooms.test.jsx` (yeni)

**Interfaces:**
- Consumes: hiçbiri (doğrudan backend #1'e, zaten doğru olan `/api/rooms` yoluna bağlanır — ayrı bir adapter modülüne gerek yok, tek tüketici dosya bu).
- Produces: hiçbiri.

- [ ] **Step 1: Write the failing tests**

`tests/components/SalonYonetim.rooms.test.jsx` (mevcut `tests/components/SesliKontrolAyarlari.kiosk.test.jsx` gibi dosyalardaki supertest/render desenine bakarak React Testing Library ile):

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SalonYonetim from '../../src/pages/SalonYonetim.jsx';

beforeEach(() => {
  localStorage.setItem('operio_access', 'test-token');
  global.fetch = vi.fn().mockResolvedValue({ ok:true, json: async () => ({ success:true, data:[] }) });
});

describe('SalonYonetim — gerçek backend #1 uç noktaları', () => {
  it('"Salon Ekle" artık sabit toast DEĞİL, gerçek POST /api/rooms atar', async () => {
    render(<SalonYonetim />);
    // Form alanlarını doldur (implementer mevcut form ref'lerine göre tam seçiciyi yazar)
    // ... name, roomNumber doldurulur ...
    fireEvent.click(screen.getByText(/Salon Ekle|Yeni Salon/i));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/rooms'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('durum güncelleme artık PATCH /api/rooms/:id/status atar (PUT /api/rooms/:id DEĞİL)', async () => {
    render(<SalonYonetim />);
    // ... bir salonun durumunu değiştiren aksiyonu tetikle ...
    await waitFor(() => {
      const calls = global.fetch.mock.calls.filter(c => c[1]?.method === 'PATCH');
      expect(calls.some(c => /\/api\/rooms\/.+\/status/.test(c[0]))).toBe(true);
    });
  });

  it('roomNumber boş/geçersiz girilip backend 400 döndürdüğünde sayfa çökmez, hata toast ile gösterilir (Review Focus)', async () => {
    global.fetch.mockResolvedValueOnce({ ok:false, status:400, json: async () => ({ success:false, error:{ code:'BAD_REQUEST', message:'roomNumber geçersiz' } }) });
    render(<SalonYonetim />);
    // ... formu roomNumber BOŞ bırakarak gönder ...
    fireEvent.click(screen.getByText(/Salon Ekle|Yeni Salon/i));
    await waitFor(() => {
      expect(screen.queryByText(/roomNumber geçersiz|hata/i)).toBeInTheDocument();
    });
    // Sayfa hâlâ render edilmiş durumda olmalı (çökmedi) — en az bir bilinen element hâlâ DOM'da.
    expect(screen.getByText(/Salon Ekle|Yeni Salon/i)).toBeInTheDocument();
  });
});
```

(Implementer, mevcut `SalonYonetim.jsx`'i okuyup bu iki testin gerçek form/buton seçicilerini — `getByText`/`getByLabelText` — dosyadaki gerçek metinlere göre tamamlar; yukarıdaki iskelet davranışı sabitler.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/components/SalonYonetim.rooms.test.jsx`
Expected: FAIL (şu an `saveSalon()` sadece `showToast(...)` çağırıyor, hiç fetch atmıyor; durum güncellemesi `PUT /rooms/:id` atıyor)

- [ ] **Step 3: `SalonYonetim.jsx`'i güncelle**

- `saveSalon()`'daki `if (modal === 'yeni') { showToast('Yeni salon eklemek için backend desteği gerekiyor'); }` bloğu KALDIRILIR; yerine gerçek `fetch(BASE+'/rooms', {method:'POST', headers:h, body:JSON.stringify({name:form.name, roomNumber:Number(form.roomNumber), branch:form.branch, capacity:Number(form.capacity)||6, color:form.color})})` konur (roomCreateSchema'ya uygun — `roomNumber` SAYI olmalı, `Number(...)` dönüşümü ŞART).
- Mevcut durum güncelleme kodu (`PUT ${BASE}/rooms/${modal.id}`) → `PATCH ${BASE}/rooms/${modal.id}/status`, body sadece `{status: ENUM_DEĞER}` (mevcut `UI_TO_DB` çeviri tablosu varsa, hedef değerleri `'ACTIVE'|'IDLE'|'RESERVED'|'MAINTENANCE'|'CLOSED'` olacak şekilde güncellenir — eski değerler `'Aktif'|'Bos'` gibi Türkçe idiyse backend enum'una çevrilir).
- Başarılı POST sonrası dönen yeni salonun arayüz listesine eklenmesi (ya da sayfanın `listRooms`'u yeniden çağırması) — mevcut `rooms` state güncelleme deseniyle tutarlı şekilde yapılır.
- POST/PATCH başarısız dönerse (`success:false`), backend'in `error.message`'ı `showToast(...)` ile gösterilir (mevcut `showToast` deseniyle, `Kurum.jsx` vb. diğer sayfalarda zaten kullanılan aynı mekanizma) — sayfa state'i bozulmaz, form açık/render edilmiş kalır.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/components/SalonYonetim.rooms.test.jsx`
Expected: PASS

- [ ] **Step 5: Run full frontend test suite (regresyon)**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/pages/SalonYonetim.jsx tests/components/SalonYonetim.rooms.test.jsx
git commit -m "fix(rooms): wire real POST /rooms and PATCH /rooms/:id/status"
```

---

### Task 7: Steril Set Adapter Modülü

**Files:**
- Create: `src/services/sterileSetsAdapter.js`
- Test: `tests/unit/sterileSetsAdapter.test.js`

**Interfaces:**
- Consumes: hiçbiri.
- Produces:
  - `listSterileSets(): Promise<Array<{id, name, doktor, raf, durum, color, aletler}>>` (mevcut `SterilSetler.jsx`'in `dbToUi` şekliyle AYNI alan isimleri — implementer bunu korur, sadece veri kaynağını değiştirir).
  - `createSterileSet(input: {code, name, totalCount?, shelfLocation?, status?, instruments?}): Promise<SameShape>`
  - `updateSterileSet(id: string, patch: Partial<input>): Promise<SameShape>`
  - SİLME FONKSİYONU YOK — backend'de `DELETE` rotası olmadığı için kasıtlı olarak eklenmez (Non-goal).

- [ ] **Step 1: Write the failing tests**

`tests/unit/sterileSetsAdapter.test.js` (aynı `beforeEach`/`afterEach` fetch-mock deseni):

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listSterileSets, createSterileSet, updateSterileSet } from '../../src/services/sterileSetsAdapter.js';

const BASE = 'http://localhost:4000/api';
beforeEach(() => { localStorage.setItem('operio_access','test-token'); global.fetch = vi.fn(); });
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('listSterileSets', () => {
  it('backend zarfını açar, shelf_location/status alanlarını Türkçe UI değerlerine çevirir', async () => {
    global.fetch.mockResolvedValueOnce({ ok:true, json: async () => ({ success:true, data:[{
      id:'ss1', code:'SET-001', name:'Laparoskopi Seti', total_count:5, sterile_count:5, in_use_count:0,
      shelf_location:'Raf A-3', status:'STERILE', instruments:[],
    }], meta:{} }) });

    const result = await listSterileSets();

    expect(global.fetch).toHaveBeenCalledWith(`${BASE}/sterile-sets`, expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
    }));
    expect(result[0]).toMatchObject({ id:'ss1', name:'Laparoskopi Seti', raf:'Raf A-3', durum:'Steril — Hazır' });
  });

  it('IN_USE -> Kullanımda, STERILIZING -> Sterilizasyonda, FAULTY/RETIRED -> Arızalı çevrilir', async () => {
    global.fetch.mockResolvedValueOnce({ ok:true, json: async () => ({ success:true, data:[
      { id:'a', code:'A', name:'A', status:'IN_USE' },
      { id:'b', code:'B', name:'B', status:'STERILIZING' },
      { id:'c', code:'C', name:'C', status:'FAULTY' },
      { id:'d', code:'D', name:'D', status:'RETIRED' },
    ], meta:{} }) });
    const result = await listSterileSets();
    expect(result.map(r=>r.durum)).toEqual(['Kullanımda','Sterilizasyonda','Arızalı','Arızalı']);
  });
});

describe('createSterileSet / updateSterileSet', () => {
  it('createSterileSet POST /sterile-sets camelCase body atar', async () => {
    global.fetch.mockResolvedValueOnce({ ok:true, json: async () => ({ success:true, data:{ id:'ss2', code:'SET-002', name:'Yeni Set', status:'STERILE' } }) });
    await createSterileSet({ code:'SET-002', name:'Yeni Set' });
    expect(global.fetch).toHaveBeenCalledWith(`${BASE}/sterile-sets`, expect.objectContaining({
      method:'POST', body: JSON.stringify({ code:'SET-002', name:'Yeni Set' }),
    }));
  });

  it('updateSterileSet PATCH /sterile-sets/:id atar (PUT DEĞİL)', async () => {
    global.fetch.mockResolvedValueOnce({ ok:true, json: async () => ({ success:true, data:{ id:'ss1', status:'IN_USE' } }) });
    await updateSterileSet('ss1', { status: 'IN_USE' });
    expect(global.fetch).toHaveBeenCalledWith(`${BASE}/sterile-sets/ss1`, expect.objectContaining({ method:'PATCH' }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/sterileSetsAdapter.test.js`
Expected: FAIL

- [ ] **Step 3: Implement `src/services/sterileSetsAdapter.js`**

Task 1'deki `apiCall` yardımcısının AYNISI (console.error loglaması dahil). `STATUS_TO_TR = {STERILE:'Steril — Hazır', IN_USE:'Kullanımda', STERILIZING:'Sterilizasyonda', FAULTY:'Arızalı', RETIRED:'Arızalı'}`. `mapSet(s)`: `name`←`s.name`, `doktor`←`s.code||'Genel Kullanım'` (mevcut `SterilSetler.jsx`'in `dbToUi`'siyle AYNI mantık — "doktor" alanı aslında set kodunu taşıyor, bu task DEĞİŞTİRMEZ), `raf`←`s.shelf_location||'—'`, `durum`←`STATUS_TO_TR[s.status]||'Steril — Hazır'`, `aletler`←`(s.instruments||[]).map(i=>({ad:i.name, adet:i.expected_count}))`. `listSterileSets/createSterileSet/updateSterileSet` — Task 1'deki `apiCall` deseniyle `/sterile-sets` yoluna (POST/PATCH — asla PUT, asla DELETE).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/unit/sterileSetsAdapter.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/sterileSetsAdapter.js tests/unit/sterileSetsAdapter.test.js
git commit -m "feat(adapter): add sterile sets adapter for backend #1 (no delete — route doesn't exist)"
```

---

### Task 8: Steril Set Tüketicilerini Taşı + Silme Butonunu Kaldır

**Files:**
- Modify: `src/App.jsx` (`useApiLoader`'ın steril kısmı)
- Modify: `src/pages/SterilSetler.jsx`
- Test: `tests/components/SterilSetler.adapter.test.jsx` (yeni)

**Interfaces:**
- Consumes: Task 7'nin `listSterileSets`, `createSterileSet`, `updateSterileSet`.

- [ ] **Step 1: Write the failing tests**

`tests/components/SterilSetler.adapter.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as adapter from '../../src/services/sterileSetsAdapter.js';
import SterilSetler from '../../src/pages/SterilSetler.jsx';

beforeEach(() => {
  vi.spyOn(adapter, 'listSterileSets').mockResolvedValue([
    { id:'ss1', name:'Set A', doktor:'SET-001', raf:'Raf A', durum:'Steril — Hazır', aletler:[] },
  ]);
});

describe('SterilSetler — adapter + silme butonu yok', () => {
  it('listSterileSets() ile veri çeker, kendi fetch("/steril") kodunu kullanmaz', async () => {
    render(<SterilSetler />);
    expect(await screen.findByText('Set A')).toBeInTheDocument();
    expect(adapter.listSterileSets).toHaveBeenCalled();
  });

  it('silme butonu/aksiyonu artık YOK (backend\'de DELETE rotası olmadığı için)', async () => {
    render(<SterilSetler />);
    await screen.findByText('Set A');
    expect(screen.queryByRole('button', { name: /sil/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/components/SterilSetler.adapter.test.jsx`
Expected: FAIL

- [ ] **Step 3: Dosyaları güncelle**

`App.jsx`: `mapSteril` fonksiyonu SİLİNİR, `get("/steril")` → `listSterileSets()`. `SterilSetler.jsx`: dosyanın kendi `useEffect`'teki `fetch(\`${BASE}/steril\`...)` + `dbToUi` SİLİNİR, yerine `listSterileSets()` çağrılır (dönen şekil zaten `dbToUi`'nin ürettiği şekille AYNI — `id,name,doktor,raf,durum,aletler` — sayfanın geri kalan render/filtre/arama mantığı DEĞİŞMEZ). Oluşturma/güncelleme formları `createSterileSet`/`updateSterileSet` kullanacak şekilde güncellenir. Silme butonu/aksiyonu (varsa) JSX'ten ve ilgili handler'dan KALDIRILIR.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/components/SterilSetler.adapter.test.jsx`
Expected: PASS

- [ ] **Step 5: Run full frontend test suite (regresyon)**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/pages/SterilSetler.jsx tests/components/SterilSetler.adapter.test.jsx
git commit -m "fix(sterile-sets): migrate to adapter, remove delete action (no backend route)"
```

---

### Task 9: Bildirimler + Aktivite Logları + Profil Şifre Yolu

**Files:**
- Modify: `src/pages/BildirimDuyuru.jsx`
- Modify: `src/pages/Kurum.jsx`
- Modify: `src/pages/AktiviteLoglari.jsx`
- Modify: `src/pages/Profil.jsx`
- Test: `tests/components/MiscWiringFixes.test.jsx` (yeni)

**Interfaces:**
- Consumes: hiçbiri (her biri tek dosyalık küçük düzeltme, ayrı adapter'a gerek yok — YAGNI).

- [ ] **Step 1: Write the failing tests**

`tests/components/MiscWiringFixes.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

describe('Küçük kablolama düzeltmeleri', () => {
  it('BildirimDuyuru.jsx doğru /api/notifications yoluna POST atıyor', () => {
    const src = readFileSync('src/pages/BildirimDuyuru.jsx', 'utf8');
    expect(src).toMatch(/\/api\/notifications/);
  });

  it('Kurum.jsx ve AktiviteLoglari.jsx artık /logs DEĞİL /api/audit kullanıyor, {success,data,meta} zarfını açıyor', () => {
    for (const file of ['src/pages/Kurum.jsx', 'src/pages/AktiviteLoglari.jsx']) {
      const src = readFileSync(file, 'utf8');
      expect(src).not.toMatch(/['"`]\/logs/);
      expect(src).toMatch(/\/api\/audit/);
    }
  });

  it('Profil.jsx şifre değiştirmede /api/security/password/change kullanıyor', () => {
    const src = readFileSync('src/pages/Profil.jsx', 'utf8');
    expect(src).toMatch(/\/api\/security\/password\/change/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/components/MiscWiringFixes.test.jsx`
Expected: FAIL

- [ ] **Step 3: Her dosyayı güncelle**

- `BildirimDuyuru.jsx`: mevcut `POST` çağrısının yolunu/body alanlarını `notificationCreateSchema`'ya göre doğrula ve düzelt (`targetRole, title, message, type` — şema zod'da `optional/nullable` olanlar hariç zorunlu alanları kontrol et).
- `Kurum.jsx`, `AktiviteLoglari.jsx`: `GET /logs` (`{items:[]}` bekleyen) → `GET /api/audit` (`{success,data:[],meta:{total,page,totalPages}}` zarfı — `response.data` okunur, `items` değil). Audit satırındaki alan isimleri (`action, resource, resource_id, user_id, created_at` — `src/routes/security.routes.js`'teki `/events` ya da `src/routes/other.routes.js`'teki `auditRouter`'a bakarak teyit edilir) sayfanın mevcut render alanlarına eşlenir.
- `Profil.jsx`: mevcut `/auth/change-password` çağrısı → `/api/security/password/change`; body alanları (`oldPassword`/`currentPassword`, `newPassword`) `security.routes.js`'teki gerçek şemaya göre doğrulanıp gerekirse yeniden adlandırılır.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/components/MiscWiringFixes.test.jsx`
Expected: PASS

- [ ] **Step 5: Run full frontend test suite (regresyon)**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/pages/BildirimDuyuru.jsx src/pages/Kurum.jsx src/pages/AktiviteLoglari.jsx src/pages/Profil.jsx tests/components/MiscWiringFixes.test.jsx
git commit -m "fix(misc): correct notification/audit/password-change endpoints"
```
