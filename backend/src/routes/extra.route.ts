import { Router }             from 'express';
import { rateLimit }          from '../middlewares/rate-limit.middleware.js';
import { listExtrasHandler }  from '../controllers/extra.controller.js';

export const extraRouter = Router();

extraRouter.get('/', rateLimit(60, 60), listExtrasHandler);
