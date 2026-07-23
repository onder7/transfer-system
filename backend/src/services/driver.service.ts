import { prisma }            from '../config/database.js';
import { AppError }          from '../middlewares/error.middleware.js';
import { queueNotification } from './notification.service.js';
import { sendToBooking }     from './push.service.js';
import { logger }            from '../config/logger.js';
import type { AssignDriverInput } from '@transfer/shared';

// ─── Müsaitlik kontrolü — harita-tahmini + yolcu-alma anası ──────────────────
//
// Eski sistem: sabit ±120 dk (elle "araç dönüş süresi"). Yeni sistem: her transferin
// meşguliyet penceresi = [transferDate − pay,  yolcuAlmaAnı + tahmini süre + pay].
//   • tahmini süre  → harita (OSRM) tahmini, Booking.estimatedDurationMin
//   • yolcuAlmaAnı  → şoför "yolcuyu aldım" dediyse gerçek pickedUpAt, yoksa planlanan transferDate
//   • pay           → sabit temizlik/hazırlık payı (vehicle_turnaround_minutes)
// İki transfer, pencereleri örtüşürse çakışır (aralık kesişimi).

const DEFAULT_TRIP_MIN = 60; // estimatedDurationMin yoksa güvenli varsayılan

interface WindowBooking { transferDate: Date; estimatedDurationMin: number | null; }
interface WindowAssignment { pickedUpAt: Date | null; }

async function getMarginMin(): Promise<number> {
  const s = await prisma.systemSetting.findUnique({ where: { key: 'vehicle_turnaround_minutes' } });
  return s ? Number(s.value) : 20;
}

function blockWindow(b: WindowBooking, marginMs: number, a?: WindowAssignment) {
  const travelMs = (b.estimatedDurationMin ?? DEFAULT_TRIP_MIN) * 60_000;
  const anchor   = (a?.pickedUpAt ?? b.transferDate).getTime(); // yolcu alındıysa gerçek an
  return {
    start: b.transferDate.getTime() - marginMs,          // araca varış payı (planlanan)
    end:   anchor + travelMs + marginMs,                 // bırakma + temizlik payı
  };
}

// kind'a göre (şoför/araç) çakışan atamayı bulur; varsa 409 fırlatır
async function assertResourceAvailable(
  kind: 'driver' | 'vehicle',
  resourceId: string,
  newBooking: WindowBooking,
  excludeBookingId?: string,
) {
  const marginMs = (await getMarginMin()) * 60_000;
  const w = blockWindow(newBooking, marginMs);

  // Kaba DB penceresi (satır sayısını sınırlamak için ±12s); kesin örtüşme JS'te
  const coarseFrom = new Date(w.start - 12 * 3600_000);
  const coarseTo   = new Date(w.end   + 12 * 3600_000);

  const candidates = await prisma.driverAssignment.findMany({
    where: {
      ...(kind === 'driver' ? { driverId: resourceId } : { vehicleId: resourceId }),
      status: { in: ['ASSIGNED', 'EN_ROUTE', 'PICKED_UP'] },
      booking: {
        status:      { notIn: ['CANCELLED', 'COMPLETED'] },
        transferDate: { gte: coarseFrom, lte: coarseTo },
        id:          excludeBookingId ? { not: excludeBookingId } : undefined,
      },
    },
    include: { booking: { select: { transferDate: true, estimatedDurationMin: true, bookingRef: true } } },
  });

  for (const c of candidates) {
    const cw = blockWindow(c.booking, marginMs, { pickedUpAt: c.pickedUpAt });
    if (w.start < cw.end && cw.start < w.end) {           // aralık kesişimi
      const label = kind === 'driver' ? 'Şoför' : 'Araç';
      throw new AppError(
        409,
        `${label} bu zaman aralığında meşgul (${c.booking.bookingRef.slice(-8)} — ${c.booking.transferDate.toLocaleString('tr-TR')})`,
      );
    }
  }
}

const assertDriverAvailable  = (driverId: string,  b: WindowBooking, ex?: string) => assertResourceAvailable('driver',  driverId,  b, ex);
const assertVehicleAvailable = (vehicleId: string, b: WindowBooking, ex?: string) => assertResourceAvailable('vehicle', vehicleId, b, ex);

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

// Şoför iş akışı: Atandı → Yola Çıktı → Yolcuyu Aldı → Tamamlandı
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  ASSIGNED:  ['EN_ROUTE'],
  EN_ROUTE:  ['PICKED_UP'],
  PICKED_UP: ['COMPLETED'],
};

