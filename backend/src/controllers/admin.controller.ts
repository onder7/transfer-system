import type { Request, Response, NextFunction } from 'express';
import {
  AdminUpdateBookingSchema,
  AdminCreateLocationSchema,
  AdminUpdateLocationSchema,
  AdminCreateVehicleClassSchema,
  AdminUpdatePriceMatrixSchema,
  AdminCreateSurchargeSchema,
  AdminCreateUserSchema,
  AdminUpdateRoleSchema,
  AdminSetActiveSchema,
  AdminCreateCouponSchema,
  AdminUpsertIntegrationSchema,
  AdminCreateChildPriceRuleSchema,
  AdminUpdateUserProfileSchema,
} from '@transfer/shared';
import * as adminService        from '../services/admin.service.js';
import { sendTestEmail }        from '../services/notification.service.js';
import { AppError }             from '../middlewares/error.middleware.js';

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function dashboardHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json(await adminService.getDashboard()); } catch (e) { next(e); }
}

// ─── Bookings ────────────────────────────────────────────────────────────────

export async function listBookingsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.listBookings({
      status:   req.query.status   as string | undefined,
      date:     req.query.date     as string | undefined,
      search:   req.query.search   as string | undefined,
      page:     req.query.page     ? Number(req.query.page)     : undefined,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
    });
    res.json(result);
  } catch (e) { next(e); }
}

export async function getBookingDetailHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json(await adminService.getBookingDetail(req.params.id as string)); } catch (e) { next(e); }
}

export async function updateBookingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input   = AdminUpdateBookingSchema.parse(req.body);
    const booking = await adminService.updateBookingStatus(req.params.id as string, input, req.user!.sub);
    res.json({ booking });
  } catch (e) { next(e); }
}

// ─── Locations ────────────────────────────────────────────────────────────────

export async function listLocationsHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json({ locations: await adminService.listLocations() }); } catch (e) { next(e); }
}

export async function createLocationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input    = AdminCreateLocationSchema.parse(req.body);
    const location = await adminService.createLocation(input);
    res.status(201).json({ location });
  } catch (e) { next(e); }
}

export async function updateLocationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input    = AdminUpdateLocationSchema.parse(req.body);
    const location = await adminService.updateLocation(req.params.id as string, input);
    res.json({ location });
  } catch (e) { next(e); }
}

export async function deleteLocationHandler(req: Request, res: Response, next: NextFunction) {
  try { await adminService.deleteLocation(req.params.id as string); res.json({ ok: true }); } catch (e) { next(e); }
}

// ─── Vehicle Classes ──────────────────────────────────────────────────────────

export async function listVehicleClassesHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json({ vehicleClasses: await adminService.listVehicleClasses() }); } catch (e) { next(e); }
}

export async function createVehicleClassHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = AdminCreateVehicleClassSchema.parse(req.body);
    res.status(201).json({ vehicleClass: await adminService.createVehicleClass(input) });
  } catch (e) { next(e); }
}

export async function updateVehicleClassHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = AdminCreateVehicleClassSchema.partial().parse(req.body);
    res.json({ vehicleClass: await adminService.updateVehicleClass(req.params.id as string, input) });
  } catch (e) { next(e); }
}

export async function deleteVehicleClassHandler(req: Request, res: Response, next: NextFunction) {
  try { await adminService.deleteVehicleClass(req.params.id as string); res.json({ ok: true }); } catch (e) { next(e); }
}

export async function uploadVehicleImageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) throw new AppError(400, 'Dosya bulunamadı (alan adı: image)');
    // Tam URL üret — imageUrl şeması .url() beklediği için mutlak adres döneriz.
    const host = req.get('host');
    const proto = (req.get('x-forwarded-proto') ?? req.protocol);
    const url = `${proto}://${host}/api/uploads/vehicles/${file.filename}`;
    res.status(201).json({ url });
  } catch (e) { next(e); }
}

export async function uploadHeroImageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) throw new AppError(400, 'Dosya bulunamadı (alan adı: image)');
    // Hero görseli sistem ayarı olarak GÖRELİ yol saklanır (host'tan bağımsız, taşınabilir).
    const url = `/api/uploads/hero/${file.filename}`;
    await adminService.updateSystemSetting('hero_image_url', url);
    res.status(201).json({ url });
  } catch (e) { next(e); }
}

// ─── Price Matrix ─────────────────────────────────────────────────────────────

export async function listPriceMatrixHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json({ priceMatrix: await adminService.listPriceMatrix() }); } catch (e) { next(e); }
}

export async function upsertPriceMatrixHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = AdminUpdatePriceMatrixSchema.parse(req.body);
    res.json({ priceMatrix: await adminService.upsertPriceMatrix(input) });
  } catch (e) { next(e); }
}

export async function deletePriceMatrixHandler(req: Request, res: Response, next: NextFunction) {
  try { await adminService.deletePriceMatrix(req.params.id as string); res.json({ ok: true }); } catch (e) { next(e); }
}

// ─── Surcharges ───────────────────────────────────────────────────────────────

export async function listSurchargesHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json({ surcharges: await adminService.listSurcharges() }); } catch (e) { next(e); }
}

export async function createSurchargeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = AdminCreateSurchargeSchema.parse(req.body);
    res.status(201).json({ surcharge: await adminService.createSurcharge(input) });
  } catch (e) { next(e); }
}

export async function updateSurchargeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = AdminCreateSurchargeSchema.partial().parse(req.body);
    res.json({ surcharge: await adminService.updateSurcharge(req.params.id as string, input) });
  } catch (e) { next(e); }
}

