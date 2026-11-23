# Operio Vision — Sterilizasyon Alet Sayımı (Tasarım)

## Amaç ve neden

Sterilizasyon biriminde, ameliyattan dönen "kirli" cerrahi setler teslim alınırken her alet elle sayılıp beklenen listeyle (`set_instruments.expected_count`) karşılaştırılıyor. Bu iş bugün [SetTakip.jsx](../../../src/pages/SetTakip.jsx)'teki **Alet Sayım Formu** (`SayimModal`) üzerinden personelin her alet için tek tek +/- tuşuna basarak yaptığı, tamamen elle bir işlem. Operio Vision bu sayımı bir fotoğraf + Claude görsel analizi ile hızlandırıp doğrulamayı destekler: personel tepsinin fotoğrafını çeker/yükler, sistem her alet için tespit ettiği sayıyı öneri olarak sayaçlara doldurur; personel onaylamadan hiçbir şey kalıcı hale gelmez.

Sıralama: Voice modülü (sesli cihaz kontrolü + Operia kiosk) tamamlanmış durumda. Vision bir sonraki modül. Gerçek alet fotoğrafları henüz yok (kullanıcı yarın sağlayacak) — bu doküman, placeholder/stok görsellerle uçtan uca çalışan gerçek bir boru hattı (fotoğraf → Claude → öneri → elle onay) kurmayı; gerçek fotoğraflar gelince doğruluğun o zaman ölçülmesini öngörüyor.

## Kapsam dışında bırakılanlar (non-goals)

- **Ameliyat sırasında (OR) alet sayımı** — ameliyat kapanmadan önce masadaki aletleri sayma, farklı bir ihtiyaç; bu doküman onu kapsamıyor (kullanıcı tercihi: önce sterilizasyon birimi).
- **SetTakip.jsx'in diğer aşamaları** (yıkamada, sterilizasyonda, steril, depoda) ve sayfanın geri kalanı — dokunulmuyor, mock veride kalmaya devam ediyor.
- **SterilSetler.jsx'in kullandığı `/steril` endpoint'i** — bu plan onu değiştirmiyor, konsolide etmiyor. Üç paralel veri yolu (gerçek-ama-kullanılmayan `/sterile-sets`, SetTakip'in mock'u, SterilSetler'in `/steril`'i) bu planın sonunda da üç olarak kalacak; sadece birincisi artık canlı bir tüketiciye kavuşuyor.
- **Özel/eğitilmiş bir CV modeli veya üçüncü parti görüntü-işleme servisi** — kullanılmıyor, Claude'un görsel analiz yeteneği kullanılıyor (web aramada izlenen "yeni vendor yok" ilkesiyle aynı).
- **Gerçek kamera donanımı/sabit OR kamerası** — yok; tarayıcı üzerinden dosya yükleme veya `getUserMedia` ile anlık kare yakalama var.

## Anti-goals

- AI'ın önerdiği sayım hiçbir koşulda otomatik onaylanıp kalıcı hale gelmemeli — cihaz komutu teyit akışında izlenen "insan onayı olmadan hiçbir kritik veri kalıcılaşmaz" ilkesiyle aynı.
- Eksik alet tespiti bir sonraki aşamaya (yıkama) geçişi **engellemeyecek** — mevcut UX'te olduğu gibi uyarı + log ile devam ediliyor; Vision bunu daha katı bir kurala çevirmiyor.

## Kısıtlar

- Gerçek alet fotoğrafı yok; Claude'un görsel ayırt etme isabeti bu aşamada doğrulanamıyor — bilinen ve kabul edilen risk.
- `modules` tablosunda `vision_counting` slug'ı henüz seed edilmemiş (sadece `voice_control` var) — bu plan ekliyor.
- SetTakip.jsx'in set listesi mock veriden (`sterilSetlerV2`, sayısal `id`) geliyor; gerçek backend'deki `sterile_sets` tablosu UUID `id` kullanıyor — bu ikisi hiç eşleşmiyor (aşağıda çözüm var).

## Mevcut durum (bulgular)

