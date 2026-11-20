# Operio Backend — REST API

Node.js · Express · PostgreSQL · JWT

## Hızlı Başlangıç

### 1. Gereksinimler
- Node.js ≥ 18
- PostgreSQL ≥ 14
- Docker (opsiyonel, önerilir)

### 2. Kurulum

```bash
# Bağımlılıkları yükle
npm install

# Ortam değişkenlerini kopyala ve düzenle
cp .env.example .env
```

`.env` dosyasında `DATABASE_URL` ve JWT secret'larını güncelle.

### 3a. Docker ile (önerilen)

```bash
# PostgreSQL + API'yi başlat
docker compose up -d

# Logları izle
docker compose logs -f api
```

İlk başlatmada migration ve seed otomatik çalışır.

### 3b. Yerel PostgreSQL ile

```bash
# Tabloları oluştur
psql $DATABASE_URL -f migrations/001_init.sql

# Demo verileri yükle
npm run db:seed

# Geliştirme sunucusunu başlat
npm run dev
```

Sunucu `http://localhost:4000` üzerinde çalışır.

---

## Proje Yapısı

```
operio-backend/
├── migrations/
│   └── 001_init.sql          # Tüm tabloları oluşturan SQL
├── prisma/
│   ├── schema.prisma         # Referans şema (dokümantasyon amaçlı)
│   └── seed.js               # Demo veri yükleyici
├── src/
│   ├── middleware/
│   │   ├── auth.js           # authenticate / authorize / optionalAuth
│   │   ├── validate.js       # Zod şema doğrulama middleware'i
│   │   └── errorHandler.js   # Global hata yakalayıcı
│   ├── routes/
│   │   ├── auth.routes.js    # /api/auth/*
│   │   ├── surgery.routes.js # /api/surgeries/*
│   │   └── other.routes.js   # /api/patients /api/rooms /api/sterile-sets /api/audit
│   ├── services/
│   │   ├── auth.service.js        # Giriş, kayıt, token yenileme, çıkış
│   │   ├── surgery.service.js     # Ameliyat CRUD + ekip yönetimi
│   │   ├── patient.service.js     # Hasta CRUD
│   │   ├── room.service.js        # Salon CRUD + durum değiştirme
│   │   └── sterileSet.service.js  # Set CRUD + takip log
│   ├── utils/
│   │   ├── db.js             # PostgreSQL bağlantı havuzu (pg)
│   │   ├── jwt.js            # Token üretme ve doğrulama
│   │   ├── audit.js          # Denetim kaydı yardımcısı
│   │   └── response.js       # Standart API yanıt formatı
│   ├── validators/
│   │   └── schemas.js        # Tüm Zod şemaları
│   ├── app.js                # Express uygulaması
│   └── server.js             # Giriş noktası
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

---

## API Referansı

### Yanıt Formatı

```json
// Başarılı
{ "success": true, "data": {...}, "meta": { "total": 100, "page": 1 } }

// Hata
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Ameliyat bulunamadı" } }
```

### Auth

| Method | Endpoint             | Açıklama              | Auth |
|--------|----------------------|-----------------------|------|
| POST   | /api/auth/login      | Giriş yap             | —    |
| POST   | /api/auth/register   | Kullanıcı oluştur     | —    |
| POST   | /api/auth/refresh    | Token yenile          | —    |
| POST   | /api/auth/logout     | Çıkış yap             | ✓    |
| GET    | /api/auth/me         | Mevcut kullanıcı      | ✓    |

**Login isteği:**
```json
{ "email": "admin@hastane.tr", "password": "Admin123!" }
```

**Login yanıtı:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": { "id": "...", "email": "...", "fullName": "...", "role_id": 0 }
  }
}
```

Sonraki isteklerde: `Authorization: Bearer <accessToken>`

### Ameliyatlar

| Method | Endpoint                        | Açıklama          | Roller       |
|--------|---------------------------------|-------------------|--------------|
| GET    | /api/surgeries                  | Liste (filtreli)  | Tümü         |
| GET    | /api/surgeries/:id              | Detay             | Tümü         |
| POST   | /api/surgeries                  | Oluştur           | 0, 1, 7      |
| PATCH  | /api/surgeries/:id              | Güncelle          | 0, 1, 2, 7   |
| DELETE | /api/surgeries/:id              | Sil               | 0            |
| POST   | /api/surgeries/:id/team         | Ekip ata          | 0, 1, 2      |
| DELETE | /api/surgeries/:id/team/:uid    | Ekipten çıkar     | 0, 1, 2      |

**Query parametreleri:** `?status=IN_PROGRESS&date=2025-05-15&page=1&limit=20`

