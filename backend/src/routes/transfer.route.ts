import { Router }                from 'express';
import { rateLimit }             from '../middlewares/rate-limit.middleware.js';
import { searchTransfersHandler, listFleetHandler } from '../controllers/transfer.controller.js';

export const transferRouter = Router();

// Filo (araç sınıfları) — fiyatsız, arama öncesi vitrin için
transferRouter.get('/fleet', rateLimit(60, 60), listFleetHandler);

// Arama endpoint'i — 30 istek / dakika
transferRouter.get('/search', rateLimit(30, 60), searchTransfersHandler);
