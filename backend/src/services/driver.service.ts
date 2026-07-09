import { prisma }            from '../config/database.js';
import { AppError }          from '../middlewares/error.middleware.js';
import { queueNotification } from './notification.service.js';
import { logger }            from '../config/logger.js';
import type { AssignDriverInput } from '@transfer/shared';

// ─── Müsaitlik kontrolü — çakışma/overlap ────────────────────────────────────

const BUFFER_HOURS = 4; // aynı şoför aynı pencerede iki transfer alamaz

async function assertDriverAvailable(driverId: string, transferDate: Date, excludeBookingId?: string) {
  const from = new Date(transferDate.getTime() - BUFFER_HOURS * 3_600_000);
  const to   = new Date(transferDate.getTime() + BUFFER_HOURS * 3_600_000);

  const conflict = await prisma.driverAssignment.findFirst({
    where: {
      driverId,
      status: { in: ['ASSIGNED', 'EN_ROUTE'] },
      booking: {
        status:      { notIn: ['CANCELLED', 'COMPLETED'] },
        transferDate: { gte: from, lte: to },
        id:          excludeBookingId ? { not: excludeBookingId } : undefined,
      },
    },
    include: { booking: { select: { transferDate: true, bookingRef: true } } },
  });

  if (conflict) {
    throw new AppError(
      409,
      `Şoför bu zaman aralığında meşgul (${conflict.booking.bookingRef} — ${conflict.booking.transferDate.toLocaleString('tr-TR')})`,
    );
  }
}

// ─── Şoför transferlerini listele ─────────────────────────────────────────────

export async function getDriverAssignments(driverId: string, dateStr?: string) {
  const where: Parameters<typeof prisma.driverAssignment.findMany>[0]['where'] = {
    driverId,
    status: { notIn: ['COMPLETED'] },
  };

  if (dateStr) {
    const day   = new Date(dateStr);
    const dayEnd = new Date(dateStr);
    day.setHours(0, 0, 0, 0);
    dayEnd.setHours(23, 59, 59, 999);
    where.booking = { transferDate: { gte: day, lte: dayEnd } };
  }

  return prisma.driverAssignment.findMany({
    where,
    include: {
      booking: {
        include: {
          fromLocation: { select: { name: true, nameEn: true } },
          toLocation:   { select: { name: true, nameEn: true } },
          flightInfo:   true,
        },
      },
      vehicleClass: { select: { name: true, capacity: true } },
    },
    orderBy: { booking: { transferDate: 'asc' } },
  });
}

// ─── Transfer detayı ──────────────────────────────────────────────────────────

export async function getAssignmentDetail(assignmentId: string, driverId: string) {
  const assignment = await prisma.driverAssignment.findUnique({
    where:   { id: assignmentId },
    include: {
      booking: {
        include: {
          fromLocation: true,
          toLocation:   true,
          flightInfo:   true,
        },
      },
      vehicleClass: true,
    },
  });

  if (!assignment) throw new AppError(404, 'Atama bulunamadı');
  if (assignment.driverId !== driverId) throw new AppError(403, 'Bu atamaya erişim yetkiniz yok');

  // Yolcu bilgilerini kısıtlı dön (hassas veri — sadece operasyon için gerekliler)
  const { booking } = assignment;
  return {
    ...assignment,
    booking: {
      id:            booking.id,
      bookingRef:    booking.bookingRef,
      transferDate:  booking.transferDate,
      adultCount:    booking.adultCount,
      childCount:    booking.childCount,
      flightNumber:  booking.flightNumber,
      returnFlight:  booking.returnFlight,
      returnFlightNo: booking.returnFlightNo,
      extraRequests: booking.extraRequests,
      guestName:     booking.guestName,
      guestPhone:    booking.guestPhone,     // şoförün arayacağı numara
      customFromAddress: booking.customFromAddress,
      customFromLat: booking.customFromLat,
      customFromLng: booking.customFromLng,
      fromLocation:  booking.fromLocation,
      toLocation:    booking.toLocation,
      flightInfo:    booking.flightInfo,
      status:        booking.status,
    },
  };
}

