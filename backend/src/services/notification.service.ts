import nodemailer                from 'nodemailer';
import { prisma }               from '../config/database.js';
import { getIntegration }       from './config.service.js';
import { AppError }             from '../middlewares/error.middleware.js';
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
  setImmediate(() => void processNotification(notification.id));
  return notification;
}

export async function processNotification(id: string) {
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

function buildSmtpTransport(cfg: Awaited<ReturnType<typeof getIntegration>> & object) {
  const port = Number(cfg.config.port ?? 587);
  return nodemailer.createTransport({
    host:   cfg.config.host   as string,
    port,
    secure: port === 465,
    auth:   {
      user: cfg.config.user     as string,
      pass: cfg.secrets.password,
    },
  });
}

async function sendEmail(to: string, subject: string, html: string) {
  const cfg = await getIntegration('smtp');
  if (!cfg) {
    logger.warn('SMTP ayarı bulunamadı, mail gönderilmedi');
    return;
  }

  const transport = buildSmtpTransport(cfg);
  await transport.sendMail({
    from:    (cfg.config.from as string) || (cfg.config.user as string),
    to,
    subject,
    html,
  });
}

// ─── Admin SMTP bağlantı testi ────────────────────────────────────────────────

export async function sendTestEmail(to: string): Promise<{ ok: boolean }> {
  const cfg = await getIntegration('smtp');
  if (!cfg) throw new AppError(400, 'SMTP entegrasyonu yapılandırılmamış veya pasif');

  const transport = buildSmtpTransport(cfg);

  // Önce bağlantı doğrula
  await transport.verify().catch((err: Error) => {
    throw new AppError(502, `SMTP bağlantısı kurulamadı: ${err.message}`);
  });

  const fromAddr = (cfg.config.from as string) || (cfg.config.user as string);

  await transport.sendMail({
    from:    fromAddr,
    to,
    subject: '✅ SMTP Test Emaili',
    html: `
      <h2 style="color:#1d4ed8">SMTP Bağlantısı Başarılı</h2>
      <p>Bu email admin panelinden gönderilmiş bir bağlantı testidir.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0">
      <p style="color:#6b7280;font-size:12px">
        Sunucu: <code>${cfg.config.host}:${cfg.config.port}</code><br>
        Kullanıcı: <code>${cfg.config.user}</code><br>
        Gönderen: <code>${fromAddr}</code>
      </p>
    `,
  });

  logger.info({ to }, 'SMTP test emaili gönderildi');
  return { ok: true };
}

// ─── Email şablonları ────────────────────────────────────────────────────────

type BookingEmailData = {
  bookingRef:   string;
  guestName?:   string | null;
  transferDate: Date;
  fromLocation: { name: string };
  toLocation:   { name: string };
  price:        unknown;
  currency:     string;
};

export function bookingReceivedHtml(b: BookingEmailData) {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2 style="color:#1d4ed8">Rezervasyonunuz Alındı</h2>
      <p>Sayın ${b.guestName ?? 'Müşterimiz'},</p>
      <p>Rezervasyon talebiniz başarıyla oluşturuldu. Ödemeniz onaylandıktan sonra rezervasyonunuz kesinleşecektir.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:6px 0;color:#6b7280">Rezervasyon No</td><td style="font-weight:bold">${b.bookingRef}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Güzergah</td><td>${b.fromLocation.name} → ${b.toLocation.name}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Tarih</td><td>${new Date(b.transferDate).toLocaleString('tr-TR')}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Tutar</td><td>${b.price} ${b.currency}</td></tr>
      </table>
      <p style="color:#6b7280;font-size:13px">Sorularınız için bizimle iletişime geçebilirsiniz.</p>
    </div>
  `;
}

export function bookingConfirmationHtml(b: BookingEmailData) {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2 style="color:#16a34a">Rezervasyonunuz Onaylandı</h2>
      <p>Sayın ${b.guestName ?? 'Müşterimiz'},</p>
      <p>Ödemeniz alındı, rezervasyonunuz kesinleşti. Güvenli yolculuklar dileriz!</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:6px 0;color:#6b7280">Rezervasyon No</td><td style="font-weight:bold">${b.bookingRef}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Güzergah</td><td>${b.fromLocation.name} → ${b.toLocation.name}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Tarih</td><td>${new Date(b.transferDate).toLocaleString('tr-TR')}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Tutar</td><td>${b.price} ${b.currency}</td></tr>
      </table>
      <p style="color:#6b7280;font-size:13px">Sorularınız için bizimle iletişime geçebilirsiniz.</p>
    </div>
  `;
}
