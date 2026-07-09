import { prisma }                        from '../config/database.js';
import { redis }                         from '../config/redis.js';
import { AppError }                      from '../middlewares/error.middleware.js';
import type { SearchTransferInput }      from '@transfer/shared';
import type { PriceSurcharge }           from '@prisma/client';

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

  const surcharges   = await prisma.priceSurcharge.findMany({ where: { isActive: true } });
  const transferDate = new Date(input.transferDate);
  const multiplier   = calcMultiplier(surcharges, transferDate);

  const results: TransferResult[] = prices
    .filter((p) => p.vehicleClass.capacity >= totalPassengers) // kapasite filtresi
    .map((p) => {
      const basePerUnit = Number(p.basePrice) * multiplier;
      // Paylaşımlı araç → kişi başı; özel → araç başı
      const unitPrice   = p.vehicleClass.isShared
        ? +(basePerUnit * totalPassengers).toFixed(2)
        : +basePerUnit.toFixed(2);

      const returnDisc  = Number(p.returnDiscount) / 100;
      const returnPrice = input.returnFlight
        ? +(unitPrice * 2 * (1 - returnDisc)).toFixed(2)
        : null;

      return {
        vehicleClass:     p.vehicleClass,
        price:            unitPrice,
        pricePerPerson:   p.vehicleClass.isShared ? +basePerUnit.toFixed(2) : null,
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
  pricePerPerson:   number | null; // isShared=true için birim fiyat
  returnPrice:      number | null;
  currency:         'TRY';
  surchargeApplied: boolean;
  multiplier:       number;
  returnDiscount:   unknown;
}
