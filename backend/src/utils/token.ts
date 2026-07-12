import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { env } from '../config/env.js';
import type { Role } from '@prisma/client';

export interface AccessPayload {
  sub:   string;
  role:  Role;
  email: string;
}

export interface RefreshPayload {
  sub: string;
  jti: string; // benzersiz token id — rotasyonda doğrulama için
}

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function signRefreshToken(userId: string): { token: string; jti: string } {
  const jti = randomBytes(16).toString('hex');
  const token = jwt.sign({ sub: userId, jti }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
  return { token, jti };
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, env.JWT_SECRET) as AccessPayload;
}

export function verifyRefreshToken(token: string): RefreshPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshPayload;
}

// Cookie maxAge (ms) — .env string'ini parse et: "15m" → 900_000
export function parseDurationMs(duration: string): number {
  const units: Record<string, number> = {
    s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000,
  };
  const m = duration.match(/^(\d+)([smhd])$/);
  if (!m) throw new Error(`Geçersiz süre formatı: ${duration}`);
  return parseInt(m[1]) * units[m[2]];
}
