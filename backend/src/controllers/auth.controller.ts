import type { Request, Response, NextFunction } from 'express';
import { RegisterSchema, LoginSchema }          from '@transfer/shared';
import * as authService                         from '../services/auth.service.js';
import { prisma }                               from '../config/database.js';

export async function registerHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data   = RegisterSchema.parse(req.body);
    const result = await authService.register(data, res);
    res.status(201).json({ user: result.user });
  } catch (e) { next(e); }
}

export async function loginHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data   = LoginSchema.parse(req.body);
    const result = await authService.login(data, res);
    res.json({ user: result.user });
  } catch (e) { next(e); }
}

export async function refreshHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.refreshToken as string | undefined;
    if (!token) { res.status(401).json({ error: 'Refresh token bulunamadı' }); return; }
    await authService.refresh(token, res);
    res.json({ ok: true });
  } catch (e) { next(e); }
}

export async function logoutHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const accessToken = req.cookies?.accessToken as string | undefined ?? '';
    const userId      = req.user?.sub ?? '';
    await authService.logout(accessToken, userId, res);
    res.json({ ok: true });
  } catch (e) { next(e); }
}

export async function meHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: req.user!.sub },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, phone: true, createdAt: true },
    });
    if (!user) { res.status(404).json({ error: 'Kullanıcı bulunamadı' }); return; }
    res.json({ user });
  } catch (e) { next(e); }
}
