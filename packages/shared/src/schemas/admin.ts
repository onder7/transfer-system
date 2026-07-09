import { z } from 'zod';

// ─── Booking ──────────────────────────────────────────────────────────────────

export const AdminUpdateBookingSchema = z.object({
  status:        z.enum(['PENDING','CONFIRMED','ASSIGNED','EN_ROUTE','COMPLETED','CANCELLED']).optional(),
  extraRequests: z.string().optional(),
  notes:         z.string().optional(),
});
export type AdminUpdateBookingInput = z.infer<typeof AdminUpdateBookingSchema>;

// ─── Location ─────────────────────────────────────────────────────────────────

export const AdminCreateLocationSchema = z.object({
  name:    z.string().min(2),
  nameEn:  z.string().min(2),
  type:    z.enum(['airport', 'hotel', 'region', 'port', 'city']),
  lat:     z.number(),
  lng:     z.number(),
  address: z.string().optional(),
});
export type AdminCreateLocationInput = z.infer<typeof AdminCreateLocationSchema>;

export const AdminUpdateLocationSchema = AdminCreateLocationSchema.partial();
export type AdminUpdateLocationInput = z.infer<typeof AdminUpdateLocationSchema>;

// ─── VehicleClass ─────────────────────────────────────────────────────────────

export const AdminCreateVehicleClassSchema = z.object({
  name:        z.string().min(2),
  nameEn:      z.string().min(2),
  capacity:    z.number().int().min(1).max(50),
  features:    z.array(z.string()).default([]),
  imageUrl:    z.string().url().optional(),
  description: z.string().optional(),
});
export type AdminCreateVehicleClassInput = z.infer<typeof AdminCreateVehicleClassSchema>;

// ─── PriceMatrix ──────────────────────────────────────────────────────────────

export const AdminUpdatePriceMatrixSchema = z.object({
  fromLocationId:  z.string().min(1),
  toLocationId:    z.string().min(1),
  vehicleClassId:  z.string().min(1),
  basePrice:       z.number().positive(),
  returnDiscount:  z.number().min(0).max(100).default(0),
  isActive:        z.boolean().default(true),
});
export type AdminUpdatePriceMatrixInput = z.infer<typeof AdminUpdatePriceMatrixSchema>;

// ─── PriceSurcharge ───────────────────────────────────────────────────────────

export const AdminCreateSurchargeSchema = z.object({
  name:       z.string().min(2),
  multiplier: z.number().min(1).max(5),
  startHour:  z.number().int().min(0).max(23).optional(),
  endHour:    z.number().int().min(0).max(23).optional(),
  startDate:  z.coerce.date().optional(),
  endDate:    z.coerce.date().optional(),
});
export type AdminCreateSurchargeInput = z.infer<typeof AdminCreateSurchargeSchema>;

// ─── User ─────────────────────────────────────────────────────────────────────

export const AdminCreateUserSchema = z.object({
  email:     z.string().email(),
  password:  z.string().min(8),
  firstName: z.string().min(1),
  lastName:  z.string().min(1),
  phone:     z.string().optional(),
  role:      z.enum(['ADMIN', 'OPERATOR', 'DRIVER', 'CUSTOMER']),
});
export type AdminCreateUserInput = z.infer<typeof AdminCreateUserSchema>;

export const AdminUpdateRoleSchema = z.object({
  role: z.enum(['ADMIN', 'OPERATOR', 'DRIVER', 'CUSTOMER']),
});

export const AdminSetActiveSchema = z.object({
  isActive: z.boolean(),
});

// ─── Coupon ───────────────────────────────────────────────────────────────────

export const AdminCreateCouponSchema = z.object({
  code:         z.string().min(3).max(32),
  discountType: z.enum(['percent', 'fixed']),
  amount:       z.number().positive(),
  maxUses:      z.number().int().positive().optional(),
  validFrom:    z.coerce.date().optional(),
  validUntil:   z.coerce.date().optional(),
  isActive:     z.boolean().default(true),
});
export type AdminCreateCouponInput = z.infer<typeof AdminCreateCouponSchema>;

// ─── Integration ──────────────────────────────────────────────────────────────

export const AdminUpsertIntegrationSchema = z.object({
  service:  z.string().min(1),        // 'paytr' | 'aeroDataBox' | 'netgsm' | ...
  provider: z.string().optional(),
  isActive: z.boolean().optional(),
  config:   z.record(z.unknown()).optional(),   // plain config (non-secret)
  secrets:  z.record(z.string()).optional(),    // yazıldıktan sonra masked döner
});
export type AdminUpsertIntegrationInput = z.infer<typeof AdminUpsertIntegrationSchema>;
