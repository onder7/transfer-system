import { prisma }    from '../config/database.js';
import { redis }     from '../config/redis.js';
import { AppError }  from '../middlewares/error.middleware.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import { hashPassword }     from '../utils/password.js';
import type {
  AdminUpdateBookingInput,
  AdminCreateLocationInput,
  AdminUpdateLocationInput,
  AdminCreateVehicleClassInput,
  AdminUpdatePriceMatrixInput,
  AdminCreateSurchargeInput,
  AdminCreateUserInput,
  AdminCreateCouponInput,
  AdminUpsertIntegrationInput,
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

  const where: Parameters<typeof prisma.booking.findMany>[0]['where'] = {};

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
        vehicleClass:    { select: { name: true } },
        payment:         { select: { status: true, amount: true, currency: true } },
        assignment:       { select: { status: true, vehiclePlate: true, driver: { select: { firstName: true, lastName: true } } } },
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

// ─── Lokasyon yönetimi ────────────────────────────────────────────────────────

export async function listLocations() {
  return prisma.location.findMany({ orderBy: { name: 'asc' } });
}

export async function createLocation(input: AdminCreateLocationInput) {
  return prisma.location.create({ data: input });
}

export async function updateLocation(id: string, input: AdminUpdateLocationInput) {
  const loc = await prisma.location.findUnique({ where: { id } });
  if (!loc) throw new AppError(404, 'Lokasyon bulunamadı');
  return prisma.location.update({ where: { id }, data: input });
}

export async function deleteLocation(id: string) {
  const used = await prisma.priceMatrix.findFirst({
    where: { OR: [{ fromLocationId: id }, { toLocationId: id }] },
  });
  if (used) throw new AppError(409, 'Bu lokasyon fiyat matrisinde kullanılıyor, önce fiyatları silin');
  await prisma.location.delete({ where: { id } });
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
      fromLocation: { select: { id: true, name: true } },
      toLocation:   { select: { id: true, name: true } },
      vehicleClass: { select: { id: true, name: true } },
    },
    orderBy: [{ fromLocation: { name: 'asc' } }, { vehicleClass: { capacity: 'asc' } }],
  });
}

export async function upsertPriceMatrix(input: AdminUpdatePriceMatrixInput) {
  const { fromLocationId, toLocationId, vehicleClassId, ...data } = input;
  return prisma.priceMatrix.upsert({
    where: { fromLocationId_toLocationId_vehicleClassId: { fromLocationId, toLocationId, vehicleClassId } },
    update: data,
    create: input,
  });
}

export async function deletePriceMatrix(id: string) {
  await prisma.priceMatrix.delete({ where: { id } });
}

// ─── Surcharge (zamlar) ───────────────────────────────────────────────────────

export async function listSurcharges() {
  return prisma.priceSurcharge.findMany({ orderBy: { createdAt: 'asc' } });
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

// ─── Kullanıcı yönetimi ───────────────────────────────────────────────────────

export async function listUsers(role?: string) {
  return prisma.user.findMany({
    where:   role ? { role: role as any } : undefined,
    select:  {
      id: true, email: true, firstName: true, lastName: true,
      phone: true, role: true, isActive: true, createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
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
  const secretJson = input.secrets ? encrypt(JSON.stringify(input.secrets)) : undefined;
  const configJson = input.config  ? JSON.stringify(input.config) : undefined;

  const existing = await prisma.integrationSetting.findUnique({ where: { service: input.service } });

  if (existing) {
    return prisma.integrationSetting.update({
      where: { service: input.service },
      data:  {
        provider:   input.provider  ?? undefined,
        isActive:   input.isActive  ?? undefined,
        configJson: configJson      ?? undefined,
        secretJson: secretJson      ?? undefined,
      },
      select: { id: true, service: true, provider: true, isActive: true, updatedAt: true },
    });
  }

  return prisma.integrationSetting.create({
    data:   {
      service:    input.service,
      provider:   input.provider ?? '',
      isActive:   input.isActive ?? true,
      configJson: configJson,
      secretJson: secretJson,
    },
    select: { id: true, service: true, provider: true, isActive: true, updatedAt: true },
  });
}

export async function deleteIntegration(id: string) {
  const row = await prisma.integrationSetting.findUnique({ where: { id } });
  if (!row) throw new AppError(404, 'Entegrasyon bulunamadı');

  // Redis cache'i temizle
  await redis.del(`integration:${row.service}`);
  await prisma.integrationSetting.delete({ where: { id } });
}
