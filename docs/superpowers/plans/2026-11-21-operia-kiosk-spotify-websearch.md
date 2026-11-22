# Operia — Kiosk Sesli Asistan (Spotify + Web Arama + Time-Out) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Oda-sabit kiosk ekranından, ses-biyometri doğrulamasıyla, hem cihaz kontrolü (Plan 1'in üzerine, sesle) hem de kritik-olmayan Operia komutlarını (Spotify kontrolü, web arama, Time-Out hatırlatması) çalıştırılabilir hale getirmek.

**Architecture:** Kiosk, kişisel JWT yerine oda-bağlı bir **kiosk token** ile çalışır. Her komutta backend: (1) kiosk token + odadaki aktif (IN_PROGRESS) ameliyatı doğrular, (2) komut tipine göre (Time-Out hariç) `SpeakerVerifier` ile konuşmacıyı o ameliyatın ekibi içinden tanır, (3) transkripti pure bir `parseIntent()` ile sınıflandırır, (4) ilgili servise delege eder — cihaz komutları mevcut (Plan 1) `device.service.js`'e, Spotify yeni bir OAuth+mock-sürücü akışına, web arama mevcut `ai.service.js`'in (Operia) Claude istemcisine `web_search` aracıyla genişletilmiş haline. Cihaz komutları ek olarak rastgele bir ifadeyle sesli onay döngüsünden geçer (in-memory, kısa ömürlü).

**Tech Stack:** Backend: Express + `pg` (ham SQL), `jsonwebtoken`, `@anthropic-ai/sdk` (zaten bağımlı), Spotify Web API (yeni `node-fetch`/yerleşik `fetch`, ek paket gerekmez — Node 18+ global fetch). Frontend: React 19 + Vite, Web Speech API (`SpeechRecognition` + `speechSynthesis`), `MediaRecorder`.