export async function deleteSurchargeHandler(req: Request, res: Response, next: NextFunction) {
  try { await adminService.deleteSurcharge(req.params.id as string); res.json({ ok: true }); } catch (e) { next(e); }
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function listGuestsHandler(_req: Request, res: Response, next: NextFunction) {
  try { res.json({ guests: await adminService.listGuests() }); } catch (e) { next(e); }
}

export async function listUsersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const roleParam = req.query.role as string | undefined;
    const roles = roleParam ? roleParam.split(',').map((r) => r.trim()).filter(Boolean) : undefined;
    const users = await adminService.listUsers(roles);
    res.json({ users });
  } catch (e) { next(e); }
}

export async function createUserHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = AdminCreateUserSchema.parse(req.body);
    res.status(201).json({ user: await adminService.createUser(input) });
  } catch (e) { next(e); }
}

export async function updateUserProfileHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = AdminUpdateUserProfileSchema.parse(req.body);
    const user  = await adminService.updateUserProfile(req.params.id as string, input);
    res.json({ user });
  } catch (e) { next(e); }
}

export async function updateUserRoleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { role } = AdminUpdateRoleSchema.parse(req.body);
    const user     = await adminService.updateUserRole(req.params.id as string, role, req.user!.sub);
    res.json({ user });
  } catch (e) { next(e); }
}

export async function setUserActiveHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { isActive } = AdminSetActiveSchema.parse(req.body);
    const user         = await adminService.setUserActive(req.params.id as string, isActive, req.user!.sub);
    res.json({ user });
  } catch (e) { next(e); }
}

// ─── Coupons ─────────────────────────────────────────────────────────────────

export async function listCouponsHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json({ coupons: await adminService.listCoupons() }); } catch (e) { next(e); }
}

export async function createCouponHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input  = AdminCreateCouponSchema.parse(req.body);
    const coupon = await adminService.createCoupon(input);
    res.status(201).json({ coupon });
  } catch (e) { next(e); }
}

export async function toggleCouponHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { isActive } = AdminSetActiveSchema.parse(req.body);
    const coupon       = await adminService.toggleCoupon(req.params.id as string, isActive);
    res.json({ coupon });
  } catch (e) { next(e); }
}

// ─── Integrations ────────────────────────────────────────────────────────────

export async function listIntegrationsHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json({ integrations: await adminService.listIntegrations() }); } catch (e) { next(e); }
}

export async function upsertIntegrationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input       = AdminUpsertIntegrationSchema.parse(req.body);
    const integration = await adminService.upsertIntegration(input);
    res.json({ integration });
  } catch (e) { next(e); }
}

export async function deleteIntegrationHandler(req: Request, res: Response, next: NextFunction) {
  try { await adminService.deleteIntegration(req.params.id as string); res.json({ ok: true }); } catch (e) { next(e); }
}

export async function testSmtpHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { to } = req.body as { to?: string };
    if (!to || typeof to !== 'string' || !to.includes('@')) {
      throw new AppError(400, 'Geçerli bir "to" e-posta adresi gerekli');
    }
    const result = await sendTestEmail(to);
    res.json(result);
  } catch (e) { next(e); }
}

// ─── Child Price Rules ────────────────────────────────────────────────────────

export async function listChildPriceRulesHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json({ rules: await adminService.listChildPriceRules() }); } catch (e) { next(e); }
}

export async function createChildPriceRuleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = AdminCreateChildPriceRuleSchema.parse(req.body);
    res.status(201).json({ rule: await adminService.createChildPriceRule(input) });
  } catch (e) { next(e); }
}

export async function updateChildPriceRuleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = AdminCreateChildPriceRuleSchema.partial().parse(req.body);
    res.json({ rule: await adminService.updateChildPriceRule(req.params.id as string, input) });
  } catch (e) { next(e); }
}

export async function deleteChildPriceRuleHandler(req: Request, res: Response, next: NextFunction) {
  try { await adminService.deleteChildPriceRule(req.params.id as string); res.json({ ok: true }); } catch (e) { next(e); }
}

// ─── Sistem Ayarları ──────────────────────────────────────────────────────────

export async function getSystemSettingsHandler(_req: Request, res: Response, next: NextFunction) {
  try { res.json({ settings: await adminService.getSystemSettings() }); } catch (e) { next(e); }
}

export async function updateSystemSettingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { key }   = req.params;
    const { value } = req.body as { value: string };
    if (value === undefined) throw new Error('value gerekli');
    res.json(await adminService.updateSystemSetting(key as string, String(value)));
  } catch (e) { next(e); }
}

// ─── Admin rezervasyon onay ───────────────────────────────────────────────────

export async function adminConfirmBookingHandler(req: Request, res: Response, next: NextFunction) {
  try { res.json(await adminService.adminConfirmBooking(req.params.id as string)); } catch (e) { next(e); }
}

// ─── Admin rezervasyon yönetimi ───────────────────────────────────────────────

export async function cancelBookingAdminHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.adminCancelBooking(req.params.id as string, req.user!.sub);
    res.json(result);
  } catch (e) { next(e); }
}

export async function advanceBookingStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.advanceBookingStatus(req.params.id as string, req.user!.sub);
    res.json(result);
  } catch (e) { next(e); }
}

export async function editBookingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.editBooking(req.params.id as string, req.body, req.user!.sub);
    res.json(result);
  } catch (e) { next(e); }
}

export async function deleteBookingAdminHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.deleteBooking(req.params.id as string);
    res.json(result);
  } catch (e) { next(e); }
}
