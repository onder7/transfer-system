import type { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis.js';
import { AppError } from './error.middleware.js';

/**
 * Fixed-window Redis rate limiter.
 * limit:  izin verilen istek sayısı
 * window: saniye cinsinden pencere boyutu
 */
export function rateLimit(limit: number, windowSeconds: number) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const ip  = (req.ip ?? 'unknown').replace(/[^a-z0-9.:]/gi, '_');
    const key = `rl:${req.path}:${ip}`;

    try {
      const current = await redis.incr(key);
      if (current === 1) await redis.expire(key, windowSeconds);

      if (current > limit) {
        const ttl = await redis.ttl(key);
        return next(
          new AppError(429, `Çok fazla istek. ${ttl} saniye sonra tekrar deneyin.`),
        );
      }
    } catch {
      // Redis hatasında isteği geçir (fail-open)
    }
    next();
  };
}