- Backend'de **doğru şekilde tasarlanmış ama hiç tüketilmeyen** bir model hazır: `sterile_sets` + `set_instruments(expected_count, current_count)` + `set_tracking_logs`, `sterileSet.service.js` (`listSets/getSet/createSet/updateSet/addTrackingLog`), `/api/sterile-sets/*` route'ları (`other.routes.js`), `authorize(0,1,8,9)` (Üst Yönetici, Ameliyathane Sorumlu Hemşiresi, Sterilizasyon Sorumlusu, Sterilizasyon Personeli). Frontend'de `sterileSetsAPI` ([api.js:182](../../../src/services/api.js)) tanımlı ama hiçbir yerden çağrılmıyor.
- `addTrackingLog`, `set_instruments.current_count`'u **hiç güncellemiyor** — sadece `set_tracking_logs`'a satır ekliyor ve `sterile_sets.status`'u değiştiriyor. Yani alet bazında sayım sonucunu kalıcı tutacak bir yazma yolu şu an hiç yok; bu plan ekliyor.
- `requireModule(slug)` middleware'i (`middleware/requireModule.js`) kurumun ilgili modülü satın alıp almadığını kontrol ediyor, `req.user.institutionId` bekliyor — kiosk'a özgü değil, normal authenticated route'larda doğrudan kullanılabilir (`device.routes.js`'teki `router.use(authenticate, requireModule('voice_control'))` örneği gibi).
- `ai.service.js`'teki `webSearch(query)` fonksiyonu, mevcut Anthropic `client`/`MODEL`'i yeni bir araçla (`web_search_20250305`) genişletme örüntüsünü gösteriyor — Vision için aynı örüntü (yeni bir araç yerine görsel içerik bloğu) izlenecek.

## Yaklaşımlar (tartışılan ve seçilen)

**Backend kapsamı için:**
1. **Sadece sayım adımını bağla (seçildi).** Yeni "AI ile say" aksiyonu + sayım onayı, mevcut `/sterile-sets` + `set_instruments` modeline bağlanır; SetTakip.jsx'in geri kalanı ve SterilSetler.jsx dokunulmadan kalır. En düşük riskli, Voice/Spotify'da izlenen "minimum dokunuş" ilkesiyle tutarlı.
2. SetTakip.jsx'i tamamen gerçek backend'e taşı — reddedildi, kapsamı gereksiz büyütüyor.
3. Üç veri yolunu da birleştir — reddedildi, Vision'ın kendi ihtiyacının çok ötesinde bir temizlik işi.

**Görüntü analizi için:**
1. **Claude görsel analizi (seçildi).** `ai.service.js`'teki mevcut istemciye görsel girdi eklenir. Yeni vendor yok, demo aşaması için zaten kabul edilmiş 3. parti API istisnasına dahil, placeholder görsellerle bugün çalışır.
2. Ayrı bir CV servisi/eğitilmiş model — reddedildi, yeni vendor kurulumu gerektirir ve gerçek foto/etiketli veri olmadan zaten eğitilemez.
3. Tamamen mock sürücü (içeriğe bakmadan configurable sonuç) — reddedildi; kullanıcı "görüntü olmadan devam edelim" derken entegrasyonun sahte değil gerçek olmasını istiyor (Spotify'da izlenen "mock bırakmayalım" tercihiyle tutarlı yorum) — placeholder GÖRSEL kullanılacak ama ANALİZ gerçek.

## Karar verilen tasarım

### Veri modeli — ekleme (`migrations/`'e yeni dosya)

```sql
-- modules tablosuna yeni satır
INSERT INTO modules (slug, name, description, price_try, price_usd)
VALUES ('vision_counting', 'Görsel Alet Sayımı', 'Yapay zeka ile cerrahi alet sayım doğrulaması', 400000, 12000)
ON CONFLICT (slug) DO NOTHING;

-- set_instruments: AI önerisini insan onayından ayrı tutmak için
ALTER TABLE set_instruments ADD COLUMN IF NOT EXISTS last_suggested_count SMALLINT;
```

`current_count` her zaman **insan onayladığı** sayıyı taşır; `last_suggested_count` sadece en son AI önerisini (denetim/karşılaştırma amaçlı) tutar — ikisi asla karıştırılmaz.

### Seed eşleştirme sorunu — çözüm

SetTakip.jsx'in gösterdiği setler ([mockData.js:159-172](../../../src/data/mockData.js)) sayısal `id` kullanıyor, gerçek `sterile_sets` tablosu UUID kullanıyor; ikisi hiç eşleşmiyor. SetTakip.jsx'in kart listesini/navigasyonunu değiştirmeden (onaylanan "minimum dokunuş" kapsamı) gerçek veriye bağlamak için:

- Seed migration, `STERIL_SETLER_V2`'deki setlerle **aynı isim ve alet listesiyle**, sabit (hardcoded) UUID'lerle gerçek `sterile_sets`/`set_instruments` satırları oluşturur.
- `mockData.js`'teki her `STERIL_SETLER_V2` öğesine bu sabit UUID'yi taşıyan bir `backendSetId` alanı eklenir.
- `SayimModal`, açıldığında `s.backendSetId` ile gerçek `GET /sterile-sets/:id`'i çeker (gerçek `set_instruments` listesi + id'leri) — kaydet/AI-say çağrıları bu gerçek id'lere gider. `backendSetId` yoksa (ileride eklenecek yeni mock setler) buton "Bu set için AI sayım henüz tanımlı değil" ile pasifleşir.

