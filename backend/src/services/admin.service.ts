import { prisma }    from '../config/database.js';
import { redis }     from '../config/redis.js';
import { AppError }  from '../middlewares/error.middleware.js';
import { cancelBooking as bookingServiceCancel } from './booking.service.js';
import { autoAssignBooking } from './driver.service.js';
import { getIntegration, invalidateIntegrationCache } from './config.service.js';
import { updateBookingFlight } from './flight.service.js';
import type { ServiceKey } from './config.service.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import { hashPassword }     from '../utils/password.js';
import { invalidateLocationsCache, invalidateRoutesCache } from './location.service.js';
import type {
  AdminUpdateBookingInput,
  AdminCreateLocationInput,
  AdminUpdateLocationInput,
  AdminCreateVehicleClassInput,
  AdminUpdatePriceMatrixInput,
  AdminCreateSurchargeInput,
  AdminCreateChildPriceRuleInput,
  AdminCreateUserInput,
  AdminUpdateUserProfileInput,
  AdminCreateCouponInput,
  AdminUpsertIntegrationInput,
  AdminCreateExtraServiceInput,
  AdminUpdateExtraServiceInput,
} from '@transfer/shared';

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboard() {
  const today      = new Date(); today.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(today); todayEnd.setHours(23, 59, 59, 999);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [totalBookings, todayTransfers, pendingBookings, monthRevenue, recentBookings] =
    await Promise.all([
      prisma.booking.count(),
      prisma.booking.count({ where: { transferDate: { gte: today, lte: todayEnd } } }),
      prisma.booking.count({ where: { status: { in: ['PENDING', 'CONFIRMED'] } } }),
      prisma.payment.aggregate({
        where:  { status: 'PAID', paidAt: { gte: monthStart } },
        _sum:   { amount: true },
      }),
      prisma.booking.findMany({
        take:    10,
        orderBy: { createdAt: 'desc' },
        include: {
          fromLocation: { select: { name: true } },
          toLocation:   { select: { name: true } },
          payment:      { select: { status: true, amount: true } },
        },
      }),
    ]);

  return {
    totalBookings,
    todayTransfers,
    pendingBookings,
    monthRevenueTRY: monthRevenue._sum.amount ?? 0,
    recentBookings,
  };
}

// ─── Rezervasyon yönetimi ──────────────────────────────────────────────────────

