import { Router }                                  from 'express';
import { rateLimit }                               from '../middlewares/rate-limit.middleware.js';
import { listLocationsHandler, listRoutesHandler } from '../controllers/location.controller.js';

export const locationRouter = Router();

locationRouter.get('/',       rateLimit(60, 60), listLocationsHandler);
locationRouter.get('/routes', rateLimit(60, 60), listRoutesHandler);