**Status değerleri:** `WAITING | PREPARING | IN_PROGRESS | COMPLETED | CANCELLED | POSTPONED`

### Hastalar

| Method | Endpoint          | Açıklama | Roller    |
|--------|-------------------|----------|-----------|
| GET    | /api/patients     | Liste    | 0,1,6,7,10|
| GET    | /api/patients/:id | Detay    | 0,1,6,7,10|
| POST   | /api/patients     | Oluştur  | 0, 1, 7   |
| PATCH  | /api/patients/:id | Güncelle | 0, 1, 7   |

### Salonlar

| Method | Endpoint               | Açıklama        | Roller |
|--------|------------------------|-----------------|--------|
| GET    | /api/rooms             | Tüm salonlar    | Tümü   |
| GET    | /api/rooms/:id         | Salon detayı    | Tümü   |
| POST   | /api/rooms             | Salon ekle      | 0, 1   |
| PATCH  | /api/rooms/:id/status  | Durum değiştir  | 0,1,8  |
| DELETE | /api/rooms/:id         | Salon sil       | 0      |

**Status değerleri:** `ACTIVE | IDLE | RESERVED | MAINTENANCE | CLOSED`

### Steril Setler

| Method | Endpoint                       | Açıklama       | Roller  |
|--------|--------------------------------|----------------|---------|
| GET    | /api/sterile-sets              | Liste          | Tümü    |
| GET    | /api/sterile-sets/:id          | Detay + log    | Tümü    |
| POST   | /api/sterile-sets              | Set oluştur    | 0,1,8   |
| PATCH  | /api/sterile-sets/:id          | Güncelle       | 0,1,8,9 |
| POST   | /api/sterile-sets/:id/tracking | Aşama kaydet   | 0,1,8,9 |

**Takip aşamaları:** `teslim_alindi → yikama → sterilizasyon → steril → depo`

### Denetim Günlüğü

| Method | Endpoint   | Açıklama       | Roller |
|--------|------------|----------------|--------|
| GET    | /api/audit | Log listesi    | 0      |

**Query:** `?resource=surgery&action=UPDATE&page=1`

---

## Rol Sistemi

| ID | Ad                              |
|----|---------------------------------|
| 0  | Üst Yönetici                    |
| 1  | Ameliyathane Sorumlu Hemşiresi  |
| 2  | Anestezi Sorumlusu              |
| 3  | Anestezi Teknisyeni             |
| 4  | Hemşire & Ameliyathane Teknikeri|
| 5  | Ameliyathane Personeli          |
| 6  | Doktor                          |
| 7  | Sekreterlik                     |
| 8  | Sterilizasyon Sorumlusu         |
| 9  | Sterilizasyon Personeli         |
| 10 | Misafir Hekim                   |

---

## Güvenlik

- **JWT Access Token:** 15 dakika ömürlü
- **JWT Refresh Token:** 7 gün ömürlü, rotation ile her yenilemede değişir
- **Rate Limiting:** Auth endpoint'leri 15 dk / 10 istek, genel 15 dk / 100 istek
- **Helmet:** Güvenlik HTTP başlıkları
- **Zod Doğrulama:** Tüm request body'leri şema doğrulamasından geçer
- **Audit Log:** Her kritik işlem (CREATE/UPDATE/DELETE/LOGIN/LOGOUT) kayıt altına alınır
- **Rol Bazlı Erişim:** Her endpoint hangi rollerin erişebileceğini açıkça tanımlar

---

## Veritabanı Yönetimi

```bash
# Tabloları sıfırla ve yeniden oluştur
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
psql $DATABASE_URL -f migrations/001_init.sql
npm run db:seed

# pgAdmin arayüzü (Docker ile)
docker compose --profile tools up -d pgadmin
# http://localhost:5050  →  admin@operio.local / admin123
# Server: postgres:5432, DB: operio_db, User: operio
```

---

## Frontend Entegrasyonu

Frontend `src/services/api.js` dosyası token yönetimini otomatik yapar:

```js
import { authAPI, surgeriesAPI, patientsAPI, roomsAPI, sterileSetsAPI } from './services/api';

// Giriş
const { accessToken, user } = await authAPI.login({ email, password });

// Ameliyat listesi
const { data } = await surgeriesAPI.list({ date: '2025-05-15', status: 'IN_PROGRESS' });

// Salon durumu güncelle
await roomsAPI.updateStatus('room-uuid', 'MAINTENANCE');
```

Token süresi dolduğunda otomatik refresh yapılır. 401 hatası çözülemezse `/giris` sayfasına yönlendirilir.