// ─── Statü güncelleme (şoför mobil arayüzünden) ───────────────────────────────

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  ASSIGNED:  ['EN_ROUTE'],
  EN_ROUTE:  ['COMPLETED'],
};

export async function updateAssignmentStatus(
  assignmentId: string,
  driverId: string,
  newStatus: 'EN_ROUTE' | 'COMPLETED',
) {
  const assignment = await prisma.driverAssignment.findUnique({
    where:   { id: assignmentId },
    include: { booking: true },
  });

  if (!assignment) throw new AppError(404, 'Atama bulunamadı');
  if (assignment.driverId !== driverId) throw new AppError(403, 'Yetki yok');

  const allowed = ALLOWED_TRANSITIONS[assignment.status] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new AppError(400, `${assignment.status} → ${newStatus} geçişi yapılamaz`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.driverAssignment.update({
      where: { id: assignmentId },
      data:  {
        status:      newStatus,
        completedAt: newStatus === 'COMPLETED' ? new Date() : undefined,
      },
    });

    // Booking statüsünü eşle
    const bookingStatus = newStatus === 'EN_ROUTE' ? 'EN_ROUTE' : 'COMPLETED';
    await tx.booking.update({
      where: { id: assignment.bookingId },
      data:  { status: bookingStatus },
    });
  });

  // Yolda → müşteriye bildir
  if (newStatus === 'EN_ROUTE') {
    const phone = assignment.booking.guestPhone;
    if (phone) {
      await queueNotification({
        bookingId: assignment.bookingId,
        channel:   'SMS',
        recipient:  phone,
        body:      `Şoförünüz yola çıktı. Rezervasyon: ${assignment.booking.bookingRef}`,
      });
    }
  }

  logger.info({ assignmentId, newStatus }, 'Atama statüsü güncellendi');
  return { ok: true, status: newStatus };
}

// ─── Admin: şoför ata ─────────────────────────────────────────────────────────

export async function assignDriver(
  bookingId: string,
  input: AssignDriverInput,
  adminId: string,
) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new AppError(404, 'Rezervasyon bulunamadı');
  if (!['CONFIRMED', 'ASSIGNED'].includes(booking.status)) {
    throw new AppError(400, `${booking.status} durumundaki rezervasyona şoför atanamaz`);
  }

  // Müsaitlik kontrolü
  await assertDriverAvailable(input.driverId, booking.transferDate, bookingId);

  // Mevcut atama varsa güncelle, yoksa yeni yarat
  const assignment = await prisma.$transaction(async (tx) => {
    const existing = await tx.driverAssignment.findUnique({ where: { bookingId } });

    let a;
    if (existing) {
      a = await tx.driverAssignment.update({
        where: { bookingId },
        data:  { driverId: input.driverId, vehicleClassId: input.vehicleClassId, vehiclePlate: input.vehiclePlate, status: 'ASSIGNED' },
      });
    } else {
      a = await tx.driverAssignment.create({
        data: { bookingId, driverId: input.driverId, vehicleClassId: input.vehicleClassId, vehiclePlate: input.vehiclePlate },
      });
    }

    await tx.booking.update({ where: { id: bookingId }, data: { status: 'ASSIGNED' } });
    await tx.auditLog.create({
      data: { userId: adminId, action: 'DRIVER_ASSIGNED', entityType: 'Booking', entityId: bookingId,
              meta: { driverId: input.driverId, vehiclePlate: input.vehiclePlate } },
    });

    return a;
  });

  // Şoföre bildirim
  const driver = await prisma.user.findUnique({
    where: { id: input.driverId },
    select: { phone: true, firstName: true },
  });

  if (driver?.phone) {
    await queueNotification({
      bookingId,
      channel:   'SMS',
      recipient:  driver.phone,
      body: `Yeni Transfer — ${booking.bookingRef} | ${booking.transferDate.toLocaleString('tr-TR')} | Uçuş: ${booking.flightNumber ?? '-'}`,
    });
  }

  return assignment;
}