Bu, mock kabuk + gerçek yaprak (leaf) ilkesi: kart listesi/akış gösterimi mock kalır, sadece sayım adımının kendisi gerçek veriyle çalışır.

### Backend — yeni endpoint'ler (`other.routes.js`, `setRouter` içine)

```
POST /api/sterile-sets/:id/vision-count
  authorize(0,1,8,9), requireModule('vision_counting')
  body: { imageBase64: string, mediaType: 'image/jpeg'|'image/png' }
  → setInstruments listesini çeker, ai.service.js'teki yeni countInstruments() ile
    Claude'a gönderir, { instrumentId, detectedCount, note }[] döner.
  → set_instruments.last_suggested_count güncellenir (audit: AI_COUNT_SUGGESTION).
  → Kalıcı current_count DEĞİŞMEZ — sadece öneri.

POST /api/sterile-sets/:id/tracking  (mevcut endpoint, GENİŞLETİLİYOR)
  setTrackingSchema'ya opsiyonel counts: [{instrumentId, count}] eklenir.
  addTrackingLog, counts verildiğinde her set_instruments.current_count'u günceller,
  expected_count'tan düşük olan varsa mismatch=true ile tracking log'a not düşer
  (mevcut davranış korunur: aşama geçişi ENGELLENMEZ, sadece işaretlenir).
```

### Fotoğraf boyutu / transport (builder-check'te bulundu, karar verildi)

