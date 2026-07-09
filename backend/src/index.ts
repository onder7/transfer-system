import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';

import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { prisma } from './config/database.js';
import { redis } from './config/redis.js';
import { router } from './routes/index.js';
import { errorMiddleware } from './middlewares/error.middleware.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(pinoHttp({ logger }));

app.use('/api', router);
app.use(errorMiddleware);

async function start() {
  await redis.connect();
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
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
});
