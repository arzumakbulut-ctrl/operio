# Operio Voice — Ameliyathane Sesli Cihaz Kontrol Modülü

**Durum:** Revize edildi — standalone ürün değil, mevcut Operio uygulamasının bir modülü olarak kararlaştırıldı. **2026-11-21 güncellemesi:** Kapsam, mevcut **"Operia"** asistan kimliği (bkz. `src/services/ai.service.js`, sidebar sohbet paneli) altında Spotify kontrolü ve web arama (kritik olmayan, rol kısıtı olmayan komutlar) içerecek şekilde genişletildi — yeni bir marka icat edilmedi, Operia sesli hale genişletildi. Bkz. "Operia — Genişletilmiş Kapsam" bölümü.

## Amaç ve neden

Ameliyathanede eller steril/dolu olduğu için personel medikal cihazları dokunmadan, sesle kontrol edebilsin istiyoruz: "Operio" uyandırma kelimesi + bir komutla cihaz durumunu değiştirme. Bu, mevcut Operio uygulamasının (bu repo) bir modülü olarak geliştirilecek — ayrı bir ürün/marka değil; mevcut auth, roller, oda/ameliyat verisi, Socket.io altyapısı doğrudan kullanılacak.

Bu doküman **demo/prototip aşaması** için yazılmıştır. Elde fiziksel cihaz yok (Covidien/Medtronic ForceTriad hariç, o da henüz temin edilmedi); mimari, gerçek donanım geldiğinde backend'de yeni bir sürücü eklemekle genişleyecek şekilde kuruluyor.

**Kritik not (değişmedi):** Enerji/hareket veren cerrahi cihazları gerçek bir hastada kontrol eden yazılım, çoğu yargı alanında ayrı bir tıbbi cihaz yazılımı (SaMD) sayılır ve IEC 62304 / ISO 14971 / IEC 60601 serisi standartlara uyum ile FDA/CE onayı gerektirir. Bu tasarım **klinik/hasta kullanımı için onaylanmamıştır** — yalnızca demo/geliştirme amaçlıdır.

**ForceTriad hakkında gerçeklik kontrolü:** Medtronic/Covidien gibi üreticiler, elektrocerrahi jeneratörlerinin güç seviyesini uzaktan ayarlayan açık/genel bir protokol yayınlamazlar. Gerçek entegrasyon genelde resmi bir OEM ortaklığı gerektirir ve çoğu zaman sadece "tetikleme" (footswitch rölesi gibi) seviyesindedir, güç seviyesi ayarı değil. Bu yüzden ForceTriad entegrasyonu, mimarinin geri kalanını bloklamayan **ayrı bir araştırma/doğrulama adımı** olarak ele alınıyor (bkz. "Builder'a bırakılanlar").

## Kapsam — cihaz grupları

1. **Elektrocerrahi cihazları** (koter, enerji platformları, LigaSure) — yüksek risk, enerji veriyor.
2. **Endoskopi ve görüntüleme sistemleri** (endoskopi işlemcileri, kamera, görüntü üniteleri) — düşük risk, hastaya doğrudan enerji/hareket uygulamıyor.
3. **Cerrahi ışık kaynakları** (ameliyat lambaları) — orta risk, görüş alanını etkiler ama hastaya temas yok.
4. **Ameliyat masaları** (pozisyonlama) — yüksek risk, motorlu fiziksel hareket (sıkışma/çarpma tehlikesi).

**Kapsam dışı (şimdilik):** Anestezi cihazları ve yukarıdaki 4 grup dışındaki her şey.

## Hedefler

- "Operio" uyandırma kelimesi + doğal dilde komutla cihaz durumu değiştirme — **oda-sabit ekranda** çalışır (bkz. aşağıdaki kimlik doğrulama maddeleri; kişisel cihazda genel dinleme yok).
- 4 cihaz grubunun da ortak bir sürücü arayüzüyle modellenmesi; yeni cihaz/marka eklemek yeni bir sürücü sınıfı yazmaktan ibaret olmalı.
- **Risk seviyesine göre iki farklı onay modeli:**
  - Elektrocerrahi, ışık, görüntüleme: sesli onay döngüsü yeterli (sistem geri okur, kullanıcı sesle onaylar).
  - **Ameliyat masası hareketleri: sesli onay TEK BAŞINA yeterli değil** — komut önce "arm" (hazırlanmış/bekliyor) durumuna geçer, gerçek hareket ancak masanın kendi fiziksel konsolundan ek bir fiziksel onayla başlar. Simülasyon modunda bile bu ek adım birebir modellenir (ayrı bir "fiziksel onay" aksiyonu olarak).
