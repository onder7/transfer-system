import { prisma }   from '../config/database.js';
import { AppError } from '../middlewares/error.middleware.js';

export async function validateCoupon(code: string, bookingAmount: number) {
  const coupon = await prisma.coupon.findUnique({
    where: { code: code.toUpperCase() },
  });

  if (!coupon || !coupon.isActive)
    throw new AppError(404, 'Geçersiz veya pasif kupon kodu');

  const now = new Date();
  if (coupon.validFrom && now < coupon.validFrom)
    throw new AppError(400, 'Kupon henüz aktif değil');
  if (coupon.validUntil && now > coupon.validUntil)
    throw new AppError(400, 'Kupon süresi dolmuş');
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses)
    throw new AppError(400, 'Kupon kullanım limiti dolmuş');

  const raw = Number(coupon.amount);
  const discount =
    coupon.discountType === 'percent'
      ? bookingAmount * (raw / 100)
      : raw;

  const discountAmount = +Math.min(discount, bookingAmount).toFixed(2);
  const finalAmount    = +Math.max(0, bookingAmount - discountAmount).toFixed(2);

  return { coupon, discountAmount, finalAmount };
}
