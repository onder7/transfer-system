import { prisma }                           from '../config/database.js';
import { redis }                            from '../config/redis.js';
import { env }                              from '../config/env.js';
import { hashPassword, verifyPassword }     from '../utils/password.js';
import {
  signAccessToken, signRefreshToken,
  verifyRefreshToken, parseDurationMs,
} from '../utils/token.js';
import { AppError }                         from '../middlewares/error.middleware.js';
import type { RegisterInput, LoginInput }   from '@transfer/shared';
import type { Response }                    from 'express';

// Redis key: kullanıcı başına geçerli refresh token jti
const rtKey = (userId: string) => `rt:${userId}`;

// ─── Token çifti üret + cookie'ye yaz ────────────────────────────────────────

export async function issueTokens(
  res: Response,
  user: { id: string; role: import('@prisma/client').Role; email: string },
) {
  const accessToken            = signAccessToken({ sub: user.id, role: user.role, email: user.email });
  const { token: refreshToken, jti } = signRefreshToken(user.id);

  // Rotate: Redis'e yeni jti'yi yaz
  const refreshTtlSec = parseDurationMs(env.JWT_REFRESH_EXPIRES_IN) / 1000;
  await redis.setex(rtKey(user.id), refreshTtlSec, jti);

  const isProd = env.NODE_ENV === 'production';
  const base   = { httpOnly: true, secure: isProd, sameSite: 'strict' as const };

  res.cookie('accessToken',  accessToken,  { ...base, maxAge: parseDurationMs(env.JWT_EXPIRES_IN) });
  res.cookie('refreshToken', refreshToken, { ...base, maxAge: parseDurationMs(env.JWT_REFRESH_EXPIRES_IN), path: '/api/auth' });

  return { accessToken, user };
}

// ─── Register ─────────────────────────────────────────────────────────────────

export async function register(data: RegisterInput, res: Response) {
  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) throw new AppError(409, 'Bu e-posta adresi zaten kayıtlı');

  const passwordHash = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      email:        data.email,
      firstName:    data.firstName,
      lastName:     data.lastName,
      phone:        data.phone,
      passwordHash,
      role:         'CUSTOMER',
      consentGiven: data.consent,
      consentAt:    new Date(),
    },
    select: { id: true, email: true, firstName: true, lastName: true, role: true },
  });

  return issueTokens(res, user);
}

// ─── Login ────────────────────────────────────────────────────────────────────

export async function login(data: LoginInput, res: Response) {
  const user = await prisma.user.findUnique({
    where:  { email: data.email },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, passwordHash: true },
  });

  if (!user?.passwordHash) throw new AppError(401, 'E-posta veya şifre hatalı');

  const valid = await verifyPassword(data.password, user.passwordHash);
  if (!valid) throw new AppError(401, 'E-posta veya şifre hatalı');

  const { passwordHash: _, ...safeUser } = user;
  return issueTokens(res, safeUser);
}

// ─── Refresh ──────────────────────────────────────────────────────────────────

export async function refresh(refreshToken: string, res: Response) {
  let payload: ReturnType<typeof verifyRefreshToken>;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(401, 'Geçersiz refresh token');
  }

  // Redis'teki jti ile eşleşiyor mu? (token çalındı kontrolü)
  const storedJti = await redis.get(rtKey(payload.sub));
  if (!storedJti || storedJti !== payload.jti) {
    throw new AppError(401, 'Refresh token geçersiz kılınmış');
  }

  const user = await prisma.user.findUnique({
    where:  { id: payload.sub },
    select: { id: true, email: true, role: true },
  });
  if (!user) throw new AppError(401, 'Kullanıcı bulunamadı');

  return issueTokens(res, user);
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logout(accessToken: string, userId: string, res: Response) {
  // Access token'ı kara listeye al (kalan TTL kadar)
  try {
    const decoded = JSON.parse(
      Buffer.from(accessToken.split('.')[1], 'base64url').toString(),
    ) as { exp?: number };
    const ttl = (decoded.exp ?? 0) - Math.floor(Date.now() / 1000);
    if (ttl > 0) await redis.setex(`bl:${accessToken}`, ttl, '1');
  } catch { /* token bozuksa sessizce geç */ }

  // Refresh token'ı Redis'ten sil
  await redis.del(rtKey(userId));

  res.clearCookie('accessToken');
  res.clearCookie('refreshToken', { path: '/api/auth' });
}
