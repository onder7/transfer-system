import { Router }               from 'express';
import { rateLimit }            from '../middlewares/rate-limit.middleware.js';
import { validateCouponHandler } from '../controllers/coupon.controller.js';

export const couponRouter = Router();

couponRouter.post('/validate', rateLimit(20, 60), validateCouponHandler);
