import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';

export function auditLog(action: string, entityType: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const entityId = (req.params.id ?? req.params.bookingId ?? 'unknown') as string;
      await prisma.auditLog.create({
        data: {
          userId:     req.user?.sub,
          action,
          entityType,
          entityId,
          meta:       req.body as Record<string, unknown>,
          ip:         req.ip,
        },
      });
    } catch {
      // AuditLog yazma hatası işlemi durdurmaz
    }
    next();
  };
}