export async function listBookings(params: {
  status?:   string;
  date?:     string;
  search?:   string;
  page?:     number;
  pageSize?: number;
}) {
  const page     = params.page     ?? 1;
  const pageSize = params.pageSize ?? 20;
  const skip     = (page - 1) * pageSize;

  const where: NonNullable<Parameters<typeof prisma.booking.findMany>[0]>['where'] = {};

  if (params.status) where.status = params.status as any;

  if (params.date) {
    const d    = new Date(params.date);
    const dEnd = new Date(params.date);
    d.setHours(0, 0, 0, 0);
    dEnd.setHours(23, 59, 59, 999);
    where.transferDate = { gte: d, lte: dEnd };
  }

  if (params.search) {
    const s = params.search;
    where.OR = [
      { bookingRef:  { contains: s, mode: 'insensitive' } },
      { guestName:   { contains: s, mode: 'insensitive' } },
      { guestEmail:  { contains: s, mode: 'insensitive' } },
      { flightNumber:{ contains: s, mode: 'insensitive' } },
    ];
  }

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        fromLocation:    { select: { name: true } },
        toLocation:      { select: { name: true } },
        vehicleClass:    { select: { id: true, name: true } },
        payment:         { select: { status: true, amount: true, currency: true, method: true } },
        assignment:      { select: { status: true, vehiclePlate: true, driver: { select: { firstName: true, lastName: true } } } },
        flightInfo:      { select: { status: true, delayMinutes: true, scheduledAt: true, estimatedAt: true, actualAt: true, lastCheckedAt: true, depIata: true, depName: true, depUtcOffset: true, arrIata: true, arrName: true, arrUtcOffset: true } },
      },
    }),
    prisma.booking.count({ where }),
  ]);

  return { bookings, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getBookingDetail(id: string) {
  const booking = await prisma.booking.findUnique({
    where:   { id },
    include: {
      fromLocation:    true,
      toLocation:      true,
      vehicleClass:    true,
      payment:         true,
      assignment:       { include: { driver: { select: { id: true, firstName: true, lastName: true, phone: true } } } },
      flightInfo:      true,
      notifications:   { orderBy: { createdAt: 'desc' }, take: 20 },
      coupon:          { select: { code: true, discountType: true, amount: true } },
    },
  });
  if (!booking) throw new AppError(404, 'Rezervasyon bulunamadı');
  return booking;
}

export async function updateBookingStatus(id: string, input: AdminUpdateBookingInput, adminId: string) {
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw new AppError(404, 'Rezervasyon bulunamadı');

  const updated = await prisma.booking.update({
    where: { id },
    data:  {
      status:        input.status        ?? undefined,
      extraRequests: input.extraRequests ?? undefined,
      notes:         input.notes         ?? undefined,
    },
  });

  await prisma.auditLog.create({
    data: { userId: adminId, action: 'BOOKING_UPDATED', entityType: 'Booking', entityId: id,
            meta: { from: booking.status, to: input.status } },
  });

  return updated;
}

// ─── Rezervasyon Yönetimi (Admin Aksiyonlar) ─────────────────────────────────

export async function adminCancelBooking(id: string, adminId: string) {
  const result = await bookingServiceCancel(id, undefined, true);

  await prisma.auditLog.create({
    data: { userId: adminId, action: 'BOOKING_CANCELLED_ADMIN', entityType: 'Booking', entityId: id,
            meta: { refundAmount: result.refundAmount, policy: result.policy } },
  });

  return result;
}

const ADVANCE_MAP: Partial<Record<string, string>> = {
  ASSIGNED: 'EN_ROUTE',
  EN_ROUTE: 'COMPLETED',
};

export async function advanceBookingStatus(id: string, adminId: string) {
  const booking = await prisma.booking.findUnique({
    where:  { id },
    select: { status: true },
  });
  if (!booking) throw new AppError(404, 'Rezervasyon bulunamadı');

  if (booking.status === 'CONFIRMED') {
    throw new AppError(400, 'Durum ilerletilemez — önce şoför ve araç ataması yapılmalı (Şoför Ata butonunu kullanın)');
  }

  const next = ADVANCE_MAP[booking.status];
  if (!next) throw new AppError(400, `'${booking.status}' durumundan ilerletilemez`);

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({ where: { id }, data: { status: next as any } });

    // DriverAssignment durumunu da eşle
    const assignStatus = next === 'EN_ROUTE' ? 'EN_ROUTE' : next === 'COMPLETED' ? 'COMPLETED' : null;
    if (assignStatus) {
      await tx.driverAssignment.updateMany({
        where: { bookingId: id },
        data:  {
          status:      assignStatus,
          ...(assignStatus === 'COMPLETED' ? { completedAt: new Date() } : {}),
        },
      });
    }

    await tx.auditLog.create({
      data: { userId: adminId, action: 'BOOKING_STATUS_ADVANCED', entityType: 'Booking', entityId: id,
              meta: { from: booking.status, to: next } },
    });
  });

  return { ok: true, from: booking.status, to: next };
}