**Spec:** `docs/superpowers/specs/2026-11-20-sesli-cihaz-kontrolu-design.md` (bu plan, "Karar verilen tasarım" + "Operia — Genişletilmiş Kapsam" bölümlerini uygular; executor'lar her ikisini de okumalı).

## Global Constraints

- Web Speech API pratikte Chrome/Edge ile sınırlı; mikrofon izni + HTTPS/localhost gerekir.
- Mevcut yığına uyum: React 19 + Vite + Zustand, Express + `pg` (ham SQL), Socket.io. Yeni ORM/mimari katman yok.
- Mevcut `authenticate`/`authorize(...roleIds)` ve `audit_logs`/`audit()` kullanılacak — yeni bir log sistemi icat edilmeyecek.
- Ses biyometrisi (embedding) KVKK'da özel nitelikli veri — ham ses asla kalıcı saklanmaz, sadece enrollment embedding'i.
- Kiosk uyandırma kelimesi **"Operio"** değişmez; asistan kendi kimliğinden bahsederken **"Operia"** adını kullanır.
- Sesli onay ve fiziksel onay zaman aşımı: **10 saniye** (bu planda karara bağlandı).
- Spotify/web arama "taban kapı": oda + aktif `IN_PROGRESS` ameliyat + ses-biyometri zorunlu — cihaz komutlarıyla aynı kapı, sadece ek rol kısıtı yok.
- Spotify/web-arama **sesli onay döngüsünden geçmez** (bu planda karara bağlandı — "kritik olmayan" oldukları için tek adımda çalışır); confirm-phrase döngüsü sadece cihaz komutlarında (4 grup) var.
- Spotify'ın gerçek `play`/`transfer-playback` uç noktası bu fazda **hiç çağrılmaz** — sadece `search` gerçek, oynatma mock.
- Web arama sorgu metni Claude API'ye (3. taraf) gider — bu demo/prototip fazı için bilinçli kabul edilmiş bir sınırlama, redaksiyon eklenmiyor.
- Time-Out okuması hiçbir doğrulama katmanından geçmez (sadece kiosk token + modül + aktif ameliyat kontrolü) — spesifikasyonun kendi kararı.

## Review Focus

- Kiosk token'ın bağlı olduğu `room_id` ile istekte gönderilen `roomId` uyuşmuyorsa komut reddedilmeli (token çalınıp başka odada kullanılması).
- Bir cihaz komutu "onay bekliyor" (pending confirmation) durumundayken ameliyat `IN_PROGRESS` olmaktan çıkarsa, onay anında bu tekrar kontrol edilip stale onay reddedilmeli.
- "Hiç tanınmadı" (unrecognized) ile "tanındı ama ekipte değil" ret mesajları birbirine karışmamalı — kullanıcıya doğru, isme özel mesaj dönmeli.
- Spotify hesabı bağlı olmayan bir kullanıcı "Spotify'da çal" dediğinde jenerik bir hataya değil, "hesabınız bağlı değil, Profil'den bağlayın" mesajına düşmeli.
- Çok kısa/boş/anlamsız bir transcript (düşük güvenli STT çıktısı) web aramaya veya cihaz komutuna gitmeden `UNKNOWN` olarak elenmeli.

---

## Backend (`operio-backend`)

### Task 1: Veri modeli — kiosk/ses/Spotify tabloları

**Files:**
- Modify: `migrations/001_init.sql` (sona eklenir)
- Test: `tests/unit/migrations.test.js` (yeni — sadece migration dosyasının geçerli SQL olduğunu, ilgili tabloların/kolonların var olduğunu kontrol eden bir smoke test; mevcut testlerin hiçbiri migration'ı gerçek bir DB'ye uygulamıyor, bu yüzden bu test de uygulamıyor, sadece dosya içeriğini statik olarak (regex ile tablo adlarını arayarak) doğruluyor — projede hâlâ gerçek bir test-DB'si yok)

**Interfaces:**
- Produces: `voice_profiles(user_id, embedding, model_version, enrolled_at)`, `kiosk_tokens(id, institution_id, room_id, jti, revoked_at, created_at)`, `kiosk_mock_config(institution_id PK, mode, cycle_index)`, `user_spotify_connections(user_id, spotify_user_id, access_token, refresh_token, expires_at, connected_at)` — sonraki tüm backend task'ları bu tablolara `db.query` ile erişir.

- [ ] **Step 1: `migrations/001_init.sql`'e dört tabloyu ekle**

```sql
CREATE TABLE IF NOT EXISTS voice_profiles (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  embedding     BYTEA       NOT NULL,
  model_version VARCHAR(30) NOT NULL,
  enrolled_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS kiosk_tokens (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID        NOT NULL REFERENCES institutions(id),
  room_id        UUID        NOT NULL REFERENCES operating_rooms(id),
  jti            VARCHAR(64) NOT NULL UNIQUE,
  revoked_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kiosk_tokens_room ON kiosk_tokens(room_id);

CREATE TABLE IF NOT EXISTS kiosk_mock_config (
  institution_id UUID        PRIMARY KEY REFERENCES institutions(id),
  mode           VARCHAR(20) NOT NULL DEFAULT 'always_match'
                 CHECK (mode IN ('always_match','always_reject_team','always_unrecognized','cycle')),
  cycle_index    INTEGER     NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_spotify_connections (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  spotify_user_id VARCHAR(100) NOT NULL,
  access_token    TEXT        NOT NULL,
  refresh_token   TEXT        NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  connected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 2: `tests/unit/migrations.test.js` yaz — dört tablo adının da dosyada geçtiğini doğrula**

```js
import { readFileSync } from 'fs';
test('001_init.sql defines kiosk/voice/spotify tables', () => {
  const sql = readFileSync('migrations/001_init.sql', 'utf8');
  for (const table of ['voice_profiles', 'kiosk_tokens', 'kiosk_mock_config', 'user_spotify_connections']) {
    expect(sql).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
});
```

- [ ] **Step 3: Testi çalıştır, geçtiğini doğrula** — `npm test -- migrations`
- [ ] **Step 4: Commit** — `git add migrations/001_init.sql tests/unit/migrations.test.js && git commit -m "feat(kiosk): add voice/kiosk-token/spotify tables"`

---

### Task 2: Kiosk token imzalama + `kioskRoomAuth` middleware

**Files:**
- Create: `src/utils/kioskJwt.js`
- Create: `src/middleware/kioskRoomAuth.js`
- Create: `src/services/kiosk.service.js`
- Test: `tests/unit/kioskJwt.test.js`, `tests/unit/kioskRoomAuth.test.js`

**Interfaces:**
- Consumes: Plan 1'in `module.service.js`'teki `hasActiveModule(institutionId, slug)`.
- Produces: `signKioskToken({ institutionId, roomId, jti }): string`, `verifyKioskToken(token): { institutionId, roomId, jti }` (throws on invalid/expired). `kioskRoomAuth(req, res, next)` — `Authorization: Bearer <kioskToken>` okur, `verifyKioskToken` ile doğrular, `kiosk_tokens`'ta `jti` için `revoked_at IS NULL` kontrolü yapar, URL'deki `:roomId` ile token'ın `roomId`'si eşleşmiyorsa 403, ardından `hasActiveModule(institutionId, 'voice_control')` kontrolü yapar (yoksa 403 `{code:'module_not_purchased'}` — spesifikasyonun "`requireModule('voice_control')`" şartı, kişisel JWT olmadığı için mevcut `requireModule` middleware'i değil, bu fonksiyon doğrudan çağrılarak uygulanır), sonra o oda için `IN_PROGRESS` ameliyat sorgular — yoksa 409 (`{code:'no_active_surgery'}`) döner, varsa `req.kiosk = { institutionId, roomId }` ve `req.activeSurgery = { id, surgeryTeams: [{ userId, fullName, roleId, teamRole }] }` atar ve `next()` çağırır (`surgery_teams` ile `users` JOIN edilir — `role_id` ve `full_name` buradan gelir, ikisi de aşağıdaki Task 4'ün ret mesajları ve Task 7'nin `authorize` eşdeğeri rol kontrolü için gerekli). Sonraki tüm kiosk route'ları bu middleware'i kullanır.

- [ ] **Step 1: `tests/unit/kioskJwt.test.js` — sign/verify round-trip ve geçersiz token testleri yaz**

```js
test('signs and verifies a kiosk token', () => {
  const token = signKioskToken({ institutionId: 'inst-1', roomId: 'room-1', jti: 'abc' });
  const payload = verifyKioskToken(token);
  expect(payload).toMatchObject({ institutionId: 'inst-1', roomId: 'room-1', jti: 'abc' });
});

test('throws on a tampered token', () => {
  const token = signKioskToken({ institutionId: 'inst-1', roomId: 'room-1', jti: 'abc' });
  expect(() => verifyKioskToken(token + 'x')).toThrow();
});
```

- [ ] **Step 2: Testleri çalıştır, fail ettiklerini doğrula**
- [ ] **Step 3: `src/utils/kioskJwt.js`'i implemente et** — `jsonwebtoken` ile, ayrı bir `process.env.KIOSK_JWT_SECRET` (yoksa `.env.example`'a eklenir), `expiresIn: '3650d'` (uzun ömürlü, admin panelinden revoke edilebilir).
- [ ] **Step 4: Testleri çalıştır, geçtiklerini doğrula**
- [ ] **Step 5: `tests/unit/kioskRoomAuth.test.js` yaz** — `_registry` deseniyle `db` çağrılarını değil, middleware'i doğrudan mock bir `req/res/next` ile çağırıp şu senaryoları test et: (a) token yok → 401, (b) token geçerli ama `kiosk_tokens`'ta revoked → 403, (c) token'ın `roomId`'si URL'deki `:roomId` ile uyuşmuyor → 403 (Review Focus #1), (d) `hasActiveModule` false → 403 `module_not_purchased`, (e) modül aktif ama o odada `IN_PROGRESS` ameliyat yok → 409 `no_active_surgery`, (f) her şey geçerli → `next()` çağrılır, `req.kiosk`/`req.activeSurgery` dolu. DB sorguları `_registry`'den bir `kiosk` servisi (`getActiveSurgeryForRoom(roomId)`, `isTokenRevoked(jti)`) ve mevcut `module` servisinin (`registry.get('module')`) `hasActiveModule`'ü üzerinden yapılır ki test'te mocklanabilsin (bu projenin CJS/`vi.mock` kısıtı nedeniyle — bkz. Plan 1'in aynı kısıtı).
- [ ] **Step 6: `src/services/kiosk.service.js`'e `getActiveSurgeryForRoom(roomId)` (surgery + `surgery_teams` JOIN, `status='IN_PROGRESS'`) ve `isTokenRevoked(jti)` ekle; `src/middleware/kioskRoomAuth.js`'i bu servisi ve `registry.get('module').hasActiveModule` çağrısını kullanacak şekilde implemente et.**
- [ ] **Step 7: Testleri çalıştır, geçtiklerini doğrula**
- [ ] **Step 8: Commit**

---

### Task 3: Kiosk admin endpoint'leri — token üretimi/iptali, mock-config

**Files:**
- Create: `src/routes/kioskAdmin.routes.js`
- Modify: `src/services/kiosk.service.js` (Task 2'de oluşturuldu)
- Modify: `src/app.js` (route mount)
- Test: `tests/integration/kioskAdmin.test.js`

**Interfaces:**
- Consumes: Task 2'nin `signKioskToken`; `authenticate`/`authorize` (mevcut).
- Produces: `POST /api/kiosk-admin/rooms/:roomId/token` (roller 0,11,12 — önceki aktif token'ı `revoked_at=NOW()` yapar, yeni `jti` ile yeni token üretir, `kiosk_tokens`'a INSERT eder, `{ token, kioskUrl: '/kiosk/:roomId' }` döner), `POST /api/kiosk-admin/rooms/:roomId/token/revoke`, `GET /api/kiosk-admin/mock-config`, `PUT /api/kiosk-admin/mock-config` (body `{ mode }`, `institution_modules`'tan değil `kiosk_mock_config`'den — upsert).

- [ ] **Step 1: `tests/integration/kioskAdmin.test.js` yaz** — Plan 1'in `tests/integration/module.test.js`'teki `_registry` + `supertest` desenini izleyerek: (a) rol 4 (hemşire) ile token üretimi → 403, (b) rol 0 ile üretim → 200 + token string + eski token'ın revoke edildiğinin mock servis çağrısından doğrulanması, (c) `PUT /mock-config` geçersiz `mode` değeriyle → 400 (zod), (d) geçerli `mode` ile → 200.
- [ ] **Step 2: Testleri çalıştır, fail ettiklerini doğrula**
- [ ] **Step 3: `src/services/kiosk.service.js`'e `createKioskToken(institutionId, roomId)`, `revokeKioskToken(roomId)`, `getMockConfig(institutionId)`, `setMockConfig(institutionId, mode)` ekle; `src/validators/schemas.js`'e `mockConfigSchema` ekle; `src/routes/kioskAdmin.routes.js`'i yaz, `src/app.js`'e `/api/kiosk-admin` olarak mount et.**
- [ ] **Step 4: Testleri çalıştır, geçtiklerini doğrula**
- [ ] **Step 5: Commit**

---

### Task 4: `SpeakerVerifier` + `MockSpeakerVerifier` + `kioskSpeakerAuth`

**Files:**
- Create: `src/drivers/SpeakerVerifier.js`, `src/drivers/MockSpeakerVerifier.js`
- Create: `src/middleware/kioskSpeakerAuth.js`
- Test: `tests/unit/mockSpeakerVerifier.test.js`, `tests/unit/kioskSpeakerAuth.test.js`

**Interfaces:**
- Consumes: Task 2'nin `kioskRoomAuth` (bu middleware ondan sonra zincirlenir, `req.activeSurgery.surgeryTeams` kullanır), Task 3'ün `getMockConfig`.
- Produces: `SpeakerVerifier.identify(audioBuffer, candidateUserIds): Promise<{userId, confidence} | null>` (abstract), `MockSpeakerVerifier` bu arayüzü `mode`'a göre uygular. `kioskSpeakerAuth(req, res, next)` — `req.activeSurgery.surgeryTeams`'ten `candidateUserIds` çıkarır, `identify()` çağırır: sonuç `null` → 403 `{code:'unrecognized', message:'Sizi tanıyamadım...'}`; sonuç dolu ama `userId` o ekipte değil → 403 `{code:'not_in_team', message:'{isim}, bu ameliyatta görevli değilsiniz, komut veremezsiniz'}`; ekipteyse eşleşen candidate'in `req.activeSurgery.surgeryTeams`'teki tam kaydından `req.speaker = { userId, fullName, roleId, teamRole }` ile `next()` (hiçbir ek sorgu gerekmez — bu alanlar zaten Task 2'nin JOIN'inden `req.activeSurgery.surgeryTeams`'te mevcuttur).

- [ ] **Step 1: `tests/unit/mockSpeakerVerifier.test.js` yaz** — `mode='always_match'` → ilk candidate'i döner; `mode='always_reject_team'` → candidate listesinde OLMAYAN bir `userId` döner (ekip-dışı reddi simüle etmek için); `mode='always_unrecognized'` → `null` döner; `mode='cycle'` → ardışık çağrılarda `cycle_index`'e göre farklı candidate döner ve index'i artırır.
- [ ] **Step 2: Testleri çalıştır, fail ettiklerini doğrula**
- [ ] **Step 3: `SpeakerVerifier` base class'ı ve `MockSpeakerVerifier`'ı implemente et.**
- [ ] **Step 4: Testleri çalıştır, geçtiklerini doğrula**
- [ ] **Step 5: `tests/unit/kioskSpeakerAuth.test.js` yaz** — Review Focus #3'ü kapsayan iki ayrı senaryo: (a) `identify()` `null` dönerse yanıt mesajı `"Sizi tanıyamadım"` İÇERMELİ, isim İÇERMEMELİ; (b) `identify()` ekip-dışı bir `userId` dönerse yanıt mesajı o kişinin `full_name`'ini İÇERMELİ ve `"görevli değilsiniz"` İÇERMELİ — bu iki mesaj birbirinden net ayrılmalı. Ayrıca: ekipteyse `req.speaker` doğru dolduğunu doğrula.
- [ ] **Step 6: Testleri çalıştır, fail ettiklerini doğrula**
- [ ] **Step 7: `src/middleware/kioskSpeakerAuth.js`'i implemente et — `registry.get('kiosk').getMockConfig(...)` ile config okuyup `MockSpeakerVerifier`'a geçirir (driver seçimi `driver_key`'siz, şimdilik tek seçenek Mock — `registry.js` Plan 1'deki cihaz sürücü registry'siyle karıştırılmaz, ayrı küçük bir seçim).**
- [ ] **Step 8: Testleri çalıştır, geçtiklerini doğrula**
- [ ] **Step 9: Commit**

---

### Task 5: Ses profili kaydı (enrollment)

**Files:**
- Create: `src/services/voiceProfile.service.js`
- Create: `src/routes/voiceProfile.routes.js`
- Modify: `src/app.js` (mount)
- Test: `tests/unit/voiceProfile.test.js`, `tests/integration/voiceProfile.test.js`

**Interfaces:**
- Produces: `enrollVoiceProfile(userId, audioBase64): { modelVersion, enrolledAt }` (pure-ish: `audioBase64` → `crypto.createHash('sha256').update(buffer).digest()` → `BYTEA` olarak saklanır, `model_version='mock-v1'` — gerçek embedding modeli ayrı bir araştırma adımı olduğu için placeholder), `getVoiceProfile(userId): { enrolledAt, modelVersion } | null`. Route: `POST /api/profile/voice-enrollment` (authenticate, body `{ audio: base64 }`), `GET /api/profile/voice-enrollment` (authenticate) — kişisel JWT ile, kiosk token'la değil.

- [ ] **Step 1: `tests/unit/voiceProfile.test.js` yaz** — `enrollVoiceProfile`'ın hash fonksiyonunun deterministik olduğunu (aynı girdi → aynı hash) ve `modelVersion='mock-v1'` döndürdüğünü doğrulayan pure fonksiyon testleri.
- [ ] **Step 2: Testleri çalıştır, fail ettiklerini doğrula**
- [ ] **Step 3: `voiceProfile.service.js`'i implemente et** (hash hesaplama pure, DB insert/upsert thin).
- [ ] **Step 4: Testleri çalıştır, geçtiklerini doğrula**
- [ ] **Step 5: `tests/integration/voiceProfile.test.js` yaz** — `_registry` ile `voiceProfile` servisini mocklayıp: 401 (auth yok), 200 (enroll başarılı), `GET` ile önceden enroll edilmemiş kullanıcı için `null`/404.
- [ ] **Step 6: Testleri çalıştır, fail ettiklerini doğrula**
- [ ] **Step 7: `src/routes/voiceProfile.routes.js`'i yaz, `src/app.js`'e `/api/profile/voice-enrollment` olarak mount et.**
- [ ] **Step 8: Testleri çalıştır, geçtiklerini doğrula**
- [ ] **Step 9: Commit**

---

### Task 6: Kiosk voice-command route — intent parser + Time-Out dalı

**Files:**
- Create: `src/utils/kioskIntent.js`
- Create: `src/routes/kiosk.routes.js`
- Modify: `src/app.js` (mount)
- Test: `tests/unit/kioskIntent.test.js`, `tests/integration/kioskVoiceCommand.timeout.test.js`

**Interfaces:**
- Produces: `parseIntent(transcript: string): { type: 'DEVICE_COMMAND'|'SPOTIFY_PLAY'|'WEB_SEARCH'|'TIMEOUT'|'UNKNOWN', params: object }` (pure). `POST /api/kiosk/rooms/:roomId/voice-command` (body `{ transcript, audio }`) — `kioskRoomAuth` → `parseIntent(transcript)` → `type==='TIMEOUT'` ise `req.speaker` HİÇ gerekmez, doğrudan sabit iki maddeyi döner + `audit()` (`action='voice:timeout_read'`) yazar; `type==='UNKNOWN'` veya transcript çok kısa (< 3 karakter, Review Focus #5) ise `{ type:'UNKNOWN', say: 'Anlayamadım, tekrar söyler misiniz?' }` döner. (Diğer dallar sonraki task'larda eklenir.)

- [ ] **Step 1: `tests/unit/kioskIntent.test.js` yaz** — her tip için en az 2 örnek Türkçe cümle:
  - `TIMEOUT`: "Operio time-out", "operio zaman aşımı" (not: komut metninde uyandırma kelimesi zaten client tarafında ayıklanmış geliyor varsayımıyla, transcript'in kendisi sadece komut kısmı — "time-out", "zaman aşımı")
  - `DEVICE_COMMAND`: "koteri yirmi yap", "ışığı aç"
  - `SPOTIFY_PLAY`: "spotify'da seksenler çalsın", "spotify aç müzik çal"
  - `WEB_SEARCH`: "ara: parasetamol dozu", "bul fenerbahçe kaç kaç bitti"
  - `UNKNOWN`: "", "asdasd"
- [ ] **Step 2: Testleri çalıştır, fail ettiklerini doğrula**
- [ ] **Step 3: `parseIntent`'i implemente et** — basit anahtar-kelime regex sınıflandırması (ör. `/time.?out|zaman aşımı/i` → TIMEOUT, `/spotify/i` → SPOTIFY_PLAY, `/^(ara|bul)[:\s]/i` → WEB_SEARCH, cihaz-grubu kelimeleri `koter|ligasure|ışık|lamba|masa` → DEVICE_COMMAND, hiçbiri eşleşmez veya `transcript.trim().length < 3` → UNKNOWN). `DEVICE_COMMAND` için `params`'a eşleşen cihaz-grubu anahtar kelimesini ve varsa metindeki sayıyı (`\d+`) koy.
- [ ] **Step 4: Testleri çalıştır, geçtiklerini doğrula**
- [ ] **Step 5: `tests/integration/kioskVoiceCommand.timeout.test.js` yaz** — `_registry` ile `kiosk` servisini mocklayıp: TIMEOUT transcript gönderildiğinde 200 + iki sabit Türkçe madde metni + `audit()`'in `action='voice:timeout_read'` ile çağrıldığının doğrulanması (mock audit fonksiyonu üzerinden); UNKNOWN için 200 + `say` alanı dolu.
- [ ] **Step 6: Testleri çalıştır, fail ettiklerini doğrula**
- [ ] **Step 7: `src/routes/kiosk.routes.js`'i yaz (sadece TIMEOUT/UNKNOWN dalları; DEVICE_COMMAND/SPOTIFY_PLAY/WEB_SEARCH sonraki task'larda eklenecek `if` dalları olarak yer tutucu bırakılır), `src/app.js`'e `/api/kiosk` olarak mount et.**
- [ ] **Step 8: Testleri çalıştır, geçtiklerini doğrula**
- [ ] **Step 9: Commit**

---

### Task 7: Kiosk voice-command route — cihaz komutu dalı + sesli onay döngüsü

**Files:**
- Create: `src/services/kioskConfirmation.service.js`
- Modify: `src/routes/kiosk.routes.js` (DEVICE_COMMAND dalı)
- Test: `tests/unit/kioskConfirmation.test.js`, `tests/integration/kioskVoiceCommand.device.test.js`

**Interfaces:**
- Consumes: Task 4'ün `kioskSpeakerAuth` (`req.speaker = {userId, fullName, roleId, teamRole}`), Plan 1'in `deviceService.listDevices({institutionId, roomId})` (NOT `deviceGroup` filtresi — client/route tarafında filtrelenir) ve `executeCommand({deviceId, institutionId, userId, roleId, action, value, req})`.
- Produces: `createPendingConfirmation(roomId, payload): { phrase }` (3 rastgele rakam, `-` ile, bellekte `Map<roomId, {phrase, payload, expiresAt}>`, 10sn TTL), `resolvePendingConfirmation(roomId, saidPhrase): payload | null` (eşleşmiyor/süresi geçmiş → `null`, eşleşiyor → entry silinir + `payload` döner — Review Focus #2: `payload`'ın `surgeryId`'si çağıran tarafından hâlâ `IN_PROGRESS` mi diye TEKRAR kontrol edilir, resolvePendingConfirmation'ın kendisi DB'ye bakmaz, bu kontrol route'ta yapılır).

- [ ] **Step 1: `tests/unit/kioskConfirmation.test.js` yaz** — oluşturulan phrase'in `\d-\d-\d` formatında olduğu; doğru phrase ile `resolvePendingConfirmation` payload'ı döndürüp entry'yi sildiği (ikinci çağrıda `null`); yanlış phrase ile `null` döndüğü; `expiresAt` geçmişse (zaman mocklanarak) doğru phrase bile olsa `null` döndüğü (Review Focus #2'nin alt parçası).
- [ ] **Step 2: Testleri çalıştır, fail ettiklerini doğrula**
- [ ] **Step 3: `kioskConfirmation.service.js`'i implemente et** (in-memory `Map`, DB yok — bu projenin CJS/db-mock kısıtından tamamen muaf, saf JS).
- [ ] **Step 4: Testleri çalıştır, geçtiklerini doğrula**
- [ ] **Step 5: `tests/integration/kioskVoiceCommand.device.test.js` yaz** — (a) ilk çağrı (DEVICE_COMMAND transcript, `confirmationPhrase` yok) → `kioskSpeakerAuth` geçer → 200 + `{status:'pending_confirmation', phrase}`; (b) ikinci çağrı aynı `roomId` + doğru `confirmationPhrase` + aynı transcript → `deviceService.decideCommand`/`executeCommand`'ın (mock `_registry` ile) doğru parametrelerle çağrıldığı ve 200 sonuç döndüğü; (c) ikinci çağrıda ameliyat artık `IN_PROGRESS` değilse (mock `kioskRoomAuth` zaten üst katmanda 409 döner — bu zaten Task 2'nin kapsamında, burada ayrıca test edilmez) — bunun yerine burada test edilen: ikinci çağrıda YANLIŞ `confirmationPhrase` → 400 `{code:'confirmation_mismatch'}`.
- [ ] **Step 6: Testleri çalıştır, fail ettiklerini doğrula**
- [ ] **Step 7: `src/routes/kiosk.routes.js`'in DEVICE_COMMAND dalını implemente et** — gerçek `deviceService.listDevices({ institutionId, roomId })` imzası bir `deviceGroup` filtresi ALMAZ (sadece kurum+oda filtreler) — bu yüzden `listDevices({ institutionId: req.kiosk.institutionId, roomId: req.kiosk.roomId })` çağrılıp dönen listeden `params`'taki cihaz-grubu anahtar kelimesiyle eşleşen `device_group`'a sahip ilk cihaz route handler'ında seçilir (birden fazla eşleşirse ilkini alır — builder notu). `confirmationPhrase` yoksa `createPendingConfirmation` ile phrase üretip döner; varsa `resolvePendingConfirmation` ile payload'ı çözüp `deviceService.executeCommand({ deviceId, institutionId: req.kiosk.institutionId, userId: req.speaker.userId, roleId: req.speaker.roleId, action, value, req })` çağırır — `executeCommand` kendi içinde `getActiveAssignment` ile oda/ekip rolünü zaten yeniden doğrular (bkz. `device.service.js:216`), bu route'ta `teamRole` ayrıca geçirilmez/kontrol edilmez.
- [ ] **Step 8: Testleri çalıştır, geçtiklerini doğrula**
- [ ] **Step 9: Commit**

---

### Task 8: Spotify OAuth bağlantısı

**Files:**
- Create: `src/services/spotify.service.js`
- Create: `src/routes/spotify.routes.js`
- Modify: `src/app.js` (mount)
- Test: `tests/unit/spotify.service.test.js`, `tests/integration/spotify.routes.test.js`

**Interfaces:**
- Produces: `getAuthorizeUrl(userId): string` (state=imzalı `userId`, `signKioskToken`'dan farklı, mevcut `jsonwebtoken` ile basit bir state token), `exchangeCodeForToken(code): { accessToken, refreshToken, expiresIn, spotifyUserId }` (gerçek Spotify `/api/token` çağrısı — `fetch`), `saveConnection(userId, tokenData)`, `getConnection(userId): row | null`, `refreshAccessTokenIfNeeded(userId): accessToken` (expiry kontrolü, gerekirse `fetch` ile yenileme + DB güncelleme), `disconnect(userId)`. Routes (hepsi `authenticate`): `GET /api/spotify/connect` → `{ url }`, `GET /api/spotify/callback` (public, Spotify redirect eder — `state`'ten userId çözülür), `POST /api/spotify/disconnect`.

- [ ] **Step 1: `tests/unit/spotify.service.test.js` yaz** — `getAuthorizeUrl`'ün döndürdüğü URL'nin `client_id`/`redirect_uri`/`state` query param'larını içerdiğini (gerçek `fetch` çağrısı YOK, sadece URL string testi — pure); `refreshAccessTokenIfNeeded`'ın `expires_at` gelecekteyse `fetch` ÇAĞIRMADIĞINI (mevcut access token'ı döndürdüğünü), geçmişteyse yenileme akışını tetiklediğini — `fetch` global'i `vi.stubGlobal` ile mocklanarak.
- [ ] **Step 2: Testleri çalıştır, fail ettiklerini doğrula**
- [ ] **Step 3: `spotify.service.js`'i implemente et.** `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET`/`SPOTIFY_REDIRECT_URI` ortam değişkenleri `.env.example`'a eklenir (gerçek değerler builder'a bırakılmıştı, zaten dokümante).
- [ ] **Step 4: Testleri çalıştır, geçtiklerini doğrula**
- [ ] **Step 5: `tests/integration/spotify.routes.test.js` yaz** — `_registry` ile `spotify` servisini mocklayıp: `GET /connect` auth yoksa 401, varsa 200 + `url`; `GET /callback` geçersiz `state` → 400; geçerli → 302 redirect (frontend `Profil` sayfasına, query `?spotify=connected`); `POST /disconnect` → 200.
- [ ] **Step 6: Testleri çalıştır, fail ettiklerini doğrula**
- [ ] **Step 7: `src/routes/spotify.routes.js`'i yaz, `src/app.js`'e `/api/spotify` olarak mount et.**
- [ ] **Step 8: Testleri çalıştır, geçtiklerini doğrula**
- [ ] **Step 9: Commit**

---

### Task 9: Spotify oynatma (mock sürücü) + kiosk SPOTIFY_PLAY dalı

**Files:**
- Create: `src/drivers/SpotifyPlaybackDriver.js`, `src/drivers/MockSpotifyPlaybackDriver.js`
- Modify: `src/services/spotify.service.js` (arama/resolve ekle)
- Modify: `src/routes/kiosk.routes.js` (SPOTIFY_PLAY dalı)
- Test: `tests/unit/spotifyPlaybackDriver.test.js`, `tests/integration/kioskVoiceCommand.spotify.test.js`

**Interfaces:**
- Consumes: Task 8'in `getConnection`/`refreshAccessTokenIfNeeded`; Task 4'ün `kioskSpeakerAuth`.
- Produces: `searchTrackOrPlaylist(accessToken, query): { name, uri } | null` (gerçek Spotify `/v1/search` çağrısı), `SpotifyPlaybackDriver.play({ userName, trackName })`/`MockSpotifyPlaybackDriver` (ses çıkarmaz, `audit()` + döndürür `"{userName}'in Spotify hesabından {trackName} çalınıyor (mock)"`).

- [ ] **Step 1: `tests/unit/spotifyPlaybackDriver.test.js` yaz** — `MockSpotifyPlaybackDriver.play(...)`'in beklenen metni döndürdüğü ve gerçek bir ağ çağrısı yapmadığı (fetch hiç çağrılmamış) — bu, "gerçek play endpoint'i hiç çağrılmaz" kısıtını pin'ler.
- [ ] **Step 2: Testleri çalıştır, fail ettiklerini doğrula**
- [ ] **Step 3: İki sürücü sınıfını implemente et.**
- [ ] **Step 4: Testleri çalıştır, geçtiklerini doğrula**
- [ ] **Step 5: `tests/integration/kioskVoiceCommand.spotify.test.js` yaz** — Review Focus #4'ü kapsar: (a) `req.speaker.userId` için `getConnection` `null` dönerse → 200 + `say: "Spotify hesabınız bağlı değil, Profil sayfasından bağlayabilirsiniz"` (jenerik hata DEĞİL); (b) bağlıysa → `searchTrackOrPlaylist` çağrılır (mock), sonucu `MockSpotifyPlaybackDriver.play`'e geçer, 200 + onay metni; (c) SPOTIFY_PLAY, DEVICE_COMMAND'ın aksine sesli onay döngüsüne girMEZ — tek çağrıda sonuçlanır (confirmation phrase döndürmez).
- [ ] **Step 6: Testleri çalıştır, fail ettiklerini doğrula**
- [ ] **Step 7: `searchTrackOrPlaylist`'i `spotify.service.js`'e ekle; `kiosk.routes.js`'in SPOTIFY_PLAY dalını implemente et.**
- [ ] **Step 8: Testleri çalıştır, geçtiklerini doğrula**
- [ ] **Step 9: Commit**

---

### Task 10: Web arama (Operia/`ai.service.js` genişletmesi) + kiosk WEB_SEARCH dalı

**Files:**
- Modify: `src/services/ai.service.js` (ekleme — mevcut fonksiyonlar değişmez)
- Create: `src/utils/clinicalQuestionClassifier.js`
- Modify: `src/routes/kiosk.routes.js` (WEB_SEARCH dalı)
- Test: `tests/unit/clinicalQuestionClassifier.test.js`, `tests/unit/aiService.webSearch.test.js`, `tests/integration/kioskVoiceCommand.websearch.test.js`

**Interfaces:**
- Produces: `isClinicalQuestion(text: string): boolean` (pure, anahtar kelime listesi: `ilaç|doz|mg|protokol|kontrendikasyon|alerji|ameliyat sonrası|komplikasyon`), `ai.service.js`'e eklenen `webSearch(query: string): Promise<string>` (mevcut `client`/`MODEL` kullanır, `client.messages.create`'e `tools: [{type:'web_search_20250305', name:'web_search'}]` ekler, dönen metni özetler).

- [ ] **Step 1: `tests/unit/clinicalQuestionClassifier.test.js` yaz** — "parasetamol dozu nedir" → true; "fenerbahçe kaç kaç bitti" → false; "bugün hava nasıl" → false; "bu ilacın kontrendikasyonu var mı" → true.
- [ ] **Step 2: Testleri çalıştır, fail ettiklerini doğrula**
- [ ] **Step 3: `isClinicalQuestion`'ı implemente et.**
- [ ] **Step 4: Testleri çalıştır, geçtiklerini doğrula**
- [ ] **Step 5: `tests/unit/aiService.webSearch.test.js` yaz** — `client.messages.create`'i (modül zaten `require('@anthropic-ai/sdk')` ile import edildiği için, test dosyasında `vi.mock('@anthropic-ai/sdk', ...)` ile) mocklayıp `webSearch('X')`'in doğru `model`/`tools` parametreleriyle çağrıldığını ve dönen `content[0].text`'i döndürdüğünü doğrula.
- [ ] **Step 6: Testleri çalıştır, fail ettiklerini doğrula**
- [ ] **Step 7: `ai.service.js`'e `webSearch(query)`'i ekle, `module.exports`'a dahil et.**
- [ ] **Step 8: Testleri çalıştır, geçtiklerini doğrula**
- [ ] **Step 9: `tests/integration/kioskVoiceCommand.websearch.test.js` yaz** — Review Focus #5: çok kısa transcript (`parseIntent` zaten UNKNOWN'a düşürür, bu route seviyesinde ayrıca test edilir) WEB_SEARCH'e gitmez; normal sorguda `aiService.webSearch` çağrılır (mock `_registry` ile), `isClinicalQuestion` true ise cevaptan ÖNCE `"Bu doğrulanmış bir klinik kaynak değildir."` uyarısının eklendiği, false ise eklenmediği; cevap `audit_logs`'a soru+özet olarak yazıldığı (ham kaynak metni yazılmadığı).
- [ ] **Step 10: Testleri çalıştır, fail ettiklerini doğrula**
- [ ] **Step 11: `kiosk.routes.js`'in WEB_SEARCH dalını implemente et.**
- [ ] **Step 12: Testleri çalıştır, geçtiklerini doğrula**
- [ ] **Step 13: Commit**

---

### Task 10b: Kiosk durum endpoint'i (planlama hatası, yürütme sırasında bulundu)

**Not:** Bu task orijinal plana dahil değildi — Task 15'in `Kiosk.jsx`/hook tasarımı, odada aktif ameliyat olup olmadığını **proaktif olarak** (kullanıcı "Operio" demeden, sayfa açılışında) sorgulayabileceği bir uç nokta varsayıyordu, ama hiçbir task bunu oluşturmadı — ne orijinal (2026-11-20) tasarım dokümanının Socket.io önerisi uygulanabilir (kiosk'ta kişisel JWT yok, `src/socket.js`'in JWT middleware'i bunu reddeder), ne de böyle bir REST endpoint planlandı. Task 2'nin `kioskRoomAuth` middleware'i zaten tam olarak bu kontrolü yapıyor (aktif ameliyat yoksa 409 döner) — eksik olan sadece onu tek başına çağırabilecek bir route.

**Files:**
- Modify: `src/routes/kiosk.routes.js` (yeni bir `GET` route eklenir, mevcut `POST /voice-command` route'una dokunulmaz)
- Test: `tests/integration/kioskStatus.test.js`

**Interfaces:**
- Produces: `GET /api/kiosk/rooms/:roomId/status` — sadece `kioskRoomAuth` middleware'inden geçer (başka hiçbir ek mantık yok): geçerse `ok(res, { active: true, surgeryId: req.activeSurgery.id })`; `kioskRoomAuth` zaten 401/403/409'ları kendi başına döner (token yok/geçersiz/oda uyuşmazlığı/modül satın alınmamış/aktif ameliyat yok).

- [ ] **Step 1: `tests/integration/kioskStatus.test.js` yaz** — gerçek `kioskRoomAuth`'tan geçen bir supertest isteğiyle (mock `kiosk`/`module` servisleri `_registry` üzerinden, Task 2/3'teki desenin aynısı): (a) aktif ameliyat varsa → 200 `{active:true, surgeryId}`; (b) aktif ameliyat yoksa → 409 (zaten `kioskRoomAuth`'un kendi davranışı, burada sadece route'un bunu bozmadığı doğrulanıyor).
- [ ] **Step 2: Testi çalıştır, fail ettiğini doğrula**
- [ ] **Step 3: Route'u ekle** — tek satır: `router.get('/rooms/:roomId/status', kioskRoomAuth, (req, res) => ok(res, { active: true, surgeryId: req.activeSurgery.id }));`
- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**
- [ ] **Step 5: Commit**

---

## Frontend (`operio-react/operio`)

### Task 11: `api.js` eklemeleri

**Files:**
- Modify: `src/services/api.js`
- Test: `tests/unit/api.kiosk.test.js`

**Interfaces:**
- **Düzeltme (planlama hatası, yürütme sırasında bulundu):** `api.js` axios DEĞİL, `fetch`'e dayalı özel bir `request(method, path, body, retry)` fonksiyonu kullanıyor (kişisel JWT'yi `_accessToken` modül-seviyesi değişkeninden okuyup header'a ekliyor, 401'de refresh deniyor). `kioskAPI` bu fonksiyonu KULLANAMAZ (kiosk'ta kişisel JWT yok, 401-refresh mantığı kiosk'un 401/403/409'larıyla hiç ilgili değil) — bunun yerine ayrı, basit bir `kioskRequest(method, path, kioskToken, body)` fonksiyonu eklenir: `fetch`'i doğrudan çağırır, `Authorization: Bearer <kioskToken>` header'ını parametre olarak verilen token'dan oluşturur, retry/refresh mantığı YOK.
- Produces: `kioskAPI = { voiceCommand(roomId, kioskToken, {transcript, audio, confirmationPhrase}), status(roomId, kioskToken) }` (ikisi de `kioskRequest` üzerinden; `status`, Task 10b'nin `GET /kiosk/rooms/:roomId/status` endpoint'ini çağırır), `voiceProfileAPI = { enroll(audioBase64), get() }` (bunlar normal `request()`/kişisel JWT kullanır — Profil sayfasından, oturum açmış kullanıcı çağırır), `spotifyAPI = { connect(), disconnect() }` (aynı şekilde normal `request()`), `kioskAdminAPI = { createToken(roomId), revokeToken(roomId), getMockConfig(), setMockConfig(mode) }` (aynı şekilde normal `request()` — admin kendi kişisel oturumuyla çağırır).

- [ ] **Step 1: `tests/unit/api.kiosk.test.js` yaz** — `global.fetch`'i mocklayarak: `kioskAPI.voiceCommand(roomId, kioskToken, {...})` çağrıldığında `fetch`'e giden isteğin `Authorization` header'ının parametre olarak verilen `kioskToken`'ı taşıdığını (global `_accessToken`'ı DEĞİL) doğrula — bu, Kiosk.jsx'in kişisel oturumsuz çalışabilmesi için kritik bir ayrım. Ayrıca `kioskAPI.status(roomId, kioskToken)`'ın doğru path'e (`/kiosk/rooms/:roomId/status`) GET attığını doğrula.
- [ ] **Step 2: Testi çalıştır, fail ettiğini doğrula**
- [ ] **Step 3: `api.js`'e dört nesneyi ekle** — `kioskRequest` yardımcı fonksiyonu + `kioskAPI` (onu kullanır), `voiceProfileAPI`/`spotifyAPI`/`kioskAdminAPI` (mevcut `get`/`post` kısayollarını kullanır, aynı diğer API nesneleri gibi).
- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**
- [ ] **Step 5: Commit**

---

### Task 12: `Profil.jsx` — Ses Profili bölümü

**Files:**
- Modify: `src/pages/Profil.jsx`
- Test: `tests/components/Profil.voiceEnrollment.test.jsx`

**Interfaces:**
- Consumes: Task 11'in `voiceProfileAPI`.
- Produces: Profil sayfasında yeni bir "Ses Profili" kartı — sabit metin: *"Operio ses profilimi oluşturuyorum, bu cümleyi kendi doğal konuşma hızımla okuyorum."* (builder'a bırakılan pasaj metni için bu planda karar verildi), "Kayda Başla" butonu (`MediaRecorder`), kayıt bitince otomatik `voiceProfileAPI.enroll()`, "Ses profiliniz oluşturuldu" onay mesajı + "Yeniden Kaydet" seçeneği.

- [ ] **Step 1: `tests/components/Profil.voiceEnrollment.test.jsx` yaz** — kayıt öncesi "Kayda Başla" butonu görünür; `voiceProfileAPI.get()` (mock) enrolled dönerse "Ses profiliniz oluşturuldu" + "Yeniden Kaydet" görünür, `enroll` butonu görünmez.
- [ ] **Step 2: Testi çalıştır, fail ettiğini doğrula**
- [ ] **Step 3: Bölümü implemente et.**
- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**
- [ ] **Step 5: Commit**

---

### Task 13: `Profil.jsx` — Spotify Hesabı bölümü

**Files:**
- Modify: `src/pages/Profil.jsx`
- Test: `tests/components/Profil.spotify.test.jsx`

**Interfaces:**
- Consumes: Task 11'in `spotifyAPI`.
- Produces: "Spotify Hesabı" kartı — bağlı değilse "Spotify Hesabımı Bağla" butonu (`spotifyAPI.connect()` → dönen `url`'e `window.location` ile yönlendirir), bağlıysa hesap adı + "Bağlantıyı Kaldır" butonu. URL'de `?spotify=connected` query param'ı varsa (callback dönüşü) bir başarı toast'ı gösterir.

- [ ] **Step 1: `tests/components/Profil.spotify.test.jsx` yaz** — bağlı değilken buton görünür ve tıklanınca `spotifyAPI.connect()` çağrılıp dönen URL'e yönlendirildiği; bağlıyken "Bağlantıyı Kaldır" görünüp tıklanınca `spotifyAPI.disconnect()` çağrıldığı.
- [ ] **Step 2: Testi çalıştır, fail ettiğini doğrula**
- [ ] **Step 3: Bölümü implemente et.**
- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**
- [ ] **Step 5: Commit**

---

### Task 14: `SesliKontrolAyarlari.jsx` genişletmesi — kiosk kurulumu + mock-config

**Files:**
- Modify: `src/pages/SesliKontrolAyarlari.jsx`
- Test: `tests/components/SesliKontrolAyarlari.kiosk.test.jsx`

**Interfaces:**
- Consumes: Task 11'in `kioskAdminAPI`.
- Produces: Her oda için "Kiosk Token Üret" butonu (üretilen token/URL'i gösterir, kopyalanabilir), "Token'ı İptal Et" butonu; bir "Konuşmacı Doğrulama (Demo)" seçici — `always_match`/`always_reject_team`/`always_unrecognized`/`cycle` arasında seçim (Türkçe etiketlerle: "Her Zaman Eşleştir" / "Her Zaman Reddet (Ekipte Değil)" / "Her Zaman Tanınmadı" / "Sırayla Değiştir").

- [ ] **Step 1: `tests/components/SesliKontrolAyarlari.kiosk.test.jsx` yaz** — "Kiosk Token Üret" tıklanınca `kioskAdminAPI.createToken` çağrılıp dönen token'ın ekranda göründüğü; mock-config seçicide bir seçenek seçilince `kioskAdminAPI.setMockConfig` çağrıldığı.
- [ ] **Step 2: Testi çalıştır, fail ettiğini doğrula**
- [ ] **Step 3: Bölümleri implemente et.**
- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**
- [ ] **Step 5: Commit**

---

### Task 15: `Kiosk.jsx` + `useVoiceDeviceControl` hook

**Files:**
- Create: `src/pages/Kiosk.jsx`
- Create: `src/hooks/useVoiceDeviceControl.js`
- Test: `tests/components/Kiosk.test.jsx`, `tests/unit/useVoiceDeviceControl.test.js`

**Interfaces:**
- Consumes: Task 11'in `kioskAPI`.
- Produces: `useVoiceDeviceControl(roomId, kioskToken)` → `{ state: 'idle'|'listening'|'awaiting_confirmation'|'executing'|'no_surgery', lastResponse, pendingPhrase }` + dahili olarak `SpeechRecognition` (uyandırma kelimesi "operio" + komut metni) ve `MediaRecorder` (ring buffer) paralel çalışır; komut algılanınca `kioskAPI.voiceCommand(roomId, {transcript, audio})` çağrılır; yanıt `pending_confirmation` ise `state='awaiting_confirmation'` olur ve `speechSynthesis` ile `"Onaylamak için {phrase} deyin"` okunur, kullanıcı phrase'i tekrarlayınca `confirmationPhrase` ile ikinci çağrı yapılır; her yanıttaki `say`/mesaj alanı `speechSynthesis.speak()` ile okunur. `Kiosk.jsx` bu hook'u mount eder, `state==='no_surgery'` ise "Bu odada aktif ameliyat yok, sesli kontrol kapalı" gösterir.

- [ ] **Step 1: `tests/unit/useVoiceDeviceControl.test.js` yaz** — `SpeechRecognition`/`MediaRecorder`/`speechSynthesis` global'lerini mocklayarak: (a) hook mount olduğunda `kioskAPI.status(roomId, kioskToken)` (mock) 409/`no_active_surgery` ile reddederse `state==='no_surgery'`; (b) bir komut simüle edilip `kioskAPI.voiceCommand` `pending_confirmation` dönerse `state==='awaiting_confirmation'` ve `pendingPhrase` dolu olur; (c) phrase tekrarı simüle edilip ikinci `voiceCommand` çağrısının `confirmationPhrase` içerdiği.
- [ ] **Step 2: Testleri çalıştır, fail ettiklerini doğrula**
- [ ] **Step 3: Hook'u implemente et.**
- [ ] **Step 4: Testleri çalıştır, geçtiklerini doğrula**
- [ ] **Step 5: `tests/components/Kiosk.test.jsx` yaz** — `state==='no_surgery'` iken doğru mesajın ekranda göründüğü; `lastResponse` dolu iken ekranda metninin göründüğü (TTS çağrısı ayrıca `speechSynthesis.speak`'in çağrıldığının doğrulanmasıyla test edilir).
- [ ] **Step 6: Testi çalıştır, fail ettiğini doğrula**
- [ ] **Step 7: `Kiosk.jsx`'i implemente et.**
- [ ] **Step 8: Testi çalıştır, geçtiğini doğrula**
- [ ] **Step 9: Commit**

---

### Task 16: Routing — `/kiosk/:roomId`

**Files:**
- Modify: `src/App.jsx`
- Test: `tests/components/App.kioskRoute.test.jsx`

**Interfaces:**
- Produces: `/kiosk/:roomId` route — kişisel auth guard'ından (`ProtectedRoute` veya eşdeğeri) MUAF, kendi kiosk-token mantığıyla çalışır (token, URL query param `?token=` ile veya kurulumda tarayıcıya `localStorage`'a bir kere yazılıp sabit kalır — builder notu: bu planda query-param tercih edilir, kurulumda admin ekranından kopyalanan URL zaten token'ı içerir).

- [ ] **Step 1: `tests/components/App.kioskRoute.test.jsx` yaz** — `/kiosk/abc?token=xyz` yoluna kişisel JWT OLMADAN gidildiğinde login sayfasına yönlendirilmediği, `Kiosk` bileşeninin render edildiği.
- [ ] **Step 2: Testi çalıştır, fail ettiğini doğrula**
- [ ] **Step 3: Route'u ekle (guard dışında).**
- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**
- [ ] **Step 5: Commit**
