import { Router }                               from 'express';
import { authenticate, checkBlacklist, authorize } from '../middlewares/auth.middleware.js';
import { rateLimit }                            from '../middlewares/rate-limit.middleware.js';
import { auditLog }                             from '../middlewares/audit.middleware.js';
import {
  createBookingHandler,
  getBookingHandler,
  getBookingByRefHandler,
  cancelBookingHandler,
} from '../controllers/booking.controller.js';

export const bookingRouter = Router();

// Rezervasyon oluşturma — auth isteğe bağlı (guest checkout destekli)
bookingRouter.post(
  '/',
  rateLimit(10, 60),
  createBookingHandler,
);

// Referans ile sorgula — guest'ler için (e-posta onayında link)
bookingRouter.get('/ref/:ref', getBookingByRefHandler);

// ID ile sorgula — auth gerekli
bookingRouter.get(
  '/:id',
  authenticate, checkBlacklist,
  getBookingHandler,
);

// İptal — auth gerekli
bookingRouter.post(
  '/:id/cancel',
  authenticate, checkBlacklist,
  auditLog('BOOKING_CANCELLED', 'Booking'),
  cancelBookingHandler,
);