export async function editBooking(
  id: string,
  input: {
    transferDate?:  string;
    guestName?:     string;
    guestPhone?:    string;
    guestEmail?:    string;
    flightNumber?:  string;
    extraRequests?: string;
    notes?:         string;
  },
  adminId: string,
) {
  const booking = await prisma.booking.findUnique({
    where:   { id },
    include: { vehicleClass: { select: { id: true, name: true, isShared: true } } },
  });
  if (!booking) throw new AppError(404, 'Rezervasyon bulunamadı');
  if (['COMPLETED', 'CANCELLED'].includes(booking.status)) {
    throw new AppError(400, 'Tamamlanan veya iptal edilen rezervasyon düzenlenemez');
  }

  if (input.transferDate) {
    const newDate = new Date(input.transferDate);

    if (newDate.getTime() !== booking.transferDate.getTime()) {
      const turnaroundSetting = await prisma.systemSetting.findUnique({
        where: { key: 'vehicle_turnaround_minutes' },
      });
      const bufferMs = (turnaroundSetting ? Number(turnaroundSetting.value) : 120) * 60_000;
      const slotFrom = new Date(newDate.getTime() - bufferMs);
      const slotTo   = new Date(newDate.getTime() + bufferMs);

      if (!booking.vehicleClass.isShared) {
        const [vehicleCount, bookedCount] = await Promise.all([
          prisma.vehicle.count({ where: { vehicleClassId: booking.vehicleClassId, isActive: true } }),
          prisma.booking.count({
            where: {
              id:             { not: id },
              vehicleClassId: booking.vehicleClassId,
              transferDate:   { gte: slotFrom, lte: slotTo },
              status:         { notIn: ['CANCELLED', 'COMPLETED'] },
            },
          }),
        ]);

        if (bookedCount >= vehicleCount) {
          const msg = vehicleCount === 0
            ? 'Bu araç sınıfında kayıtlı aktif araç bulunmuyor.'
            : `Bu saatte ${booking.vehicleClass.name} sınıfında tüm araçlar dolu. Lütfen farklı bir saat seçin.`;
          throw new AppError(409, msg);
        }
      }
    }
  }

  const updated = await prisma.booking.update({
    where: { id },
    data: {
      ...(input.transferDate  !== undefined ? { transferDate:  new Date(input.transferDate) } : {}),
      ...(input.guestName     !== undefined ? { guestName:     input.guestName }     : {}),
      ...(input.guestPhone    !== undefined ? { guestPhone:    input.guestPhone }    : {}),
      ...(input.guestEmail    !== undefined ? { guestEmail:    input.guestEmail }    : {}),
      ...(input.flightNumber  !== undefined ? { flightNumber:  input.flightNumber }  : {}),
      ...(input.extraRequests !== undefined ? { extraRequests: input.extraRequests } : {}),
      ...(input.notes         !== undefined ? { notes:         input.notes }         : {}),
    },
  });

  await prisma.auditLog.create({
    data: { userId: adminId, action: 'BOOKING_EDITED', entityType: 'Booking', entityId: id, meta: input },
  });

  return { booking: updated };
}

export async function deleteBooking(id: string) {
  const booking = await prisma.booking.findUnique({
    where:   { id },
    include: { payment: { select: { id: true, status: true } } },
  });
  if (!booking) throw new AppError(404, 'Rezervasyon bulunamadı');
  if (booking.status !== 'CANCELLED') {
    throw new AppError(400, 'Yalnızca iptal edilmiş rezervasyonlar silinebilir');
  }
  if (booking.payment?.status === 'PAID') {
    throw new AppError(400, 'Ödemesi tamamlanmış rezervasyon silinemez (muhasebe kaydı olarak korunur)');
  }

  await prisma.notification.deleteMany({ where: { bookingId: id } });
  await prisma.driverAssignment.deleteMany({ where: { bookingId: id } });
  if (booking.payment) {
    await prisma.payment.delete({ where: { id: booking.payment.id } });
  }
  await prisma.booking.delete({ where: { id } });

  return { ok: true };
}

// ─── Lokasyon yönetimi ────────────────────────────────────────────────────────

export async function listLocations() {
  return prisma.location.findMany({ orderBy: { name: 'asc' } });
}

export async function createLocation(input: AdminCreateLocationInput) {
  const loc = await prisma.location.create({ data: input });
  await invalidateLocationsCache();
  return loc;
}

export async function updateLocation(id: string, input: AdminUpdateLocationInput) {
  const loc = await prisma.location.findUnique({ where: { id } });
  if (!loc) throw new AppError(404, 'Lokasyon bulunamadı');
  const updated = await prisma.location.update({ where: { id }, data: input });
  await invalidateLocationsCache();
  return updated;
}

export async function deleteLocation(id: string) {
  const used = await prisma.priceMatrix.findFirst({
    where: { OR: [{ fromLocationId: id }, { toLocationId: id }] },
  });
  if (used) throw new AppError(409, 'Bu lokasyon fiyat matrisinde kullanılıyor, önce fiyatları silin');
  await prisma.location.delete({ where: { id } });
  await invalidateLocationsCache();
}

// ─── Araç sınıfları ───────────────────────────────────────────────────────────

export async function listVehicleClasses() {
  return prisma.vehicleClass.findMany({ orderBy: { capacity: 'asc' } });
}

export async function createVehicleClass(input: AdminCreateVehicleClassInput) {
  return prisma.vehicleClass.create({ data: input });
}

export async function updateVehicleClass(id: string, input: Partial<AdminCreateVehicleClassInput>) {
  return prisma.vehicleClass.update({ where: { id }, data: input });
}

