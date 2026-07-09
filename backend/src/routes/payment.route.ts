import { Router }                                        from 'express';
import express                                          from 'express';
import { authenticate, checkBlacklist }                 from '../middlewares/auth.middleware.js';
import { checkoutHandler, callbackHandler, getPaymentHandler } from '../controllers/payment.controller.js';

export const paymentRouter = Router();

// Checkout — auth isteğe bağlı (guest da ödeme yapabilir)
paymentRouter.post('/checkout', checkoutHandler);

// PayTR server-to-server callback — PUBLIC, auth YOK, ham form-encoded body
// express.urlencoded burada route bazlı eklenir (main app'te json parser var)
paymentRouter.post(
  '/callback',
  express.urlencoded({ extended: false }),
  callbackHandler,
);

// Ödeme durumu sorgulama
paymentRouter.get(
  '/:bookingId',
  authenticate, checkBlacklist,
  getPaymentHandler,
);
