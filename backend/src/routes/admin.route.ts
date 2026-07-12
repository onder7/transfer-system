import { Router }                          from 'express';
import { authenticate, checkBlacklist, authorize } from '../middlewares/auth.middleware.js';
import { auditLog }                          from '../middlewares/audit.middleware.js';
import { vehicleImageUpload, heroImageUpload } from '../config/upload.js';
import {
  listVehiclesHandler,
  availableVehiclesHandler,
  createVehicleHandler,
  updateVehicleHandler,
  deleteVehicleHandler,
} from '../controllers/vehicle.controller.js';
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
  uploadVehicleImageHandler,
  listPriceMatrixHandler,
  upsertPriceMatrixHandler,
  deletePriceMatrixHandler,
  listSurchargesHandler,
  createSurchargeHandler,
  updateSurchargeHandler,
  deleteSurchargeHandler,
  listGuestsHandler,
  listUsersHandler,
  createUserHandler,
  updateUserProfileHandler,
  updateUserRoleHandler,
  setUserActiveHandler,
  listCouponsHandler,
  createCouponHandler,
  toggleCouponHandler,
  listIntegrationsHandler,
  upsertIntegrationHandler,
  deleteIntegrationHandler,
  testSmtpHandler,
  listChildPriceRulesHandler,
  createChildPriceRuleHandler,
  updateChildPriceRuleHandler,
  deleteChildPriceRuleHandler,
  getSystemSettingsHandler,
  updateSystemSettingHandler,
  uploadHeroImageHandler,
  adminConfirmBookingHandler,
  cancelBookingAdminHandler,
  advanceBookingStatusHandler,
  editBookingHandler,
  deleteBookingAdminHandler,
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
adminRouter.post  ('/vehicle-classes/upload', authorize('ADMIN'), vehicleImageUpload.single('image'), uploadVehicleImageHandler);
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
adminRouter.get  ('/users/guests',         listGuestsHandler);
adminRouter.get  ('/users',                listUsersHandler);
adminRouter.post ('/users',                authorize('ADMIN'), createUserHandler);
adminRouter.patch('/users/:id/profile',    authorize('ADMIN'), updateUserProfileHandler);
adminRouter.patch('/users/:id/role',       authorize('ADMIN'), auditLog('USER_ROLE_UPDATED', 'User'), updateUserRoleHandler);
adminRouter.patch('/users/:id/active',     authorize('ADMIN'), setUserActiveHandler);

// ─── Coupons ─────────────────────────────────────────────────────────────────
adminRouter.get  ('/coupons',         listCouponsHandler);
adminRouter.post ('/coupons',         createCouponHandler);
adminRouter.patch('/coupons/:id/toggle', toggleCouponHandler);

// ─── Child Price Rules ────────────────────────────────────────────────────────
adminRouter.get   ('/child-price-rules',     listChildPriceRulesHandler);
adminRouter.post  ('/child-price-rules',     authorize('ADMIN'), createChildPriceRuleHandler);
adminRouter.patch ('/child-price-rules/:id', authorize('ADMIN'), updateChildPriceRuleHandler);
adminRouter.delete('/child-price-rules/:id', authorize('ADMIN'), deleteChildPriceRuleHandler);

// ─── Booking Confirm (nakit/havale) ──────────────────────────────────────────
adminRouter.post('/bookings/:id/confirm',
  auditLog('BOOKING_CONFIRMED_MANUAL', 'Booking'),
  adminConfirmBookingHandler,
);

// ─── Booking aksiyonları (iptal / ilerleme / düzenleme / silme) ───────────────
adminRouter.post  ('/bookings/:id/cancel',  auditLog('BOOKING_CANCELLED_ADMIN', 'Booking'), cancelBookingAdminHandler);
adminRouter.post  ('/bookings/:id/advance', auditLog('BOOKING_STATUS_ADVANCED',  'Booking'), advanceBookingStatusHandler);
adminRouter.patch ('/bookings/:id/edit',    editBookingHandler);
adminRouter.delete('/bookings/:id',         authorize('ADMIN'), auditLog('BOOKING_DELETED', 'Booking'), deleteBookingAdminHandler);

// ─── Sistem Ayarları ──────────────────────────────────────────────────────────
adminRouter.get  ('/system-settings',        authorize('ADMIN'), getSystemSettingsHandler);
adminRouter.post ('/settings/hero-image',    authorize('ADMIN'), heroImageUpload.single('image'), uploadHeroImageHandler);
adminRouter.patch('/system-settings/:key',   authorize('ADMIN'), updateSystemSettingHandler);

// ─── Vehicles ────────────────────────────────────────────────────────────────
adminRouter.get   ('/vehicles',              listVehiclesHandler);
adminRouter.get   ('/vehicles/available',    availableVehiclesHandler);
adminRouter.post  ('/vehicles',              authorize('ADMIN'), createVehicleHandler);
adminRouter.patch ('/vehicles/:id',          authorize('ADMIN'), updateVehicleHandler);
adminRouter.delete('/vehicles/:id',          authorize('ADMIN'), deleteVehicleHandler);

// ─── Integrations ─────────────────────────────────────────────────────────────
// SADECE ADMIN — OPERATOR entegrasyon ayarlarını değiştiremez
adminRouter.get   ('/integrations',          authorize('ADMIN'), listIntegrationsHandler);
adminRouter.put   ('/integrations',          authorize('ADMIN'), upsertIntegrationHandler);
adminRouter.delete('/integrations/:id',      authorize('ADMIN'), deleteIntegrationHandler);
adminRouter.post  ('/integrations/smtp/test', authorize('ADMIN'), testSmtpHandler);
