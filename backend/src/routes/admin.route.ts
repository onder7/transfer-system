import { Router }                          from 'express';
import { authenticate, checkBlacklist, authorize } from '../middlewares/auth.middleware.js';
import { auditLog }                          from '../middlewares/audit.middleware.js';
import {
  dashboardHandler,
  listBookingsHandler,
  getBookingDetailHandler,
  updateBookingHandler,
  listLocationsHandler,
  createLocationHandler,
  updateLocationHandler,
  deleteLocationHandler,
  listVehicleClassesHandler,
  createVehicleClassHandler,
  updateVehicleClassHandler,
  deleteVehicleClassHandler,
  listPriceMatrixHandler,
  upsertPriceMatrixHandler,
  deletePriceMatrixHandler,
  listSurchargesHandler,
  createSurchargeHandler,
  updateSurchargeHandler,
  deleteSurchargeHandler,
  listUsersHandler,
  createUserHandler,
  updateUserRoleHandler,
  setUserActiveHandler,
  listCouponsHandler,
  createCouponHandler,
  toggleCouponHandler,
  listIntegrationsHandler,
  upsertIntegrationHandler,
  deleteIntegrationHandler,
} from '../controllers/admin.controller.js';

export const adminRouter = Router();

// Tüm admin route'ları ADMIN veya OPERATOR gerektirir
adminRouter.use(authenticate, checkBlacklist, authorize('ADMIN', 'OPERATOR'));

// ─── Dashboard ────────────────────────────────────────────────────────────────
adminRouter.get('/dashboard', dashboardHandler);

// ─── Bookings ─────────────────────────────────────────────────────────────────
adminRouter.get ('/bookings',     listBookingsHandler);
adminRouter.get ('/bookings/:id', getBookingDetailHandler);
adminRouter.patch('/bookings/:id',
  auditLog('BOOKING_STATUS_UPDATED', 'Booking'),
  updateBookingHandler,
);

// ─── Locations ────────────────────────────────────────────────────────────────
adminRouter.get   ('/locations',     listLocationsHandler);
adminRouter.post  ('/locations',     authorize('ADMIN'), createLocationHandler);
adminRouter.patch ('/locations/:id', authorize('ADMIN'), updateLocationHandler);
adminRouter.delete('/locations/:id', authorize('ADMIN'), deleteLocationHandler);

// ─── Vehicle Classes ──────────────────────────────────────────────────────────
adminRouter.get   ('/vehicle-classes',     listVehicleClassesHandler);
adminRouter.post  ('/vehicle-classes',     authorize('ADMIN'), createVehicleClassHandler);
adminRouter.patch ('/vehicle-classes/:id', authorize('ADMIN'), updateVehicleClassHandler);
adminRouter.delete('/vehicle-classes/:id', authorize('ADMIN'), deleteVehicleClassHandler);

// ─── Price Matrix ─────────────────────────────────────────────────────────────
adminRouter.get   ('/price-matrix',     listPriceMatrixHandler);
adminRouter.put   ('/price-matrix',     authorize('ADMIN'), upsertPriceMatrixHandler);
adminRouter.delete('/price-matrix/:id', authorize('ADMIN'), deletePriceMatrixHandler);

// ─── Surcharges ───────────────────────────────────────────────────────────────
adminRouter.get   ('/surcharges',     listSurchargesHandler);
adminRouter.post  ('/surcharges',     authorize('ADMIN'), createSurchargeHandler);
adminRouter.patch ('/surcharges/:id', authorize('ADMIN'), updateSurchargeHandler);
adminRouter.delete('/surcharges/:id', authorize('ADMIN'), deleteSurchargeHandler);

// ─── Users ────────────────────────────────────────────────────────────────────
adminRouter.get  ('/users',                listUsersHandler);
adminRouter.post ('/users',                authorize('ADMIN'), createUserHandler);
adminRouter.patch('/users/:id/role',       authorize('ADMIN'), auditLog('USER_ROLE_UPDATED', 'User'), updateUserRoleHandler);
adminRouter.patch('/users/:id/active',     authorize('ADMIN'), setUserActiveHandler);

// ─── Coupons ─────────────────────────────────────────────────────────────────
adminRouter.get  ('/coupons',         listCouponsHandler);
adminRouter.post ('/coupons',         createCouponHandler);
adminRouter.patch('/coupons/:id/toggle', toggleCouponHandler);

// ─── Integrations ─────────────────────────────────────────────────────────────
// SADECE ADMIN — OPERATOR entegrasyon ayarlarını değiştiremez
adminRouter.get   ('/integrations',     authorize('ADMIN'), listIntegrationsHandler);
adminRouter.put   ('/integrations',     authorize('ADMIN'), upsertIntegrationHandler);
adminRouter.delete('/integrations/:id', authorize('ADMIN'), deleteIntegrationHandler);
