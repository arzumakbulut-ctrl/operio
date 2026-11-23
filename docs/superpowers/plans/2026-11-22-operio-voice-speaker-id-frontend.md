# Operio Voice — Gerçek Speaker-ID (Frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the kiosk's audio capture so each captured chunk is independently decodable (required for real speaker-ID), rename the digit-phrase confirmation to a natural-language evet/hayır exchange, and extend voice-profile enrollment from 1 recording to 3 (averaged server-side into one embedding).

**Architecture:** `useVoiceDeviceControl.js`'s continuous rolling `MediaRecorder` becomes a self-restarting per-cycle recorder (each cycle = one complete, independently-decodable WebM/Opus file) and drops the `confirmationPhrase`/`pendingPhrase` concepts in favor of a plain evet/hayır round-trip. `Profil.jsx`'s enrollment flow records 3 short clips in sequence and sends them as one array. No changes to `Kiosk.jsx` are needed — it only ever renders `lastResponse.say` as plain text, confirmed by reading its source.

**Tech Stack:** React 19 + Vite (existing), browser `MediaRecorder`/`getUserMedia`/`SpeechRecognition` APIs (existing).

**Spec:** `docs/superpowers/specs/2026-11-22-operio-voice-speaker-id-design.md` — read it alongside this plan. The companion backend plan is `operio-backend/docs/superpowers/plans/2026-11-22-operio-voice-speaker-id-backend.md` (sibling repo) — this plan's Task 2 and Task 3 depend on that repo's Task 9/Task 5 response shapes.

## Global Constraints

- `Kiosk.jsx` is NOT modified — confirmed it only renders `lastResponse.say` as plain text and never destructures `pendingPhrase`.
- Mevcut ses taşıma formatı (webm/opus, base64-over-JSON) korunur.
- `useVoiceDeviceControl`'ün döndürdüğü state machine tipleri (`'idle' | 'listening' | 'awaiting_confirmation' | 'executing' | 'no_surgery' | 'setup_error'`) değişmez.
- `AUDIO_TIMESLICE_MS = 3000` değeri değişmez — sadece HER periyotta YENİ bir `MediaRecorder` örneği başlatılır (tek, sürekli örnek yerine).
- Backend'in yeni sözleşmesi (bkz. backend planı Task 8/9): `confirmationPhrase` alanı → `confirmationAnswer`; onay yanıtında artık `phrase` alanı YOK; `say` alanı `null`/boş olabilir (sessizce beklemeye devam anlamına gelir, konuşulmaz — mevcut `speak()` yardımcı fonksiyonu zaten falsy metni no-op yapıyor, değişiklik gerekmez).

## Review Focus

