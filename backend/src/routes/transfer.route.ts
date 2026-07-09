import { Router }                from 'express';
import { rateLimit }             from '../middlewares/rate-limit.middleware.js';
import { searchTransfersHandler } from '../controllers/transfer.controller.js';

export const transferRouter = Router();

// Arama endpoint'i — 30 istek / dakika
transferRouter.get('/search', rateLimit(30, 60), searchTransfersHandler);