export async function deleteVehicleClass(id: string) {
  const used = await prisma.priceMatrix.findFirst({ where: { vehicleClassId: id } });
  if (used) throw new AppError(409, 'Bu araç sınıfı fiyat matrisinde kullanılıyor');
  await prisma.vehicleClass.delete({ where: { id } });
}

// ─── Fiyat matrisi ────────────────────────────────────────────────────────────

export async function listPriceMatrix() {
  return prisma.priceMatrix.findMany({
    include: {
      fromLocation: { select: { id: true, name: true, type: true } },
      toLocation:   { select: { id: true, name: true, type: true } },
      vehicleClass: { select: { id: true, name: true } },
    },
    orderBy: [{ fromLocation: { name: 'asc' } }, { vehicleClass: { capacity: 'asc' } }],
  });
}

export async function upsertPriceMatrix(input: AdminUpdatePriceMatrixInput) {
  const { fromLocationId, toLocationId, vehicleClassId, ...data } = input;
  const result = await prisma.priceMatrix.upsert({
    where: { fromLocationId_toLocationId_vehicleClassId: { fromLocationId, toLocationId, vehicleClassId } },
    update: data,
    create: input,
  });
  await invalidateRoutesCache();
  return result;
}

export async function deletePriceMatrix(id: string) {
  await prisma.priceMatrix.delete({ where: { id } });
  await invalidateRoutesCache();
}

// ─── Surcharge (zamlar) ───────────────────────────────────────────────────────

export async function listSurcharges() {
  return prisma.priceSurcharge.findMany({ orderBy: { id: 'asc' } });
}

export async function createSurcharge(input: AdminCreateSurchargeInput) {
  return prisma.priceSurcharge.create({ data: input });
}

export async function updateSurcharge(id: string, input: Partial<AdminCreateSurchargeInput>) {
  return prisma.priceSurcharge.update({ where: { id }, data: input });
}

export async function deleteSurcharge(id: string) {
  await prisma.priceSurcharge.delete({ where: { id } });
}

// ─── Çocuk Fiyatlandırma ──────────────────────────────────────────────────────

export async function listChildPriceRules() {
  return prisma.childPriceRule.findMany({ orderBy: { maxAge: 'asc' } });
}

export async function createChildPriceRule(input: AdminCreateChildPriceRuleInput) {
  return prisma.childPriceRule.create({ data: input });
}

export async function updateChildPriceRule(id: string, input: Partial<AdminCreateChildPriceRuleInput>) {
  const rule = await prisma.childPriceRule.findUnique({ where: { id } });
  if (!rule) throw new AppError(404, 'Çocuk fiyat kuralı bulunamadı');
  return prisma.childPriceRule.update({ where: { id }, data: input });
}

export async function deleteChildPriceRule(id: string) {
  const rule = await prisma.childPriceRule.findUnique({ where: { id } });
  if (!rule) throw new AppError(404, 'Çocuk fiyat kuralı bulunamadı');
  await prisma.childPriceRule.delete({ where: { id } });
}

// ─── Kullanıcı yönetimi ───────────────────────────────────────────────────────

