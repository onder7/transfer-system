import { Router }        from 'express';
import type { Request, Response, NextFunction } from 'express';
import { rateLimit }     from '../middlewares/rate-limit.middleware.js';
import * as push         from '../services/push.service.js';

export const pushRouter = Router();

// VAPID public key — frontend abone olurken kullanır
pushRouter.get('/vapid-key', (_req, res) => {
  res.json({ publicKey: push.getVapidPublicKey(), enabled: push.isPushEnabled() });
});

// Abonelik kaydet — müşteri "bildirim al" deyince (bookingId ile bağlanır)
pushRouter.post('/subscribe', rateLimit(20, 60), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subscription, bookingId } = req.body as {
      subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      bookingId?: string;
    };
    if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys.auth) {
      res.status(400).json({ error: 'Geçersiz abonelik' });
      return;
    }
    await push.saveSubscription(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth } },
      bookingId,
      req.get('user-agent') ?? undefined,
    );
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});