`app.js`'teki global `express.json({limit:'512kb'})` tüm route'lardan önce çalışıyor ve base64 bir tepsi fotoğrafı (ham halinin ~%33 şişmiş hali) bunu kolayca aşar — mevcut tek base64-body örneği (`voiceProfile.routes.js`'teki `audio` alanı) de bu limiti aşmıyor, yani kopyalanacak bir örüntü yok. Yeni vendor/dependency (multer) eklemeden çözüm:

- **İstemci tarafı sıkıştırma (zorunlu):** Fotoğraf gönderilmeden önce canvas'a çizilip yeniden boyutlandırılır (maks. genişlik ~1280px) ve JPEG quality ~0.7 ile sıkıştırılır — hedef ham boyut ~300-500KB. Bu sadece performans değil, Claude API maliyeti/gecikmesi için de doğru varsayılan.
- **Route'a özel limit:** `POST /:id/vision-count` için `app.js`'te, global `express.json()`'dan ÖNCE, bu path'e özel `express.json({limit:'4mb'})` mount edilir (Express body parser'ları `req._body` set edildiyse tekrar çalışmaz, bu yüzden sıralama önemli). 512kb küresel limit diğer tüm route'larda değişmeden kalır.

### Modül satın alma kontrolü — CTA ne zaman gösterilir (builder-check'te bulundu, karar verildi)

`CihazKontrol.jsx`'teki CTA örüntüsü, sayfanın veri yükleme çağrısının kendisi `requireModule('voice_control')` ile gated olmasına dayanıyor (403 yakalanır). `SayimModal`'ın açılışta çektiği `GET /sterile-sets/:id` gated DEĞİL (sadece `/vision-count` gated) — yani aynı mekanizma buraya taşınamaz. Bunun yerine: modal açıldığında zaten var olan `moduleAPI.mine()` (`GET /billing/modules/mine`) çağrılır; `vision_counting` aktif değilse "📷 Fotoğrafla Say" butonu yerine CTA gösterilir — kullanıcı fotoğraf çekmeden ÖNCE, Voice modülünün CTA'sıyla aynı ruhta ama farklı mekanizmayla.

### `ai.service.js` — yeni fonksiyon

`webSearch` ile aynı örüntü: mevcut `client`/`MODEL`, yeni araç yerine görsel içerik bloğu.

```js
async function countInstruments(imageBase64, mediaType, expectedInstruments) {
  // expectedInstruments: [{id, name, expectedCount}]
  // Claude'a: görsel + beklenen alet listesi + "her alet için gördüğün sayıyı
  // JSON döndür" talimatı. Yanıttan ```json bloğunu parse eder.
  // Parse hatası / belirsiz yanıt → boş öneri + "AI sayamadı, elle sayın" notu
  // (hata, sayımı engellemez — sadece öneri doldurulmaz).
}
```

### Frontend

- `api.js`'e `sterileSetsAPI.visionCount(id, {imageBase64, mediaType})` eklenir (zaten var olan `sterileSetsAPI`'nin bir fonksiyonu olarak — dosyadaki tanım kullanılır, "tanımlı ama çağrılmayan" durumu sona erer).
- `SayimModal` (`SetTakip.jsx`): açılışta gerçek `set_instruments`'ı çeker; "📷 Fotoğrafla Say" butonu eklenir (dosya yükleme + `getUserMedia` canlı kare yakalama, ikisi de desteklenir). Çekilen/yüklenen görsel `visionCount`'a gönderilir, dönen `detectedCount`'lar mevcut +/- sayaçlarını **doldurur** (kullanıcı hâlâ elle düzeltebilir). "Sayımı Onayla & Teslim Al" artık gerçek `counts` dizisiyle `tracking` endpoint'ini çağırır.
- Modül satın alınmamışsa (`403`), "📷 Fotoğrafla Say" butonu yerine mevcut Abonelik/Modüller sayfasına CTA gösterilir — Voice modülünde izlenen örüntü.

## Bilinen/kabul edilen sınırlamalar

- Claude'un görsel ayırt etme isabeti gerçek fotoğraflarla doğrulanmadı — yarın gerçek fotoğraflar gelince asıl doğrulama yapılacak, bu plan sadece boru hattını kurup placeholder görsellerle test ediyor.
- `last_suggested_count` ile `current_count` arasındaki fark (AI ne önerdi vs insan ne onayladı) denetim amaçlı tutuluyor ama bunun üzerine bir raporlama/analiz ekranı bu planın kapsamında değil.
- SterilSetler.jsx ve SetTakip.jsx'in diğer aşamaları mock kalmaya devam ettiği için, bu plandan sonra da uygulamada "gerçek veri" ve "mock veri" karışık görünecek — bilinçli bir kapsam sınırı, teknik borç olarak not edilmiştir.
- `sterile_sets` tablosunda `institution_id` kolonu yok (bu plandan önce de öyleydi, `listSets`/`getSet` hiçbir kurum filtresi yapmıyor) — yani seed edilecek sabit-UUID demo setler teorik olarak tüm kurumlara görünür/sayılabilir olacak. Bu, bu planın getirdiği yeni bir regresyon değil, var olan sistemin aynen devam eden bir özelliği; üç-paralel-veri-yolunu-birleştirmeme kararıyla aynı kapsam sınırının bir parçası olarak kabul edilmiştir.

## Builder'a bırakılanlar

- Claude'a gönderilecek tam prompt metni/JSON şeması detayları.
- `getUserMedia` kare yakalama UI'ının tam görsel tasarımı (SetTakip.jsx'in mevcut `qr-zone` bileşeninin görsel diliyle tutarlı olacak şekilde).
- Seed migration'daki sabit UUID değerlerinin üretimi.
- `vision_counting` fiyat alanları (`price_try`/`price_usd`) placeholder'dır, iş kararı gerektirmez.
