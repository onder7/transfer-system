import { z } from 'zod';

export const SearchTransferSchema = z.object({
  fromLocationId: z.string().min(1),
  toLocationId:   z.string().min(1),
  transferDate:   z.string().datetime(),
  // Query string'den string gelir, coerce ile dönüştür
  passengerCount: z.coerce.number().int().min(1).max(20),
  returnFlight:   z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => v === true || v === 'true')
    .default(false),
  returnDate:     z.string().datetime().optional(),
  currency:       z.enum(['TRY', 'EUR', 'GBP']).default('TRY'),
});

export const CreateBookingSchema = z.object({
  // Çift booking koruması — client UUID üretir, aynı key tekrar gelirse mevcut booking döner
  idempotencyKey: z.string().uuid(),

  // Transfer detayı
  fromLocationId:   z.string().min(1),
  toLocationId:     z.string().min(1),
  customFromAddress: z.string().optional(),
  customFromLat:    z.number().optional(),
  customFromLng:    z.number().optional(),
  customToAddress:  z.string().optional(),
  customToLat:      z.number().optional(),
  customToLng:      z.number().optional(),
  vehicleClassId:   z.string().min(1),
  transferDate:     z.string().datetime(),
  passengerCount:   z.number().int().min(1).max(20),
  flightNumber:     z.string().optional(),
  returnFlight:     z.boolean().default(false),
  returnFlightNo:   z.string().optional(),
  returnDate:       z.string().datetime().optional(),
  extraRequests:    z.string().max(500).optional(),
  couponCode:       z.string().optional(),
  currency:         z.enum(['TRY', 'EUR', 'GBP']).default('TRY'),

  // Misafir bilgileri (guest checkout)
  guestName:  z.string().optional(),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().optional(),
});

export const ValidateCouponSchema = z.object({
  code:           z.string().min(1),
  fromLocationId: z.string().min(1),
  toLocationId:   z.string().min(1),
  vehicleClassId: z.string().min(1),
  currency:       z.enum(['TRY', 'EUR', 'GBP']).default('TRY'),
});

export type SearchTransferInput  = z.infer<typeof SearchTransferSchema>;
export type CreateBookingInput   = z.infer<typeof CreateBookingSchema>;
export type ValidateCouponInput  = z.infer<typeof ValidateCouponSchema>;
