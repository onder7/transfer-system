import webpush from 'web-push';
import { prisma } from '../config/database.js';
import { env }    from '../config/env.js';
import { logger } from '../config/logger.js';

// VAPID yapılandırması — anahtarlar .env'de; tanımlı değilse push devre dışı kalır.
const pushEnabled = !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
if (pushEnabled) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
  logger.info('🔔 Web Push etkin');
} else {
  logger.warn('🔕 VAPID anahtarları yok — Web Push devre dışı');
}

export function isPushEnabled() { return pushEnabled; }
export function getVapidPublicKey() { return env.VAPID_PUBLIC_KEY ?? null; }

interface SubInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

// Tarayıcı aboneliğini kaydet (endpoint benzersiz → upsert)
export async function saveSubscription(sub: SubInput, bookingId?: string, userAgent?: string) {
  return prisma.pushSubscription.upsert({
    where:  { endpoint: sub.endpoint },
    update: { bookingId: bookingId ?? null, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent },
    create: { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, bookingId: bookingId ?? null, userAgent },
  });
}

export interface PushPayload {
  title: string;
  body:  string;
  url?:  string;   // tıklanınca açılacak sayfa
  tag?:  string;
}

// Bir rezervasyona bağlı tüm aboneliklere push gönder. Süresi dolan (404/410) abonelikleri siler.
export async function sendToBooking(bookingId: string, payload: PushPayload): Promise<number> {
  if (!pushEnabled) return 0;

  const subs = await prisma.pushSubscription.findMany({ where: { bookingId } });
  if (!subs.length) return 0;

  const data = JSON.stringify(payload);
  let sent = 0;

  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        data,
      );
      sent++;
    } catch (err: any) {
      const code = err?.statusCode;
      if (code === 404 || code === 410) {
        // Abonelik geçersiz → temizle
        await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
      } else {
        logger.warn({ err, endpoint: s.endpoint }, 'Push gönderilemedi');
      }
    }
  }));

  logger.info({ bookingId, sent, total: subs.length }, 'Push gönderildi');
  return sent;
}
