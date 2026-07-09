import { prisma }                              from '../config/database.js';
import { AppError }                           from '../middlewares/error.middleware.js';
import { validateCoupon }                     from './coupon.service.js';
import { queueNotification, bookingConfirmationHtml } from './notification.service.js';
import type { CreateBookingInput }            from '@transfer/shared';
import type { PriceSurcharge, BookingStatus } from '@prisma/client';

// ─── Fiyat surcharge hesabı (transfer.service ile aynı mantık) ───────────────

function calcMultiplier(surcharges: PriceSurcharge[], date: Date): number {
  const hour = date.getHours();
  let m = 1;
  for (const s of surcharges) {
    if (s.startHour !== null && s.endHour !== null) {
      const night = s.startHour > s.endHour
        ? hour >= s.startHour || hour < s.endHour
        : hour >= s.startHour && hour < s.endHour;
      if (night) m = Math.max(m, Number(s.multiplier));
    }
    if (s.startDate && s.endDate) {
      if (date >= s.startDate && date <= s.endDate) m = Math.max(m, Number(s.multiplier));
    }
  }
  return m;
}

// ─── İptal iade politikası ────────────────────────────────────────────────────

export function calcRefundAmount(transferDate: Date, paymentAmount: number): number {
  const hours = (transferDate.getTime() - Date.now()) / 3_600_000;
  if (hours >= 48) return paymentAmount;          // %100
  if (hours >= 24) return +(paymentAmount * 0.5).toFixed(2); // %50
  return 0;                                       // İade yok
}

// ─── Rezervasyon oluşturma ────────────────────────────────────────────────────

export async function createBooking(
  data: CreateBookingInput,
  userId?: string,
) {
  // 1. Idempotency — aynı key tekrar gelirse mevcut kaydı dön
  const existing = await prisma.payment.findUnique({
    where:   { idempotencyKey: data.idempotencyKey },
    include: { booking: true },
  });
  if (existing) return { booking: existing.booking, payment: existing, isNew: false };

  // 2. Lokasyonlar var mı?
  const [fromLoc, toLoc, vehicleClass] = await Promise.all([
    prisma.location.findUnique({ where: { id: data.fromLocationId } }),
    prisma.location.findUnique({ where: { id: data.toLocationId } }),
    prisma.vehicleClass.findUnique({ where: { id: data.vehicleClassId } }),
  ]);
  if (!fromLoc)     throw new AppError(404, 'Kalkış noktası bulunamadı');
  if (!toLoc)       throw new AppError(404, 'Varış noktası bulunamadı');
  if (!vehicleClass) throw new AppError(404, 'Araç sınıfı bulunamadı');

  // 3. Fiyat — backend'de tekrar hesapla, client'a güvenme
  const [priceRow, surcharges] = await Promise.all([
    prisma.priceMatrix.findUnique({
      where: {
        fromLocationId_toLocationId_vehicleClassId: {
          fromLocationId: data.fromLocationId,
          toLocationId:   data.toLocationId,
          vehicleClassId: data.vehicleClassId,
        },
      },
    }),
    prisma.priceSurcharge.findMany({ where: { isActive: true } }),
  ]);
  if (!priceRow) throw new AppError(404, 'Bu güzergah için fiyat tanımlı değil');

  const transferDate = new Date(data.transferDate);
  const multiplier   = calcMultiplier(surcharges, transferDate);
  let   price        = +( Number(priceRow.basePrice) * multiplier ).toFixed(2);

  if (data.returnFlight) {
    const disc = Number(priceRow.returnDiscount) / 100;
    price = +(price * 2 * (1 - disc)).toFixed(2);
  }

  // 4. Kupon
  let discountAmount = 0;
  let couponId: string | undefined;
  if (data.couponCode) {
    const cv     = await validateCoupon(data.couponCode, price);
    discountAmount = cv.discountAmount;
    price          = cv.finalAmount;
    couponId       = cv.coupon.id;
  }

  // 5. Atomik oluşturma
  const result = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.create({
      data: {
        customerId:      userId ?? null,
        guestEmail:      data.guestEmail,
        guestPhone:      data.guestPhone,
        guestName:       data.guestName,
        fromLocationId:  data.fromLocationId,
        toLocationId:    data.toLocationId,
        customFromAddress: data.customFromAddress,
        customFromLat:   data.customFromLat,
        customFromLng:   data.customFromLng,
        customToAddress: data.customToAddress,
        customToLat:     data.customToLat,
        customToLng:     data.customToLng,
        vehicleClassId:  data.vehicleClassId,
        transferDate,
        passengerCount:  data.passengerCount,
        flightNumber:    data.flightNumber,
        returnFlight:    data.returnFlight,
        returnFlightNo:  data.returnFlightNo,
        returnDate:      data.returnDate ? new Date(data.returnDate) : null,
        extraRequests:   data.extraRequests,
        price,
        currency:        data.currency ?? 'TRY',
        couponId,
        discountAmount:  discountAmount > 0 ? discountAmount : null,
        status:          'PENDING',
      },
      include: { fromLocation: true, toLocation: true },
    });

    const payment = await tx.payment.create({
      data: {
        bookingId:      booking.id,
        amount:         price,
        currency:       data.currency ?? 'TRY',
        method:         'ONLINE',
        status:         'PENDING',
        idempotencyKey: data.idempotencyKey,
      },
    });

    // Kupon kullanıldı
    if (couponId) {
      await tx.coupon.update({ where: { id: couponId }, data: { usedCount: { increment: 1 } } });
    }

    return { booking, payment };
  });

  return { ...result, isNew: true };
}

