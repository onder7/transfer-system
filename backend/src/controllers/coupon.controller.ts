import type { Request, Response, NextFunction } from 'express';
import { ValidateCouponSchema }                from '@transfer/shared';
import { validateCoupon }                      from '../services/coupon.service.js';
import { prisma }                              from '../config/database.js';
import { AppError }                            from '../middlewares/error.middleware.js';

export async function validateCouponHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { code, fromLocationId, toLocationId, vehicleClassId, currency } =
      ValidateCouponSchema.parse(req.body);

    // Fiyatı bul (kupon hesabı için referans tutar)
    const priceRow = await prisma.priceMatrix.findUnique({
      where: {
        fromLocationId_toLocationId_vehicleClassId: {
          fromLocationId, toLocationId, vehicleClassId,
        },
      },
    });
    if (!priceRow) throw new AppError(404, 'Bu güzergah için fiyat bulunamadı');

    const result = await validateCoupon(code, Number(priceRow.basePrice));
    res.json({
      valid:          true,
      discountType:   result.coupon.discountType,
      discountAmount: result.discountAmount,
      finalAmount:    result.finalAmount,
      currency:       currency ?? 'TRY',
    });
  } catch (e) { next(e); }
}
