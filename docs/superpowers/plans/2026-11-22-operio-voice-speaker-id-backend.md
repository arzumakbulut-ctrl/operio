# Operio Voice — Gerçek Speaker-ID (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `MockSpeakerVerifier` with a real, self-hosted speaker-verification pipeline (new Python embedding microservice + Node integration), upgrade voice enrollment to a 3-sample averaged embedding, and redesign the kiosk device-command confirmation flow from a spoken digit-phrase to a natural-language "evet/hayır" exchange.

**Architecture:** A new standalone Python microservice (`speaker-id-service/`) decodes an audio sample, runs a voice-activity check, and returns a speaker embedding vector via one HTTP endpoint. The Node backend calls it through a small client (`speakerIdClient.js`) from two places: enrollment (average 3 samples into one stored vector) and verification (`RealSpeakerVerifier`, compared by cosine similarity against enrolled embeddings of the active surgery's team). `kioskConfirmation.service.js` drops digit-phrase matching for a 3-outcome evet/hayır/ambiguous contract with a 20s TTL.

**Tech Stack:** Node/Express (existing), new Python 3 + FastAPI + SpeechBrain (ECAPA-TDNN pretrained speaker-embedding model) microservice, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-11-22-operio-voice-speaker-id-design.md` (in the frontend repo, `operio-react/operio`) — read both.

## Global Constraints

- Mevcut ses taşıma formatı (webm/opus, base64-over-JSON) korunur; yeni bir yakalama altyapısı kurulmaz.
- Metinden bağımsız (text-independent) speaker verification — Türkçe dahil her dilde aynı şekilde çalışır (ses tınısına bakar, kelimelere bakmaz).
- `src/services/device.service.js` (ALLOWED_ROLE_IDS, decideCommand, checkDeviceAuthorization, executeCommand, physicalConfirm) **HİÇ DEĞİŞMEZ** — yetki mantığı zaten doğru çalışıyor, sadece gerçek `roleId`/`teamRole` ile besleniyor olacak.
- Tanınamayan konuşmacı için mevcut 403 `{code:'unrecognized', message:'Sizi tanıyamadım, lütfen tekrar deneyin.'}` yanıtı **aynen korunur** — yeni bir PIN/yedek onay yolu eklenmez.
- Sayı-tabanlı onay (`kioskConfirmation.service.js`'in `phrase` alanı) tamamen kaldırılır; yerine evet/hayır/anlaşılmaz 3 sonuçlu bir sözleşme gelir.
- Onay TTL'si 20000 ms, `createPendingConfirmation` çağrıldığı anda başlar (TTS'in bitişini sunucu gözlemleyemez — bu, tasarım dokümanının "TTS bitince başlar" niyetinin pratikte uygulanabilir sadeleştirmesidir).
- `voice_profiles.embedding` (BYTEA) kolonunun TİPİ değişmez — sadece içeriği (SHA-256 hash → gerçek ortalanmış embedding vektörü) ve `model_version` değeri değişir.
- Yeni bir migration dosyası açılmaz — proje konvansiyonu tek `migrations/001_init.sql` dosyasıdır, doğrudan düzenlenir.
- Hitap kuralı: `roleId` ∈ {6 (doktor), 10 (misafir_hekim)} → `"{Ad} hocam"`; diğer roller → sadece `"{Ad}"`. Ad, `fullName`'den bilinen unvan ön-ekleri (`Dr.`/`Uzm.`/`Tek.`/`Hem.`/`Srl.`/`Sn.`, case-insensitive) temizlenip ilk kelime alınarak çıkarılır.
- Cosine-similarity eşiği ve VAD enerji-eşiği builder'a bırakılmıştır (bkz. Task 1 ve Task 6) — isimli bir sabit olarak tanımlanır, kalibrasyon bu planın kapsamı dışındadır.

## Review Focus

- Enrollment'ta 3 kayıttan biri sessiz/çok kısa/bozuk gelirse (mikrofon kapalı, VAD "ses yok" derse) embedding ortalamasına katılmamalı veya tüm enrollment reddedilmeli — sessizce ortalamaya karışıp profili bozmamalı (Task 3, Task 4).
- Speaker-ID eşik-altı ama sıfır olmayan bir skorla eşleşirse (şüpheli ama kesin değil) reddetme tarafına düşmeli — "muhtemelen doğrudur" diye geçmemeli (Task 6, anti-goal).
- Onay TTL'si dolduktan hemen sonra "evet" gelirse, eski bekleyen komut YANLIŞLIKLA uygulanmamalı — expired olarak ele alınmalı (Task 5).
- Başlatan kişi dışında biri "evet"/"hayır" derse, bekleyen onay silinmemeli ve başlatan kişi TTL içinde hâlâ cevap verebilmeli (Task 5 — mevcut tasarımın korunan davranışı).
- `candidateUserIds` boşsa veya hiçbirinin enrollment'ı yoksa (`getEmbeddingsForUsers` boş dizi döner), `RealSpeakerVerifier.identify` hata fırlatmadan `null` dönmeli (Task 6).

---

### Task 1: Speaker-embedding mikroservisi (Python)

**Files:**
- Create: `speaker-id-service/app.py`
- Create: `speaker-id-service/requirements.txt`
- Create: `speaker-id-service/Dockerfile`
- Create: `speaker-id-service/tests/test_embed.py`
- Create: `speaker-id-service/tests/fixtures/sample.webm` (herhangi bir kısa, gerçek webm/opus ses dosyası — kaynak: `ffmpeg -f lavfi -i "sine=frequency=200:duration=2" -c:a libopus sample.webm` ile sentetik üretilebilir)

**Interfaces:**
- Produces: `POST /embed` — İstek body (JSON): `{"audio_base64": string, "mime_type": "audio/webm"}`. Yanıt (200): `{"voice_detected": true, "embedding": number[]}` (ECAPA-TDNN embedding boyutu, genelde 192) VEYA `{"voice_detected": false}` (VAD/enerji eşiği sesi "konuşma değil" olarak işaretlerse — `embedding` alanı o zaman yok). Geçersiz/decode edilemeyen ses → 400 `{"error": "decode_failed"}`.

Bu servis bu kod tabanındaki İLK Python bileşeni — mevcut hiçbir sürücü/kayıt deseni yok, aşağıdaki adımlar kendi küçük sözleşmesini kurar.

- [ ] **Step 1: `requirements.txt` oluştur**

İçerik (en az): `fastapi`, `uvicorn`, `speechbrain`, `torch`, `pydub` (webm/opus decode için `ffmpeg` sistem paketine ihtiyaç duyar). Implementer, bu kütüphanelerin güncel/uyumlu sürümlerini kendisi seçer (bu alan bu repo için yeni olduğundan, kesin sürüm numaraları builder'a bırakılmıştır).

- [ ] **Step 2: Başarısız test — `tests/test_embed.py`**

```python
from fastapi.testclient import TestClient
from app import app
import base64, pathlib

client = TestClient(app)

def _sample_b64():
    path = pathlib.Path(__file__).parent / "fixtures" / "sample.webm"
    return base64.b64encode(path.read_bytes()).decode()

def test_embed_returns_vector_for_valid_audio():
    resp = client.post("/embed", json={"audio_base64": _sample_b64(), "mime_type": "audio/webm"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["voice_detected"] is True
    assert isinstance(body["embedding"], list)
    assert len(body["embedding"]) > 0

def test_embed_rejects_invalid_base64():
    resp = client.post("/embed", json={"audio_base64": "not-valid-base64!!", "mime_type": "audio/webm"})
    assert resp.status_code == 400
    assert resp.json()["error"] == "decode_failed"
```

- [ ] **Step 3: Testi çalıştırıp FAIL ettiğini doğrula**

Run: `cd speaker-id-service && python -m pytest tests/test_embed.py -v`
Expected: FAIL (app modülü/endpoint henüz yok)

- [ ] **Step 4: `app.py`'de `POST /embed` implementasyonu**

FastAPI app; başlangıçta (modül yüklenirken, her istekte değil) bir SpeechBrain `spkrec-ecapa-voxceleb` önceden eğitilmiş konuşmacı-embedding modelini yükle. İstek geldiğinde: base64 decode (hata → 400 `decode_failed`) → `pydub` ile webm/opus'tan ham dalga formuna çevir → basit bir enerji/RMS eşiği ile "ses var mı" kontrolü yap (eşik: isimli bir sabit, örn. `VOICE_ENERGY_THRESHOLD`, implementer makul bir varsayılan seçer) → eşik altındaysa `{"voice_detected": false}` döndür → üstündeyse modelden embedding çıkar, `{"voice_detected": true, "embedding": [...]}` döndür (embedding bir Python listesi olmalı, JSON-serializable).

- [ ] **Step 5: Testi çalıştırıp PASS ettiğini doğrula**

Run: `cd speaker-id-service && python -m pytest tests/test_embed.py -v`
Expected: PASS

- [ ] **Step 6: `Dockerfile` oluştur**

Python 3.11-slim tabanlı, `ffmpeg` sistem paketini apt ile kurar (pydub'ın webm/opus decode etmesi için gerekli), `requirements.txt`'i kurar, `uvicorn app:app --host 0.0.0.0 --port 8001` ile başlar (port 8001 — Node API'nin 4000'i ve Postgres'in 5432'siyle çakışmaz).

- [ ] **Step 7: Commit**

```bash
git add speaker-id-service/
git commit -m "feat(speaker-id): add standalone speaker-embedding microservice"
```

---

### Task 2: Docker Compose wiring + migration güncellemesi

**Files:**
- Modify: `docker-compose.yml`
- Modify: `migrations/001_init.sql`
- Modify: `tests/unit/migrations.test.js` (proje konvansiyonu: statik içerik kontrolü, `readFileSync`+regex — bkz. mevcut test deseni)

**Interfaces:**
- Produces: `speaker-id` adlı yeni bir Docker Compose servisi, `api` servisinin erişebileceği `SPEAKER_ID_SERVICE_URL` ortam değişkeni (örn. `http://speaker-id:8001`) — Task 3'ün `speakerIdClient.js`'i bunu okuyacak.

- [ ] **Step 1: `docker-compose.yml`'e `speaker-id` servisini ekle**

`build: { context: ./speaker-id-service }`, `ports` gerekmez (sadece iç ağda `api` tarafından erişilir, dışa açılmaz), `restart: unless-stopped` (projenin diğer servisleriyle tutarlı bir politika varsa onu izle).

- [ ] **Step 2: `api` servisine `SPEAKER_ID_SERVICE_URL=http://speaker-id:8001` ortam değişkeni ve `depends_on: [speaker-id]` ekle**

- [ ] **Step 3: `migrations/001_init.sql`'de `kiosk_mock_config.mode` CHECK kısıtını güncelle**

```sql
CHECK (mode IN ('always_match','always_reject_team','always_unrecognized','cycle','real'))
```

- [ ] **Step 4: `tests/unit/migrations.test.js`'e bu CHECK'in `'real'` içerdiğini doğrulayan bir assertion ekle**

Mevcut dosyadaki desenle aynı (statik regex/içerik kontrolü, DB'ye bağlanmaz).

- [ ] **Step 5: Testi çalıştır**

Run: `npm test -- migrations.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml migrations/001_init.sql tests/unit/migrations.test.js
git commit -m "feat(speaker-id): wire speaker-id-service into docker-compose, allow 'real' kiosk mock mode"
```

---

### Task 3: `speakerIdClient.js` — Python servisine Node istemcisi

**Files:**
- Create: `src/services/speakerIdClient.js`
- Test: `tests/unit/speakerIdClient.test.js`

**Interfaces:**
- Produces: `async function getEmbedding(audioBase64Str, mimeType = 'audio/webm')` → `Promise<number[] | null>` (`null` = `voice_detected: false` veya decode hatası — ASLA fırlatmaz, çağıranlar null'u "ses/konuşma yok" olarak ele alır). `process.env.SPEAKER_ID_SERVICE_URL`'i okur.

- [ ] **Step 1: Başarısız test — `tests/unit/speakerIdClient.test.js`**

```js
describe('speakerIdClient.getEmbedding', () => {
  it('voice_detected:true dönerse embedding dizisini döner', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ voice_detected: true, embedding: [0.1, 0.2, 0.3] }),
    });
    const { getEmbedding } = require('../../src/services/speakerIdClient');
    const result = await getEmbedding('base64data');
    expect(result).toEqual([0.1, 0.2, 0.3]);
  });

  it('voice_detected:false dönerse null döner', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ voice_detected: false }),
    });
    const { getEmbedding } = require('../../src/services/speakerIdClient');
    expect(await getEmbedding('base64data')).toBeNull();
  });

  it('servis 400/500 dönerse veya ağ hatası olursa fırlatmaz, null döner', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'));
    const { getEmbedding } = require('../../src/services/speakerIdClient');
    expect(await getEmbedding('base64data')).toBeNull();
  });
});
```

(Projenin Node sürümü global `fetch` destekliyorsa doğrudan mock'lanır; desteklemiyorsa implementer `node-fetch`'i `dependencies`'e ekler ve aynı şekilde mock'lar — her iki durumda da test, HTTP çağrısının kendisini değil `getEmbedding`'in dönüş sözleşmesini doğrular.)

- [ ] **Step 2: Testi çalıştırıp FAIL ettiğini doğrula**

Run: `npm test -- speakerIdClient.test.js`
Expected: FAIL (modül yok)

- [ ] **Step 3: `speakerIdClient.js` implementasyonu**

`getEmbedding(audioBase64Str, mimeType)`: `process.env.SPEAKER_ID_SERVICE_URL + '/embed'`e POST, body `{audio_base64: audioBase64Str, mime_type: mimeType}`; `try/catch` içinde — ağ hatası, non-2xx, `voice_detected:false` hepsi `null` döndürür (fırlatmaz); `voice_detected:true` ise `embedding` dizisini döner.

- [ ] **Step 4: Testi çalıştırıp PASS ettiğini doğrula**

Run: `npm test -- speakerIdClient.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/speakerIdClient.js tests/unit/speakerIdClient.test.js
git commit -m "feat(speaker-id): add Node client for the speaker-embedding microservice"
```

---

### Task 4: `voiceProfile.service.js` — gerçek embedding ile 3-örnekli enrollment

**Files:**
- Modify: `src/services/voiceProfile.service.js`
- Modify: `tests/unit/voiceProfile.test.js` (mevcut `hashAudio`/`MODEL_VERSION==='mock-v1'` testleri kaldırılır, yenileriyle değiştirilir)

**Interfaces:**
- Consumes: `speakerIdClient.getEmbedding(audioBase64, mimeType)` (Task 3).
- Produces: `async function enrollVoiceProfile(userId, audioSamples)` — `audioSamples` tam olarak 3 elemanlı bir base64 string dizisi; `async function getEmbeddingsForUsers(userIds)` → `Promise<Array<{userId: string, embedding: number[]}>>` (enrollment'ı olmayan userId'ler sonuçta YOK — dizi sadece kayıtlı olanları içerir). `getVoiceProfile(userId)` imzası değişmez.

- [ ] **Step 1: Başarısız testler — `tests/unit/voiceProfile.test.js`'i yeniden yaz**

```js
describe('voiceProfile.service — gerçek embedding', () => {
  it('3 örneğin embedding ortalamasını (centroid) hesaplar ve BYTEA olarak saklar', async () => {
    // speakerIdClient.getEmbedding 3 ayrı çağrıda [1,0], [0,1], [2,2] döner diye mock'la
    // enrollVoiceProfile(userId, [a,b,c]) çağrıldığında db.query'ye geçirilen embedding
    // buffer'ının, ortalama [1,1]'in serialize edilmiş hali olduğunu doğrula.
  });

  it('audioSamples 3 eleman değilse (ör. 2 veya 4) hata fırlatır', async () => {
    const { enrollVoiceProfile } = require('../../src/services/voiceProfile.service');
    await expect(enrollVoiceProfile('u1', ['a', 'b'])).rejects.toThrow();
  });

  it('örneklerden biri voice_detected:false dönerse (getEmbedding null) enrollment reddedilir', async () => {
    // speakerIdClient.getEmbedding 2 kez embedding, 1 kez null dönsün diye mock'la;
    // enrollVoiceProfile'ın reddettiğini (throw veya özel bir hata) doğrula — Review Focus #1.
  });

  it('getEmbeddingsForUsers, enrollment'i olmayan userId'leri sonuçtan atlar', async () => {
    // db.query boş/kısmi satır dönsün diye mock'la; dönen dizinin sadece enrolled olanları
    // içerdiğini doğrula.
  });
});
```

(Implementer, bu projenin mevcut `db` mock'lama deseniyle — `require.cache` enjeksiyonu veya registry — testleri tamamlar; `getVoiceProfile` için mevcut test korunur.)

- [ ] **Step 2: Testleri çalıştırıp FAIL ettiklerini doğrula**

Run: `npm test -- voiceProfile.test.js`
Expected: FAIL

- [ ] **Step 3: Serileştirme yardımcıları + `enrollVoiceProfile`/`getEmbeddingsForUsers` implementasyonu**

`serializeEmbedding(vector: number[]) -> Buffer` (Float32Array → Buffer) ve `deserializeEmbedding(buffer: Buffer) -> number[]` (ters işlem) ekle. `enrollVoiceProfile(userId, audioSamples)`: `audioSamples.length !== 3` → throw; her örnek için `speakerIdClient.getEmbedding`; herhangi biri `null` dönerse throw (Review Focus #1); 3 vektörün eleman-bazlı ortalamasını al, `serializeEmbedding` ile BYTEA'ya çevirip yeni bir `model_version` (örn. `'ecapa-tdnn-v1'`) ile upsert et (mevcut `ON CONFLICT (user_id) DO UPDATE` deseni korunur). `getEmbeddingsForUsers(userIds)`: `voice_profiles`'ten `user_id, embedding` seç (`WHERE user_id = ANY($1)`), her satırı `deserializeEmbedding` ile çöz, `{userId, embedding}` dizisi döndür. `hashAudio` ve eski `MODEL_VERSION='mock-v1'` sabiti kaldırılır.

- [ ] **Step 4: Testleri çalıştırıp PASS ettiklerini doğrula**

Run: `npm test -- voiceProfile.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/voiceProfile.service.js tests/unit/voiceProfile.test.js
git commit -m "feat(speaker-id): real averaged embedding enrollment, replace hashAudio mock"
```

---

### Task 5: `voiceProfile.routes.js` — 3 kayıt kabul eden endpoint

**Files:**
- Modify: `src/routes/voiceProfile.routes.js`
- Test: `tests/integration/voiceProfile.test.js` (mevcut dosya — tek-audio gönderen testler güncellenir)

**Interfaces:**
- Consumes: `voiceProfile.service.enrollVoiceProfile(userId, audioSamples)` (Task 4).
- Produces: `POST /profile/voice-enrollment` artık body'de `{ audioSamples: string[] }` (tam 3 eleman) bekler, eski tekil `audio` alanı kaldırılır.

- [ ] **Step 1: Başarısız test — mevcut entegrasyon testindeki tek-`audio` gönderen senaryoları `audioSamples` (3 elemanlı dizi) gönderecek şekilde güncelle; ayrıca:**

```js
it('audioSamples 3 eleman değilse 400 döner', async () => {
  const res = await request(app).post('/api/profile/voice-enrollment')
    .set('Authorization', `Bearer ${token}`)
    .send({ audioSamples: ['a', 'b'] });
  expect(res.status).toBe(400);
});
```

- [ ] **Step 2: Testleri çalıştırıp FAIL ettiklerini doğrula**

Run: `npm test -- voiceProfile.test.js` (integration)
Expected: FAIL

- [ ] **Step 3: Route güncellemesi**

`req.body.audioSamples` oku; `Array.isArray` değilse veya `length !== 3` ise `badRequest(res, "'audioSamples' tam olarak 3 elemanlı bir base64 dizisi olmalı")`; aksi halde `enrollVoiceProfile(req.user.sub, audioSamples)` çağır. `enrollVoiceProfile`'ın Task 4'teki "örnek reddedildi" hatasını burada da uygun bir 400'e çevir (`serverError` değil — kullanıcı hatası).

- [ ] **Step 4: Testleri çalıştırıp PASS ettiklerini doğrula**

Run: `npm test -- voiceProfile.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/routes/voiceProfile.routes.js tests/integration/voiceProfile.test.js
git commit -m "feat(speaker-id): accept 3-sample enrollment payload on voice-enrollment route"
```

---

### Task 6: `RealSpeakerVerifier` — gerçek konuşmacı tanıma sürücüsü

**Files:**
- Create: `src/drivers/RealSpeakerVerifier.js`
- Test: `tests/unit/realSpeakerVerifier.test.js`

**Interfaces:**
- Consumes: `speakerIdClient.getEmbedding` (Task 3), `voiceProfile.service.getEmbeddingsForUsers` (Task 4), `SpeakerVerifier` taban sınıfı (`src/drivers/SpeakerVerifier.js`, mevcut, değişmez).
- Produces: `class RealSpeakerVerifier extends SpeakerVerifier` — `async identify(audioBuffer, candidateUserIds, config)` → `Promise<{userId, confidence} | null>`, imza `MockSpeakerVerifier` ile birebir aynı (Task 7 ikisi arasında seçim yapacak).

- [ ] **Step 1: Başarısız testler — `tests/unit/realSpeakerVerifier.test.js`**

```js
describe('RealSpeakerVerifier.identify', () => {
  it('en yüksek cosine-similarity skoru eşik üstündeyse o userId'yi confidence ile döner', async () => {
    // getEmbedding → [1,0] query vektörü; getEmbeddingsForUsers → u1:[1,0] (skor 1), u2:[0,1] (skor 0)
    // identify(..., ['u1','u2'], {}) sonucu { userId: 'u1', confidence: 1 } (veya skora yakın) olmalı.
  });

  it('en yüksek skor eşik altındaysa null döner (false-accept\'e düşmez)', async () => {
    // tüm kayıtlı embedding\'ler query\'den çok farklı → null.
  });

  it('audioBuffer null ise (ses yok) fırlatmadan null döner', async () => {
    const verifier = new (require('../../src/drivers/RealSpeakerVerifier').RealSpeakerVerifier)();
    await expect(verifier.identify(null, ['u1'], {})).resolves.toBeNull();
  });

  it('candidateUserIds boşsa null döner', async () => {
    const verifier = new (require('../../src/drivers/RealSpeakerVerifier').RealSpeakerVerifier)();
    await expect(verifier.identify('audio', [], {})).resolves.toBeNull();
  });

  it('getEmbeddingsForUsers hiçbir eşleşme döndürmezse (kimse enroll olmamış) null döner', async () => {
    // Review Focus #5.
  });
});
```

- [ ] **Step 2: Testleri çalıştırıp FAIL ettiklerini doğrula**

Run: `npm test -- realSpeakerVerifier.test.js`
Expected: FAIL

- [ ] **Step 3: İmplementasyon**

`MATCH_THRESHOLD` adlı isimli bir sabit tanımla (örn. `0.75` — builder'ın kalibre edeceği bir placeholder, bkz. Global Constraints). `identify(audioBuffer, candidateUserIds, config)`: `audioBuffer` veya `candidateUserIds.length===0` ise erken `null`; `speakerIdClient.getEmbedding(audioBuffer)` ile sorgu vektörünü çıkar (null dönerse erken `null`); `getEmbeddingsForUsers(candidateUserIds)` ile kayıtlı embedding'leri çek (boşsa erken `null`); her biriyle cosine-similarity hesapla (`dot(a,b)/(norm(a)*norm(b))`), en yüksek skoru bul; `MATCH_THRESHOLD` altındaysa `null`, üstündeyse `{userId, confidence: skor}`.

- [ ] **Step 4: Testleri çalıştırıp PASS ettiklerini doğrula**

Run: `npm test -- realSpeakerVerifier.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/drivers/RealSpeakerVerifier.js tests/unit/realSpeakerVerifier.test.js
git commit -m "feat(speaker-id): add RealSpeakerVerifier (cosine-similarity speaker matching)"
```

---

### Task 7: `kioskSpeakerAuth.js` — mock/real dispatch

**Files:**
- Modify: `src/middleware/kioskSpeakerAuth.js`
- Modify: `tests/unit/kioskSpeakerAuth.test.js` (mevcut testler — `getSpeakerVerifier()` artık `config` parametresi alıyor, zero-arg çağrı varsa güncellenir)

**Interfaces:**
- Consumes: `RealSpeakerVerifier` (Task 6), `MockSpeakerVerifier` (mevcut, değişmez).
- Produces: `function getSpeakerVerifier(config)` — `config.mode === 'real'` → `new RealSpeakerVerifier()`, aksi halde → `new MockSpeakerVerifier()`.

- [ ] **Step 1: Mevcut testi gözden geçir, gerekirse güncelle**

`tests/unit/kioskSpeakerAuth.test.js`'i oku; `getSpeakerVerifier` çağrısının artık `config` argümanı aldığını varsayan/doğrulayan bir assertion ekle (örn. `config.mode:'real'` verildiğinde `RealSpeakerVerifier` örneği döndüğünü doğrulayan yeni bir test).

- [ ] **Step 2: Testi çalıştırıp FAIL ettiğini doğrula (yeni eklenen assertion için)**

Run: `npm test -- kioskSpeakerAuth.test.js`
Expected: FAIL

- [ ] **Step 3: `getSpeakerVerifier` ve çağrı noktasını güncelle**

```js
function getSpeakerVerifier(config) {
  return (config && config.mode === 'real') ? new RealSpeakerVerifier() : new MockSpeakerVerifier();
}
```

`kioskSpeakerAuth` fonksiyonu içindeki `const verifier = getSpeakerVerifier();` çağrısını `getSpeakerVerifier(config)` olarak güncelle (config zaten `kioskService.getMockConfig(institutionId)`'den o satırdan önce okunmuş durumda).

- [ ] **Step 4: Testleri çalıştırıp PASS ettiklerini doğrula**

Run: `npm test -- kioskSpeakerAuth.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/middleware/kioskSpeakerAuth.js tests/unit/kioskSpeakerAuth.test.js
git commit -m "feat(speaker-id): dispatch mock vs real speaker verifier by institution config mode"
```

---

### Task 8: `kioskConfirmation.service.js` — evet/hayır, 3 sonuçlu sözleşme

**Files:**
- Modify: `src/services/kioskConfirmation.service.js`
- Modify: `tests/unit/kioskConfirmation.test.js` (digit-phrase testleri tamamen kaldırılır, yenileriyle değiştirilir)

**Interfaces:**
- Produces: `function createPendingConfirmation(roomId, payload)` → `{}` (artık `phrase` DÖNDÜRMEZ — çağıran taraf, Task 9'da, konuşmacı adı+eylem açıklamasından kendi "say" metnini kurar). `function resolvePendingConfirmation(roomId, answerText, confirmingUserId)` → `null` (bekleyen onay yok/süresi geçmiş — entry siliniyorsa silinir) **|** `{status:'unresolved'}` (anlaşılmaz metin VEYA yanlış konuşmacı — entry SİLİNMEZ) **|** `{status:'cancelled'}` (açık "hayır" — entry silinir) **|** `{status:'confirmed', payload}` (açık "evet", doğru konuşmacı — entry silinir).

- [ ] **Step 1: Başarısız testler — `tests/unit/kioskConfirmation.test.js`'i yeniden yaz**

```js
describe('kioskConfirmation.service — evet/hayır', () => {
  it('"evet" diyen başlatan kişiye confirmed+payload döner, entry silinir', () => {
    const { createPendingConfirmation, resolvePendingConfirmation } = require('../../src/services/kioskConfirmation.service');
    createPendingConfirmation('room1', { deviceId: 'd1', action: 'set_power', value: 20, initiatingUserId: 'u1' });
    const result = resolvePendingConfirmation('room1', 'evet', 'u1');
    expect(result).toEqual({ status: 'confirmed', payload: { deviceId: 'd1', action: 'set_power', value: 20, initiatingUserId: 'u1' } });
    expect(resolvePendingConfirmation('room1', 'evet', 'u1')).toBeNull(); // tek kullanımlık
  });

  it('"hayır" diyen başlatan kişiye cancelled döner, entry silinir', () => {
    // benzer kurulum; resolvePendingConfirmation(..., 'hayır', 'u1') → { status: 'cancelled' }
  });

  it('anlaşılmaz bir metin (ör. "ne dedin") unresolved döner, entry SİLİNMEZ (tekrar denenebilir)', () => {
    // resolvePendingConfirmation(..., 'ne dedin', 'u1') → { status: 'unresolved' }
    // ardından aynı roomId için 'evet' ile tekrar çağrıldığında hâlâ confirmed dönmeli.
  });

  it('başlatan kişi dışında biri "evet" derse unresolved döner, entry SİLİNMEZ', () => {
    // initiatingUserId:'u1' iken resolvePendingConfirmation(..., 'evet', 'u2') → unresolved;
    // ardından 'u1' aynı TTL içinde 'evet' derse confirmed dönmeli.
  });

  it('süre dolduktan sonra "evet" gelirse null döner, entry silinir', () => {
    // vi.useFakeTimers() ile TTL_MS (20000) aşılır, ardından resolvePendingConfirmation → null.
  });

  it('hiç bekleyen onay yoksa null döner', () => {
    const { resolvePendingConfirmation } = require('../../src/services/kioskConfirmation.service');
    expect(resolvePendingConfirmation('oda-yok', 'evet', 'u1')).toBeNull();
  });
});
```

- [ ] **Step 2: Testleri çalıştırıp FAIL ettiklerini doğrula**

Run: `npm test -- kioskConfirmation.test.js`
Expected: FAIL

- [ ] **Step 3: İmplementasyon**

`TTL_MS = 20000`. `createPendingConfirmation(roomId, payload)`: `randomDigit`/`phrase` üretimi kaldırılır; sadece `PENDING.set(roomId, {payload, expiresAt: Date.now()+TTL_MS})`; dönüş değeri `{}`. Evet/hayır tanıma için isimli regex sabitleri: `YES_RE = /^(evet|tamam|onaylıyorum|olur)\b/i`, `NO_RE = /^(hayır|hayir|yok|istemiyorum|iptal)\b/i` (metin trim+lowercase edilip test edilir). `resolvePendingConfirmation(roomId, answerText, confirmingUserId)`: entry yoksa `null`; süresi geçmişse `PENDING.delete(roomId); return null;`; konuşmacı uyuşmuyorsa (`payload.initiatingUserId !== undefined && !== confirmingUserId`) entry SİLİNMEDEN `{status:'unresolved'}`; `YES_RE` eşleşirse `PENDING.delete(roomId); return {status:'confirmed', payload: entry.payload};`; `NO_RE` eşleşirse `PENDING.delete(roomId); return {status:'cancelled'};`; hiçbiri eşleşmezse entry SİLİNMEDEN `{status:'unresolved'}`.

- [ ] **Step 4: Testleri çalıştırıp PASS ettiklerini doğrula**

Run: `npm test -- kioskConfirmation.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/kioskConfirmation.service.js tests/unit/kioskConfirmation.test.js
git commit -m "feat(speaker-id): replace digit-phrase confirmation with evet/hayır 3-outcome contract"
```

---

### Task 9: `kiosk.routes.js` — doğal dil onayı + hitap + UNKNOWN kademeli mesaj

**Files:**
- Modify: `src/routes/kiosk.routes.js`
- Modify: `src/validators/schemas.js` (`kioskVoiceCommandSchema`'da `confirmationPhrase` → `confirmationAnswer`)
- Create: `src/utils/kioskAddressing.js`
- Modify: `tests/integration/kioskVoiceCommand.device.test.js` (digit-phrase'e dayanan onay-akışı testleri — fork raporundaki (b),(c),(l),(m),(o),(p) — yeniden yazılır; diğer testler dokunulmaz)

**Interfaces:**
- Consumes: `createPendingConfirmation`/`resolvePendingConfirmation` (Task 8, yeni sözleşme), `req.speaker` (kioskSpeakerAuth'tan, `{userId, fullName, roleId, teamRole}` — değişmez).
- Produces: `src/utils/kioskAddressing.js`'ten `function addressSpeaker({fullName, roleId}) -> string` ve `function describeDeviceAction(groupKeyword, action, value) -> string` (export edilir, Task 9 içinde kullanılır).

- [ ] **Step 1: Başarısız testler — `src/utils/kioskAddressing.js` için yeni bir test dosyası + `kioskVoiceCommand.device.test.js` güncellemeleri**

`tests/unit/kioskAddressing.test.js` (yeni):
```js
describe('addressSpeaker', () => {
  it.each([
    [{ fullName: 'Dr. Ahmet Yılmaz', roleId: 6 }, 'Ahmet hocam'],
    [{ fullName: 'Misafir Dr. Zeynep Kaya', roleId: 10 }, 'Misafir hocam'], // unvan ön-eki "Dr." temizlenir, "Misafir" ilk kelime kalır — builder'ın ad çıkarma kuralını not et
    [{ fullName: 'Hem. Ayşe Korkmaz', roleId: 4 }, 'Ayşe'],
    [{ fullName: 'Tek. Mehmet Arslan', roleId: 3 }, 'Mehmet'],
  ])('%j için %s döner', (speaker, expected) => {
    const { addressSpeaker } = require('../../src/utils/kioskAddressing');
    expect(addressSpeaker(speaker)).toBe(expected);
  });
});

describe('describeDeviceAction', () => {
  it('set_power için "{grup}i {value} yapmamı" döner', () => {
    const { describeDeviceAction } = require('../../src/utils/kioskAddressing');
    expect(describeDeviceAction('koter', 'set_power', 20)).toBe('koteri 20 yapmamı');
  });
  it('turn_on için "{grup}i açmamı" döner', () => { /* ... */ });
  it('turn_off için "{grup}i kapatmamı" döner', () => { /* ... */ });
  it('arm_move için "masayı hareket için hazırlamamı" döner (sabit metin)', () => { /* ... */ });
});
```

`kioskVoiceCommand.device.test.js` içindeki digit-phrase testleri `confirmationAnswer: 'evet'`/`'hayır'` gönderecek şekilde yeniden yazılır; ayrıca yeni senaryolar eklenir:
```js
it('DEVICE_COMMAND ilk çağrısı artık isimli/doğal bir soru döner (rakam yok)', async () => {
  // say metninin addressSpeaker+describeDeviceAction'dan kurulu, "doğru mu?" ile bitti­ğini doğrula
});
it('"hayır" cevabı komut iptal edildi mesajıyla sonuçlanır, executeCommand ÇAĞRILMAZ', async () => { /* ... */ });
it('anlaşılmaz bir cevap sessizce pending_confirmation\'a döner (say boş/null, executeCommand ÇAĞRILMAZ)', async () => { /* ... */ });
```

- [ ] **Step 2: Testleri çalıştırıp FAIL ettiklerini doğrula**

Run: `npm test -- kioskAddressing.test.js kioskVoiceCommand.device.test.js`
Expected: FAIL

- [ ] **Step 3: `src/utils/kioskAddressing.js` implementasyonu**

```js
const HOCAM_ROLE_IDS = [6, 10];
const TITLE_PREFIXES_RE = /^(dr\.?|uzm\.?|tek\.?|hem\.?|srl\.?|sn\.?)\s+/i;

function addressSpeaker({ fullName, roleId }) {
  const name = (fullName || '').replace(TITLE_PREFIXES_RE, '').trim().split(/\s+/)[0] || '';
  return HOCAM_ROLE_IDS.includes(roleId) ? `${name} hocam` : name;
}

function describeDeviceAction(groupKeyword, action, value) {
  if (action === 'set_power') return `${groupKeyword}i ${value} yapmamı`;
  if (action === 'turn_on') return `${groupKeyword}i açmamı`;
  if (action === 'turn_off') return `${groupKeyword}i kapatmamı`;
  if (action === 'arm_move') return 'masayı hareket için hazırlamamı';
  return `${groupKeyword} için istediğiniz işlemi`;
}

module.exports = { addressSpeaker, describeDeviceAction };
```

(`groupKeyword` zaten `kiosk.routes.js`'in kendi `DEVICE_GROUP_MAP` anahtarı — kullanıcının söylediği Türkçe kelime, örn. "koter"/"ligasure"/"ışık"/"lamba"/"masa" — yeni bir çeviri tablosu gerekmez, kullanıcının kendi kelimesi geri okunur. "i" eki basitleştirilmiştir — "ışığı"/"lambayı" gibi ünlü uyumu farkları builder'ın kabul ettiği bir sadeleştirmedir, dilbilgisel kusursuzluk bu planın kapsamı dışındadır.)

- [ ] **Step 4: `src/validators/schemas.js`'de `kioskVoiceCommandSchema` güncellemesi**

`confirmationPhrase: z.string().optional()` → `confirmationAnswer: z.string().optional()`.

- [ ] **Step 5: `kiosk.routes.js` DEVICE_COMMAND ve onay dallarını güncelle**

- Dosya başındaki `const { confirmationPhrase } = req.body;` → `const { confirmationAnswer } = req.body;`, aşağıdaki `typeof confirmationPhrase === 'string' && ...` kontrolü de yeni ada göre güncellenir.
- Onay dalı: `resolvePendingConfirmation(req.kiosk.roomId, confirmationAnswer, req.speaker.userId)` çağrısının sonucuna göre dallan:
  - `null` → mevcut `CONFIRMATION_MISMATCH_BODY` ile 400 (değişmez — "bekleyen onay yok/süresi geçti").
  - `{status:'unresolved'}` → `return ok(res, { type: 'DEVICE_COMMAND', status: 'pending_confirmation', say: null });`
  - `{status:'cancelled'}` → `return ok(res, { type: 'DEVICE_COMMAND', say: 'Komut iptal edildi.' });`
  - `{status:'confirmed', payload}` → mevcut `executeCommand(...)` çağrısı, artık `payload.deviceId`/`payload.action`/`payload.value` üzerinden (değişmez mantık).
- DEVICE_COMMAND ilk-çağrı dalı: `createPendingConfirmation(...)` çağrısından artık `phrase` DESTRUCTURE EDİLMEZ (kullanılmıyor); `say` metni `` `${addressSpeaker(req.speaker)}, ${describeDeviceAction(groupKeyword, derived.action, derived.value)}, doğru mu?` `` olarak kurulur; yanıt `{ type:'DEVICE_COMMAND', status:'pending_confirmation', say: <bu metin> }` (artık `phrase` alanı YOK).

- [ ] **Step 6: UNKNOWN için kademeli mesaj (ardışık iki başarısız deneme)**

Modül seviyesinde küçük bir Map ekle: `const UNKNOWN_STREAK = new Map();` (roomId → ardışık UNKNOWN sayacı, `kioskConfirmation.service.js`'teki bellek-içi Map deseniyle tutarlı). `intent.type === 'UNKNOWN'` dalında: sayaç 0'dan 1'e çıkarsa `UNKNOWN_RESPONSE` ("Anlayamadım, tekrar söyler misiniz?") dön; sayaç 2 veya üstüyse `{ type:'UNKNOWN', say: 'Ne demek istediğinizi anlamadım, herhangi bir işlem yapmıyorum.' }` dön. Herhangi bir BAŞKA intent tipi (TIMEOUT/DEVICE_COMMAND/SPOTIFY_PLAY/WEB_SEARCH, onay dalı dahil) o roomId'nin sayacını sıfırlar (`UNKNOWN_STREAK.delete(req.kiosk.roomId)`).

- [ ] **Step 7: Testleri çalıştırıp PASS ettiklerini doğrula**

Run: `npm test -- kioskAddressing.test.js kioskVoiceCommand.device.test.js`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/utils/kioskAddressing.js src/routes/kiosk.routes.js src/validators/schemas.js tests/unit/kioskAddressing.test.js tests/integration/kioskVoiceCommand.device.test.js
git commit -m "feat(speaker-id): natural-language yes/no confirmation with personalized addressing"
```

---

### Task 10: Tam test paketi + regresyon taraması

**Files:**
- Modify: (gerekirse) herhangi bir kalan test dosyası

**Interfaces:** Yok — bu task sadece doğrulama.

- [ ] **Step 1: Tam backend test paketini çalıştır**

Run: `npm test`
Expected: Tüm testler PASS (Task 1-9'da değiştirilmeyen hiçbir dosya kırılmamış olmalı — özellikle `tests/unit/mockSpeakerVerifier.test.js`, `tests/integration/kioskVoiceCommand.device.test.js`'in intent-parsing/device-group testleri, `device.service.js`'e dair tüm testler).

- [ ] **Step 2: Herhangi bir beklenmeyen kırılma varsa kök nedeni bul ve düzelt**

(Bu task'ta yeni davranış eklenmez — sadece önceki task'ların bıraktığı regresyonlar giderilir.)

- [ ] **Step 3: Commit (sadece düzeltme varsa)**

```bash
git add -A
git commit -m "fix(speaker-id): resolve test regressions from speaker-id rollout"
```
