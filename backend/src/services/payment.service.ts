import { createHmac }      from 'crypto';
import axios               from 'axios';
import { prisma }          from '../config/database.js';
import { getIntegration }  from './config.service.js';
import { confirmBooking }  from './booking.service.js';
import { AppError }        from '../middlewares/error.middleware.js';
import { logger }          from '../config/logger.js';

const PAYTR_API = 'https://www.paytr.com/odeme/api/v1';

// ─── PayTR yapılandırması al ──────────────────────────────────────────────────

async function getPayTRConfig() {
  const cfg = await getIntegration('paytr');
  if (!cfg) throw new AppError(503, 'Ödeme servisi henüz yapılandırılmamış. Lütfen admin panelinden PayTR entegrasyonunu yapılandırın.');

  const merchantId   = cfg.secrets.merchantId   as string | undefined;
  const merchantKey  = cfg.secrets.merchantKey  as string | undefined;
  const merchantSalt = cfg.secrets.merchantSalt as string | undefined;

  if (!merchantId || !merchantKey || !merchantSalt) {
    throw new AppError(503, 'PayTR kimlik bilgileri eksik. Lütfen admin panelinden Entegrasyonlar → PayTR ayarlarını tamamlayın.');
  }

  return {
    merchantId,
    merchantKey,
    merchantSalt,
    callbackUrl: (cfg.config.callbackUrl as string) ?? '',
    okUrl:       (cfg.config.okUrl as string) ?? '',
    failUrl:     (cfg.config.failUrl as string) ?? '',
    testMode:    (cfg.config.testMode as boolean) ? '1' : '0',
  };
}

// ─── İframe token üret ────────────────────────────────────────────────────────

/**
 * PayTR iframe token'ı üretir.
 * Dökümantasyon: https://dev.paytr.com/iframe-api
 *
 * Hash formülü:
 *   hash_str = merchantId + userIp + merchantOid + email +
 *              paymentAmount + paymentType + installmentCount +
 *              currency + testMode + merchantSalt
 *   paytrToken = Base64(HMAC-SHA256(hash_str, merchantKey))
 */