export async function updateAssignmentStatus(
  assignmentId: string,
  driverId: string,
  newStatus: 'EN_ROUTE' | 'PICKED_UP' | 'COMPLETED',
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
        // "Yolcuyu aldım" → gerçek pickup anı; çakışma penceresi buradan hesaplanır
        pickedUpAt:  newStatus === 'PICKED_UP'  ? new Date() : undefined,
        completedAt: newStatus === 'COMPLETED'  ? new Date() : undefined,
      },
    });

    // Booking statüsünü eşle (PICKED_UP → booking hâlâ EN_ROUTE)
    const bookingStatus = newStatus === 'COMPLETED' ? 'COMPLETED' : 'EN_ROUTE';
    await tx.booking.update({
      where: { id: assignment.bookingId },
      data:  { status: bookingStatus },
    });
  });

  // Müşteri bildirimi — SMS + Web Push
  const phone = assignment.booking.guestPhone;
  const ref   = assignment.booking.bookingRef;
  const trackUrl = `/confirmation/${assignment.bookingId}`;

  if (newStatus === 'EN_ROUTE') {
    if (phone) await queueNotification({ bookingId: assignment.bookingId, channel: 'SMS', recipient: phone, body: `Şoförünüz yola çıktı. Rezervasyon: ${ref}` });
    void sendToBooking(assignment.bookingId, { title: '🚗 Şoförünüz yola çıktı', body: 'Transferiniz için şoförünüz yola çıktı.', url: trackUrl, tag: 'transfer' });
  } else if (newStatus === 'PICKED_UP') {
    if (phone) await queueNotification({ bookingId: assignment.bookingId, channel: 'SMS', recipient: phone, body: `Transferiniz başladı, iyi yolculuklar! Rezervasyon: ${ref}` });
    void sendToBooking(assignment.bookingId, { title: '🧍 Transferiniz başladı', body: 'İyi yolculuklar dileriz!', url: trackUrl, tag: 'transfer' });
  }

  logger.info({ assignmentId, newStatus }, 'Atama statüsü güncellendi');
  return { ok: true, status: newStatus };
}

// Şoför "yaklaştım/kapıdayım" der → müşteriye push (durum değişmez)
export async function notifyApproaching(assignmentId: string, driverId: string) {
  const assignment = await prisma.driverAssignment.findUnique({
    where:   { id: assignmentId },
    include: { booking: { select: { id: true, bookingRef: true, guestPhone: true } } },
  });
  if (!assignment) throw new AppError(404, 'Atama bulunamadı');
  if (assignment.driverId !== driverId) throw new AppError(403, 'Yetki yok');
  if (assignment.status !== 'EN_ROUTE') throw new AppError(400, 'Yaklaşma bildirimi yalnızca yola çıktıktan sonra gönderilebilir');

  const b = assignment.booking;
  const sent = await sendToBooking(b.id, {
    title: '📍 Şoförünüz yaklaştı',
    body:  'Şoförünüz buluşma noktasına yaklaştı. Lütfen hazır olun.',
    url:   `/confirmation/${b.id}`,
    tag:   'transfer',
  });
  if (b.guestPhone) {
    await queueNotification({ bookingId: b.id, channel: 'SMS', recipient: b.guestPhone, body: `Şoförünüz yaklaştı, lütfen hazır olun. Rezervasyon: ${b.bookingRef}` });
  }
  return { ok: true, pushSent: sent };
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

  // Müsaitlik kontrolü — hem şoför hem ARAÇ (harita-tahmini pencereyle)
  await assertDriverAvailable(input.driverId, booking, bookingId);

  // vehicleId verilmişse plakayı Vehicle tablosundan al (tarihsel snapshot için)
  let vehiclePlate = input.vehiclePlate;
  if (input.vehicleId) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: input.vehicleId } });
    if (!vehicle) throw new AppError(404, 'Araç bulunamadı');
    if (!vehicle.isActive) throw new AppError(400, 'Seçilen araç pasif durumda');
    await assertVehicleAvailable(input.vehicleId, booking, bookingId);
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
      // Otomatik atamada adminId='SYSTEM' → User FK'sı yok; null yaz (AuditLog.userId nullable)
      data: { userId: adminId === 'SYSTEM' ? null : adminId, action: 'DRIVER_ASSIGNED', entityType: 'Booking', entityId: bookingId,
              meta: { driverId: input.driverId, vehicleId: input.vehicleId, vehiclePlate, auto: adminId === 'SYSTEM' } },
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

  // Harita-tahmini pencere (assignDriver ile aynı mantık; burası yalnızca ön-filtre)
  const marginMs = (await getMarginMin()) * 60_000;
  const w = blockWindow({ transferDate: booking.transferDate, estimatedDurationMin: booking.estimatedDurationMin }, marginMs);

  const candidatesBusy = await prisma.driverAssignment.findMany({
    where: {
      status: { in: ['ASSIGNED', 'EN_ROUTE', 'PICKED_UP'] },
      booking: {
        id:          { not: bookingId },
        status:      { notIn: ['CANCELLED', 'COMPLETED'] },
        transferDate: { gte: new Date(w.start - 12 * 3600_000), lte: new Date(w.end + 12 * 3600_000) },
      },
    },
    select: { vehicleId: true, driverId: true, pickedUpAt: true, booking: { select: { transferDate: true, estimatedDurationMin: true } } },
  });
  const busyVehicleIds = new Set<string>();
  const busyDriverIds  = new Set<string>();
  for (const c of candidatesBusy) {
    const cw = blockWindow(c.booking, marginMs, { pickedUpAt: c.pickedUpAt });
    if (w.start < cw.end && cw.start < w.end) {
      if (c.vehicleId) busyVehicleIds.add(c.vehicleId);
      busyDriverIds.add(c.driverId);
    }
  }

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
