import type { Request, Response, NextFunction } from 'express';
import { UpdateAssignmentStatusSchema, AssignDriverSchema } from '@transfer/shared';
import * as driverService  from '../services/driver.service.js';
import { saveDriverLocation } from '../services/driver-location.service.js';
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

// Şoför "yaklaştım" → müşteriye anlık bildirim
export async function notifyApproachingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await driverService.notifyApproaching(req.params.id as string, req.user!.sub);
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

// ─── Canlı konum gönderimi (Geolocation → Redis) ─────────────────────────────

export async function updateLocationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const driverId    = req.user!.sub;
    const assignmentId = req.params.id as string;
    const { lat, lng, heading, speed } = req.body as {
      lat: number; lng: number; heading?: number | null; speed?: number | null;
    };
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      throw new AppError(400, 'lat ve lng gereklidir');
    }

    // Assignment sahipliğini ve aktif durumu doğrula
    const { prisma } = await import('../config/database.js');
    const assignment = await prisma.driverAssignment.findUnique({
      where: { id: assignmentId },
      select: { driverId: true, status: true },
    });
    if (!assignment) throw new AppError(404, 'Atama bulunamadı');
    if (assignment.driverId !== driverId) throw new AppError(403, 'Yetki yok');
    if (!['EN_ROUTE', 'PICKED_UP'].includes(assignment.status)) {
      throw new AppError(400, 'Konum yalnızca yolda veya yolcu alındığında gönderilebilir');
    }

    await saveDriverLocation(assignmentId, {
      lat,
      lng,
      heading: heading ?? null,
      speed:   speed ?? null,
    });

    res.json({ ok: true });
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