- Simülasyon modu ile gerçek cihaz modunun her zaman, her ekranda net şekilde ayırt edilmesi (rozet/renk ile) — karıştırılması mümkün olmamalı.
- Her komutun kim/ne zaman/hangi cihaza/ne yaptığının denetim kaydı.
- Yeni bir Yönetim/Ayarlar ekranı: cihaz tanımlama, sürücü atama, sim/gerçek mod geçişi (bu geçiş sıradan kullanıcıya/sesli komuta kapalı, sadece yetkili rol).
- Rol bazlı + **odaya göre** erişim: sadece o an ilgili cihazın bulunduğu odada "aktif" olan (devam eden ameliyat ekibinde yer alan) klinik roller komut verebilir.
- **Komut verme, kişisel cihazdan değil, odaya sabit bir ekran/kiosk üzerinden yapılır** (ör. salonun duvarındaki ekran). Kişisel cihazlar sadece **ses profili kaydı (enrollment)** için kullanılır — her klinisyen kendi telefonundan/tabletinden, kendi hesabıyla, sabit bir metni bir kez okuyarak ses profilini oluşturur.
- Oda-sabit ekran bir komut duyduğunda, konuşanı **o odanın o an aktif ameliyat ekibindeki kişilerin ses profilleriyle** karşılaştırır (konuşmacı doğrulama). Eşleşen kişi bulunur ve ekipte/yetkiliyse komut işlenir; eşleşmezse veya eşleşen kişi o ekipte değilse, mümkünse isimle kişiye özel sesli ret verilir ("Dr. Esra, bu ameliyatta görevli değilsiniz, komut veremezsiniz"), hiç eşleşme yoksa genel bir "sizi tanıyamadım" mesajı verilir.
- Oda-sabit ekranın komut kabul penceresi, o odadaki ameliyatın durumuna bağlıdır: sadece **IN_PROGRESS** iken aktif olur; ameliyat tamamlanınca/iptal olunca **otomatik ve backend tarafında da doğrulanarak** kapanır.

## Hedef olmayanlar

- Gerçek cihaz protokolü yazmak (ForceTriad hariç, o da bu fazda sadece araştırma/doğrulama — gerçek sürücü değil).
- Tıbbi cihaz regülasyonu / klinik onay süreci.
- Gerçek hastada/ameliyatta kullanım.
- Üreticinin güvenlik sınırlarını/donanımsal kilitlerini herhangi bir şekilde devre dışı bırakacak kod.
- **Gerçek bir konuşmacı doğrulama (speaker verification) modelinin seçilip üretime alınması** — ForceTriad'la aynı mantıkla, bu ayrı bir araştırma adımı; bu fazda sadece mimari (arayüz + Mock) kuruluyor.

## Anti-hedefler

- Enerji/lazer/tehlikeli motor hareketinin sesli onaydan hemen sonra, ek bir fiziksel adım olmadan **doğrudan** uygulanması (masa/ışık hareketi için).
- Simülasyon modunda olunduğunun belli edilmemesi.
- Sim ↔ gerçek mod geçişinin normal kullanıcı/sesli komut tarafından yapılabilmesi.
- Dört cihaz grubu için ayrı ayrı, tekrar eden kod yazılması (ortak arayüz yerine).

## Kısıtlar (değişmedi + ek)

- Web Speech API pratikte Chrome/Edge ile sınırlı; mikrofon izni + HTTPS/localhost gerekir; sürekli dinleme `onend`'de yeniden başlatılmalı.
- Mevcut yığına uyum: React 19 + Vite + Zustand, Express + `pg` (ham SQL, Prisma referans), Socket.io. Yeni ORM/mimari katman yok.
- Mevcut `authenticate`/`authorize(...roleIds)` ve `audit_logs`/`audit()` kullanılacak — yeni yetkilendirme/log sistemi icat edilmeyecek.
- Mevcut projede şu an "bu kullanıcının o an çalıştığı oda" kavramı yok — bu modülle birlikte kuruluyor (aşağıda).
- Mevcut Envanter/Biyomedikal modüllerinin backend'de hiç tablosu yok (sadece mock veri) — bu modülün tablosu, projenin **ilk gerçek cihaz tablosu** olacak.
- **Ses biyometrisi (voice embedding) KVKK'da özel nitelikli kişisel veri sayılır** — açık rıza metni, minimum saklama (ham ses değil, sadece embedding saklanır), silme hakkı gibi konular bu dokümanda mimari olarak işaretleniyor ama tam hukuki metin builder'a/hukuk birimine bırakılıyor.

## Yaklaşım (önceki konuşmada seçildi, değişmedi)

Ses tanıma tarayıcıda, komut backend'e gidiyor, backend'de Cihaz Sürücüsü soyutlaması (mock→gerçek geçişi backend-only). Artık teyit edilen ek karar: **modül, ayrı bir ürün değil, bu Operio uygulamasının içinde** — kendi auth/ayarlar ekranı icat edilmiyor, mevcut rol/oturum sistemine ekleniyor.

## Karar verilen tasarım

### Satın alınabilir modül (paylaşılan altyapı — Vision modülü de bunu kullanacak)

Mevcut abonelik sistemine baktım: `plans.features` JSONB alanı var ama sadece gösterim amaçlı, hiçbir yerde gerçek bir yetki kontrolü yapmıyor — yani "kurum şu modülü satın aldı mı" diye bir kavram hiç yok. Bunu, plan sisteminin yanına, **eklenti modülleri** olarak ekliyorum (plan değişmiyor, üstüne ekleniyor):

