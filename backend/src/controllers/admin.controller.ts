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
} from '@transfer/shared';
import * as adminService from '../services/admin.service.js';

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

export async function listUsersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const users = await adminService.listUsers(req.query.role as string | undefined);
    res.json({ users });
  } catch (e) { next(e); }
}

export async function createUserHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = AdminCreateUserSchema.parse(req.body);
    res.status(201).json({ user: await adminService.createUser(input) });
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
