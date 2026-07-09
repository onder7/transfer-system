import type { Request, Response, NextFunction } from 'express';
import { UpdateAssignmentStatusSchema, AssignDriverSchema } from '@transfer/shared';
import * as driverService  from '../services/driver.service.js';
import { updateBookingFlight } from '../services/flight.service.js';
import { AppError }        from '../middlewares/error.middleware.js';

export async function listAssignmentsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const driverId = req.user!.sub;
    const date     = req.query.date as string | undefined;
    const list     = await driverService.getDriverAssignments(driverId, date);
    res.json({ assignments: list });
  } catch (e) { next(e); }
}

export async function getAssignmentDetailHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const driverId = req.user!.sub;
    const detail   = await driverService.getAssignmentDetail(req.params.id as string, driverId);
    res.json({ assignment: detail });
  } catch (e) { next(e); }
}

export async function updateAssignmentStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const driverId = req.user!.sub;
    const { status } = UpdateAssignmentStatusSchema.parse(req.body);
    const result   = await driverService.updateAssignmentStatus(
      req.params.id as string,
      driverId,
      status,
    );
    res.json(result);
  } catch (e) { next(e); }
}

export async function getFlightInfoHandler(req: Request, res: Response, next: NextFunction) {
  try {
    // Uçuş bilgisini anlık güncelle + dön
    await updateBookingFlight(req.params.bookingId as string);
    const { prisma } = await import('../config/database.js');
    const info = await prisma.flightInfo.findUnique({
      where: { bookingId: req.params.bookingId as string },
    });
    if (!info) throw new AppError(404, 'Uçuş bilgisi bulunamadı (uçuş no kayıtlı mı?)');
    res.json({ flightInfo: info });
  } catch (e) { next(e); }
}

// ─── Admin: şoför ata ─────────────────────────────────────────────────────────

export async function assignDriverHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input      = AssignDriverSchema.parse(req.body);
    const assignment = await driverService.assignDriver(
      req.params.bookingId as string,
      input,
      req.user!.sub,
    );
    res.status(201).json({ assignment });
  } catch (e) { next(e); }
}
