# Operio — Modüler React Mimarisi

## Kurulum

```bash
npm install
npm run dev      # geliştirme sunucusu (http://localhost:5173)
npm run build    # üretim build
```

## Proje Yapısı

```
src/
├── components/
│   ├── auth/
│   │   └── AuthScreen.jsx     # Giriş, rol seçimi, 2FA
│   ├── layout/
│   │   ├── AppLayout.jsx      # Ana sarmalayıcı (sidebar + topbar + içerik)
│   │   ├── Sidebar.jsx        # Navigasyon, tema, rol değiştirme
│   │   └── Topbar.jsx         # Başlık, bildirimler, profil
│   └── ui/
│       ├── Modal.jsx           # Yeniden kullanılabilir modal
│       └── Toast.jsx           # Bildirim toast
├── data/
│   ├── mockData.js            # Tüm demo veriler (ameliyat, salon, personel…)
│   └── roles.js               # 11 rol + navigasyon tanımları
├── pages/
│   ├── Dashboard.jsx          # Kontrol paneli + ameliyat listesi
│   ├── Personel.jsx           # Personel yönetimi
│   ├── Hastalar.jsx           # Hasta kayıtları
│   ├── Doktorlar.jsx          # Doktor yönetimi + onay akışı
│   ├── SterilSetler.jsx       # Cerrahi set takibi
│   ├── SalonYonetim.jsx       # Ameliyat salonu yönetimi
│   ├── Istatistik.jsx         # Analitik ve grafikler
│   └── Placeholder.jsx        # Henüz yazılmamış sayfalar için şablon
├── store/
│   └── index.js               # Zustand store (auth, ui, data, theme)
├── App.jsx                    # Router + route tanımları
├── main.jsx                   # Giriş noktası
└── index.css                  # Global stil değişkenleri

```

## Demo Girişleri

| E-posta | Şifre | Rol |
|---|---|---|
| admin@hastane.tr | 123456 | Üst Yönetici |
| doktor@hastane.tr | 123456 | Doktor |
| steril@hastane.tr | 123456 | Sterilizasyon Sorumlusu |
| hemsire@hastane.tr | 123456 | Ameliyathane Sorumlu Hemşiresi |
| anestezi@hastane.tr | 123456 | Anestezi Sorumlusu |
| teknisyen@hastane.tr | 123456 | Anestezi Teknisyeni |
| hemsire2@hastane.tr | 123456 | Hemşire & Ameliyathane Teknikeri |

2FA kodu: **123456**

## Gerçek Backend'e Geçiş

1. `src/data/mockData.js` → API çağrılarıyla değiştir
2. `src/store/index.js` → demo doğrulamayı gerçek JWT ile değiştir
3. `src/components/auth/AuthScreen.jsx` → POST /api/auth/login bağla

## Uygulanan Modüller

- ✅ Auth (giriş, rol seçimi, 2FA simülasyonu)
- ✅ Dashboard — ameliyat listesi, salon durumu, bildirimler
- ✅ Personel yönetimi (CRUD)
- ✅ Hasta kayıtları (CRUD)
- ✅ Doktor yönetimi + onay akışı
- ✅ Cerrahi set takibi (durum döngüsü)
- ✅ Salon yönetimi (durum değiştirme)
- ✅ İstatistik & grafikler
- ✅ Bildirim paneli
- ✅ Koyu/açık tema
- ✅ Rol bazlı navigasyon (11 rol)
- 🚧 Anestezi formu, Takvim, Raporlar, Set takip, vb. (Placeholder)
