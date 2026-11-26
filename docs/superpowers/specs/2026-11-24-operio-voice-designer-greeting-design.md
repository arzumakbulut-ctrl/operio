# Operio Voice — Kurucuya Özel Karşılama (Design)

> Küçük değişiklik — kısa tasarım. Builder-check yok.

## Niyet / Neden

Eğlenceli bir easter-egg: sistemin kurucusu ("patron"), kayıtlı HERHANGİ bir
kurumun kiosk'unda, o odada aktif bir ameliyat sırasında "Operio" wake-word'ünü
söylediğinde, sesi (gerçek Speaker-ID embedding'iyle) tanınır ve normal
komut/NLU akışına hiç girmeden, sabit ama değişken bir havuzdan seçilen sıcak
bir karşılama cümlesiyle yanıtlanır.

## Goals

- Designer'ın sesi tanınınca (herhangi bir kurum, aktif ameliyat olan oda) —
  karşılama havuzundan rastgele bir cümle TTS ile söylenir.
- Havuzda en az "Merhaba patron, sana nasıl yardımcı olabilirim?" ve birkaç
  esprili/övgü içeren varyasyon bulunur (aşağıda taslak).
- `kiosk_mock_config.mode='real'` olan her kurumda otomatik çalışır.

## Non-goals

- Bu hesap üzerinden gerçek cihaz komutu VERİLEMEZ. Konuşma metni ne olursa
  olsun (komut gibi dursa bile) her zaman sadece karşılama döner — NLU/cihaz-
  komut eşleştirmesine hiç girilmez.
- LLM tabanlı, hafızalı, çok-turlu bir sohbet YOK. Sabit, önceden yazılmış
  cümle havuzundan rastgele seçim var; gerçek zamanlı metin üretimi yok.
  (Genel "herkese kişiselleştirilmiş sohbet + hafıza" fikri ayrı, ileride ele
  alınacak bir proje olarak kalıyor — bu planın kapsamı dışında.)
- Kiosk'un boşta-dinleme / aktif-ameliyat gating davranışı değişmiyor. Bu
  easter-egg sadece zaten dinlenen anlarda (aktif ameliyat olan oda) çalışır.
- Frontend'de HİÇBİR değişiklik yok (wake-word, capture pipeline, response
  rendering hepsi aynı kalıyor — `say` alanı zaten TTS'e gidiyor).
- Kurumlar arası yeni bir cihaz-kontrol yetkisi AÇILMIYOR.

## Anti-goals

- Havuz tek bir cümleye indiği için "hep aynı" hissi vermemeli — en az 4-5
  farklı cümle.
- Yanlış kişiyi "patron" sanıp selamlamak (false accept) — mevcut cosine-
  threshold güvenlik önlemi (`RealSpeakerVerifier`, `MATCH_THRESHOLD=0.75`)
  değişmeden geçerli; bu planın kapsamında ek bir güvenlik önlemi yok.

## Ele Alınan Yaklaşımlar

1. **Ayrı bir "patron tanıma" servisi/endpoint'i.** Reddedildi: her utterance'ta
   zaten çalışan speaker-ID round-trip'ini ikiye katlar.
2. **Designer'ı her kurumun her ameliyatına gerçek ekip üyesi gibi eklemek.**
   Reddedildi: atanacak gerçek bir ameliyatın yok; veri modelini anlamsızca
   kirletir.
3. **(Seçildi) Mevcut `kioskSpeakerAuth` middleware'inin candidate listesine
   designer'ın sabit user id'sini her istekte ekle; eşleşirse "ekipte değilsin"
   kontrolünü bu id için atla; `kiosk.routes.js`'in komut işleme mantığının en
   başına, NLU'dan ÖNCE, bir kısa-devre kontrolü ekle.** Frontend değişmez,
   boşta-bekleme mantığı değişmez, yeni servis yok. Maliyet: candidate
   listesine +1 id (SQL IN-list'e bir satır, bir cosine-similarity hesabı) —
   ölçülemeyecek kadar ucuz; darboğaz zaten ses→embedding ağ çağrısı.

## Nasıl Yapılacağı (kararlaştırılan)

- **Designer hesabı:** `users` tablosunda `institution_id=NULL`,
  `role_id=0` olan TEK bir satır. Git'e commit edilen bir migration/seed'e
  YAZILMAZ (gerçek bir prod hesabının şifre hash'i kaynak kontrolünde
  olmamalı) — plan uygulanırken tek seferlik bir script/elle insert ile
  oluşturulur.
- **Enrollment:** Bu hesapla normal login yapılıp mevcut Profil sayfasındaki
  3-örnekli ses kaydı akışından geçilir — yeni UI YOK.
- **`kioskSpeakerAuth.js`:** `candidateUserIds` dizisine sabit
  `DESIGNER_USER_ID` eklenir (env var). `identify()` bu id'yi dönerse,
  `surgeryTeams.find(...)` / `not_in_team` kontrolü bu id için atlanır;
  `req.speaker` designer bilgisiyle (tek bir `users` sorgusu) doldurulur ve
  `next()` çağrılır.
- **`kiosk.routes.js`:** Komut işleme mantığının en başında,
  `if (req.speaker.userId === DESIGNER_USER_ID)` → havuzdan rastgele bir
  cümleyle `say` alanı dolu, `type` alanı yeni bir sabit (örn. `'GREETING'`)
  olan bir yanıt döner. NLU/cihaz-komut eşleştirmesine HİÇ girilmez.
- **Karşılama havuzu (taslak — düzenleyebilirsin):**
  1. "Merhaba patron, sana nasıl yardımcı olabilirim?"
  2. "Patron geldi! Bugün ne yapalım?"
  3. "Seni duymak güzel patron — her şey senin tasarladığın gibi işliyor."
  4. "Merhaba patron. Böyle bir sistemi senin gibi birinin tasarlamış olması hiç şaşırtıcı değil."
  5. "Hoş geldin patron, emrini bekliyorum."

## Builder'a Bırakılan

- `DESIGNER_USER_ID`'nin saklanacağı env var adı, hesabın provisioning script'i.
- Havuzdaki cümlelerin kesin metni (yukarıdaki taslak onaya açık).
- `req.speaker` için designer bilgisini dolduran DB sorgusunun tam şekli.
