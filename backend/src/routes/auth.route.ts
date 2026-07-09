import { Router }          from 'express';
import { authenticate, checkBlacklist } from '../middlewares/auth.middleware.js';
import { rateLimit }       from '../middlewares/rate-limit.middleware.js';
import {
  registerHandler, loginHandler,
  refreshHandler,  logoutHandler, meHandler,
} from '../controllers/auth.controller.js';

export const authRouter = Router();

// 20 istek / 15 dakika — kayıt & giriş için
const authLimit = rateLimit(20, 15 * 60);

authRouter.post('/register', authLimit, registerHandler);
authRouter.post('/login',    authLimit, loginHandler);
authRouter.post('/refresh',  refreshHandler);
authRouter.post('/logout',   authenticate, checkBlacklist, logoutHandler);
authRouter.get ('/me',       authenticate, checkBlacklist, meHandler);
