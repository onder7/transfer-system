import { Router }    from 'express';
import express        from 'express';
import { authenticate, checkBlacklist } from '../middlewares/auth.middleware.js';
import {
  checkoutHandler,
  callbackHandler,
  getPaymentHandler,
  iframeTokenHandler,
  bankInfoHandler,
  bankTransferHandler,
  cashPaymentHandler,
} from '../controllers/payment.controller.js';

export const paymentRouter = Router();

// Banka bilgileri — PUBLIC (PaymentPage'de gösterilir)
paymentRouter.get('/bank-info', bankInfoHandler);

// PayTR iframe token
paymentRouter.post('/checkout', checkoutHandler);
paymentRouter.post('/iframe/:bookingId', iframeTokenHandler);

// Havale/EFT — ödeme yöntemi seç, banka bilgisi dön
paymentRouter.post('/bank-transfer/:bookingId', bankTransferHandler);

// Araçta ödeme — ödeme yöntemi seç, rezervasyonu hemen onayla
paymentRouter.post('/cash/:bookingId', cashPaymentHandler);

// PayTR server-to-server callback — PUBLIC, auth YOK, ham form-encoded body
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
