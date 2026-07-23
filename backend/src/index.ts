import 'dotenv/config';
import * as Sentry from '@sentry/node';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.js';

import { env } from './config/env.js';
import { UPLOAD_ROOT } from './config/upload.js';
import { logger } from './config/logger.js';
import { prisma } from './config/database.js';
import { redis } from './config/redis.js';
import { router } from './routes/index.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { startFlightTracker, stopFlightTracker }                     from './jobs/flight-tracker.job.js';
import { startBookingExpireJob, stopBookingExpireJob }               from './jobs/booking-expire.job.js';
import { startNotificationRetryJob, stopNotificationRetryJob }       from './jobs/notification-retry.job.js';

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn:         env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
  logger.info('Sentry başlatıldı');
}

const app = express();

app.use(helmet());
const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
// Yerel ağ (LAN) origin'leri: localhost, 127.x, ve RFC1918 özel IP'ler (192.168.x, 10.x, 172.16-31.x).
// Sistem sahada bir yerel ağda çalıştığı için (telefon/tablet vb. aynı ağdan erişir) bunlara izin verilir.
const LAN_ORIGIN = /^https?:\/\/(localhost|127\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;
app.use(cors({
  origin: (origin, cb) => {
    // origin yoksa (server-to-server, curl vb.), whitelist'teyse veya yerel ağdaysa izin ver
    if (!origin || allowedOrigins.includes(origin) || LAN_ORIGIN.test(origin)) return cb(null, true);
    // CORS reddi 500'e dönüşmesin — sessizce reddet (tarayıcı zaten engeller)
    logger.warn({ origin }, 'CORS: izin verilmeyen origin reddedildi');
    cb(null, false);
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(pinoHttp({ logger }));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: 'Transfer API Docs' }));

// Yüklenen görseller — 1 gün cache'li statik servis (nginx /api/ üzerinden erişilir)
app.use('/api/uploads', express.static(UPLOAD_ROOT, { maxAge: '1d', fallthrough: false }));

app.use('/api', router);
if (env.SENTRY_DSN) Sentry.setupExpressErrorHandler(app);
app.use(errorMiddleware);

async function start() {
  await redis.connect();
  startFlightTracker();
  startBookingExpireJob();
  startNotificationRetryJob();
  app.listen(env.PORT, () => {
    logger.info(`🚀 Sunucu çalışıyor → http://localhost:${env.PORT}`);
    logger.info(`📚 API Docs      → http://localhost:${env.PORT}/api-docs`);
  });
}

start().catch((err) => {
  logger.error({ err }, 'Başlatma hatası');
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM alındı, kapatılıyor...');
  stopFlightTracker();
  stopBookingExpireJob();
  stopNotificationRetryJob();
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
});
