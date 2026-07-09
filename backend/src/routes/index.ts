import { Router }        from 'express';
import { authRouter }     from './auth.route.js';
import { locationRouter } from './location.route.js';
import { transferRouter } from './transfer.route.js';

export const router = Router();

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use('/auth',      authRouter);
router.use('/locations', locationRouter);
router.use('/transfers', transferRouter);

// Yakında eklenecekler:
// router.use('/bookings', bookingRouter);
// router.use('/payments', paymentRouter);
// router.use('/coupons',  couponRouter);
// router.use('/admin',    adminRouter);
