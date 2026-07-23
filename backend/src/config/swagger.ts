import swaggerJsdoc from 'swagger-jsdoc';

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title:   'Transfer API',
      version: '1.0.0',
      description: 'Sipahi VIP Transfer Yönetim Sistemi — REST API',
    },
    servers: [{ url: '/api', description: 'Local dev' }],
    components: {
      securitySchemes: {
        cookieAuth: { type: 'apiKey', in: 'cookie', name: 'accessToken' },
      },
    },
    security: [{ cookieAuth: [] }],
    tags: [
      { name: 'Auth',      description: 'Kimlik doğrulama' },
      { name: 'Locations', description: 'Transfer noktaları' },
      { name: 'Transfers', description: 'Araç arama ve fiyat' },
      { name: 'Bookings',  description: 'Rezervasyonlar' },
      { name: 'Payments',  description: 'Ödeme (PayTR callback)' },
      { name: 'Admin',     description: 'Admin paneli' },
      { name: 'Driver',    description: 'Şoför işlemleri' },
    ],
    paths: {
      '/health': {
        get: {
          tags: ['Auth'],
          summary: 'Sistem sağlık kontrolü',
          responses: {
            200: { description: 'Tüm servisler çalışıyor' },
            503: { description: 'Bir veya daha fazla servis çalışmıyor' },
          },
        },
      },
      '/auth/register': {
        post: {
          tags: ['Auth'], summary: 'Kayıt ol',
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object', required: ['email','password','firstName','lastName'],
            properties: {
              email:     { type: 'string', example: 'user@example.com' },
              password:  { type: 'string', minLength: 8, example: 'Passw0rd!' },
              firstName: { type: 'string', example: 'Ahmet' },
              lastName:  { type: 'string', example: 'Yılmaz' },
              phone:     { type: 'string', example: '05301234567' },
            },
          }}}},
          responses: { 201: { description: 'Kayıt başarılı' }, 409: { description: 'E-posta zaten kayıtlı' } },
        },
      },
      '/auth/login': {
        post: {
          tags: ['Auth'], summary: 'Giriş yap (cookie set eder)',
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object', required: ['email','password'],
            properties: {
              email:    { type: 'string', example: 'admin@transfer.local' },
              password: { type: 'string', example: 'admin123!' },
            },
          }}}},
          responses: { 200: { description: 'Giriş başarılı — accessToken cookie set edildi' }, 401: { description: 'Hatalı bilgi' } },
        },
      },
      '/auth/logout': {
        post: { tags: ['Auth'], summary: 'Çıkış yap', responses: { 200: { description: 'Cookie temizlendi' } } },
      },
      '/auth/refresh': {
        post: { tags: ['Auth'], summary: 'Token yenile', responses: { 200: { description: 'Yeni accessToken cookie' }, 401: { description: 'Refresh token geçersiz' } } },
      },
      '/locations': {
        get: {
          tags: ['Locations'], summary: 'Tüm aktif lokasyonlar',
          responses: { 200: { description: 'Lokasyon listesi' } },
        },
      },
      '/transfers/search': {
        get: {
          tags: ['Transfers'], summary: 'Güzergah ve fiyat ara',
          parameters: [
            { name: 'fromLocationId', in: 'query', required: true,  schema: { type: 'string' }, example: 'loc_dalaman_airport' },
            { name: 'toLocationId',   in: 'query', required: true,  schema: { type: 'string' }, example: 'loc_fethiye' },
            { name: 'transferDate',   in: 'query', required: true,  schema: { type: 'string', format: 'date-time' }, example: '2026-08-15T10:00:00.000Z' },
            { name: 'adultCount',     in: 'query', required: false, schema: { type: 'integer', default: 1 } },
            { name: 'childCount',     in: 'query', required: false, schema: { type: 'integer', default: 0 } },
            { name: 'returnFlight',   in: 'query', required: false, schema: { type: 'boolean', default: false } },
            { name: 'currency',       in: 'query', required: false, schema: { type: 'string', enum: ['TRY','EUR','GBP'], default: 'TRY' } },
          ],
          responses: { 200: { description: 'Uygun araçlar ve fiyatlar' }, 404: { description: 'Güzergah bulunamadı' } },
        },
      },
      '/bookings': {
        post: {
          tags: ['Bookings'], summary: 'Rezervasyon oluştur',
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            required: ['idempotencyKey','fromLocationId','toLocationId','vehicleClassId','transferDate','adultCount'],
            properties: {
              idempotencyKey:  { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
              fromLocationId:  { type: 'string', example: 'loc_dalaman_airport' },
              toLocationId:    { type: 'string', example: 'loc_fethiye' },
              vehicleClassId:  { type: 'string', example: 'vc_sedan' },
              transferDate:    { type: 'string', format: 'date-time', example: '2026-08-15T10:00:00.000Z' },
              adultCount:      { type: 'integer', default: 1, minimum: 1 },
              childCount:      { type: 'integer', default: 0, minimum: 0 },
              flightNumber:    { type: 'string', example: 'TK1234' },
              returnFlight:    { type: 'boolean', default: false },
              guestName:       { type: 'string', example: 'Ahmet Yılmaz' },
              guestEmail:      { type: 'string', example: 'ahmet@example.com' },
              guestPhone:      { type: 'string', example: '05301234567' },
              couponCode:      { type: 'string', example: 'HOSGELDIN10' },
              currency:        { type: 'string', enum: ['TRY','EUR','GBP'], default: 'TRY' },
              extraRequests:   { type: 'string', example: 'Bebek koltuğu' },
            },
          }}}},
          responses: { 201: { description: 'Rezervasyon oluşturuldu' }, 400: { description: 'Kapasite veya validasyon hatası' } },
        },
      },
      '/bookings/my': {
        get: { tags: ['Bookings'], summary: 'Oturum açmış kullanıcının rezervasyonları', responses: { 200: { description: 'Rezervasyon listesi' } } },
      },
      '/bookings/{id}': {
        get: {
          tags: ['Bookings'], summary: 'Rezervasyon detayı',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Rezervasyon' }, 404: { description: 'Bulunamadı' } },
        },
      },
      '/bookings/{id}/cancel': {
        post: {
          tags: ['Bookings'], summary: 'Rezervasyon iptal',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'İptal ve iade bilgisi' }, 400: { description: 'İptal edilemez durum' } },
        },
      },
      '/coupons/validate': {
        post: {
          tags: ['Bookings'], summary: 'Kupon doğrula',
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object', required: ['code','fromLocationId','toLocationId','vehicleClassId'],
            properties: {
              code: { type: 'string', example: 'HOSGELDIN10' },
              fromLocationId: { type: 'string' }, toLocationId: { type: 'string' }, vehicleClassId: { type: 'string' },
            },
          }}}},
          responses: { 200: { description: 'Kupon geçerli ve indirim tutarı' }, 400: { description: 'Geçersiz kupon' } },
        },
      },
      '/admin/dashboard': {
        get: { tags: ['Admin'], summary: 'Dashboard istatistikleri', responses: { 200: { description: 'Özet veriler' } } },
      },
      '/admin/bookings': {
        get: {
          tags: ['Admin'], summary: 'Tüm rezervasyonlar (admin)',
          parameters: [
            { name: 'status', in: 'query', schema: { type: 'string' } },
            { name: 'page',   in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit',  in: 'query', schema: { type: 'integer', default: 20 } },
          ],
          responses: { 200: { description: 'Rezervasyon listesi + sayfalama' } },
        },
      },
      '/admin/vehicle-classes': {
        get:  { tags: ['Admin'], summary: 'Araç sınıfları listesi', responses: { 200: { description: 'Liste' } } },
        post: {
          tags: ['Admin'], summary: 'Yeni araç sınıfı',
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object', required: ['name','capacity'],
            properties: {
              name:            { type: 'string', example: 'Luxury SUV' },
              nameEn:          { type: 'string', example: 'Luxury SUV' },
              capacity:        { type: 'integer', example: 6 },
              luggageCapacity: { type: 'integer', example: 4 },
              isShared:        { type: 'boolean', default: false },
              features:        { type: 'array', items: { type: 'string' }, example: ['wifi','water'] },
            },
          }}}},
          responses: { 201: { description: 'Oluşturuldu' } },
        },
      },
      '/admin/price-matrix': {
        get: { tags: ['Admin'], summary: 'Fiyat matrisi', responses: { 200: { description: 'Tüm güzergah fiyatları' } } },
      },
      '/admin/integrations': {
        get: { tags: ['Admin'], summary: 'Entegrasyonlar listesi (maskeli secretler)', responses: { 200: { description: 'Entegrasyon listesi' } } },
        put: {
          tags: ['Admin'], summary: 'Entegrasyon ayarları kaydet/güncelle',
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object', required: ['service','provider'],
            properties: {
              service:  { type: 'string', example: 'aeroDataBox', description: 'paytr | aeroDataBox | netgsm | whatsapp | smtp | exchangeRate | osm' },
              provider: { type: 'string', example: 'aeroDataBox' },
              isActive: { type: 'boolean', default: true },
              config:   { type: 'object', description: 'Şifresiz ayarlar (endpoint, timeout vb.)' },
              secrets:  { type: 'object', description: 'API anahtarları — AES-256-GCM şifreli saklanır. Boş bırakılırsa mevcut korunur.' },
            },
          }}}},
          responses: { 200: { description: 'Kaydedildi' } },
        },
      },

      // ─── Driver ────────────────────────────────────────────────────────────

      '/driver/assignments': {
        get: {
          tags: ['Driver'],
          summary: 'Şoförün günlük transfer listesi',
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: 'date', in: 'query', required: false,
              schema: { type: 'string', format: 'date', example: '2026-08-15' },
              description: 'Filtrelenecek tarih (YYYY-MM-DD). Boş bırakılırsa bugün.',
            },
          ],
          responses: {
            200: { description: 'Atama listesi' },
            401: { description: 'Kimlik doğrulaması gerekli' },
            403: { description: 'Yetersiz yetki (DRIVER rolü gerekli)' },
          },
        },
      },

      '/driver/assignments/{id}': {
        get: {
          tags: ['Driver'],
          summary: 'Transfer ataması detayı',
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'DriverAssignment ID' },
          ],
          responses: {
            200: { description: 'Atama detayı (yolcu, lokasyon, uçuş, araç bilgileri)' },
            403: { description: 'Bu atama size ait değil' },
            404: { description: 'Atama bulunamadı' },
          },
        },
      },

      '/driver/assignments/{id}/status': {
        patch: {
          tags: ['Driver'],
          summary: 'Transfer statüsü güncelle',
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'DriverAssignment ID' },
          ],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: {
              type: 'object',
              required: ['status'],
              properties: {
                status: {
                  type: 'string',
                  enum: ['EN_ROUTE', 'PASSENGER_PICKED_UP', 'COMPLETED', 'NO_SHOW'],
                  example: 'EN_ROUTE',
                  description: 'Yeni atama durumu',
                },
              },
            }}},
          },
          responses: {
            200: { description: 'Statü güncellendi' },
            400: { description: 'Geçersiz statü geçişi' },
            403: { description: 'Bu atama size ait değil' },
          },
        },
      },

      '/driver/flight/{bookingId}': {
        get: {
          tags: ['Driver'],
          summary: 'Rezervasyona ait anlık uçuş bilgisi',
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: 'bookingId', in: 'path', required: true, schema: { type: 'string' }, description: 'Booking ID' },
          ],
          responses: {
            200: { description: 'Uçuş takip verisi (kapı, terminal, gecikme durumu)' },
            404: { description: 'Uçuş bilgisi bulunamadı' },
          },
        },
      },

      '/driver/assign/{bookingId}': {
        post: {
          tags: ['Driver'],
          summary: 'Rezervasyona şoför ve araç ata (Admin / Operator)',
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: 'bookingId', in: 'path', required: true, schema: { type: 'string' }, description: 'Booking ID' },
          ],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: {
              type: 'object',
              required: ['driverId', 'vehicleId'],
              properties: {
                driverId:  { type: 'string', example: 'usr_abc123', description: 'Atanacak şoför kullanıcı ID' },
                vehicleId: { type: 'string', example: 'veh_xyz789', description: 'Atanacak araç ID' },
                notes:     { type: 'string', example: 'Terminal 2den alınacak', description: 'Şoför için ek not' },
              },
            }}},
          },
          responses: {
            201: { description: 'Atama oluşturuldu' },
            400: { description: 'Şoför veya araç müsait değil' },
            403: { description: 'Yetersiz yetki (ADMIN veya OPERATOR gerekli)' },
            404: { description: 'Rezervasyon bulunamadı' },
          },
        },
      },
    },
  },
  apis: [],
});
