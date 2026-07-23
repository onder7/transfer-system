import { z } from 'zod';

const schema = z.object({
  NODE_ENV:              z.enum(['development', 'production', 'test']).default('development'),
  PORT:                  z.coerce.number().default(5000),
  DATABASE_URL:          z.string().min(1),
  REDIS_URL:             z.string().default('redis://localhost:6379'),
  JWT_SECRET:            z.string().min(32),
  JWT_REFRESH_SECRET:    z.string().min(32),
  JWT_EXPIRES_IN:        z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN:           z.string().default('http://localhost:5173'),
  SETTINGS_ENCRYPTION_KEY: z.string().min(32), // hex 32 byte
  BASE_CURRENCY:         z.string().default('TRY'),
  SENTRY_DSN:            z.string().optional(),
  // Web Push (VAPID) — opsiyonel; tanımlı değilse push devre dışı
  VAPID_PUBLIC_KEY:      z.string().optional(),
  VAPID_PRIVATE_KEY:     z.string().optional(),
  VAPID_SUBJECT:         z.string().default('mailto:info@example.com'),
});

const result = schema.safeParse(process.env);

if (!result.success) {
  console.error('❌ Geçersiz ortam değişkenleri:');
  console.error(result.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = result.data;
