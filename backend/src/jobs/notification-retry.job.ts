import { prisma }  from '../config/database.js';
import { logger }  from '../config/logger.js';

let timer: ReturnType<typeof setInterval> | null = null;

async function retryQueuedNotifications() {
  const pending = await prisma.notification.findMany({
    where: { status: 'QUEUED' },
    take: 20,
  });
  if (pending.length === 0) return;

  logger.info({ count: pending.length }, 'QUEUED bildirimler yeniden deneniyor');

  // notification.service içindeki sendNotification'ı doğrudan çağırmak yerine
  // servisi dinamik import ile çekiyoruz (circular dependency önlemi)
  const { processNotification } = await import('../services/notification.service.js');
  for (const n of pending) {
    await processNotification(n.id).catch((err: unknown) =>
      logger.warn({ err, notificationId: n.id }, 'Retry başarısız'),
    );
  }
}

export function startNotificationRetryJob() {
  if (timer) return;
  // Sunucu başlayınca 10 saniye bekle, sonra her 5 dakikada bir çalış
  setTimeout(() => {
    void retryQueuedNotifications();
    timer = setInterval(() => void retryQueuedNotifications(), 5 * 60_000);
  }, 10_000);
  logger.info('Notification retry job başlatıldı');
}

export function stopNotificationRetryJob() {
  if (timer) { clearInterval(timer); timer = null; }
}
