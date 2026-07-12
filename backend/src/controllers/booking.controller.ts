import type { Request, Response, NextFunction } from 'express';
import { CreateBookingSchema, CancelBookingSchema } from '@transfer/shared';
import * as bookingService                         from '../services/booking.service.js';

export async function getMyBookingsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const bookings = await bookingService.getMyBookings(req.user!.sub, req.user!.email);
    res.json({ bookings });
  } catch (e) { next(e); }
}

export async function createBookingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data   = CreateBookingSchema.parse(req.body);
    const result = await bookingService.createBooking(data, req.user?.sub);
    res.status(result.isNew ? 201 : 200).json({
      booking:   result.booking,
      payment:   { id: result.payment.id, status: result.payment.status, amount: result.payment.amount },
      isNew:     result.isNew,
    });
  } catch (e) { next(e); }
}

export async function getBookingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { id }  = req.params;
    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'OPERATOR';
    const booking = await bookingService.getBooking(id as string, req.user?.sub, isAdmin);
    res.json({ booking });
  } catch (e) { next(e); }
}

export async function getBookingByRefHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const booking = await bookingService.getBookingByRef(req.params.ref as string);
    res.json({ booking });
  } catch (e) { next(e); }
}

export async function cancelBookingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    CancelBookingSchema.parse(req.body); // reason opsiyonel
    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'OPERATOR';
    const result  = await bookingService.cancelBooking(id as string, req.user?.sub, isAdmin);
    res.json(result);
  } catch (e) { next(e); }
}
