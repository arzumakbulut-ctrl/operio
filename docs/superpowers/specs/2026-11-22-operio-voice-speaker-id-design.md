# Operio Voice — Gerçek Speaker-ID ve Sesli Onay Yeniden Tasarımı

**Durum:** Taslak — onay bekliyor

## Amaç ve Neden

Kiosk'taki sesli asistan (Operio Voice), cihaz komutlarını onaylarken konuşmacıyı "tanıyormuş gibi" davranıyor ama bu tamamen mock: `MockSpeakerVerifier` sesi hiç dinlemeden, admin panelindeki bir moda (`always_match`/`cycle`/vb.) göre sabit/rastgele bir kullanıcı ID'si döndürüyor. Bu iki şeyi etkiliyor:

1. Cihaz komutu onayı (koter/ligasure gibi elektrocerrahi cihazları) güvenlik açısından kağıt üzerinde var, pratikte yok — ses hiç karşılaştırılmıyor.
2. Konuşmacıyı isimle çağırma, role-özel hitap ("hocam") gibi kişiselleştirilmiş deneyimler mock üzerine inşa edilemez — gerçek biri tanınmadan "Mehmet hocam" denemez.

Bu proje mock'u gerçek bir ses-biyometri (speaker verification) altyapısıyla değiştiriyor ve bunun üzerine daha doğal, ameliyathane ortamına uygun bir sesli onay akışı kuruyor. Ayrıca sohbet/hafıza özelliğinin (ayrı bir proje) üzerine inşa edileceği gerçek kimlik temelini sağlıyor.

## Kapsam Dışı (Non-goals)

- Serbest sohbet / hafızalı, sıcak konuşma ("nasılsın", "tatilin nasıl geçti" vb.) — bu AYRI bir proje, sonraki bir brainstorming turunda ele alınacak. Bu proje sadece kimlik doğrulama + cihaz-komut onay akışını kapsıyor.
- Dashboard'daki Cmd+K "Operia" paneli (`AIPanel.jsx`/`useAIChat.js`) — dokunulmuyor.
- Yeni bir rol/yetki sistemi — mevcut `roles` tablosu ve `ALLOWED_ROLE_IDS`/`decideCommand`/`role_not_allowed` zaten çalışıyor, değişmiyor; sadece artık gerçek `roleId` ile besleniyor olacak.

## Anti-goals (teknik çalışsa da başarısızlık sayılır)

- Yanlış kişiyi tanıyıp (false-accept) yetkisi olmayan bir komutu çalıştırmak — eşik/kalibrasyon güvenlik tarafında hataya düşmeli: şüpheliyse reddet/tekrar sor, asla "muhtemelen doğrudur" diye geçme.
- Ameliyat sırasında ekstra sürtünme/dikkat dağıtma eklemek (bu yüzden sayı-onayı tamamen kaldırıldı, ks. Approaches).
- Ses biyometri verisinin hastane dışına çıkması (KVKK'da özel kategori veri sayılır).

## Kısıtlar

- Türkçe konuşmada güvenilir çalışmalı — metinden bağımsız (text-independent) bir yöntem gerekiyor (sabit bir parola söyletmeden, serbest konuşmadan tanıma).
- Mevcut ses taşıma formatı (webm/opus, base64-over-JSON) korunuyor; yeni bir yakalama altyapısı kurulmuyor.
- Node/Express backend'e yeni bir dil/runtime (Python) eklemeyi gerektiriyor — bu, B yaklaşımının kabul edilen maliyeti.

## Yaklaşımlar (Approaches)

### 1) Kimlik doğrulama teknolojisi

- **A) Hazır bulut speaker-verification API'si** — az altyapı kurma ihtiyacı ama: biyometrik veri 3. bir şirkete gider (KVKK özel kategori veri, ayrı izin/sözleşme süreci gerekir), bu alanda kolay entegre edilen halka açık servis seçeneği son yıllarda azaldı, kullanım-başı maliyet.
- **B) Kendi barındırılan açık kaynak embedding modeli (seçildi)** — ses hastane dışına çıkmıyor, tekrarlayan vendor maliyeti yok. Bedeli: bir Python mikroservisi işletmek.