export async function createIframeToken(bookingId: string, userIp: string) {
  const payment = await prisma.payment.findUnique({
    where:   { bookingId },
    include: { booking: true },
  });
  if (!payment) throw new AppError(404, 'Ödeme kaydı bulunamadı');
  if (payment.status === 'PAID') throw new AppError(400, 'Bu rezervasyon zaten ödendi');

  const booking = payment.booking;
  const cfg     = await getPayTRConfig();

  const merchantOid   = payment.id;                  // benzersiz sipariş id
  const email         = booking.guestEmail ?? 'guest@transfer.local';
  const paymentAmount = String(Math.round(Number(payment.amount) * 100)); // kuruş
  const paymentType   = 'card';
  const installment   = '0';
  const currency      = 'TL';

  const hashStr =
    cfg.merchantId + userIp + merchantOid + email +
    paymentAmount + paymentType + installment + currency +
    cfg.testMode + cfg.merchantSalt;

  const paytrToken = createHmac('sha256', cfg.merchantKey)
    .update(hashStr)
    .digest('base64');

  const userBasket = Buffer.from(
    JSON.stringify([[booking.bookingRef, Number(payment.amount), 1]]),
  ).toString('base64');

  const params = new URLSearchParams({
    merchant_id:        cfg.merchantId,
    user_ip:            userIp,
    merchant_oid:       merchantOid,
    email,
    payment_amount:     paymentAmount,
    paytr_token:        paytrToken,
    user_basket:        userBasket,
    debug_on:           '0',
    no_installment:     '0',
    max_installment:    '0',
    user_name:          booking.guestName ?? 'Müşteri',
    user_address:       'Transfer',
    user_phone:         booking.guestPhone ?? '05000000000',
    merchant_ok_url:    cfg.okUrl,
    merchant_fail_url:  cfg.failUrl,
    timeout_limit:      '30',
    currency,
    test_mode:          cfg.testMode,
  });

  let data: { status: string; token?: string; reason?: string };
  try {
    const resp = await axios.post<typeof data>(
      PAYTR_API,
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
    data = resp.data;
  } catch (axErr: any) {
    const status = axErr?.response?.status;
    const msg    = status === 401
      ? 'PayTR kimlik bilgileri geçersiz. Lütfen merchant_id, merchant_key ve merchant_salt değerlerini kontrol edin.'
      : `PayTR bağlantı hatası (HTTP ${status ?? 'timeout'})`;
    logger.error({ axErr }, 'PayTR API çağrısı başarısız');
    throw new AppError(502, msg);
  }

  if (data.status !== 'success' || !data.token) {
    logger.error({ reason: data.reason }, 'PayTR token alınamadı');
    throw new AppError(502, `PayTR hatası: ${data.reason ?? 'Bilinmeyen hata'}`);
  }

  // Token'ı payment'a geçici kaydet
  await prisma.payment.update({
    where: { id: payment.id },
    data:  { paytryOrderId: merchantOid, paytryToken: data.token },
  });

  return { token: data.token, merchantOid };
}

// ─── Callback doğrulama + ödeme işleme ───────────────────────────────────────

/**
 * PayTR server-to-server callback.
 * Formda gelen alanlar: merchant_oid, status, total_amount, hash, ...
 *
 * Hash doğrulama formülü:
 *   hash_str = merchantOid + merchantSalt + status + totalAmount
 *   expected = Base64(HMAC-SHA256(hash_str, merchantKey))
 *
 * Yanıt: düz metin "OK" (PayTR beklentisi)
 */
export async function processCallback(body: Record<string, string>) {
  const { merchant_oid, status, total_amount, hash } = body;
  if (!merchant_oid || !status || !total_amount || !hash) {
    throw new AppError(400, 'Eksik callback parametresi');
  }

  const cfg = await getPayTRConfig();

  const hashStr  = merchant_oid + cfg.merchantSalt + status + total_amount;
  const expected = createHmac('sha256', cfg.merchantKey)
    .update(hashStr)
    .digest('base64');

  if (expected !== hash) {
    logger.warn({ merchant_oid }, 'PayTR callback hash uyuşmazlığı');
    throw new AppError(403, 'Geçersiz callback imzası');
  }

  // Ödeme kaydını bul (merchant_oid = payment.id)
  const payment = await prisma.payment.findUnique({ where: { id: merchant_oid } });
  if (!payment) {
    logger.error({ merchant_oid }, 'Callback için payment bulunamadı');
    return 'OK'; // PayTR'ye yine de OK dön
  }

  if (status === 'success') {
    if (payment.status !== 'PAID') {
      await prisma.payment.update({
        where: { id: payment.id },
        data:  { status: 'PAID', paidAt: new Date() },
      });
      await confirmBooking(payment.bookingId);
    }
  } else {
    if (payment.status === 'PENDING') {
      await prisma.payment.update({
        where: { id: payment.id },
        data:  { status: 'FAILED' },
      });
      logger.info({ merchant_oid, reason: body.failed_reason_msg }, 'Ödeme başarısız');
    }
  }

  return 'OK';
}

// ─── Banka bilgileri (public) ────────────────────────────────────────────────

// Müşteriye gösterilecek aktif ödeme yöntemleri.
// paytr / bank_transfer → IntegrationSetting.isActive ile yönetilir.
// cash → 'cash' entegrasyonu tanımlıysa onun isActive'i, tanımlı değilse açık kabul edilir
// (geriye dönük uyumluluk: araçta ödeme her zaman çalışıyordu).
export async function getEnabledMethods() {
  const [paytr, bank, cash] = await Promise.all([
    getIntegration('paytr'),
    getIntegration('bank_transfer'),
    getIntegration('cash'),
  ]);
  return {
    online: !!paytr?.isActive,
    bank:   !!bank?.isActive,
    cash:   cash ? !!cash.isActive : true,
  };
}

export async function getBankInfo() {
  const cfg = await getIntegration('bank_transfer');
  if (!cfg || !cfg.isActive) return null;
  return cfg.config as {
    bankName?: string; accountName?: string; iban?: string; branchCode?: string; description?: string;
  };
}

// ─── Havale/EFT ──────────────────────────────────────────────────────────────

export async function initBankTransfer(bookingId: string) {
  const payment = await prisma.payment.findUnique({ where: { bookingId } });
  if (!payment) throw new AppError(404, 'Ödeme kaydı bulunamadı');
  if (payment.status === 'PAID') throw new AppError(400, 'Bu rezervasyon zaten ödendi');

  await prisma.payment.update({
    where: { id: payment.id },
    data:  { method: 'BANK_TRANSFER' },
  });

  const bankInfo = await getBankInfo();
  return { bookingId, bankInfo };
}

// ─── Araçta ödeme ────────────────────────────────────────────────────────────

export async function initCashPayment(bookingId: string) {
  const payment = await prisma.payment.findUnique({ where: { bookingId } });
  if (!payment) throw new AppError(404, 'Ödeme kaydı bulunamadı');
  if (payment.status === 'PAID') throw new AppError(400, 'Bu rezervasyon zaten ödendi');

  await prisma.payment.update({
    where: { id: payment.id },
    data:  { method: 'CASH_ON_DELIVERY' },
  });

  // PENDING kalır — admin panelinden X dakika içinde onaylanmalı
  // Onaylanmazsa scheduler otomatik iptal eder (SystemSetting: cash_confirm_timeout_min)

  return { bookingId };
}