```sql
CREATE TABLE IF NOT EXISTS modules (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug        VARCHAR(40) UNIQUE NOT NULL,   -- 'voice_control' | 'vision_counting' | ...
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  price_try   INTEGER     NOT NULL DEFAULT 0, -- kuruş
  price_usd   INTEGER     NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS institution_modules (
  id                     UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id         UUID        NOT NULL REFERENCES institutions(id),
  module_slug            VARCHAR(40) NOT NULL REFERENCES modules(slug),
  status                 VARCHAR(20) NOT NULL DEFAULT 'active', -- active | cancelled | trial
  purchased_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at           TIMESTAMPTZ,
  iyzico_subscription_id VARCHAR(100),
  stripe_subscription_id VARCHAR(100),
  UNIQUE (institution_id, module_slug)
);
```

- Yeni bir `requireModule(slug)` middleware'i (`authorize` ile aynı yerde/tarzda) — `institution_modules`'ta ilgili kurum için `status='active'` kaydı yoksa 403 + "Bu modül satın alınmamış" döner. `/api/devices/*` route'larının tamamına uygulanır.
- Satın alma akışı **yeni bir ödeme sistemi değil** — mevcut `payment.provider.js` (iyzico/stripe) aynen kullanılır, sadece `plan_slug` yerine `module_slug` ile parametrelenir.
- Frontend: mevcut Abonelik/Fiyatlandırma sayfalarına bir "Modüller/Eklentiler" bölümü eklenir (yeni bir sayfa değil). Kurum modülü almamışsa, Sidebar'da "Sesli Kontrol" girişi yerine satın alma CTA'sı gösterilir.
- Bu tablo/middleware Vision modülü geldiğinde aynen (`module_slug='vision_counting'`) tekrar kullanılacak — Vision için ayrıca tasarlanmayacak.

### Veri modeli (`migrations/001_init.sql`'e eklenir)

```sql
CREATE TYPE device_power_state AS ENUM ('OFF', 'STANDBY', 'ON', 'ARMED');
CREATE TYPE device_mode        AS ENUM ('SIM', 'REAL');

CREATE TABLE IF NOT EXISTS controllable_devices (
  id                     UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id         UUID        NOT NULL REFERENCES institutions(id),
  room_id                UUID        REFERENCES operating_rooms(id),
  name                   VARCHAR(100) NOT NULL,              -- "Elektrokoter Unit 3"
  device_group           VARCHAR(30) NOT NULL,               -- 'electrosurgery' | 'endoscopy_imaging' | 'light' | 'table'
  device_type            VARCHAR(50) NOT NULL,               -- 'cautery' | 'ligasure' | 'forcetriad' | ...
  driver_key             VARCHAR(50) NOT NULL DEFAULT 'mock',
  mode                   device_mode NOT NULL DEFAULT 'SIM', -- SIM/REAL ayrımı — sadece yönetim ekranından değişir
  power_state            device_power_state NOT NULL DEFAULT 'OFF',
  power_level            SMALLINT    NOT NULL DEFAULT 0,
  requires_physical_confirm BOOLEAN  NOT NULL DEFAULT FALSE, -- masa/ışık hareketi için TRUE
  capabilities           JSONB       NOT NULL DEFAULT '{}',  -- desteklenen aksiyonlar, min/max, vb.
  connection_info        JSONB       NOT NULL DEFAULT '{}',  -- gerçek donanıma geçince: port/ip vb.
  serial_number           VARCHAR(60),                       -- envanter modülüyle paylaşılan alanlar
  category                VARCHAR(60),
  last_maintenance_at      DATE,
  calibration_at           DATE,
  is_voice_enabled        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_controllable_devices_room ON controllable_devices(room_id);
```

Komut geçmişi: mevcut `audit_logs` tablosu (`action='device:command'`, `resource='controllable_devices'`, `resource_id`, `new_data={ command, value, result, driverKey, mode }`). Yeni tablo açılmıyor.

`serial_number/category/last_maintenance_at/calibration_at` alanları, ileride Envanter/Biyomedikal modülleri gerçek backend'e geçtiğinde aynı tabloyu kullanabilsin diye şimdiden ekleniyor — iki ayrı "cihaz" kavramı oluşmasın diye.

### Kimlik doğrulama — oda-sabit ekran + ses biyometrisi

Komut veren tarafın kişisel JWT oturumu **yok** — oda-sabit ekran kişisel bir hesapla giriş yapmıyor. Bunun yerine:

- **Kurulum:** Biyomedikal/Teknik Servis, ekranı bir kere `room_id`'ye bağlar (ör. `/kiosk/:roomId` açılır) ve o oda için uzun ömürlü, kuruma özel bir **kiosk token** üretilir (kişisel JWT'den farklı, sadece `institution_id`+`room_id` taşıyan, `authorize` rol kontrolünden geçmeyen ayrı bir doğrulama yolu). Bu, mevcut auth sistemine dokunmadan eklenen minimal, yeni bir kavram.
- **Ses profili kaydı (enrollment):** Her klinisyen, kendi kişisel cihazından, **kendi normal (JWT) oturumuyla**, `Profil.jsx`'teki yeni "Ses Profili" bölümünden sabit bir metni bir kez okur; backend bunu işleyip bir **embedding** (vektör) üretir ve `user_id`'ye bağlı saklar — ham ses kaydı saklanmaz.
- **Komut anında doğrulama:** Oda-sabit ekran "Operio" + komutu duyunca, ham sesi (kiosk token ile) backend'e yollar. Backend: (1) o odada `IN_PROGRESS` bir ameliyat var mı kontrol eder — yoksa komut tümden reddedilir; (2) varsa o ameliyatın `surgery_teams` listesindeki kişilerin ses profilleriyle `SpeakerVerifier.identify()` çağrısı yapılır; (3) eşleşen kişi bulunursa onun rolü `authorize` listesiyle kontrol edilir; (4) hepsi geçerse komut işlenir.
- **Ret durumları, kişiye özel sesli geri bildirim:** Eşleşen kişi ekipte/yetkili değilse → "`{isim}`, bu ameliyatta görevli değilsiniz, komut veremezsiniz" (isim, eşleşen kullanıcının `full_name`'inden). Hiç eşleşme yoksa → genel "Sizi tanıyamadım, lütfen tekrar deneyin veya ses profilinizi Profil sayfasından oluşturun."
- **Ameliyat bitince otomatik kapanma:** Backend her komutta ameliyat durumunu **o an yeniden** kontrol eder (sadece ekran açılışında değil) — `IN_PROGRESS` değilse reddeder. Ekran, `EVENTS.SURGERY_UPDATED` event'ini dinleyip durumu anlık günceller ve "Bu odada aktif ameliyat yok, sesli kontrol kapalı" gösterir.
- **ARMED cihazlar için güvenli varsayılan:** Bir cihaz `ARMED` (fiziksel onay bekliyor) durumundayken ameliyat `IN_PROGRESS` olmaktan çıkarsa (tamamlandı/iptal), o odadaki tüm `ARMED` cihazlar backend tarafından **otomatik olarak** son onaylı duruma (`OFF`/`STANDBY`) döndürülür — hiçbir cihaz, "şu an bunu gerçekten isteyen biri yok" durumunda ARMED kalmaz; masada sonradan yanlışlıkla basılacak fiziksel bir düğme artık hiçbir harekete yol açmaz.

#### Veri modeli — ses profili

```sql
CREATE TABLE IF NOT EXISTS voice_profiles (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  embedding     BYTEA       NOT NULL,     -- ses parmak izi (vektör) — ham ses saklanmaz
  model_version VARCHAR(30) NOT NULL,     -- hangi embedding modeliyle üretildi
  enrolled_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);
```

### Yetkilendirme (özet)

`POST /api/devices/:id/command`: kiosk token doğrulanır + `requireModule('voice_control')` + oda'da `IN_PROGRESS` ameliyat kontrolü + `SpeakerVerifier.identify()` ile kişi tespiti + o kişi için `authorize(0,1,2,3,4,5,6)` eşdeğeri rol kontrolü. Hepsi tek bir middleware zincirinde, mevcut `authorize` deseniyle tutarlı yazılır.

**Cihaz grubuna göre yetki kademelendirmesi (karar verildi):** Düz rol listesi (0,1,2,3,4,5,6) her iki grup için de ön koşul, ama üstüne risk seviyesine göre `surgery_teams.team_role` bazlı ek bir süzgeç var:

- **Elektrocerrahi ve ameliyat masası** (yüksek risk): ek olarak, komutu veren kişinin o ameliyattaki `team_role`'ü **'cerrah'** olmalı — yani o ameliyatı yürüten cerrahtan başkası (asistan, hemşire, anestezi vb. ekipte olsa bile) bu iki grubu kontrol edemez.
- **Cerrahi ışık ve endoskopi/görüntüleme** (düşük/orta risk): ek kısıtlama yok, düz rol listesindeki herhangi bir ekip üyesi kullanabilir.

Bu, yeni bir sütun açmadan, mevcut `capabilities` JSONB alanına `requiredTeamRoles: ['cerrah']` gibi bir anahtar eklenerek uygulanır (boş/yoksa ek kısıtlama yok demektir) — cihaz bazında da override edilebilir (örn. ileride bir cihaz için farklı bir rol gerekebilir).

Sim→Gerçek mod değişimi (cihaz) ve kiosk kurulumu: ayrı endpoint'ler, sadece Üst Yönetici(0)/Biyomedikal(11)/Teknik Servis(12) rolleriyle sınırlı (normal kişisel JWT oturumuyla, kiosk token'la değil).

### Backend: Sürücü soyutlaması

```js
// src/drivers/DeviceDriver.js
class DeviceDriver {
  constructor(device) { this.device = device; }
  async turnOn()        { throw new Error('not implemented'); }
  async turnOff()       { throw new Error('not implemented'); }
  async setPower(level) { throw new Error('not implemented'); }
  async armMove(preset) { throw new Error('not implemented'); } // masa/ışık için: sadece "hazırla"
  async confirmPhysical(){ throw new Error('not implemented'); } // masa/ışık: fiziksel onay geldi
  async getStatus()     { throw new Error('not implemented'); }
  // Yukarıdaki 6 metot ortak eylemleri kapsar (aç/kapat/güç/hazırla/fiziksel onay/durum).
  // Endoskopi-görüntüleme (zoom/pan/beyaz dengesi/kare dondur) ve elektrocerrahinin
  // kesme/koagülasyon modu gibi gruba özel eylemler için genel bir kaçış kapısı:
  async invokeAction(name, args) { throw new Error('not implemented'); }
}
```

