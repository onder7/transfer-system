import { prisma }                              from '../config/database.js';
import { AppError }                           from '../middlewares/error.middleware.js';
import { validateCoupon }                     from './coupon.service.js';
import { queueNotification, bookingConfirmationHtml, bookingReceivedHtml } from './notification.service.js';
import { autoAssignBooking }                  from './driver.service.js';
import { estimateDurationMin }                 from './route-estimate.service.js';
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

  // 2. Minimum ileriye dönük rezervasyon kontrolü
  const transferDate = new Date(data.transferDate);
  const advanceSetting = await prisma.systemSetting.findUnique({ where: { key: 'min_advance_minutes' } });
  const minAdvanceMin  = parseInt(advanceSetting?.value ?? '60', 10);
  const earliestAllowed = new Date(Date.now() + minAdvanceMin * 60_000);
  if (transferDate < earliestAllowed) {
    const h = Math.floor(minAdvanceMin / 60);
    const m = minAdvanceMin % 60;
    const label = h > 0 ? (m > 0 ? `${h} saat ${m} dakika` : `${h} saat`) : `${m} dakika`;
    throw new AppError(400, `Rezervasyon en az ${label} sonrası için yapılabilir.`);
  }

  // 3. Lokasyonlar var mı?
  const [fromLoc, toLoc, vehicleClass] = await Promise.all([
    prisma.location.findUnique({ where: { id: data.fromLocationId } }),
    prisma.location.findUnique({ where: { id: data.toLocationId } }),
    prisma.vehicleClass.findUnique({ where: { id: data.vehicleClassId } }),
  ]);
  if (!fromLoc)      throw new AppError(404, 'Kalkış noktası bulunamadı');
  if (!toLoc)        throw new AppError(404, 'Varış noktası bulunamadı');
  if (!vehicleClass) throw new AppError(404, 'Araç sınıfı bulunamadı');

  const totalPassengers = data.adultCount + data.childCount;
  if (totalPassengers > vehicleClass.capacity) {
    throw new AppError(400, `Bu araç en fazla ${vehicleClass.capacity} kişi taşıyabilir`);
  }

  // 4. Slot çakışma kontrolü — buffer sistem ayarından okunur
  const turnaroundSetting = await prisma.systemSetting.findUnique({
    where: { key: 'vehicle_turnaround_minutes' },
  });
  const bufferMs = (turnaroundSetting ? Number(turnaroundSetting.value) : 120) * 60_000;
  const slotFrom = new Date(transferDate.getTime() - bufferMs);
  const slotTo   = new Date(transferDate.getTime() + bufferMs);

  if (vehicleClass.isShared) {
    // Paylaşımlı araç: aynı güzergah + saat kalan kapasite kontrolü
    const activeForSlot = await prisma.booking.findMany({
      where: {
        fromLocationId: data.fromLocationId,
        toLocationId:   data.toLocationId,
        vehicleClassId: data.vehicleClassId,
        transferDate:   transferDate,
        status:         { notIn: ['CANCELLED', 'COMPLETED'] },
      },
      select: { adultCount: true, childCount: true },
    });
    const occupied  = activeForSlot.reduce((s, b) => s + b.adultCount + b.childCount, 0);
    const remaining = vehicleClass.capacity - occupied;
    if (remaining < totalPassengers) {
      throw new AppError(409, `Bu tarihte bu araçta yeterli yer yok. Kalan kapasite: ${remaining} kişi.`);
    }
  } else {
    // Özel araç: tüm sınıftaki aktif araç sayısı vs ±4 saat içindeki aktif rezervasyon sayısı
    const [vehicleCount, bookedCount] = await Promise.all([
      prisma.vehicle.count({
        where: { vehicleClassId: data.vehicleClassId, isActive: true },
      }),
      prisma.booking.count({
        where: {
          vehicleClassId: data.vehicleClassId,
          transferDate:   { gte: slotFrom, lte: slotTo },
          status:         { notIn: ['CANCELLED', 'COMPLETED'] },
        },
      }),
    ]);

    if (bookedCount >= vehicleCount) {
      const msg = vehicleCount === 0
        ? `Bu araç sınıfında kayıtlı aktif araç bulunmuyor.`
        : `Bu saatte ${vehicleClass.name} sınıfında tüm araçlar dolu (${vehicleCount} araç, ${bookedCount} aktif rezervasyon). Lütfen farklı bir saat seçin.`;
      throw new AppError(409, msg);
    }
  }

  // 5. Fiyat — backend'de tekrar hesapla, client'a güvenme
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

  const multiplier = calcMultiplier(surcharges, transferDate);
  const baseUnit = Number(priceRow.basePrice) * multiplier;
  // Paylaşımlı araç → kişi başı; özel → araç başı
  let price = vehicleClass.isShared
    ? +(baseUnit * totalPassengers).toFixed(2)
    : +baseUnit.toFixed(2);

  if (data.returnFlight) {
    const disc = Number(priceRow.returnDiscount) / 100;
    price = +(price * 2 * (1 - disc)).toFixed(2);
  }

  // 5b. Ekstra hizmetler — birim fiyatı DB'den al, client'a güvenme
  const resolvedExtras: { extraServiceId: string; quantity: number; unitPrice: number; note?: string }[] = [];
  if (data.extras?.length) {
    const ids     = [...new Set(data.extras.map((e) => e.extraServiceId))];
    const records = await prisma.extraService.findMany({ where: { id: { in: ids }, isActive: true } });
    const byId    = new Map(records.map((r) => [r.id, r]));

    for (const sel of data.extras) {
      const svc = byId.get(sel.extraServiceId);
      if (!svc) throw new AppError(404, 'Seçilen ekstra hizmet bulunamadı veya pasif');

      const unit     = Number(svc.price);
      const quantity =
        svc.priceType === 'FLAT'       ? 1
        : svc.priceType === 'PER_PERSON' ? totalPassengers
        : Math.min(sel.quantity, svc.maxQuantity);

      price += +(unit * quantity).toFixed(2);
      resolvedExtras.push({
        extraServiceId: svc.id,
        quantity,
        unitPrice: unit,
        note: sel.note?.trim() || undefined,
      });
    }
    price = +price.toFixed(2);
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

  // 5b. Gidiş-dönüş: dönüş tarihi zorunlu ve gidişten sonra olmalı
  let returnDateObj: Date | null = null;
  if (data.returnFlight) {
    if (!data.returnDate) {
      throw new AppError(400, 'Gidiş-dönüş transfer için dönüş tarihi ve saati zorunludur.');
    }
    returnDateObj = new Date(data.returnDate);
    if (isNaN(returnDateObj.getTime())) {
      throw new AppError(400, 'Dönüş tarihi geçersiz.');
    }
    if (returnDateObj <= transferDate) {
      throw new AppError(400, 'Dönüş tarihi, gidiş tarihinden sonra olmalıdır.');
    }
  }

  // 5c. Harita tahmini yolculuk süresi — çakışma penceresi otomatik hesabında kullanılır.
  // Serbest adres koordinatı varsa onu, yoksa lokasyon koordinatını kullan.
  const fromLat = data.customFromLat ?? fromLoc.lat;
  const fromLng = data.customFromLng ?? fromLoc.lng;
  const toLat   = data.customToLat   ?? toLoc.lat;
  const toLng   = data.customToLng   ?? toLoc.lng;
  const estimatedDurationMin = await estimateDurationMin(fromLat, fromLng, toLat, toLng);

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
        estimatedDurationMin,
        adultCount:      data.adultCount,
        childCount:      data.childCount,
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

    // Ekstra hizmet satırları (birim fiyat snapshot'lı)
    if (resolvedExtras.length) {
      await tx.bookingExtra.createMany({
        data: resolvedExtras.map((e) => ({ ...e, bookingId: booking.id })),
      });
    }

    // Dönüş bacağı — AYRI rezervasyon (ters güzergah, kendi tarihi).
    // Ücret gidiş kaydında tutulur (tek Payment) → gelir çift sayılmaz.
    if (returnDateObj) {
      await tx.booking.create({
        data: {
          customerId:      userId ?? null,
          guestEmail:      data.guestEmail,
          guestPhone:      data.guestPhone,
          guestName:       data.guestName,
          // Güzergah ters çevrilir
          fromLocationId:  data.toLocationId,
          toLocationId:    data.fromLocationId,
          customFromAddress: data.customToAddress,
          customFromLat:   data.customToLat,
          customFromLng:   data.customToLng,
          customToAddress: data.customFromAddress,
          customToLat:     data.customFromLat,
          customToLng:     data.customFromLng,
          vehicleClassId:  data.vehicleClassId,
          transferDate:    returnDateObj,
          estimatedDurationMin,         // ters güzergah, aynı tahmini süre
          adultCount:      data.adultCount,
          childCount:      data.childCount,
          flightNumber:    data.returnFlightNo,
          returnFlight:    false,          // dönüş bacağının kendisi tek yön
          extraRequests:   data.extraRequests,
          price:           0,              // ücret gidiş kaydında
          currency:        data.currency ?? 'TRY',
          status:          'PENDING',
          outboundId:      booking.id,     // gidişe bağla
        },
      });
    }

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

  // Rezervasyon alındı emaili (ödeme onayından bağımsız, anında gönderilir)
  const { booking } = result;
  const recipient = booking.guestEmail ?? (data as any).email ?? null;
  if (recipient) {
    void queueNotification({
      bookingId: booking.id,
      channel:   'EMAIL',
      recipient,
      subject:   `Rezervasyon Alındı — ${booking.bookingRef}`,
      body:      bookingReceivedHtml({
        bookingRef:   booking.bookingRef,
        guestName:    booking.guestName,
        transferDate: booking.transferDate,
        fromLocation: booking.fromLocation,
        toLocation:   booking.toLocation,
        price:        booking.price,
        currency:     booking.currency,
      }),
    });
  }

  return { ...result, isNew: true };
}

