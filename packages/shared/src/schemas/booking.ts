import { z } from 'zod';

export const SearchTransferSchema = z.object({
  fromLocationId: z.string().cuid(),
  toLocationId:   z.string().cuid(),
  transferDate:   z.string().datetime(),
  passengerCount: z.number().int().min(1).max(20),
  returnFlight:   z.boolean().default(false),
  returnDate:     z.string().datetime().optional(),
  currency:       z.enum(['TRY', 'EUR', 'GBP']).default('TRY'),
});

export const CreateBookingSchema = z.object({
  // Transfer detayı
  fromLocationId:   z.string().cuid(),
  toLocationId:     z.string().cuid(),
  customFromAddress: z.string().optional(),
  customFromLat:    z.number().optional(),
  customFromLng:    z.number().optional(),
  customToAddress:  z.string().optional(),
  customToLat:      z.number().optional(),
  customToLng:      z.number().optional(),
  vehicleClassId:   z.string().cuid(),
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
  fromLocationId: z.string().cuid(),
  toLocationId:   z.string().cuid(),
  vehicleClassId: z.string().cuid(),
  currency:       z.enum(['TRY', 'EUR', 'GBP']).default('TRY'),
});

export type SearchTransferInput  = z.infer<typeof SearchTransferSchema>;
export type CreateBookingInput   = z.infer<typeof CreateBookingSchema>;
export type ValidateCouponInput  = z.infer<typeof ValidateCouponSchema>;
