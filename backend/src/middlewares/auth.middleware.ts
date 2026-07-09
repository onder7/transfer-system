import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { redis } from '../config/redis.js';
import { AppError } from './error.middleware.js';
import type { Role } from '@prisma/client';

export interface AuthPayload {
  sub: string;   // user id
  role: Role;
  email: string;
}

declare global {
  namespace Express {
    interface Request { user?: AuthPayload }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.accessToken as string | undefined;
  if (!token) return next(new AppError(401, 'Oturum açılmamış'));

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    next(new AppError(401, 'Geçersiz veya süresi dolmuş token'));
  }
}

export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError(403, 'Bu işlem için yetkiniz yok'));
    }
    next();
  };
}

// Logout sonrası kara listeye alınan access token kontrolü
export async function checkBlacklist(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.accessToken as string | undefined;
  if (!token) return next();
  const blacklisted = await redis.get(`bl:${token}`);
  if (blacklisted) return next(new AppError(401, 'Token geçersiz kılınmış'));
  next();
}