// ─── Müşteri rezervasyon listesi ─────────────────────────────────────────────

export async function getMyBookings(userId: string, userEmail?: string) {
  return prisma.booking.findMany({
    where: {
      OR: [
        { customerId: userId },
        ...(userEmail ? [{ guestEmail: userEmail, customerId: null }] : []),
      ],
    },
    orderBy: { createdAt: 'desc' },
    include: {
      fromLocation: { select: { name: true } },
      toLocation:   { select: { name: true } },
      vehicleClass: { select: { name: true } },
      payment:      { select: { status: true } },
      assignment: {
        select: {
          status: true,
          vehiclePlate: true,
          driver: { select: { firstName: true, lastName: true } },
        },
      },
      flightInfo: { select: { status: true, delayMinutes: true, estimatedAt: true } },
    },
  });
}

// ─── Rezervasyon detayı ───────────────────────────────────────────────────────

export async function getBooking(id: string, userId?: string, isAdmin = false) {
  const booking = await prisma.booking.findUnique({
    where:   { id },
    include: {
      fromLocation: true,
      toLocation:   true,
      // id gerekli: cancelBooking iade güncellemesinde payment.id kullanıyor
      payment:      { select: { id: true, status: true, method: true, amount: true, refundAmount: true } },
      assignment:   { include: { driver: { select: { firstName: true, lastName: true, phone: true } } } },
      flightInfo:   true,
      customer:     { select: { email: true } },
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
  const booking = await prisma.booking.findFirst({
    where: { OR: [{ bookingRef: ref }, { id: ref }] },
    include: {
      fromLocation: true,
      toLocation:   true,
      vehicleClass: { select: { name: true } },
      payment:      { select: { status: true, method: true } },
      flightInfo:   true,
      assignment: {
        select: {
          status: true,
          vehiclePlate: true,
          driver: { select: { firstName: true, lastName: true, phone: true } },
        },
      },
    },
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

    // Gidiş iptal edilirse bağlı dönüş bacağı da iptal edilir
    await tx.booking.updateMany({
      where: { outboundId: id, status: { notIn: ['CANCELLED', 'COMPLETED'] } },
      data:  { status: 'CANCELLED' },
    });

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
    include: { fromLocation: true, toLocation: true, customer: { select: { email: true } } },
  });

  // Gidiş onaylandıysa dönüş bacağı da onaylanır (ödeme gidişte tutulur)
  await prisma.booking.updateMany({
    where: { outboundId: bookingId, status: 'PENDING' },
    data:  { status: 'CONFIRMED' },
  });

  const recipient = booking.guestEmail ?? booking.customer?.email ?? null;
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

  // Onay sonrası otomatik araç+şoför atama denemesi (başarısız olursa CONFIRMED'da kalır)
  await autoAssignBooking(booking.id);

  return booking;
}