export async function listUsers(roles?: string[]) {
  return prisma.user.findMany({
    where:   roles?.length ? { role: { in: roles as any[] } } : undefined,
    select:  {
      id: true, email: true, firstName: true, lastName: true,
      phone: true, role: true, isActive: true, createdAt: true,
      _count: { select: { bookings: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listGuests() {
  // Üye olmadan rezervasyon yapan benzersiz misafirleri döndür
  const rows = await prisma.booking.groupBy({
    by:      ['guestEmail', 'guestName', 'guestPhone'],
    where:   { customerId: null, guestEmail: { not: null } },
    _count:  { id: true },
    _max:    { createdAt: true },
    orderBy: { _max: { createdAt: 'desc' } },
  });
  return rows.map((r) => ({
    email:          r.guestEmail!,
    name:           r.guestName,
    phone:          r.guestPhone,
    bookingCount:   r._count.id,
    lastBookingAt:  r._max.createdAt,
  }));
}

export async function createUser(input: AdminCreateUserInput) {
  const exists = await prisma.user.findUnique({ where: { email: input.email } });
  if (exists) throw new AppError(409, 'Bu e-posta adresi zaten kayıtlı');

  const passwordHash = await hashPassword(input.password);
  return prisma.user.create({
    data: {
      email:        input.email,
      firstName:    input.firstName,
      lastName:     input.lastName,
      phone:        input.phone,
      role:         input.role,
      passwordHash,
      consentGiven: true,
      consentAt:    new Date(),
    },
    select: { id: true, email: true, firstName: true, lastName: true, role: true },
  });
}

export async function updateUserProfile(id: string, input: AdminUpdateUserProfileInput) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError(404, 'Kullanıcı bulunamadı');

  if (input.email && input.email !== user.email) {
    const exists = await prisma.user.findUnique({ where: { email: input.email } });
    if (exists) throw new AppError(409, 'Bu e-posta adresi başka bir hesaba ait');
  }

  return prisma.user.update({
    where:  { id },
    data:   {
      firstName: input.firstName ?? undefined,
      lastName:  input.lastName  ?? undefined,
      phone:     input.phone     !== undefined ? input.phone : undefined,
      email:     input.email     ?? undefined,
    },
    select: { id: true, email: true, firstName: true, lastName: true, phone: true, role: true, isActive: true },
  });
}

export async function updateUserRole(id: string, role: string, adminId: string) {
  if (id === adminId) throw new AppError(400, 'Kendi rolünüzü değiştiremezsiniz');
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError(404, 'Kullanıcı bulunamadı');

  await prisma.auditLog.create({
    data: { userId: adminId, action: 'USER_ROLE_UPDATED', entityType: 'User', entityId: id,
            meta: { from: user.role, to: role } },
  });

  return prisma.user.update({
    where:  { id },
    data:   { role: role as any },
    select: { id: true, email: true, role: true },
  });
}

export async function setUserActive(id: string, isActive: boolean, adminId: string) {
  if (id === adminId) throw new AppError(400, 'Kendi hesabınızı deaktive edemezsiniz');
  return prisma.user.update({
    where:  { id },
    data:   { isActive },
    select: { id: true, email: true, isActive: true },
  });
}

// ─── Kupon yönetimi ───────────────────────────────────────────────────────────

export async function listCoupons() {
  return prisma.coupon.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { bookings: true } } },
  });
}

export async function createCoupon(input: AdminCreateCouponInput) {
  const exists = await prisma.coupon.findUnique({ where: { code: input.code.toUpperCase() } });
  if (exists) throw new AppError(409, 'Bu kupon kodu zaten mevcut');
  return prisma.coupon.create({ data: { ...input, code: input.code.toUpperCase() } });
}

export async function toggleCoupon(id: string, isActive: boolean) {
  return prisma.coupon.update({ where: { id }, data: { isActive } });
}

// ─── Ekstra hizmetler (çocuk koltuğu, isimle karşılama vb.) ───────────────────

export async function listExtraServices() {
  return prisma.extraService.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: { _count: { select: { bookings: true } } },
  });
}

export async function createExtraService(input: AdminCreateExtraServiceInput) {
  return prisma.extraService.create({ data: input });
}

export async function updateExtraService(id: string, input: AdminUpdateExtraServiceInput) {
  const exists = await prisma.extraService.findUnique({ where: { id } });
  if (!exists) throw new AppError(404, 'Ekstra hizmet bulunamadı');
  return prisma.extraService.update({ where: { id }, data: input });
}

export async function deleteExtraService(id: string) {
  const used = await prisma.bookingExtra.count({ where: { extraServiceId: id } });
  if (used > 0) {
    // Geçmiş rezervasyonları koru — silmek yerine pasife çek
    return prisma.extraService.update({ where: { id }, data: { isActive: false } });
  }
  return prisma.extraService.delete({ where: { id } });
}

// ─── Uçuş takibi — admin anlık sorgu ─────────────────────────────────────────

export async function refreshBookingFlight(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where:  { id: bookingId },
    select: { flightNumber: true },
  });
  if (!booking) throw new AppError(404, 'Rezervasyon bulunamadı');
  if (!booking.flightNumber) {
    throw new AppError(400, 'Bu rezervasyonda uçuş numarası tanımlı değil.');
  }

  const cfg = await getIntegration('flight');
  if (!cfg) {
    throw new AppError(400, 'Uçuş takip entegrasyonu (AeroDataBox) yapılandırılmamış veya pasif. Entegrasyonlar sayfasından ekleyin.');
  }

  await updateBookingFlight(bookingId);

  const info = await prisma.flightInfo.findUnique({ where: { bookingId } });
  if (!info) {
    throw new AppError(404, `"${booking.flightNumber}" için bu tarihte uçuş verisi bulunamadı. Uçuş numarasını ve tarihi kontrol edin.`);
  }
  return info;
}

