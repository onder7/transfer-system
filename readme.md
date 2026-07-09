# Airport Transfer Management System (Dalaman Smile Transfer Clone)

Bu proje, profesyonel bir havalimanı transfer (shuttle/private) operasyonunu uçtan uca yönetmek için tasarlanmış, yüksek performanslı, ölçeklenebilir ve modern bir web uygulamasıdır. Kullanıcıların kolayca transfer araması yapmasını, araç seçmesini ve rezervasyon oluşturmasını sağlarken; gelişmiş yönetim paneliyle operatörlerin fiyat matrisini, araçları ve şoför atamalarını yönetmesini sağlar.

---

## 🛠 Teknoloji Yığını (Tech Stack)

### 🖥️ Frontend (Ön Yüz)
- **Framework:** React 19 (Vite ile yapılandırılmış hızlı build ortamı)
- **Stil Yönetimi:** **Tailwind CSS v4** (config CSS-first) + Shadcn UI (Radix tabanlı ortak primitive'ler)
- **Admin Panel:** [TailAdmin](https://github.com/TailAdmin/free-react-tailwind-admin-dashboard) — dashboard kabuğu (sidebar/header/layout) + **ApexCharts** grafikleri. Müşteri sitesiyle aynı Tailwind sistemi.
- **State Management:** Zustand (hem müşteri hem admin, ortak)
- **Veri Çekme:** TanStack Query v5 (React Query) & Axios (hem müşteri hem admin)
- **Form Yönetimi:** React Hook Form + **Zod** — Zod şemaları backend ile paylaşılan `packages/shared` üzerinden gelir (tek kaynak)
- **Çok Dilli Destek:** react-i18next (Türkçe / İngilizce)

> **Not:** Müşteri sitesi ve admin paneli **ayrı Vite uygulamaları** ama **tek tasarım sistemi** (Tailwind v4). Admin, TailAdmin kabuğunu kullanır; ortak form/tablo/dialog primitive'leri Shadcn'den gelir. İş mantığı (Zustand + RHF/Zod + TanStack) iki tarafta da aynıdır.

### ⚙️ Backend (Arka Yüz)
- **Çalışma Ortamı:** Node.js + Express.js (TypeScript ile tip güvenli)
- **Veri Tabanı & ORM:** PostgreSQL & Prisma ORM
- **Önbellek & Session:** Redis (Fiyat matrisi önbellekleme, rate-limiting ve refresh token yönetimi)
- **Kimlik Doğrulama:** JWT (JSON Web Token) — Rotate Refresh Token + HTTP-Only Cookies
- **API Dokümantasyonu:** Swagger / OpenAPI 3.0
- **Loglama:** Pino (yapılandırılmış JSON loglama)
- **Hata Takibi:** Sentry
- **Ödeme:** PayTR (iframe + server-to-server callback, 3D Secure)
- **Uçuş Takibi:** AeroDataBox / FlightAware API (uçuş no → tahmini iniş saati)
- **Çoklu Para Birimi:** Baz para birimi + günlük kur (TRY/EUR/GBP); ödeme anında kur snapshot'ı
- **Harita / Adres:** Adres autocomplete + geocoding + iki nokta arası mesafe (fiyat hesabı). Sağlayıcı-bağımsız (OSM/OSRM veya Google), admin panelinden seçilir.
- **Entegrasyon Yönetimi:** Tüm 3. parti API anahtarları (PayTR, uçuş, harita, SMS, WhatsApp, SMTP, kur) admin panelinden yönetilir; DB'de şifreli (AES-256-GCM) saklanır — `.env`'de sadece master key durur.

---

## 📐 Veri Tabanı Şeması

Proje mimarisi ilişkisel bir veri tabanı (PostgreSQL) üzerinde yükselir.

```
[User] (Admin, Customer, Driver, Operator)
│
├──► [Booking] (Rezervasyonlar) ◄─── [VehicleClass] (Sedan, Vito, Minivan)
│        │                                  │
│        ▼                                  ▼
[Location] (Havalimanı, Oteller) ◄────► [PriceMatrix] (Dinamik Fiyatlar)
│
├──► [Payment] (Ödeme durumu: PENDING, PAID, REFUNDED)
├──► [Coupon] (İndirim kuponları)
├──► [Notification] (SMS / E-posta bildirimleri)
└──► [DriverAssignment] (Şoför atamaları)
```

### Temel Modeller

| Model | Açıklama |
|---|---|
| `User` | Admin, Customer, Driver, Operator rolleriyle tek tablo |
| `Location` | Havalimanı, otel, bölge gibi transfer noktaları |
| `VehicleClass` | Sedan, VIP Vito, Minibüs — kapasite ve özellikler |
| `PriceMatrix` | Lokasyon → Lokasyon + VehicleClass bazlı fiyat |
| `Booking` | Rezervasyon: uçuş kodu, tarih, yolcu sayısı, statü (state machine), guest/kayıtlı |
| `Payment` | Ödeme: tutar, para birimi + **kur snapshot'ı**, yöntem, durum, iade kaydı, idempotency key |
| `Coupon` | İndirim kodu, yüzde/sabit indirim, kullanım limiti, geçerlilik tarihi |
| `DriverAssignment` | Booking → Driver + Vehicle ataması (çakışma/müsaitlik kontrollü) |
| `FlightInfo` | Uçuş no, tahmini/gerçek iniş saati, statü (SCHEDULED/DELAYED/LANDED) |
| `Notification` | SMS/Email/WhatsApp gönderim kuyruğu ve durumu |
| `AuditLog` | Admin/operatör işlemleri (KVKK + hesap verebilirlik) |
| `IntegrationSetting` | 3. parti servis konfigürasyonu + **şifreli API anahtarları** (admin yönetir, sağlayıcı seçilebilir) |

---

## 📁 Proje Klasör Yapısı

Monorepo (npm/pnpm workspaces) — müşteri sitesi ve admin ayrı uygulamalar, Zod şemaları ortak paketten paylaşılır.

```
transfer-system/
├── backend/
│   ├── src/
│   │   ├── config/          # Env, Redis, DB bağlantı ayarları
│   │   ├── controllers/     # Route handler'ları
│   │   ├── middlewares/     # Auth, rate-limit, error handler
│   │   ├── routes/          # Express router tanımları
│   │   ├── services/        # İş mantığı katmanı (ConfigService, ödeme, uçuş, harita...)
│   │   ├── validators/      # @transfer/shared Zod şemalarını kullanır
│   │   ├── jobs/            # Bildirim kuyruğu, kur/uçuş güncelleme cron'ları
│   │   └── utils/           # Yardımcı fonksiyonlar (AES-256-GCM crypto vb.)
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── Dockerfile
├── apps/
│   ├── web/                 # Müşteri sitesi — Vite + React 19 + Tailwind v4 + Shadcn
│   │   ├── src/
│   │   │   ├── components/  # Shadcn tabanlı ortak bileşenler
│   │   │   ├── pages/       # Arama, araç seçim, checkout, profil
│   │   │   ├── store/       # Zustand (auth vb.)
│   │   │   ├── hooks/  services/  locales/  utils/
│   │   └── Dockerfile       # Nginx build + serve
│   └── admin/               # Admin panel — Vite + React 19 + Tailwind v4 + TailAdmin
│       ├── src/
│       │   ├── layout/      # TailAdmin kabuğu (sidebar/header)
│       │   ├── pages/       # Dashboard, rezervasyon, fiyat matrisi, atama, entegrasyon ayarları
│       │   ├── components/  # ApexCharts widget'ları + Shadcn primitive'ler
│       │   ├── store/  services/  locales/  utils/
│       └── Dockerfile
├── packages/
│   └── shared/              # @transfer/shared — Zod şemaları + tipler (backend + web + admin ortak)
├── docker-compose.yml
└── docker-compose.prod.yml
```

---

## 🔌 Temel API Endpoint'leri

> Tam dokümantasyon için uygulama ayakta iken `http://localhost:5000/api-docs` adresini ziyaret edin (Swagger UI).

| Method | Endpoint | Açıklama |
|---|---|---|
| `POST` | `/api/auth/register` | Kullanıcı kaydı |
| `POST` | `/api/auth/login` | Giriş, cookie'ye token yazar |
| `POST` | `/api/auth/refresh` | Access token yenileme |
| `POST` | `/api/auth/logout` | Token iptali + cookie temizleme |
| `GET` | `/api/locations` | Tüm transfer noktaları |
| `GET` | `/api/transfers/search` | Fiyat + araç sınıfı sorgulama |
| `POST` | `/api/bookings` | Yeni rezervasyon oluşturma |
| `GET` | `/api/bookings/:id` | Rezervasyon detayı |
| `POST` | `/api/payments/checkout` | Ödeme başlatma |
| `POST` | `/api/coupons/validate` | Kupon doğrulama |
| `GET` | `/api/admin/bookings` | (Admin) Tüm rezervasyonlar |
| `PUT` | `/api/admin/bookings/:id/assign` | (Admin) Şoför atama |

---

## 🚀 Başlangıç ve Kurulum (Local Development)

### Gereksinimler
- **Node.js 22 LTS** (Vite 6/7 için minimum Node 20+ zorunlu)
- Docker ve Docker Desktop (PostgreSQL ve Redis için)

### 1. Depoyu Klonlayın ve Bağımlılıkları Kurun
```bash
git clone https://github.com/your-username/transfer-system.git
cd transfer-system

# Monorepo (npm/pnpm workspaces) — tek komutla tüm workspace bağımlılıkları
npm install
```

### 2. Çevresel Değişkenleri Ayarlayın

Örnek dosyaları kopyalayın ve değerleri kendi ortamınıza göre doldurun:

```bash
cp backend/.env.example backend/.env
cp apps/web/.env.example apps/web/.env
cp apps/admin/.env.example apps/admin/.env
```

**backend/.env.example:**
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/transfer_db?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET=""                   # Güçlü, rastgele bir değer girin
JWT_REFRESH_SECRET=""           # JWT_SECRET'tan farklı olmalı
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
PORT=5000
SENTRY_DSN=""
BASE_CURRENCY="TRY"

# --- Şifreleme master key ---
# Admin panelinden girilen tüm 3. parti API anahtarları bununla şifrelenir (AES-256-GCM).
# Bu tek anahtar .env'de kalır; PayTR/uçuş/harita/SMS/WhatsApp/SMTP/kur anahtarları
# uygulama çalışırken admin panelinden girilip DB'de şifreli saklanır.
SETTINGS_ENCRYPTION_KEY=""     # 32 byte, hex/base64 rastgele değer
```

> **Not:** Üçüncü parti servis anahtarları (PayTR merchant bilgileri, FLIGHT_API_KEY, harita sağlayıcı anahtarı, SMS/WhatsApp/SMTP kimlikleri, EXCHANGE_API_KEY) **artık `.env`'de tutulmaz**; admin panelindeki **Entegrasyon Ayarları** ekranından yönetilir ve `IntegrationSetting` tablosunda şifreli saklanır. İstenirse ilk kurulum için `.env`'e bootstrap değeri konabilir, ancak DB'deki değer önceliklidir.

**apps/web/.env.example** ve **apps/admin/.env.example:**
```env
VITE_API_URL="http://localhost:5000/api"
VITE_SENTRY_DSN=""
# Harita autocomplete sağlayıcısı (public anahtar; gizli anahtarlar admin/backend'de)
VITE_MAP_PROVIDER="osm"        # osm | google
```

### 3. Docker Konteynerlerini Başlatın
```bash
docker-compose up -d
```

### 4. Prisma Geçişlerini ve Seed İşlemini Yapın
```bash
cd backend
npx prisma migrate dev --name init
npx prisma db seed
```

### 5. Uygulamayı Başlatın

```bash
# Backend
npm run dev -w backend

# Müşteri sitesi (ayrı terminalde)
npm run dev -w apps/web

# Admin panel (ayrı terminalde)
npm run dev -w apps/admin
```

---

## 🐳 Docker Deployment (Production)

```bash
docker-compose -f docker-compose.prod.yml up --build -d
```

Bu komut; Node.js backend'i, Nginx üzerinde optimize edilmiş **iki React build'ini (müşteri sitesi + admin panel)**, PostgreSQL ve Redis'i izole ağlar üzerinde güvenli biçimde çalıştırır.

---

## 🔒 Güvenlik ve Performans

* **Rotate Refresh Token:** Her token yenilemede mevcut refresh token geçersiz kılınır, yenisi Redis'e yazılır. Token çalınma senaryolarına karşı koruma sağlar.
* **Token Blacklisting:** Logout sonrası access token süresi dolmadan önce Redis'te kara listeye alınır.
* **Dinamik Fiyat Önbellekleme:** Lokasyon–araç fiyat sorguları Redis'te TTL ile önbelleğe alınır, PostgreSQL yükü azaltılır.
* **Rate Limiting:** Arama ve auth endpoint'leri Redis tabanlı rate limiter ile korunur.
* **Güvenli Token Yönetimi:** JWT'ler `httpOnly`, `secure`, `sameSite=strict` cookie flag'leriyle saklanır.
* **SQL Injection Koruması:** Prisma ORM ile tüm sorgular parametrize edilir, tip güvenliği derleme aşamasında doğrulanır.
* **Ödeme Güvenliği (PayTR):** Ödeme onayı client'a değil, PayTR'nin server-to-server callback'ine güvenir. Hash doğrulaması yapılır; `Booking` yalnızca geçerli callback ile PAID'e geçer.
* **Idempotency:** Ödeme/rezervasyon oluşturma idempotency key ile korunur — çift tıklama çift çekim/çift booking yaratmaz.
* **KVKK / Veri Koruma:** Yolcu kişisel verileri için aydınlatma + açık rıza; admin işlemleri `AuditLog`'a yazılır; veri saklama/silme politikası uygulanır.
* **Şifreli Entegrasyon Anahtarları:** Admin panelinden girilen tüm 3. parti API anahtarları `SETTINGS_ENCRYPTION_KEY` ile AES-256-GCM şifrelenerek `IntegrationSetting`'te saklanır. Anahtar değerleri frontend'e asla düz dönülmez (write-only, maskeli gösterim).
* **Yapılandırılmış Loglama:** Pino ile JSON formatında loglar; production'da log aggregation sistemlerine (Datadog, ELK vb.) kolayca gönderilebilir.

---

## 🧪 Test Stratejisi

| Katman | Araç | Kapsam |
|---|---|---|
| Unit | Vitest | Service ve utility fonksiyonları |
| Integration | Supertest + Vitest | API endpoint'leri, DB işlemleri |
| E2E | Playwright | Kritik kullanıcı akışları (arama → ödeme) |
| Frontend | React Testing Library | Bileşen ve hook testleri |

```bash
# Backend testleri
cd backend && npm run test

# Frontend testleri
cd frontend && npm run test
```
