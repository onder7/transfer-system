import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

redis.on('connect', () => logger.info('Redis bağlantısı kuruldu'));
redis.on('error',   (err) => logger.error({ err }, 'Redis hatası'));
