# Airport Transfer Management System (Dalaman Smile Transfer Clone)

Bu proje, profesyonel bir havalimanı transfer (shuttle/private) operasyonunu uçtan uca yönetmek için tasarlanmış, yüksek performanslı, ölçeklenebilir ve modern bir web uygulamasıdır. Kullanıcıların kolayca transfer araması yapmasını, araç seçmesini ve rezervasyon oluşturmasını sağlarken; gelişmiş yönetim paneliyle operatörlerin fiyat matrisini, araçları ve şoför atamalarını yönetmesini sağlar.

## 🛠 Teknoloji Yığını (Tech Stack)

### 🖥️ Frontend (Ön Yüz)
- **Framework:** React 18+ (Vite ile yapılandırılmış hızlı build ortamı)
- **State Management:** Zustand (Hafif ve efektif global state yönetimi)
- **Stil Yönetimi:** Tailwind CSS + Shadcn UI (Radix UI tabanlı modern bileşenler)
- **Veri Çekme:** TanStack Query v5 (React Query) & Axios
- **Form Yönetimi:** React Hook Form + Zod (Şema tabanlı strict validasyon)

### ⚙️ Backend (Arka Yüz)
- **Çalışma Ortamı:** Node.js + Express.js (TypeScript ile tip güvenli)
- **Veri Tabanı & ORM:** PostgreSQL & Prisma ORM
- **Önbellek & Session:** Redis (Fiyat matrisi önbellekleme ve rate-limiting için)
- **Kimlik Doğrulama:** JWT (JSON Web Token) & HTTP-Only Cookies Security

---

## 📐 Veri Tabanı Şeması Özet Görünümü

Proje mimarisi ilişkisel bir veri tabanı (PostgreSQL) üzerinde yükselir. Temel modeller şu şekildedir:


```

[User] (Admin, Customer, Driver)
│
├──► [Booking] (Rezervasyonlar) ◄─── [VehicleClass] (Sedan, Vito, Minivan)
│        │                                  │
│        ▼                                  ▼
[Location] (Havalimanı, Oteller) ◄────► [PriceMatrix] (Dinamik Fiyatlar)

```

---

## 🚀 Başlangıç ve Kurulum (Local Development)

### Gereksinimler
- Node.js (v18 veya üzeri)
- Docker ve Docker Desktop (PostgreSQL ve Redis için)

### 1. Depoyu Klonlayın ve Bağımlılıkları Kurun
```bash
# Projeyi indirin
git clone [https://github.com/your-username/transfer-system.git](https://github.com/your-username/transfer-system.git)
cd transfer-system

# Backend bağımlılıkları
cd backend
npm install

# Frontend bağımlılıkları
cd ../frontend
npm install

```

### 2. Çevresel Değişkenleri Ayarlayın (.env)

**backend/.env:**

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/transfer_db?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="super-secret-key-change-me-in-production"
PORT=5000

```

**frontend/.env:**

```env
VITE_API_URL="http://localhost:5000/api"

```

### 3. Docker Konteynerlerini Başlatın

Veri tabanı ve Redis'i yerelde ayağa kaldırmak için kök dizinde:

```bash
docker-compose up -d

```

### 4. Prisma Veri Tabanı Geçişlerini ve Seed İşlemini Yapın

```bash
cd backend
npx prisma migrate dev --name init
npx prisma db seed

```

### 5. Uygulamayı Başlatın

**Backend için:**

```bash
cd backend
npm run dev

```

**Frontend için:**

```bash
cd frontend
npm run dev

```

---

## 🐳 Docker Deployment (Production)

Canlıya alım sürecinde sistemin tamamını tek bir komutla ayağa kaldırmak için `docker-compose.prod.yml` konfigürasyonu hazırdır:

```bash
docker-compose -f docker-compose.prod.yml up --build -d

```

Bu komut; Node.js backend'i, optimize edilmiş React build'ini sunan Nginx sunucusunu, PostgreSQL ve Redis'i izole ağlar (networks) üzerinde güvenli bir şekilde çalıştırır.

---

## 🔒 Güvenlik ve Performans Optimizasyonları

* **Dinamik Fiyat Önbellekleme:** Havalimanı-Bölge transfer fiyat aramaları yoğun istek aldığında PostgreSQL yerine doğrudan **Redis** önbelleğinden beslenir.
* **Güvenli Token Yönetimi:** JWT'ler tarayıcı tarafında XSS saldırılarına karşı korunması amacıyla `httpOnly`, `secure` ve `sameSite` flag'lerine sahip cookie'lerde saklanır.
* **SQL Injection ve Tip Güvenliği:** Prisma ORM kullanılarak tüm sorgular parametrize edilir ve tip güvenliği derleme (compile) aşamasında doğrulanır.