- `MockDriver` — tüm 4 grup için varsayılan; `requires_physical_confirm=true` olan cihazlarda `armMove()` durumu `ARMED` yapar, gerçek hareket ancak ayrı bir `POST /api/devices/:id/physical-confirm` çağrısıyla (simülasyonda: panelde "Konsoldan fiziksel onayla" butonu) tamamlanır.
- `registry.js` — `driver_key → sınıf` eşlemesi. Gerçek donanım geldiğinde yeni sınıf eklenir, başka hiçbir yer değişmez.
- `src/socket.js`'e eklenir: `DEVICE_STATUS_CHANGED: 'device:status_changed'`.

#### Backend: Konuşmacı doğrulama soyutlaması (aynı desen)

```js
// src/drivers/SpeakerVerifier.js — ortak arayüz
class SpeakerVerifier {
  // candidateUserIds: o odanın o anki ameliyat ekibi
  async identify(audioBuffer, candidateUserIds) { throw new Error('not implemented'); }
  // -> { userId, confidence } | null (eşik altındaysa/eşleşme yoksa null — "kimse değil" açıkça dönmeli)
}

// src/drivers/MockSpeakerVerifier.js — demo: ilk adayı "eşleşti" döndürür, UI'da "MOCK" etiketli
```

Gerçek model (ör. açık kaynak bir speaker-embedding modeli, hastane verisinin dışarı çıkmaması için tercihen kendi barındırılan) ve **kayıttan tekrar oynatmaya (replay) karşı dayanıklılık/liveness** ayrı bir araştırma adımıdır — bkz. "Builder'a bırakılanlar". Bu fazda tek mimari karar: sesli onay adımı sabit bir "evet/hayır" değil, **her seferinde rastgele üretilen kısa bir ifadenin** ("üç-yedi-iki" gibi) tekrarlanmasını ister — bu, önceden kaydedilmiş bir onay sesinin basitçe tekrar oynatılmasına karşı ucuz bir ilk savunma sağlar; gerçek bir liveness/anti-spoofing yöntemi gerekip gerekmediği, konuşmacı doğrulama modeli seçilirken ayrıca değerlendirilir.

`MockSpeakerVerifier`, demo sırasında her iki ret senaryosunun da ("ekipte değil" / "hiç tanınmadı") gösterilebilmesi için yapılandırılabilir olacak: Yönetim ekranından "her zaman eşleştir / her zaman reddet (ekipte değil) / her zaman tanınmadı / sırayla değiştir" seçeneklerinden biri seçilebilir — sabit "ilk adayı eşleştir" davranışı demo amacına yetmez.

Çalışma zamanında doğrulama için gönderilen ham ses **kalıcı olarak saklanmaz** — `identify()` çağrısı için bellekte/geçici işlenir, sonucu (eşleşen kullanıcı + güven skoru) `audit_logs`'a yazılır, ses kaydının kendisi atılır. (Enrollment'taki embedding'den farklı olarak, komut anı sesi hiç saklanmaz.)

### Frontend