- Her "operio" sonrası konuşma için YENİ bir `MediaRecorder` döngüsü başlamalı — eski sürekli-tek-kayıt yöntemi, 3 saniyeden sonraki parçaları bağımsız decode edilemez (header'sız) hale getiriyordu; bu artık her döngüde kendi geçerli header'ına sahip olmalı (Task 1).
- Mikrofon izni reddedilirse veya `MediaRecorder`/`getUserMedia` tarayıcıda yoksa ses hattı sessizce (audio:null) çalışmaya devam etmeli — mevcut davranış korunur, yeni döngü mantığı bunu bozmamalı (Task 1).
- Enrollment'ta 3 kayıttan biri sırasında mikrofon izni geri çekilirse/hata olursa, backend'e eksik/bozuk bir dizi gönderilmemeli — kullanıcıya hata gösterilip süreç baştan başlatılmalı (Task 4).
- Backend "unresolved" (say:null) dönerse kullanıcı arayüzünde sessizce `awaiting_confirmation` durumunda kalınmalı, hiçbir hata/toast gösterilmemeli (Task 2).
- Backend "cancelled" dönerse (say:'Komut iptal edildi.') normal `idle` durumuna dönülmeli, bir hata gibi ele alınmamalı (Task 2).

---

### Task 1: Ses yakalama — her döngüde taze `MediaRecorder` (header sorunu)

**Files:**
- Modify: `src/hooks/useVoiceDeviceControl.js`
- Test: `tests/unit/useVoiceDeviceControl.test.js` (mevcut "dönen (rolling) MediaRecorder ses tamponu" describe bloğu yeniden yazılır; dosyanın geri kalanı — uyandırma kelimesi çıkarımı, durum makinesi, hata işleme — dokunulmaz)

**Interfaces:**
- Produces: `startAudioCapture()` davranışı değişir (iç implementasyon; dışa dönük imza/dönüş tipi aynı — hook'un döndürdüğü `{state, lastResponse, start}` değişmez, bkz. Task 2).

- [ ] **Step 1: Başarısız testler — mevcut "dönen ses tamponu" describe bloğunu şu davranışı doğrulayacak şekilde yeniden yaz**

Mevcut dosyadaki `MediaRecorder`/`getUserMedia` mock kurulumunu (zaten var olan yardımcıları) kullanarak:

```js
describe('ses yakalama — döngü-başı taze MediaRecorder', () => {
  it('her AUDIO_TIMESLICE_MS periyodunda YENİ bir MediaRecorder örneği oluşturulur (tek sürekli örnek değil)', async () => {
    // start() çağrıldıktan ve AUDIO_TIMESLICE_MS (3000ms) iki kez geçtikten sonra,
    // global.MediaRecorder constructor'ının EN AZ 2 farklı kez çağrıldığını doğrula
    // (vi.useFakeTimers() + vi.advanceTimersByTime(3000) iki kez).
  });

  it('getUserMedia audio kısıtlarına noiseSuppression ve echoCancellation ister', async () => {
    // getUserMedia mock'unun çağrıldığı argümanı yakala; audio.noiseSuppression===true
    // ve audio.echoCancellation===true olduğunu doğrula.
  });

  it('her döngünün bitmiş blob\'u latestAudioChunkRef\'e (dolaylı: sendVoiceCommand\'a) eşdeğer şekilde ulaşır', async () => {
    // Bir döngü tamamlandıktan (onstop tetiklendikten) sonra bir wake-word utterance
    // tetiklenirse, kioskAPI.voiceCommand'a geçen audio alanının o döngünün blob'undan
    // türediğini doğrula (mevcut blobToBase64 mock'lama deseni korunur).
  });

  it('unmount olunca veya no_surgery\'ye geçince döngü yeniden başlamaz', async () => {
    // mevcut "mikrofonu açık tutma" testiyle aynı ruhta — stopPipeline çağrıldıktan sonra
    // bir timer tetiklenirse yeni bir MediaRecorder OLUŞTURULMAMALI.
  });

  it('mikrofon izni reddedilirse (getUserMedia reject) ses hattı sessizce audio:null ile çalışmaya devam eder', async () => {
    // getUserMedia'yı reject et; recordCycle hiç başlamaz ama recognition/pipeline hata
    // fırlatmadan çalışır — mevcut dış try/catch'in yeni recordCycle çağrısını da kapsadığını doğrula.
  });
});
```

- [ ] **Step 2: Testleri çalıştırıp FAIL ettiklerini doğrula**

Run: `npm test -- useVoiceDeviceControl.test.js`
Expected: FAIL

- [ ] **Step 3: `startAudioCapture` implementasyonu**

`getUserMedia({ audio: { noiseSuppression: true, echoCancellation: true } })` (önceki `{ audio: true }` yerine). Tek-seferlik `recorder.start(AUDIO_TIMESLICE_MS)` + sürekli `ondataavailable` yerine, kendi kendini yeniden başlatan bir döngü:

```js
function recordCycle(stream) {
  if (unmountedRef.current || phaseRef.current === 'no_surgery') return;
  const chunks = [];
  const recorder = new window.MediaRecorder(stream);
  recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
  recorder.onstop = () => {
    if (chunks.length > 0) latestAudioChunkRef.current = new Blob(chunks, { type: 'audio/webm' });
    recordCycle(stream);
  };
  recorder.start();
  mediaRecorderRef.current = { recorder, stream };
  setTimeout(() => { try { recorder.stop(); } catch { /* zaten durmuş olabilir */ } }, AUDIO_TIMESLICE_MS);
}
```

`startAudioCapture`, stream alındıktan sonra `recordCycle(stream)`'i çağırır (eski tek `recorder.start(AUDIO_TIMESLICE_MS)` + kalıcı `ondataavailable` ataması kaldırılır). `stopPipeline()`'daki mevcut `mediaRecorderRef.current.recorder.stop()` çağrısı değişmeden kalır — `onstop` handler'ı zaten `unmountedRef`/`no_surgery` kontrolünü yapıp döngüyü oradan sonlandırır.

- [ ] **Step 4: Testleri çalıştırıp PASS ettiklerini doğrula**

Run: `npm test -- useVoiceDeviceControl.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useVoiceDeviceControl.js tests/unit/useVoiceDeviceControl.test.js
git commit -m "fix(speaker-id): restart MediaRecorder per capture cycle so each chunk decodes standalone"
```

---

### Task 2: Onay akışı — `confirmationPhrase` → `confirmationAnswer`, `pendingPhrase` kaldırılması

**Files:**
- Modify: `src/hooks/useVoiceDeviceControl.js`
- Test: `tests/unit/useVoiceDeviceControl.test.js` (confirmationPhrase/pendingPhrase'e dayanan testler güncellenir)

**Interfaces:**
- Produces: Hook'un döndürdüğü nesne artık `pendingPhrase` İÇERMEZ: `{ state, lastResponse, start }` (önceki `{ state, lastResponse, pendingPhrase, start }`'tan `pendingPhrase` çıkarıldı — `Kiosk.jsx` bunu hiç kullanmadığı için tüketici tarafında kırılma yok, confirmed).

- [ ] **Step 1: Başarısız testler — mevcut ilgili testleri güncelle**

- `'confirmationPhrase ile İKİNCİ voiceCommand çağrısını tetikler'` testi → `confirmationAnswer: commandText` gönderildiğini doğrulayacak şekilde yeniden adlandırılır/güncellenir.
- `pending_confirmation` yanıtını render eden/`pendingPhrase`'i doğrulayan test → kaldırılır (artık doğrulanacak bir `pendingPhrase` state'i yok).
- Yeni testler eklenir:
```js
it('backend say:null ile pending_confirmation dönerse hiçbir şey seslendirilmez, awaiting_confirmation\'da kalınır', async () => {
  // kioskAPI.voiceCommand { type:'DEVICE_COMMAND', status:'pending_confirmation', say: null } dönsün;
  // window.speechSynthesis.speak'in ÇAĞRILMADIĞINI ve state'in 'awaiting_confirmation' olduğunu doğrula.
});
it('backend "Komut iptal edildi." ile normal (status\'suz) yanıt dönerse idle\'a geçilir ve mesaj seslendirilir', async () => {
  // kioskAPI.voiceCommand { type:'DEVICE_COMMAND', say:'Komut iptal edildi.' } dönsün;
  // speak('Komut iptal edildi.') çağrıldığını ve state'in 'idle' olduğunu doğrula.
});
```

- [ ] **Step 2: Testleri çalıştırıp FAIL ettiklerini doğrula**

Run: `npm test -- useVoiceDeviceControl.test.js`
Expected: FAIL

- [ ] **Step 3: İmplementasyon**

`handleWakeWordUtterance`'taki `sendVoiceCommand({ transcript: commandText, confirmationPhrase: commandText })` → `sendVoiceCommand({ transcript: commandText, confirmationAnswer: commandText })`. `sendVoiceCommand`'daki `handleError(err, { isConfirmationCall: !!payload.confirmationPhrase })` → `!!payload.confirmationAnswer`. `pendingPhrase` state'i (`useState(null)`), `setPendingPhrase` çağrıları (`handleResponse`/`handleError` içindeki hepsi) ve hook'un dönüş nesnesindeki `pendingPhrase` alanı kaldırılır. `handleResponse`'daki `status === 'pending_confirmation'` dalı artık sadece `setPhase('awaiting_confirmation'); speak(response.say);` yapar (`speak(null)` zaten no-op olduğu için `say:null` durumunda hiçbir şey okunmaz — ek bir `if` gerekmez).

- [ ] **Step 4: Testleri çalıştırıp PASS ettiklerini doğrula**

Run: `npm test -- useVoiceDeviceControl.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useVoiceDeviceControl.js tests/unit/useVoiceDeviceControl.test.js
git commit -m "feat(speaker-id): switch kiosk confirmation to evet/hayır, drop pendingPhrase"
```

---

### Task 3: `api.js` — yeni istek şekilleri

**Files:**
- Modify: `src/services/api.js`
- Test: `tests/unit/api.kiosk.test.js` (veya ilgili dosya — `confirmationPhrase` gönderen assertion'lar güncellenir)

**Interfaces:**
- Produces: `kioskAPI.voiceCommand(roomId, kioskToken, { transcript, audio, confirmationAnswer })` (önceki `confirmationPhrase` parametre adı değişti). `voiceProfileAPI.enroll(audioBase64Array)` → `POST /profile/voice-enrollment` body `{ audioSamples: audioBase64Array }` (önceki tekil `{ audio: audioBase64 }`'tan değişti).

- [ ] **Step 1: Başarısız testler**

```js
it('kioskAPI.voiceCommand confirmationAnswer alanını gönderir', () => {
  // mevcut kioskRequest mock'lama deseniyle; body'de confirmationAnswer olduğunu doğrula.
});
it('voiceProfileAPI.enroll bir diziyi audioSamples alanında gönderir', () => {
  // post('/profile/voice-enrollment', { audioSamples: [...] }) çağrıldığını doğrula.
});
```

- [ ] **Step 2: Testleri çalıştırıp FAIL ettiklerini doğrula**

Run: `npm test -- api`
Expected: FAIL

- [ ] **Step 3: İmplementasyon**

```js
voiceCommand: (roomId, kioskToken, { transcript, audio, confirmationAnswer }) =>
  kioskRequest('POST', `/kiosk/rooms/${roomId}/voice-command`, kioskToken, { transcript, audio, confirmationAnswer }).then(r => r.data),
```
```js
enroll: (audioBase64Array) => post('/profile/voice-enrollment', { audioSamples: audioBase64Array }).then(r => r.data),
```

- [ ] **Step 4: Testleri çalıştırıp PASS ettiklerini doğrula**

Run: `npm test -- api`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/api.js tests/unit/api.kiosk.test.js
git commit -m "feat(speaker-id): update api.js for confirmationAnswer and multi-sample enrollment"
```

---

### Task 4: `Profil.jsx` — 3 kayıtlık enrollment akışı

**Files:**
- Modify: `src/pages/Profil.jsx`
- Test: `tests/components/Profil.voiceEnrollment.test.jsx`

**Interfaces:**
- Consumes: `voiceProfileAPI.enroll(audioBase64Array)` (Task 3).

- [ ] **Step 1: Başarısız testler — mevcut testi güncelle/genişlet**

```jsx
it('"Kayda Başla" tıklanınca 3 ardışık kayıt yapar ve tek bir enroll çağrısında 3 elemanlı dizi gönderir', async () => {
  // mevcut MediaRecorder mock'lama deseni 3 kez tetiklenecek şekilde kurulur
  // (her kayıt KAYIT_SURESI_MS sonra otomatik durur); üçü de tamamlandıktan sonra
  // voiceProfileAPI.enroll'un TEK çağrıda 3 elemanlı bir base64 dizisiyle çağrıldığını doğrula.
});
it('kayıt sırasında "Kayıt N/3" ilerleme göstergesi render edilir', async () => {
  // 1. kayıt sırasında ekranda "1/3", 2. kayıt sırasında "2/3" metninin göründüğünü doğrula.
});
it('3 kayıttan biri sırasında mikrofon hatası olursa süreç baştan başlar, kısmi dizi gönderilmez', async () => {
  // Review Focus — 2. kayıtta getUserMedia reject olsun; voiceProfileAPI.enroll\'un
  // ÇAĞRILMADIĞINI ve bir hata toast\'ı gösterildiğini doğrula.
});
```

- [ ] **Step 2: Testleri çalıştırıp FAIL ettiklerini doğrula**

Run: `npm test -- Profil.voiceEnrollment.test.jsx`
Expected: FAIL

- [ ] **Step 3: İmplementasyon**

`kayitAdimi` state'i ekle (`useState(0)`, 0=başlamadı, 1-3=aktif adım). `sesKaydiBaslat`, tek bir kayıt yapıp göndermek yerine: 3 adımı sırayla (her biri `KAYIT_SURESI_MS` süreli, aynı `getUserMedia`/`MediaRecorder` deseniyle) çalıştırır, her adımın base64'ünü bir diziye biriktirir; herhangi bir adımda hata olursa diziyi atar, `kayitAdimi`'yi sıfırlar ve mevcut "Mikrofon izni verilmedi" tarzı toast'ı gösterir; 3 adım da başarıyla tamamlanırsa `voiceProfileAPI.enroll(audioBase64Array)` TEK kez çağrılır. UI: buton metni `kayitAdimi > 0` iken `` `Kayıt ${kayitAdimi}/3...` `` gösterir (mevcut `Kaydediliyor...`/`Gönderiliyor...` metinlerinin yerini/önünü alır).

- [ ] **Step 4: Testleri çalıştırıp PASS ettiklerini doğrula**

Run: `npm test -- Profil.voiceEnrollment.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/Profil.jsx tests/components/Profil.voiceEnrollment.test.jsx
git commit -m "feat(speaker-id): record 3 enrollment samples instead of 1"
```

---

### Task 5: `SesliKontrolAyarlari.jsx` — "Gerçek Speaker-ID" demo-modu seçeneği

**Files:**
- Modify: `src/pages/SesliKontrolAyarlari.jsx`
- Test: `tests/components/SesliKontrolAyarlari.kiosk.test.jsx`

**Interfaces:** Yok (sadece bir UI seçeneği ekliyor; backend zaten `'real'` değerini `kiosk_mock_config.mode` için kabul ediyor, bkz. backend planı Task 2).

- [ ] **Step 1: Başarısız test**

```jsx
it('doğrulama senaryosu seçicisinde "Gerçek Speaker-ID" seçeneği vardır ve seçildiğinde setMockConfig(\'real\') çağrılır', async () => {
  render(<SesliKontrolAyarlari />);
  const select = await screen.findByLabelText(/doğrulama senaryosu/i);
  fireEvent.change(select, { target: { value: 'real' } });
  await waitFor(() => expect(kioskAdminAPI.setMockConfig).toHaveBeenCalledWith('real'));
});
```

- [ ] **Step 2: Testi çalıştırıp FAIL ettiğini doğrula**

Run: `npm test -- SesliKontrolAyarlari.kiosk.test.jsx`
Expected: FAIL

- [ ] **Step 3: `MOCK_MODES` dizisine 5. seçeneği ekle**

```js
{ value: 'real', label: 'Gerçek Speaker-ID' },
```

- [ ] **Step 4: Testi çalıştırıp PASS ettiğini doğrula**

Run: `npm test -- SesliKontrolAyarlari.kiosk.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/SesliKontrolAyarlari.jsx tests/components/SesliKontrolAyarlari.kiosk.test.jsx
git commit -m "feat(speaker-id): add 'real' speaker-id option to kiosk mock-mode selector"
```