**Seçilen: B.**

### 2) Onay akışı

- **Sayı-onayı (eski tasarım, şu an kodda)** — "Operio deyip şu rakamları söyleyin: 4-7-2" (`kioskConfirmation.service.js`). Güvenli ama ameliyathanede dikkat dağıtıcı/yavaş.
- **Doğal dil + evet/hayır (seçildi)** — "Mehmet hocam, koteri 20 yapmamı istiyorsunuz, doğru mu?" → "evet"/"hayır". Daha hızlı, daha az sürtünme. Güvenlik, "evet" yanıtının da arka planda (kullanıcıya görünmeden) aynı kişiden gelip gelmediğinin speaker-verify edilmesiyle korunuyor.

**Seçilen:** doğal dil + evet/hayır; sayı-onayı tamamen kaldırılıyor (kullanıcının açık kararı — ameliyat ortamında dikkat dağıtıcı ekstra adım istemiyor).

## Kararlaştırılan "Nasıl" (How)

1. **Model:** SpeechBrain / ECAPA-TDNN (veya benzeri, metinden bağımsız açık kaynak speaker-embedding modeli). Dilden bağımsız çalışır (ses tınısına bakar, kelimelere değil) — Türkçe dahil.
2. **Dağıtım:** Backend'in docker-compose'una yeni, küçük bir Python servisi eklenir; Node backend ona HTTP ile embedding çıkarma/karşılaştırma isteği atar. GPU gerekmez, küçük model CPU'da yeterli.
3. **Enrollment:** `Profil.jsx`'teki tek-kayıt akışı, doğruluk için **3 kısa kayıt** isteyecek şekilde genişletilir. `voice_profiles.embedding` artık SHA-256 hash değil, gerçek embedding vektörü tutar; `model_version` güncellenir.
4. **Gürültü/ses-odaklama:** İstemci tarafında `getUserMedia` ses kısıtlarına `noiseSuppression`/`echoCancellation` açılır; backend'de embedding çıkarmadan önce basit bir voice-activity-detection/enerji eşiği uygulanır (arka plan gürültüsü komut/konuşma sanılmasın).
5. **`kioskSpeakerAuth` güncellemesi:** `MockSpeakerVerifier.identify()` yerine gerçek karşılaştırma — ses parçası → embedding çıkar → ekip adaylarının (`candidateUserIds`) kayıtlı embedding'leriyle cosine-similarity kıyası → eşik üstü en yüksek skor eşleşme, değilse `null` (tanınamadı).
6. **Tanınamama mesajı:** Ekipte eşleşme yoksa (ya da eşik altı), kullanıcıya "Sizi tanıyamadım, bu komutu sadece kayıtlı ekip üyeleri verebilir." denir, işlem yapılmaz — yeni bir PIN/yedek onay yolu eklenmiyor.
7. **Doğal dil onay + evet/hayır:** `createPendingConfirmation`/sayı-phrase akışı kaldırılır; yerine parsed action'ı ve konuşmacının adını (unvan kuralına göre) içeren bir "say" metni üretilir. Bir sonraki "operio" sonrası transcript basit evet/hayır olarak yorumlanır; o utterance'ın konuşmacısı başlatan kişiyle AYNI olmalı (`resolvePendingConfirmation`'daki mevcut "farklı ekip üyesi reddedilir" kuralı korunur, sadece sayı yerine evet/hayır + kimlik kontrolü kullanılır).
8. **Hitap kuralı:** `roleId` doktor(6) veya misafir_hekim(10) ise "[Ad] hocam", değilse sadece "[Ad]". Ad, `full_name`'den bilinen unvan ön-ekleri (Dr./Uzm./Tek./Hem./Srl. vb.) temizlenip ilk kelime alınarak çıkarılır (örn. "Dr. Ahmet Yılmaz" → "Ahmet").
9. **Rol/yetki:** Değişiklik yok. **Düzeltme (plan yazımı sırasında bulundu):** yetki tek katman değil, iki katman — (a) `ALLOWED_ROLE_IDS=[0,1,2,3,4,5,6]` (üst_yönetici/sorumlu_hemşire/anestezi_sorumlusu/anestezi_teknisyeni/hemşire/aml_personeli/doktor) hesabın HERHANGİ bir cihaz komutu verip veremeyeceğini global olarak belirler — **misafir_hekim(10) bu listede yok, yani hiç cihaz komutu veremiyor** (bu projeden bağımsız, önceden var olan bir kural); (b) koter/ligasure/masa gibi yüksek-riskli gruplarda ayrıca, o an aktif olan AMELİYATA ÖZEL `team_role: 'cerrah'` ataması gerekiyor (`checkDeviceAuthorization`). Yani "Mehmet hocam koteri yükseltebilir" demek, Mehmet'in o ameliyatta cerrah olarak atanmış olması demek — sadece doktor olması yetmiyor. Hiçbiri değişmiyor, mevcut `ALLOWED_ROLE_IDS`/`decideCommand`/`checkDeviceAuthorization`/`role_not_allowed` aynen kullanılır, artık gerçek `roleId`+`teamRole` ile besleniyor olacak.
10. **"Anlayamadım" kopyası:** Mevcut "Anlayamadım, tekrar söyler misiniz?" korunur; art arda çözümsüz kalan durumlar için "Ne demek istediğinizi anlamadım, herhangi bir işlem yapmıyorum." eklenir.
11. **Ses yakalama (header sorunu):** `useVoiceDeviceControl.js` şu an sürekli dönen tek bir rolling MediaRecorder chunk'ı tutuyor (`latestAudioChunkRef`) — WebM/Opus'ta yalnızca İLK chunk geçerli header taşır, sonraki header'sız parçalar bağımsız decode edilemez. Speaker-ID için bu güvenilmez olurdu. Çözüm: her "operio" sonrası utterance için MediaRecorder **yeniden başlatılır** (start/stop), böylece her ses parçası kendi geçerli header'ına sahip olur ve Python servisi güvenilir şekilde decode edebilir.
12. **Onay süresi (TTL):** Sayaç, TTS cümlesi bitip kiosk dinlemeye geçtiğinde başlar (oluşturulduğu an değil); süre sayı-onayındaki 10 saniyeden **20 saniyeye** çıkarılır (tam cümle + doğal yanıt için zaman tanımak amacıyla).
13. **"Hayır" yanıtı:** Açık iptal olarak ele alınır — "Komut iptal edildi." diye seslendirilir ve bekleyen onay hemen temizlenir (sessizce TTL'e bırakılmaz). Üç durumlu sözleşme: evet → uygula, hayır → iptal + bildir, anlaşılmaz → sessizce beklemeye devam (TTL'e kadar) — eski "sadece doğru rakamla geç" davranışının ASR gürültüsüne tolerans mantığı korunur.
14. **Enrollment embedding birleştirme:** 3 kayıttan çıkan embedding'ler ortalanır (centroid); `voice_profiles.embedding` tek bir vektör olarak bu ortalamayı tutar — bu alanda yaygın/standart bir yaklaşım.

## Builder'a Bırakılanlar

- Cosine-similarity eşik değeri — kalibrasyon sırasında belirlenecek (false-accept/false-reject dengesi test verisiyle ayarlanır).
- VAD/enerji-eşiğinin tam parametreleri.
- Mevcut `mock-v1` enrollment kayıtlarının migration stratejisi (zorla yeniden-enrollment mı, yoksa geçişte "tanınamadı" muamelesi mi) — plan aşamasında netleştirilecek.
- Python mikroservisin tam API sözleşmesi (endpoint'ler, request/response şekli).
