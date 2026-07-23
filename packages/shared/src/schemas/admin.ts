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
  name:     z.string().min(2),
  nameEn:   z.string().optional().nullable(),
  type:     z.enum(['airport', 'hotel', 'region', 'port', 'city']),
  lat:      z.number().nullable().optional(),
  lng:      z.number().nullable().optional(),
  address:  z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  // Bağlı olduğu bölge (otel → bölge); boş bırakılabilir
  regionId: z.string().optional().nullable(),
});
export type AdminCreateLocationInput = z.infer<typeof AdminCreateLocationSchema>;

export const AdminUpdateLocationSchema = AdminCreateLocationSchema.partial();
export type AdminUpdateLocationInput = z.infer<typeof AdminUpdateLocationSchema>;

// ─── VehicleClass ─────────────────────────────────────────────────────────────

export const AdminCreateVehicleClassSchema = z.object({
  name:            z.string().min(2),
  nameEn:          z.string().min(2).optional(),
  capacity:        z.number().int().min(1).max(50),
  luggageCapacity: z.number().int().min(0).default(2),
  isShared:        z.boolean().default(false),
  features:        z.array(z.string()).default([]),
  imageUrl:        z.string().url().optional().nullable(),
  isActive:        z.boolean().default(true),
});
export type AdminCreateVehicleClassInput = z.infer<typeof AdminCreateVehicleClassSchema>;

// ─── PriceMatrix ──────────────────────────────────────────────────────────────

export const AdminUpdatePriceMatrixSchema = z.object({
  fromLocationId:  z.string().min(1),
  toLocationId:    z.string().min(1),
  vehicleClassId:  z.string().min(1),
  basePrice:       z.coerce.number().positive(),
  returnDiscount:  z.coerce.number().min(0).max(100).default(0),
  isActive:        z.boolean().default(true),
});
export type AdminUpdatePriceMatrixInput = z.infer<typeof AdminUpdatePriceMatrixSchema>;

// ─── PriceSurcharge ───────────────────────────────────────────────────────────

export const AdminCreateSurchargeSchema = z.object({
  name:       z.string().min(2),
  multiplier: z.coerce.number().min(0.1).max(10),
  startHour:  z.coerce.number().int().min(0).max(23).optional().nullable(),
  endHour:    z.coerce.number().int().min(0).max(23).optional().nullable(),
  startDate:  z.coerce.date().optional().nullable(),
  endDate:    z.coerce.date().optional().nullable(),
  isActive:   z.boolean().default(true),
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

export const AdminUpdateUserProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName:  z.string().min(1).optional(),
  phone:     z.string().optional().nullable(),
  email:     z.string().email().optional(),
});
export type AdminUpdateUserProfileInput = z.infer<typeof AdminUpdateUserProfileSchema>;

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

// ─── ChildPriceRule ───────────────────────────────────────────────────────────

export const AdminCreateChildPriceRuleSchema = z.object({
  label:           z.string().min(2),
  maxAge:          z.coerce.number().int().min(0).max(17),
  discountPercent: z.coerce.number().int().min(0).max(100),
  isActive:        z.boolean().default(true),
});
export type AdminCreateChildPriceRuleInput = z.infer<typeof AdminCreateChildPriceRuleSchema>;

// ─── ExtraService (ekstra hizmetler — çocuk koltuğu, isimle karşılama vb.) ─────

export const AdminCreateExtraServiceSchema = z.object({
  key:          z.string().min(1).optional().nullable(),
  name:         z.string().min(2),
  nameEn:       z.string().optional().nullable(),
  description:  z.string().optional().nullable(),
  price:        z.coerce.number().min(0),
  priceType:    z.enum(['FLAT', 'PER_PERSON', 'PER_UNIT']).default('PER_UNIT'),
  requiresNote: z.boolean().default(false),
  maxQuantity:  z.coerce.number().int().min(1).max(20).default(4),
  isActive:     z.boolean().default(true),
  sortOrder:    z.coerce.number().int().default(0),
});
export type AdminCreateExtraServiceInput = z.infer<typeof AdminCreateExtraServiceSchema>;

export const AdminUpdateExtraServiceSchema = AdminCreateExtraServiceSchema.partial();
export type AdminUpdateExtraServiceInput = z.infer<typeof AdminUpdateExtraServiceSchema>;

// ─── Integration ──────────────────────────────────────────────────────────────

export const AdminUpsertIntegrationSchema = z.object({
  service:  z.string().min(1),        // 'paytr' | 'aeroDataBox' | 'netgsm' | ...
  provider: z.string().optional(),
  isActive: z.boolean().optional(),
  config:   z.record(z.unknown()).optional(),   // plain config (non-secret)
  secrets:  z.record(z.string()).optional(),    // yazıldıktan sonra masked döner
});
export type AdminUpsertIntegrationInput = z.infer<typeof AdminUpsertIntegrationSchema>;
