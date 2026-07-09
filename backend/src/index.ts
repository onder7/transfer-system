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
import { logger } from './config/logger.js';
import { prisma } from './config/database.js';
import { redis } from './config/redis.js';
import { router } from './routes/index.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { startFlightTracker, stopFlightTracker } from './jobs/flight-tracker.job.js';

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
app.use(cors({
  origin: (origin, cb) => {
    // origin yoksa (server-to-server, curl vb.) veya whitelist'teyse izin ver
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: ${origin} izin verilmedi`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(pinoHttp({ logger }));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: 'Transfer API Docs' }));
app.use('/api', router);
if (env.SENTRY_DSN) Sentry.setupExpressErrorHandler(app);
app.use(errorMiddleware);

async function start() {
  await redis.connect();
  startFlightTracker();
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
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
});