// ─── Rezervasyon detayı ───────────────────────────────────────────────────────

export async function getBooking(id: string, userId?: string, isAdmin = false) {
  const booking = await prisma.booking.findUnique({
    where:   { id },
    include: {
      fromLocation: true,
      toLocation:   true,
      payment:      true,
      assignment:   { include: { driver: { select: { firstName: true, lastName: true, phone: true } } } },
      flightInfo:   true,
    },
  });

  if (!booking) throw new AppError(404, 'Rezervasyon bulunamadı');

  // Yetki: admin ya da rezervasyonu oluşturan kişi görebilir
  if (!isAdmin && booking.customerId && booking.customerId !== userId) {
    throw new AppError(403, 'Bu rezervasyona erişim yetkiniz yok');
  }

  return booking;
}

export async function getBookingByRef(ref: string) {
  const booking = await prisma.booking.findUnique({
    where:   { bookingRef: ref },
    include: { fromLocation: true, toLocation: true, payment: true, flightInfo: true },
  });
  if (!booking) throw new AppError(404, 'Rezervasyon bulunamadı');
  return booking;
}

// ─── İptal ───────────────────────────────────────────────────────────────────

export async function cancelBooking(id: string, userId?: string, isAdmin = false) {
  const booking = await getBooking(id, userId, isAdmin);

  const nonCancellable: BookingStatus[] = ['COMPLETED', 'CANCELLED'];
  if (nonCancellable.includes(booking.status)) {
    throw new AppError(400, `${booking.status} durumundaki rezervasyon iptal edilemez`);
  }

  const payment      = booking.payment;
  const refundAmount = payment?.status === 'PAID'
    ? calcRefundAmount(booking.transferDate, Number(payment.amount))
    : 0;

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({ where: { id }, data: { status: 'CANCELLED' } });

    if (payment && refundAmount > 0) {
      await tx.payment.update({
        where: { id: payment.id },
        data:  { status: 'REFUNDED', refundedAt: new Date(), refundAmount },
      });
    }
  });

  // Bildirim gönder
  const recipient = booking.customer?.email ?? booking.guestEmail;
  if (recipient) {
    await queueNotification({
      bookingId: id,
      channel:   'EMAIL',
      recipient,
      subject:   `Rezervasyon İptal — ${booking.bookingRef}`,
      body:      `<p>Rezervasyonunuz (${booking.bookingRef}) iptal edildi. İade tutarı: ${refundAmount} TRY</p>`,
    });
  }

  return { refundAmount, policy: refundAmount === 0 ? 'no_refund' : refundAmount === Number(payment?.amount) ? 'full' : 'partial' };
}

// ─── Booking onaylandığında çağrılır (PayTR callback'ten) ─────────────────────

export async function confirmBooking(bookingId: string) {
  const booking = await prisma.booking.update({
    where:   { id: bookingId },
    data:    { status: 'CONFIRMED' },
    include: { fromLocation: true, toLocation: true },
  });

  const recipient = booking.guestEmail;
  if (recipient) {
    await queueNotification({
      bookingId: booking.id,
      channel:   'EMAIL',
      recipient,
      subject:   `Rezervasyon Onaylandı — ${booking.bookingRef}`,
      body:      bookingConfirmationHtml({
        bookingRef:  booking.bookingRef,
        guestName:   booking.guestName,
        transferDate: booking.transferDate,
        fromLocation: booking.fromLocation,
        toLocation:   booking.toLocation,
        price:       booking.price,
        currency:    booking.currency,
      }),
    });
  }

  return booking;
}
