import { z } from 'zod';

export const InitCheckoutSchema = z.object({
  bookingId: z.string().min(1),
});

export const CancelBookingSchema = z.object({
  reason: z.string().max(500).optional(),
});

export type InitCheckoutInput  = z.infer<typeof InitCheckoutSchema>;
export type CancelBookingInput = z.infer<typeof CancelBookingSchema>;
