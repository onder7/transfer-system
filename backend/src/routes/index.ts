import { Router }        from 'express';
import { prisma }         from '../config/database.js';
import { redis }          from '../config/redis.js';
import { authRouter }     from './auth.route.js';
import { locationRouter } from './location.route.js';
import { transferRouter } from './transfer.route.js';
import { couponRouter }   from './coupon.route.js';
import { extraRouter }    from './extra.route.js';
import { bookingRouter }  from './booking.route.js';
import { paymentRouter }  from './payment.route.js';
import { driverRouter }   from './driver.route.js';
import { adminRouter }    from './admin.route.js';

export const router = Router();

router.get('/time', (_req, res) => {
  res.json({ iso: new Date().toISOString() });
});

// Public sistem ayarları — yalnızca frontend'in ihtiyaç duyduğu güvenli parametreler
router.get('/settings', async (_req, res) => {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: ['min_advance_minutes', 'timezone', 'hero_image_url'] } },
    select: { key: true, value: true },
  });
  res.json({ settings: rows });
});

router.get('/health', async (_req, res) => {
  const checks: Record<string, 'ok' | 'error'> = {};
  let degraded = false;

  // DB check
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = 'ok';
  } catch {
    checks.db = 'error';
    degraded = true;
  }

  // Redis check
  try {
    await redis.ping();
    checks.redis = 'ok';
  } catch {
    checks.redis = 'error';
    degraded = true;
  }

  const status = degraded ? 'degraded' : 'ok';
  res.status(degraded ? 503 : 200).json({ status, checks, timestamp: new Date().toISOString() });
});

router.use('/auth',      authRouter);
router.use('/locations', locationRouter);
router.use('/transfers', transferRouter);
router.use('/coupons',   couponRouter);
router.use('/extras',    extraRouter);
router.use('/bookings',  bookingRouter);
router.use('/payments',  paymentRouter);
router.use('/driver',    driverRouter);
router.use('/admin',     adminRouter);
