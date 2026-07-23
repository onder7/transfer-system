import { Router }                               from 'express';
import { authenticate, checkBlacklist, authorize } from '../middlewares/auth.middleware.js';
import { auditLog }                             from '../middlewares/audit.middleware.js';
import {
  listAssignmentsHandler,
  getAssignmentDetailHandler,
  updateAssignmentStatusHandler,
  notifyApproachingHandler,
  updateLocationHandler,
  getFlightInfoHandler,
  assignDriverHandler,
} from '../controllers/driver.controller.js';

export const driverRouter = Router();

// Tüm driver route'ları kimlik doğrulama gerektirir
driverRouter.use(authenticate, checkBlacklist);

// ─── Şoför mobil arayüzü (DRIVER rolü) ───────────────────────────────────────

// GET /api/driver/assignments?date=2026-08-15
driverRouter.get(
  '/assignments',
  authorize('DRIVER'),
  listAssignmentsHandler,
);

// GET /api/driver/assignments/:id
driverRouter.get(
  '/assignments/:id',
  authorize('DRIVER'),
  getAssignmentDetailHandler,
);

// PATCH /api/driver/assignments/:id/status
driverRouter.patch(
  '/assignments/:id/status',
  authorize('DRIVER'),
  auditLog('ASSIGNMENT_STATUS_UPDATED', 'DriverAssignment'),
  updateAssignmentStatusHandler,
);

// POST /api/driver/assignments/:id/notify-approaching — "yaklaştım" bildirimi
driverRouter.post(
  '/assignments/:id/notify-approaching',
  authorize('DRIVER'),
  notifyApproachingHandler,
);

// PUT /api/driver/assignments/:id/location — canlı GPS konumu gönder
driverRouter.put(
  '/assignments/:id/location',
  authorize('DRIVER'),
  updateLocationHandler,
);

// GET /api/driver/flight/:bookingId — anlık uçuş bilgisi
driverRouter.get(
  '/flight/:bookingId',
  authorize('DRIVER', 'ADMIN', 'OPERATOR'),
  getFlightInfoHandler,
);

// ─── Admin: şoför atama (Faz 5'te admin router'a taşınacak) ──────────────────

// POST /api/driver/assign/:bookingId
driverRouter.post(
  '/assign/:bookingId',
  authorize('ADMIN', 'OPERATOR'),
  auditLog('DRIVER_ASSIGNED', 'Booking'),
  assignDriverHandler,
);