- `src/pages/Kiosk.jsx` (`/kiosk/:roomId`) — **oda-sabit ekranın** gösterdiği sayfa; kişisel oturum değil, kiosk token ile çalışır. İçinde `useVoiceDeviceControl` hook'u mount edilir: boşta → "operio" duyuldu → komut dinleniyor → sesli onay → (gerekiyorsa) fiziksel onay bekleniyor → backend'e gönder (ses + roomId). Ameliyat `IN_PROGRESS` değilken "sesli kontrol kapalı" gösterir.
  - **Teknik not:** Web Speech API sadece metin döner, ham ses buffer'ı vermez — konuşmacı doğrulaması için ayrıca gerekli. Bu yüzden hook iki şeyi paralel çalıştırır: (1) `SpeechRecognition` → uyandırma kelimesi + komut metni için; (2) aynı anda bir `MediaRecorder` ile birkaç saniyelik dönen bir ses tamponu (ring buffer) tutulur. Komut algılanıp onay anına gelindiğinde, o utterance'a denk gelen ses parçası (recognition event'lerinin zaman damgalarıyla hizalanarak) kesilip backend'e yüklenir. İki ayrı kayıt sistemi aynı mikrofon akışından beslenir, kullanıcı için tek bir kesintisiz deneyim olarak görünür.
- `src/pages/CihazKontrol.jsx` — normal kişisel oturumla, aktif odadaki cihazları gruplarına göre kart halinde gösterir; manuel aç/kapat/slider (yedek yol, sesle sınırlı kalmasın) + sim/gerçek rozeti; masa/ışık kartlarında "fiziksel onay" simülasyon butonu. (Kiosk ekranı komut *veren* taraf, bu sayfa izleme + manuel yedek.)
- `src/pages/Profil.jsx`'e eklenen "Ses Profili" bölümü — sabit bir metni mikrofonla okuma, kayıt, backend'e yükleme, "ses profiliniz oluşturuldu" onayı, yeniden kaydetme imkanı.
- `src/pages/SesliKontrolAyarlari.jsx` (yeni, yönetim ekranı) — cihaz tanımlama, sürücü/mod atama, kiosk kurulumu (oda↔ekran eşleştirme, token üretme); sadece yukarıdaki yetkili roller görür.
- `src/data/roles.js`'e ilgili rollerin nav'ına girişler eklenir.

### Ek: Time-Out hatırlatması (Güvenli Cerrahi Kontrol Listesi, Bölüm III)

Sağlık Bakanlığı'nın resmi "Tıp Merkezi Güvenli Cerrahi Kontrol Listesi"nin (SKS Tıp Merkezi Seti 2023, Ek-2) "III. Ameliyat Kesisinden Önce" bölümünden, sadece 16. ve 17. maddeler kapsama alınıyor:

> 16. Ekipteki kişiler kendilerini ad, soyad ve görevleri ile tanıttı mı?
> 17. Ekipten bir kişi sesli olarak hastanın kimliğini, yapılan ameliyatı, ameliyat bölgesini teyit etti mi?

(Resmi standardın kendisi zaten her maddenin sesli yapılmasını zorunlu kılıyor — Voice burada yeni bir yük eklemiyor, sadece hatırlatıyor.)

**Kapsam (kullanıcı tarafından netleştirildi — minimal):** Sistem bu iki maddeyi **sadece sesli olarak okur** (TTS), cevapları toplamaz/doğrulamaz. Bu yüzden cihaz komutlarındaki ağır akış (oda+ekip kontrolü, konuşmacı doğrulama, sesli onay) burada **gerekmiyor** — okuma, herhangi bir cihaz durumunu değiştirmiyor, güvenlik riski taşımıyor.

- Tetikleme: Kiosk ekranında "Operio, time-out" (veya benzer sabit bir tetik ifadesi) duyulunca, kiosk `speechSynthesis` ile sırayla iki maddeyi okur.
- Kayıt: Ne zaman okunduğu `audit_logs`'a yazılır (`action='voice:timeout_read'`, `resource='surgeries'`, `resource_id=<ameliyat id>`) — uyum/kanıt amaçlı, ekstra bir tablo açılmadan.
- Yeni tablo yok, yeni yetkilendirme katmanı yok — mevcut Kiosk sayfasına ikinci, hafif bir komut niyeti olarak eklenir.

## Operia — Genişletilmiş Kapsam (2026-11-21 eklendi)

Bu bölüm, önceki bölümlerin karar verdiği mimariyi (kiosk + ses biyometrisi + katmanlı yetkilendirme) **değiştirmiyor**, üzerine iki yeni "kritik olmayan" komut sınıfı ekliyor: Spotify kontrolü ve web arama. Aşağıdaki her şey, yukarıdaki "Karar verilen tasarım" bölümünün bir uzantısıdır.

### Marka/UI birleşmesi

**Netleştirildi (önemli keşif, builder-check'ten önce bulundu):** Projede zaten `src/services/ai.service.js` + `AIPanel.jsx`/`useAIChat.js` ile çalışan, Claude API tabanlı, **"Operia"** adında bir metin-sohbet asistanı var (sidebar paneli, kurum verisiyle sohbet, aksiyon üretme). "Operio Voice" ve (ileride) "Operio Vision" **yeni bir marka icat etmiyor** — hepsi **Operia** kimliğinin bir uzantısı: Operia artık hem yazılı panelden hem kiosk'tan **sesle** erişilebiliyor.

- **Uyandırma kelimesi değişmiyor:** Kiosk'ta tetikleyici kelime hâlâ **"Operio"** (ör. "Operio, koteri 20 yap"). Ama asistan kendi kimliğinden bahsederken/cevap verirken kendini **"Operia"** olarak tanıtır (ör. "Operia bunu buldu: ...", "Ayşe'nin Spotify hesabını açıyorum" gibi kişiye özel yanıtlarda da konuşan taraf Operia'dır).
- **Web arama, yeni bir entegrasyon kurmaz** — mevcut `ai.service.js`'teki Claude istemcisi (`client`, `MODEL`, `ANTHROPIC_API_KEY` zaten tanımlı ve kullanımda) kullanılır, sadece `web_search` aracı eklenmiş yeni bir fonksiyon bu dosyaya eklenir. Aşağıdaki "Web arama entegrasyonu" bölümü bu şekilde güncellendi.
- `modules` tablosundaki `slug` değerleri değişmiyor (`voice_control`, ileride `vision_counting`) — satın alma/entitlement hâlâ ayrı ayrı, kurum birini alıp diğerini almayabilir.
- Spotify ve web arama **yeni bir satın alınabilir modül değil** — `voice_control` modülünün kapsamına dahil (aynı `requireModule('voice_control')` kapısından geçer).

### Yetkilendirme modeli — üçüncü kademe (yeni kavram yok, var olan mekanizma genişletiliyor)

Mevcut `capabilities.requiredTeamRoles` alanı zaten "boşsa ek kısıtlama yok" anlamına geliyordu. Spotify/web-arama bu boş-kısıtlama durumunu kullanır — veri modelinde hiçbir değişiklik gerekmez:

| Komut sınıfı | Taban kapı (ekip+oda+ses-biyometri) | Ek rol kısıtı |
|---|---|---|
| Elektrocerrahi / masa | zorunlu | `cerrah` |
| Işık / endoskopi | zorunlu | yok |
| **Spotify / web arama** | zorunlu | yok |

Yani kişi o ameliyat ekibinde olmalı (rolü ne olursa olsun) ama `cerrah` olması gerekmiyor — tıpkı ışık/endoskopi gibi.

**Netleştirildi (builder-check sordu, karar verildi):** "Taban kapı" harfiyen aynı — Spotify/web-arama da, cihaz komutları gibi, o odada **IN_PROGRESS bir ameliyat olmasını** şart koşar. Ameliyat yoksa kiosk hiçbir sesli komutu (Spotify/arama dahil) kabul etmez; `SpeakerVerifier.identify()`'ın aday havuzu hep "o anki ameliyat ekibi" olarak kalır, ikinci bir aday-havuzu kaynağı (günlük personel listesi vb.) eklenmiyor. Bilinçli tercih: basitlik, tek bir yetkilendirme yolu, ek bir kiosk ekran-durumu icat edilmiyor.

### Kanal kararı (tartışıldı, vazgeçildi)

Kişisel telefon/cihaz üzerinden ayrı bir giriş kanalı değerlendirildi ve **vazgeçildi**: Spotify/web-arama da dahil her komut, kiosk mikrofonu + ses-biyometri doğrulamasından geçer. Sebep: hangi Spotify hesabının açılacağını / kime hitaben cevap verileceğini belirlemek zaten bir kimlik tespiti gerektiriyor, bu da mevcut `SpeakerVerifier` akışının ta kendisi — ayrı bir kanal (telefon login) bu ihtiyacı ortadan kaldırmıyor, sadece yetkilendirmeyi iki yere bölüyordu.

### Spotify entegrasyonu

**Yeni tablo** (`migrations/001_init.sql`'e eklenir):

```sql
CREATE TABLE IF NOT EXISTS user_spotify_connections (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  spotify_user_id   VARCHAR(100) NOT NULL,
  access_token      TEXT        NOT NULL,
  refresh_token     TEXT        NOT NULL,
  expires_at        TIMESTAMPTZ NOT NULL,
  connected_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- **Bağlantı (gerçek, donanıma bağlı değil):** `Profil.jsx`'e "Spotify Hesabı" bölümü eklenir — standart OAuth Authorization Code flow. `GET/POST /api/spotify/connect`, `/callback`, `/disconnect` + token yenileme mantığı. Spotify Developer App kaydı/`client_id`/`client_secret` gerekir (builder'a bırakılıyor).
- **Çalma hedefi (mock, donanım yok):** Aynı `DeviceDriver` ailesine yeni bir sürücü — `src/drivers/SpotifyPlaybackDriver.js` (gerçek: Spotify Connect "transfer playback" API'si ile o odanın kayıtlı Connect cihazına gönderir) ve varsayılan `MockSpotifyPlaybackDriver` (ses çıkmaz; `audit_logs`'a `action='voice:spotify_play'` ile "{isim}'in Spotify hesabından {X} çalınıyor (mock, oda: {Y})" yazılır, kiosk ekranında metinle gösterilir).
- **Komut akışı (netleştirildi — builder-check buldu):** ses-biyometri kişiyi tanır → taban yetki kontrolü (ekip+oda) → `user_spotify_connections`'da kaydı var mı kontrol edilir (yoksa: "Spotify hesabınız bağlı değil, Profil sayfasından bağlayabilirsiniz" sesli yanıtı) → varsa, o kullanıcının gerçek token'ıyla Spotify Web API'ye **sadece arama/resolve** isteği yapılır (track/playlist URI bulma) — Spotify'ın gerçek `play`/`transfer-playback` uç noktası bu fazda **hiç çağrılmaz** (zaten bağlı bir Connect cihazı olmadan hata verir). Bulunan track/playlist bilgisi `SpotifyPlaybackDriver`'a (şu an mock) iletilir → kiosk sesle onaylar: "**{isim}**'in Spotify hesabından **{playlist/şarkı}** çalınıyor (mock)."
- Oynatma hedefinin (hangi "cihaz" kaydı olacağı) `controllable_devices` tablosuna mı ekleneceği yoksa ayrı mı tutulacağı builder'a bırakılıyor — ikisi de mevcut mimariyi bozmuyor.
- **Not (builder-check buldu, karar verildi):** Spotify'ın gerçek oynatma kontrolü (play/transfer-playback) sadece Premium hesaplarda çalışır. Kişi-başı OAuth modeli (kurumsal/paylaşılan tek hesap değil) bilinçli olarak korunuyor — bu faz zaten gerçek `play` çağrısı yapmadığı için (yukarıdaki netleştirmeye bkz.) şimdilik engel değil; gerçek sürücü yazıldığında Premium olmayan hesaplar için anlaşılır bir sesli hata ("Bu özelliği kullanmak için Spotify Premium gerekiyor") döndürülmesi builder'a not olarak bırakılıyor.

### Web arama entegrasyonu

- **Yeni entegrasyon kurulmuyor — mevcut Operia altyapısı genişletiliyor:** `src/services/ai.service.js`'teki hazır Claude istemcisi (`client`, `MODEL`, `ANTHROPIC_API_KEY` zaten var) kullanılır. Bu dosyaya `webSearch(query)` adında yeni bir fonksiyon eklenir — `client.messages.create` çağrısına Claude'un yerleşik `web_search` aracı eklenmiş hali, ayrı bir arama API'si (Google/Bing/Brave) veya ayrı bir özetleme adımı kurulmaz.
- **Akış:** kiosk "Operio, ara: ..." → backend `POST /api/assistant/web-search` (kiosk token + ses-biyometri + taban yetki kontrolünden geçer, rol kısıtı yok) → `aiService.webSearch(query)` çağrılır → dönen kısa cevap TTS ile okunur, "Operia" kimliğiyle sunulur. Ham arama sonucu/kaynak metni saklanmaz; sadece soru + özet cevap `audit_logs`'a (`action='voice:web_search'`) yazılır.
- **İçerik kapsamı tamamen açık** — klinik (ilaç dozu, protokol) veya gündelik (spor skoru, hava durumu, genel merak) her türlü soru kapsamda; bir engelleme/konu filtresi **yazılmayacak** (bilinçli anti-hedef, aşağıda).
- **Klinik-görünümlü sorularda ek sesli uyarı:** Cevap klinik bir soruya benziyorsa (yöntemi builder'a bırakılıyor — basit anahtar kelime listesi veya ikinci bir sınıflandırma çağrısı), cevaptan önce kısa bir uyarı eklenir: "Bu doğrulanmış bir klinik kaynak değildir." Gündelik sorularda bu uyarı eklenmez. Bu bir içerik kısıtlaması değildir, sadece bir sorumluluk notudur — cevap yine verilir.
- **Veri çıkışı (builder-check sordu, karar verildi):** Kullanıcının sorduğu soru metni, cevap üretmek için Anthropic'in Claude API'sine (kurum dışı, üçüncü taraf bir servis) gönderilir. Bu, dokümanın ses biyometrisi için benimsediği "hastane verisi dışarı çıkmasın" ilkesinden **bilinçli olarak muaf** tutuluyor — bu faz zaten demo/prototip (bkz. dokümanın en başındaki regülasyon notu), gerçek hasta kullanımına geçilmeden önce bu karar yeniden değerlendirilecek. Sorgu metninde hasta-tanımlayıcı bilgi geçebileceği bilinen bir sınırlama olarak not ediliyor; filtre/redaksiyon bu fazda eklenmiyor.

### Hedef olmayanlar (ek)

- Kişisel telefon/cihaz üzerinden ayrı bir sesli komut kanalı (tartışıldı, vazgeçildi).
- Web aramasının konuya/içeriğe göre kısıtlanması veya onaylı-kaynak listesiyle sınırlanması (tartışıldı, reddedildi — kullanıcının tercihine bırakıldı).
- Spotify için gerçek ses çıkışı (oda hoparlörü/Spotify Connect cihazı donanımı henüz yok) — bu faz sadece mock.

## Builder'a bırakılanlar (ek — Operia genişletmesi)

- Spotify Developer App kaydı/client credentials temin süreci.
- Oynatma hedefinin veri modeli: `controllable_devices`'a mı eklensin yoksa ayrı mı tutulsun.
- Web arama için klinik-soru sınıflandırma yöntemi ve uyarı cümlesinin kesin metni.
- Claude API model seçimi (maliyet/hız/kalite dengesi — basit sorular için düşük maliyetli bir model, karmaşık sorularda yükseltme ihtiyacı olup olmadığı).
- Türkçe komut grameri: "Operio, Spotify'da X çal", "Operio, ara: Y" gibi ifadelerin eş anlamlı varyasyonları (mevcut Türkçe komut grameri görevine ek).
- Spotify arama sonucu birden fazla eşleşme döndürürse (örn. "seksenler" adında birden fazla playlist) hangisinin seçileceği.

## Builder'a bırakılanlar

- ForceTriad için üretici teknik imkanlarının araştırılması/doğrulanması — bu, mimariyi bloklamayan ayrı bir görev; sonucu "gerçek sürücü yazılabilir" ya da "sadece OEM ortaklığıyla mümkün" olabilir, her iki durumda da mimari değişmez.
- Her cihaz grubu için `capabilities` JSON'ının somut ilk değerleri.
- Türkçe komut grameri eş anlamlı kelime listeleri.
- Kart/slider/yönetim ekranının görsel tasarımı.
- Sesli onay ve fiziksel onay zaman aşımı süreleri (öneri: ikisi için de 10sn).
- Gerçek konuşmacı doğrulama modeli/servisi seçimi (tercihen kendi barındırılan, hastane sesi dışarı çıkmasın) ve benzerlik eşik değeri — ayrı araştırma adımı, ForceTriad ile aynı şekilde.
- Ses profili kaydı için okunacak sabit/pasaj metninin içeriği.
- Kiosk token'ın tam güvenlik detayları (üretim/iptal/süre).
- KVKK açık rıza metninin hukuki içeriği (ses biyometrisi için).
- Time-Out okumasının tam TTS cümleleri (resmi listedeki soru formunu mu birebir okuyacak, yoksa "şimdi yapın" tarzı bir hatırlatma cümlesine mi çevrilecek) ve tetik ifadesinin kesin sözcükleri.
