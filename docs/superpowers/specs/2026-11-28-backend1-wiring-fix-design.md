# Backend #1 Kablolama Düzeltmesi (A+B) — Design

## Niyet / Neden

Frontend, uzun süredir çalışmayan/veri dizini silinmiş ikinci bir backend'in (native, Prisma tabanlı, "backend #2") beklediği yol isimlerine ve alan şekillerine göre yazılmış. Gerçek, çalışan, multi-tenant backend ("backend #1", Docker'lı) farklı yol isimleri ve alan şekilleri kullanıyor. Sonuç: ameliyat/hasta/salon/steril-set verisi ekranda görünmüyor veya yanlış görünüyor, "salon ekle" gibi butonlar sabit bir "backend yok" mesajı gösteriyor — oysa backend'de bu özellikler zaten var ve çalışıyor.

Bu plan SADECE kablolamayı düzeltir: backend #1'de zaten var olan 5 kaynağı (ameliyatlar, hastalar, salonlar, steril setler, bildirimler) doğru yol/metod/alan isimleriyle çağırmak, artı ameliyat ekip ataması ve aktivite logları için gerçek uç noktalara geçiş. Backend #1'in kendisine (rota, şema, migration) HİÇ dokunulmaz — zaten doğru ve test edilmiş.

## Goals

- Ameliyatlar, hastalar, salonlar, steril setler, bildirimler gerçek backend #1 uç noktalarından okunur/yazılır.
- Salon ekleme gerçekten çalışır (zaten var olan `POST /api/rooms`'a bağlanır, sabit toast kaldırılır).
- Ameliyat ekip ataması gerçek `POST/DELETE /api/surgeries/:id/team` uç noktalarını kullanır (tek bir `ekip` JSON alanı yerine).
- Aktivite logları gerçek `GET /api/audit`'e bağlanır.
- Her kaynak için TEK bir paylaşılan adapter modülü (`src/services/<kaynak>.adapter.js` gibi) olur — şu anki gibi 5-8 farklı sayfanın kendi bağımsız `fetch` + alan-eşleme kodunu tekrar tekrar yazması YERİNE, her sayfa aynı paylaşılan adapter'ı çağırır. Bu hem DRY hem de ileride backend değişirse tek yerden düzeltme sağlar.

## Non-goals

- Kategori C'deki 21 özellik (personel, kurumlar, finans, eğitim, vb.) — bu planın kapsamı dışında, ayrı bir sonraki aşama.
- Backend #1'in rota/şema/migration dosyalarına DOKUNULMAZ.
- Cihaz bakım/arıza takibi (biyomedikal asset yönetimi) — `controllable_devices` tablosu bunun için tasarlanmamış, Kategori C'ye dahil.
- Backend #2'nin (native) kodu/verisi taşınmaz — sadece referans olarak kullanıldı, artık gerekmiyor.

## Anti-goals

- Mevcut Türkçe arayüz metinlerini/filtre seçeneklerini (örn. "Bekliyor"/"Devam Ediyor"/"Tamamlandı") DEĞİŞTİRMEMELİ — backend'in İngilizce enum'ları (WAITING/IN_PROGRESS/COMPLETED) sadece adapter katmanında çevrilir, kullanıcı hiçbir arayüz farkı görmemeli.
- Steril set silme: backend'de `DELETE /api/sterile-sets/:id` rotası YOK. Var olmayan bir uç noktayı çağırıp sessizce başarısız olmamalı — silme butonu bu kaynak için devre dışı bırakılır (Kategori C'ye not düşülür).

## Ele Alınan Yaklaşım

Tek mantıklı yol: backend #1 zaten doğru ve test edilmiş olduğu için, DEĞİŞİKLİK SADECE frontend'de. Alternatif ("backend #1'i frontend'in beklediği Türkçe yollara göre yeniden adlandır") reddedildi — bu, zaten merge edilmiş, test edilmiş, çalışan backend kodunu riske atar ve hiçbir fayda sağlamaz.

Dağınık, her sayfanın kendi `fetch` kodunu yazdığı mevcut desen yerine: her kaynak için bir paylaşılan adapter modülü — tek yerde yol/metod/alan-eşleme, her tüketen sayfa oradan çağırır. `App.jsx`'teki merkezi `useApiLoader` da aynı adapter'ları kullanacak şekilde yeniden yazılır.

## Kapsam (denetimden çıkan tam liste)

**Kaynak 1 — Ameliyatlar** (`/api/surgeries`): App.jsx(useApiLoader), Sidebar.jsx, OnayBekleyenler.jsx, EkipPlani.jsx, Ameliyatlar.jsx, AmeliyatDrawer.jsx, Istatistik.jsx, SalonYonetim.jsx(referans), DolulukTakvimi.jsx, AmeliyatTalebi.jsx, AmeliyatDetay.jsx (status PATCH + ekip ataması ayrı uç noktalara)

**Kaynak 2 — Hastalar** (`/api/patients`): App.jsx(useApiLoader), YeniHasta.jsx, HastaDrawer.jsx, Ameliyatlar.jsx(referans)

**Kaynak 3 — Salonlar** (`/api/rooms`): SalonYonetim.jsx (durum güncelleme PATCH'e, "salon ekle" gerçek POST'a bağlanır)

**Kaynak 4 — Steril Setler** (`/api/sterile-sets`): App.jsx(useApiLoader), SterilSetler.jsx (tam yeniden yazım: yol, metod, alan isimleri, durum enum çevirisi, silme butonu kaldırılır)

**Kaynak 5 — Bildirimler** (`/api/notifications`): BildirimDuyuru.jsx (küçük düzeltme)

**Kaynak 6 — Aktivite Logları** (`/api/audit`): Kurum.jsx, AktiviteLoglari.jsx

**Küçük tekil düzeltmeler:** Profil.jsx (şifre değiştirme yolu → `/api/security/password/change`)

## Builder'a Bırakılan

- Adapter modüllerinin tam dosya adları/konumu (öneri: `src/services/<kaynak>.adapter.js` veya mevcut `src/services/api.js`'e eklenecek fonksiyonlar — plan yazarken karar verilecek).
- Her alan-eşlemesinin tam kodu (yukarıda not edilen alan karşılıkları plan dosyasında birebir verilecek).
- Durum enum çeviri tablolarının (İngilizce↔Türkçe) tam eşlemesi.
