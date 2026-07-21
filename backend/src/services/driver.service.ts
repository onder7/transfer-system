import { prisma }            from '../config/database.js';
import { AppError }          from '../middlewares/error.middleware.js';
import { queueNotification } from './notification.service.js';
import { logger }            from '../config/logger.js';
import type { AssignDriverInput } from '@transfer/shared';

// ─── Müsaitlik kontrolü — çakışma/overlap ────────────────────────────────────

async function getBufferMs(): Promise<number> {
  const s = await prisma.systemSetting.findUnique({ where: { key: 'vehicle_turnaround_minutes' } });
  return (s ? Number(s.value) : 120) * 60_000;
}

async function assertDriverAvailable(driverId: string, transferDate: Date, excludeBookingId?: string) {
  const bufferMs = await getBufferMs();
  const from = new Date(transferDate.getTime() - bufferMs);
  const to   = new Date(transferDate.getTime() + bufferMs);

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
  const where: NonNullable<Parameters<typeof prisma.driverAssignment.findMany>[0]>['where'] = {
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

  // vehicleId verilmişse plakayı Vehicle tablosundan al (tarihsel snapshot için)
  let vehiclePlate = input.vehiclePlate;
  if (input.vehicleId) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: input.vehicleId } });
    if (!vehicle) throw new AppError(404, 'Araç bulunamadı');
    if (!vehicle.isActive) throw new AppError(400, 'Seçilen araç pasif durumda');
    vehiclePlate = vehicle.plate;
  }

  // Mevcut atama varsa güncelle, yoksa yeni yarat
  const assignment = await prisma.$transaction(async (tx) => {
    const existing = await tx.driverAssignment.findUnique({ where: { bookingId } });

    let a;
    if (existing) {
      a = await tx.driverAssignment.update({
        where: { bookingId },
        data:  {
          driverId:      input.driverId,
          vehicleClassId: input.vehicleClassId,
          vehicleId:     input.vehicleId ?? null,
          vehiclePlate,
          status:        'ASSIGNED',
        },
      });
    } else {
      a = await tx.driverAssignment.create({
        data: {
          bookingId,
          driverId:       input.driverId,
          vehicleClassId: input.vehicleClassId,
          vehicleId:      input.vehicleId ?? null,
          vehiclePlate,
        },
      });
    }

    await tx.booking.update({ where: { id: bookingId }, data: { status: 'ASSIGNED' } });
    await tx.auditLog.create({
      data: { userId: adminId, action: 'DRIVER_ASSIGNED', entityType: 'Booking', entityId: bookingId,
              meta: { driverId: input.driverId, vehicleId: input.vehicleId, vehiclePlate } },
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

// ─── Rezervasyon onaylandığında otomatik araç+şoför ata ──────────────────────

export async function autoAssignBooking(bookingId: string): Promise<{ assigned: boolean; reason?: string }> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.status !== 'CONFIRMED') {
    return { assigned: false, reason: 'Uygun durum değil' };
  }

  const bufferMs = await getBufferMs();
  const from = new Date(booking.transferDate.getTime() - bufferMs);
  const to   = new Date(booking.transferDate.getTime() + bufferMs);

  // Bu pencerede zaten meşgul araç ve şoför ID'leri
  const busy = await prisma.driverAssignment.findMany({
    where: {
      status: { in: ['ASSIGNED', 'EN_ROUTE'] },
      booking: {
        id:          { not: bookingId },
        status:      { notIn: ['CANCELLED', 'COMPLETED'] },
        transferDate: { gte: from, lte: to },
      },
    },
    select: { vehicleId: true, driverId: true },
  });
  const busyVehicleIds = new Set(busy.map((a) => a.vehicleId).filter(Boolean) as string[]);
  const busyDriverIds  = new Set(busy.map((a) => a.driverId));

  // Bu sınıfta müsait, varsayılan şoförü olan araçları bul
  const candidates = await prisma.vehicle.findMany({
    where: {
      vehicleClassId:  booking.vehicleClassId,
      isActive:        true,
      defaultDriverId: { not: null },
      ...(busyVehicleIds.size > 0 ? { id: { notIn: [...busyVehicleIds] } } : {}),
    },
    include: { defaultDriver: { select: { id: true, isActive: true } } },
    orderBy: { plate: 'asc' },
  });

  const best = candidates.find(
    (v) => v.defaultDriver?.isActive && !busyDriverIds.has(v.defaultDriver.id),
  );

  if (!best?.defaultDriver) {
    return { assigned: false, reason: 'Uygun müsait araç/şoför bulunamadı' };
  }

  try {
    await assignDriver(
      bookingId,
      { driverId: best.defaultDriver.id, vehicleClassId: booking.vehicleClassId, vehicleId: best.id },
      'SYSTEM',
    );
    logger.info({ bookingId, vehicleId: best.id, driverId: best.defaultDriver.id }, 'Otomatik atama yapıldı');
    return { assigned: true };
  } catch (err) {
    logger.warn({ bookingId, err }, 'Otomatik atama başarısız');
    return { assigned: false, reason: 'Atama çakışması veya sistem hatası' };
  }
}
