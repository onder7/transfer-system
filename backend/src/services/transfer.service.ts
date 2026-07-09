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
  const cacheKey = `search:${input.fromLocationId}:${input.toLocationId}:${input.currency}:${new Date(input.transferDate).getHours()}`;

  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as TransferResult[];

  const [prices, surcharges] = await Promise.all([
    prisma.priceMatrix.findMany({
      where: {
        fromLocationId: input.fromLocationId,
        toLocationId:   input.toLocationId,
      },
      include: {
        vehicleClass: {
          select: { id: true, name: true, nameEn: true, capacity: true, features: true, imageUrl: true },
        },
      },
    }),
    prisma.priceSurcharge.findMany({ where: { isActive: true } }),
  ]);

  if (!prices.length) {
    throw new AppError(404, 'Bu güzergah için fiyat bulunamadı');
  }

  const transferDate = new Date(input.transferDate);
  const multiplier   = calcMultiplier(surcharges, transferDate);

  const results: TransferResult[] = prices.map((p) => {
    const base       = Number(p.basePrice) * multiplier;
    const returnDisc = Number(p.returnDiscount) / 100;
    const returnPrice = input.returnFlight
      ? +(base * 2 * (1 - returnDisc)).toFixed(2)
      : null;

    return {
      vehicleClass:     p.vehicleClass,
      price:            +base.toFixed(2),
      returnPrice,
      currency:         'TRY' as const,
      surchargeApplied: multiplier > 1,
      multiplier,
      returnDiscount:   input.returnFlight ? p.returnDiscount : null,
    };
  });

  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(results));
  return results;
}

export interface TransferResult {
  vehicleClass:     { id: string; name: string; nameEn: string | null; capacity: number; features: string[]; imageUrl: string | null };
  price:            number;
  returnPrice:      number | null;
  currency:         'TRY';
  surchargeApplied: boolean;
  multiplier:       number;
  returnDiscount:   unknown;
}