// ─── Entegrasyon ayarları ─────────────────────────────────────────────────────

const SECRET_MASK = '••••••••';

function maskSecrets(secretJson: string | null): Record<string, string> {
  if (!secretJson) return {};
  try {
    const plain = decrypt(secretJson);
    const obj   = JSON.parse(plain) as Record<string, unknown>;
    return Object.fromEntries(Object.keys(obj).map(k => [k, SECRET_MASK]));
  } catch {
    return {};
  }
}

export async function listIntegrations() {
  const rows = await prisma.integrationSetting.findMany({ orderBy: { service: 'asc' } });
  return rows.map(r => ({
    id:         r.id,
    service:    r.service,
    provider:   r.provider,
    isActive:   r.isActive,
    configJson: r.configJson ? JSON.parse(r.configJson) : null,
    secrets:    maskSecrets(r.secretJson),
    updatedAt:  r.updatedAt,
  }));
}

export async function upsertIntegration(input: AdminUpsertIntegrationInput) {
  const secretJson = input.secrets && Object.values(input.secrets).some(Boolean)
    ? encrypt(JSON.stringify(input.secrets))
    : undefined;
  const configJson = input.config && Object.keys(input.config).length > 0
    ? JSON.stringify(input.config)
    : undefined;

  const existing = await prisma.integrationSetting.findUnique({ where: { service: input.service } });

  let result;
  if (existing) {
    result = await prisma.integrationSetting.update({
      where: { service: input.service },
      data:  {
        provider:   input.provider ?? undefined,
        isActive:   input.isActive ?? undefined,
        // undefined → mevcut değeri koru; yeni değer geldiyse güncelle
        ...(configJson !== undefined && { configJson }),
        ...(secretJson !== undefined && { secretJson }),
      },
      select: { id: true, service: true, provider: true, isActive: true, updatedAt: true },
    });
  } else {
    result = await prisma.integrationSetting.create({
      data: {
        service:    input.service,
        provider:   input.provider ?? '',
        isActive:   input.isActive ?? true,
        configJson: configJson ?? '{}',      // required field — boş config için {}
        secretJson: secretJson ?? '',        // required field — secrets yoksa boş
      },
      select: { id: true, service: true, provider: true, isActive: true, updatedAt: true },
    });
  }

  // Redis cache'i temizle → yeni provider/anahtar anında etkin olur
  await invalidateIntegrationCache(input.service as ServiceKey);
  return result;
}

export async function deleteIntegration(id: string) {
  const row = await prisma.integrationSetting.findUnique({ where: { id } });
  if (!row) throw new AppError(404, 'Entegrasyon bulunamadı');

  // Redis cache'i temizle
  await redis.del(`integration:${row.service}`);
  await prisma.integrationSetting.delete({ where: { id } });
}

// ─── Sistem Ayarları ──────────────────────────────────────────────────────────

export async function getSystemSettings() {
  const rows = await prisma.systemSetting.findMany({ orderBy: { key: 'asc' } });
  return rows;
}

export async function updateSystemSetting(key: string, value: string) {
  return prisma.systemSetting.upsert({
    where:  { key },
    update: { value },
    create: { key, value, label: key },
  });
}

// ─── Rezervasyon onay (nakit/havale için manuel onay) ────────────────────────

export async function adminConfirmBooking(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where:   { id: bookingId },
    include: { payment: true },
  });
  if (!booking) throw new AppError(404, 'Rezervasyon bulunamadı');
  if (booking.status === 'CONFIRMED') throw new AppError(400, 'Rezervasyon zaten onaylandı');
  if (booking.status === 'CANCELLED') throw new AppError(400, 'İptal edilmiş rezervasyon onaylanamaz');

  const { confirmBooking } = await import('./booking.service.js');
  await confirmBooking(bookingId);

  // Havale/EFT ise ödemeyi de PAID yap
  if (booking.payment?.method === 'BANK_TRANSFER') {
    await prisma.payment.update({
      where: { id: booking.payment.id },
      data:  { status: 'PAID', paidAt: new Date() },
    });
  }

  // Onay sonrası otomatik araç+şoför atama denemesi (başarısız olursa CONFIRMED'da kalır)
  await autoAssignBooking(bookingId);

  return { success: true };
}
