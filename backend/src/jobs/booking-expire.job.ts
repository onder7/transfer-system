import { prisma }  from '../config/database.js';
import { logger }  from '../config/logger.js';
import { cancelBooking } from '../services/booking.service.js';

let timer: ReturnType<typeof setInterval> | null = null;

async function getTimeoutMin(key: string, fallback: number): Promise<number> {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  return row ? parseInt(row.value, 10) || fallback : fallback;
}

async function expireBookings() {
  try {
    const [cashMin, bankMin] = await Promise.all([
      getTimeoutMin('cash_confirm_timeout_min', 60),
      getTimeoutMin('bank_confirm_timeout_min', 720),
    ]);

    const now = Date.now();

    // Araçta ödeme — admin onaylamadıysa iptal
    const cashCutoff = new Date(now - cashMin * 60_000);
    const expiredCash = await prisma.booking.findMany({
      where: {
        status:  'PENDING',
        payment: { method: 'CASH_ON_DELIVERY' },
        createdAt: { lt: cashCutoff },
      },
      select: { id: true, bookingRef: true },
    });

    // Havale/EFT — ödeme alınmadıysa iptal
    const bankCutoff = new Date(now - bankMin * 60_000);
    const expiredBank = await prisma.booking.findMany({
      where: {
        status:  'PENDING',
        payment: { method: 'BANK_TRANSFER', status: 'PENDING' },
        createdAt: { lt: bankCutoff },
      },
      select: { id: true, bookingRef: true },
    });

    for (const b of [...expiredCash, ...expiredBank]) {
      try {
        await cancelBooking(b.id, undefined, true);
        logger.info({ bookingRef: b.bookingRef }, 'Otomatik iptal: süre doldu');
      } catch (err) {
        logger.error({ err, bookingId: b.id }, 'Otomatik iptal başarısız');
      }
    }
  } catch (err) {
    logger.error({ err }, 'Expire job hatası');
  }
}

export function startBookingExpireJob() {
  // Her 5 dakikada bir kontrol et
  timer = setInterval(expireBookings, 5 * 60_000);
  // İlk çalıştırma — sunucu başlayınca bir kez de hemen yap
  expireBookings();
  logger.info('Rezervasyon expire job başlatıldı (5 dk aralık)');
}

export function stopBookingExpireJob() {
  if (timer) { clearInterval(timer); timer = null; }
}
