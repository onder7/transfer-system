import { Router }    from 'express';
import type { Request, Response, NextFunction } from 'express';
import { rateLimit } from '../middlewares/rate-limit.middleware.js';
import { getTrackingInfo } from '../services/driver-location.service.js';

export const trackingRouter = Router();

// GET /api/tracking/:bookingId — müşteri canlı takip (public, auth yok)
trackingRouter.get(
  '/:bookingId',
  rateLimit(30, 60), // 30 istek/dk
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const info = await getTrackingInfo(req.params.bookingId as string);
      if (!info) {
        res.status(404).json({ error: 'Takip bilgisi bulunamadı' });
        return;
      }
      res.json(info);
    } catch (e) { next(e); }
  },
);
