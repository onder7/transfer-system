import { prisma }                        from '../config/database.js';
import { redis }                         from '../config/redis.js';
import { AppError }                      from '../middlewares/error.middleware.js';
import type { SearchTransferInput }      from '@transfer/shared';
import type { PriceSurcharge, ChildPriceRule } from '@prisma/client';

const CACHE_TTL = 600; // 10 dakika

// ─── Zam katsayısı hesabı ────────────────────────────────────────────────────

function calcMultiplier(surcharges: PriceSurcharge[], date: Date): number {
  const hour = date.getHours();
  let multiplier = 1;

  for (const s of surcharges) {
    // Gece zammı
    if (s.startHour !== null && s.endHour !== null) {
      const isNight = s.startHour > s.endHour
        ? hour >= s.startHour || hour < s.endHour   // örn 22-06 gece geçişi
        : hour >= s.startHour && hour < s.endHour;
      if (isNight) multiplier = Math.max(multiplier, Number(s.multiplier));
    }
    // Sezon zammı
    if (s.startDate && s.endDate) {
      if (date >= s.startDate && date <= s.endDate) {
        multiplier = Math.max(multiplier, Number(s.multiplier));
      }
    }
  }
  return multiplier;
}

// ─── Filo (araç sınıfları) — fiyatsız, public listeleme ──────────────────────

export async function listFleet() {
  return prisma.vehicleClass.findMany({
    where:   { isActive: true },
    select: {
      id: true, name: true, nameEn: true,
      capacity: true, luggageCapacity: true, isShared: true,
      features: true, imageUrl: true,
    },
    orderBy: { capacity: 'asc' },
  });
}

// ─── Transfer arama ───────────────────────────────────────────────────────────

export async function searchTransfers(input: SearchTransferInput) {
  const totalPassengers = input.adultCount + input.childCount;
  const hour            = new Date(input.transferDate).getHours();
  const cacheKey        = `search:${input.fromLocationId}:${input.toLocationId}:${input.currency}:${hour}`;

  // Fiyatları yükle — önce doğrudan yön, bulamazsa ters yönü dene
  const fetchPrices = (fromId: string, toId: string) =>
    prisma.priceMatrix.findMany({
      where: { fromLocationId: fromId, toLocationId: toId },
      include: {
        vehicleClass: {
          select: {
            id: true, name: true, nameEn: true,
            capacity: true, luggageCapacity: true, isShared: true,
            features: true, imageUrl: true,
          },
        },
      },
    });

  const cached = await redis.get(cacheKey);
  let prices: Awaited<ReturnType<typeof fetchPrices>>;

  if (cached) {
    prices = JSON.parse(cached);
  } else {
    prices = await fetchPrices(input.fromLocationId, input.toLocationId);

    // Ters yön — AIRPORT_TO_REGION ↔ REGION_TO_AIRPORT güzergahları için
    if (!prices.length) {
      prices = await fetchPrices(input.toLocationId, input.fromLocationId);
    }

    if (!prices.length) {
      throw new AppError(404, 'Bu güzergah için fiyat bulunamadı');
    }

    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(prices));
  }

  const [surcharges, childRules] = await Promise.all([
    prisma.priceSurcharge.findMany({ where: { isActive: true } }),
    prisma.childPriceRule.findMany({ where: { isActive: true }, orderBy: { maxAge: 'asc' } }),
  ]);
  const transferDate = new Date(input.transferDate);
  const multiplier   = calcMultiplier(surcharges, transferDate);

  // En düşük indirim yüzdesine sahip aktif kuralı seç (en az cömert kural geçerli)
  // Genellikle tek kural olur; birden fazlaysa en düşük indirimi al
  const childRule    = childRules.length > 0 ? childRules[0] : null;
  const childDisc    = childRule ? childRule.discountPercent / 100 : 0; // 1.0 = ücretsiz
  const adultCount   = input.adultCount;
  const childCount   = input.childCount;

  const results: TransferResult[] = prices
    .filter((p) => p.vehicleClass.capacity >= totalPassengers)
    .map((p) => {
      const basePerUnit = Number(p.basePrice) * multiplier;

      let unitPrice: number;
      let pricePerPerson: number | null = null;
      let childUnitPrice: number | null = null;

      if (p.vehicleClass.isShared) {
        // Paylaşımlı: yetişkin tam fiyat, çocuk indirimli
        const adultTotal = basePerUnit * adultCount;
        const childTotal = childCount > 0 && childRule
          ? basePerUnit * (1 - childDisc) * childCount
          : basePerUnit * childCount;
        unitPrice     = +(adultTotal + childTotal).toFixed(2);
        pricePerPerson = +basePerUnit.toFixed(2);
        childUnitPrice = childCount > 0 && childRule
          ? +( basePerUnit * (1 - childDisc) ).toFixed(2)
          : null;
      } else {
        // Özel: araç başı sabit fiyat — çocuk ek ücret oluşturmaz
        unitPrice      = +basePerUnit.toFixed(2);
        childUnitPrice = childCount > 0 && childRule
          ? +(basePerUnit * (1 - childDisc)).toFixed(2) // informatif — fiyata eklenmez
          : null;
      }

      const returnDisc = Number(p.returnDiscount) / 100;
      // Gidiş-dönüş TOPLAMI — booking.service.createBooking ile birebir aynı formül
      const roundTripTotal = +(unitPrice * 2 * (1 - returnDisc)).toFixed(2);
      // returnPrice = dönüş bacağının EK ücreti. Tüketiciler (web formu, özet kartı,
      // arama listesi) bunu gidiş fiyatına EKLER; böylece price + returnPrice === tahsil
      // edilen toplam olur. Toplamı doğrudan dönmek 3 kat fiyata yol açıyordu.
      const returnPrice = input.returnFlight
        ? +(roundTripTotal - unitPrice).toFixed(2)
        : null;

      return {
        vehicleClass:     p.vehicleClass,
        price:            unitPrice,
        pricePerPerson,
        childUnitPrice,
        childDiscount:    childRule ? childRule.discountPercent : null,
        childLabel:       childRule ? childRule.label : null,
        returnPrice,
        currency:         'TRY' as const,
        surchargeApplied: multiplier > 1,
        multiplier,
        returnDiscount:   input.returnFlight ? p.returnDiscount : null,
      };
    });

  return results;
}

export interface TransferResult {
  vehicleClass: {
    id: string; name: string; nameEn: string | null;
    capacity: number; luggageCapacity: number; isShared: boolean;
    features: string[]; imageUrl: string | null;
  };
  price:            number;
  pricePerPerson:   number | null;  // isShared=true için yetişkin birim fiyat
  childUnitPrice:   number | null;  // çocuk birim fiyatı (indirimli)
  childDiscount:    number | null;  // indirim yüzdesi, ör 100 = ücretsiz
  childLabel:       string | null;  // "Çocuk (0-12 yaş)"
  returnPrice:      number | null;
  currency:         'TRY';
  surchargeApplied: boolean;
  multiplier:       number;
  returnDiscount:   unknown;
}
