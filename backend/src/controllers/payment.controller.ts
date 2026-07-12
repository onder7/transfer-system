import type { Request, Response, NextFunction } from 'express';
import { InitCheckoutSchema }                  from '@transfer/shared';
import * as paymentService                     from '../services/payment.service.js';
import { prisma }                              from '../config/database.js';
import { AppError }                            from '../middlewares/error.middleware.js';

export async function checkoutHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { bookingId } = InitCheckoutSchema.parse(req.body);
    const userIp        = (req.ip ?? '127.0.0.1').replace('::ffff:', '');
    const result        = await paymentService.createIframeToken(bookingId, userIp);
    res.json(result); // { token, merchantOid }
  } catch (e) { next(e); }
}

// PaymentPage için: POST /payments/iframe/:bookingId → { iframeToken }
export async function iframeTokenHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const bookingId = req.params.bookingId as string;
    const userIp    = (req.ip ?? '127.0.0.1').replace('::ffff:', '');
    const { token } = await paymentService.createIframeToken(bookingId, userIp);
    res.json({ iframeToken: token });
  } catch (e) { next(e); }
}

// PayTR'den gelen server-to-server callback — ham POST, JSON değil
export async function callbackHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const body   = req.body as Record<string, string>;
    const result = await paymentService.processCallback(body);
    res.set('Content-Type', 'text/plain').send(result); // PayTR "OK" bekler
  } catch (e) { next(e); }
}

export async function bankInfoHandler(_req: Request, res: Response, next: NextFunction) {
  try { res.json({ bankInfo: await paymentService.getBankInfo() }); } catch (e) { next(e); }
}

export async function bankTransferHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await paymentService.initBankTransfer(req.params.bookingId as string);
    res.json(result);
  } catch (e) { next(e); }
}

export async function cashPaymentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await paymentService.initCashPayment(req.params.bookingId as string);
    res.json(result);
  } catch (e) { next(e); }
}

export async function getPaymentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const payment = await prisma.payment.findUnique({
      where:  { bookingId: req.params.bookingId as string },
      select: { id: true, status: true, amount: true, currency: true, method: true, paidAt: true },
    });
    if (!payment) throw new AppError(404, 'Ödeme kaydı bulunamadı');
    res.json({ payment });
  } catch (e) { next(e); }
}
