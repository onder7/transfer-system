import nodemailer                from 'nodemailer';
import { prisma }               from '../config/database.js';
import { getIntegration }       from './config.service.js';
import { logger }               from '../config/logger.js';
import type { NotificationChannel } from '@prisma/client';

export async function queueNotification(opts: {
  bookingId?: string;
  channel:    NotificationChannel;
  recipient:  string;
  subject?:   string;
  body:       string;
}) {
  const notification = await prisma.notification.create({
    data: { ...opts, status: 'QUEUED' },
  });

  // Anlık gönderim dene — başarısız olursa QUEUED kalır, cron retry'lar
  setImmediate(() => void sendNotification(notification.id));
  return notification;
}

async function sendNotification(id: string) {
  const n = await prisma.notification.findUnique({ where: { id } });
  if (!n || n.status === 'SENT') return;

  try {
    if (n.channel === 'EMAIL') await sendEmail(n.recipient, n.subject ?? '', n.body);
    // SMS / WhatsApp: ilerleyen fazlarda ConfigService üzerinden eklenir
    else return; // Henüz desteklenmiyor, QUEUED bırak

    await prisma.notification.update({
      where: { id },
      data:  { status: 'SENT', sentAt: new Date() },
    });
  } catch (err) {
    logger.warn({ err, notificationId: id }, 'Bildirim gönderilemedi');
    await prisma.notification.update({
      where: { id },
      data:  { status: 'FAILED', errorMsg: String(err) },
    });
  }
}

async function sendEmail(to: string, subject: string, html: string) {
  const cfg = await getIntegration('smtp');
  if (!cfg) {
    logger.warn('SMTP ayarı bulunamadı, mail gönderilmedi');
    return;
  }

  const transport = nodemailer.createTransport({
    host:   cfg.config.host as string,
    port:   Number(cfg.config.port ?? 587),
    secure: Boolean(cfg.config.secure ?? false),
    auth:   { user: cfg.secrets.user, pass: cfg.secrets.pass },
  });

  await transport.sendMail({
    from:    cfg.config.from as string ?? cfg.secrets.user,
    to,
    subject,
    html,
  });
}

// Rezervasyon onay maili içeriği
export function bookingConfirmationHtml(booking: {
  bookingRef: string;
  guestName?: string | null;
  transferDate: Date;
  fromLocation: { name: string };
  toLocation:   { name: string };
  price: unknown;
  currency: string;
}) {
  return `
    <h2>Rezervasyonunuz Onaylandı</h2>
    <p>Sayın ${booking.guestName ?? 'Müşterimiz'},</p>
    <p>Rezervasyon referansınız: <strong>${booking.bookingRef}</strong></p>
    <ul>
      <li>Güzergah: ${booking.fromLocation.name} → ${booking.toLocation.name}</li>
      <li>Tarih: ${new Date(booking.transferDate).toLocaleString('tr-TR')}</li>
      <li>Tutar: ${booking.price} ${booking.currency}</li>
    </ul>
    <p>Güvenli yolculuklar dileriz.</p>
  `;
}
