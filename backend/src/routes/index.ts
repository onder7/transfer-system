import { Router }        from 'express';
import { authRouter }     from './auth.route.js';
import { locationRouter } from './location.route.js';
import { transferRouter } from './transfer.route.js';
import { couponRouter }   from './coupon.route.js';
import { bookingRouter }  from './booking.route.js';
import { paymentRouter }  from './payment.route.js';
import { driverRouter }   from './driver.route.js';
import { adminRouter }    from './admin.route.js';

export const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use('/auth',      authRouter);
router.use('/locations', locationRouter);
router.use('/transfers', transferRouter);
router.use('/coupons',   couponRouter);
router.use('/bookings',  bookingRouter);
router.use('/payments',  paymentRouter);
router.use('/driver',    driverRouter);
router.use('/admin',     adminRouter);
