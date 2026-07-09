import { Router } from 'express';

export const router = Router();

// Health check
router.get('/health', async (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Buraya route'lar eklenecek:
// router.use('/auth',      authRouter);
// router.use('/locations', locationRouter);
// router.use('/transfers', transferRouter);
// router.use('/bookings',  bookingRouter);
// router.use('/payments',  paymentRouter);
// router.use('/coupons',   couponRouter);
// router.use('/admin',     adminRouter);
