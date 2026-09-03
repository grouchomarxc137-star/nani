// Intentionally minimal auth for a private two-person MVP.
//
// One shared password, checked on the server, exchanged for a signed token.
// It is kept behind this one module so it can later be replaced with real
// per-user accounts without touching any route or component.

import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from './env.js';
import { prisma } from './prisma.js';

export const USER_KEYS = ['principe', 'principessa'] as const;
export type UserKey = (typeof USER_KEYS)[number];

export function isUserKey(value: unknown): value is UserKey {
  return typeof value === 'string' && (USER_KEYS as readonly string[]).includes(value);
}

/** Constant-time comparison so the password cannot be probed by timing. */
export function verifyPassword(candidate: unknown): boolean {
  if (typeof candidate !== 'string') return false;
  const expected = Buffer.from(env.appPassword, 'utf8');
  const actual = Buffer.from(candidate, 'utf8');
  if (expected.length !== actual.length) {
    // Still burn a comparison so length is not leaked by timing.
    crypto.timingSafeEqual(expected, expected);
    return false;
  }
  return crypto.timingSafeEqual(expected, actual);
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', env.sessionSecret).update(payload).digest('base64url');
}

/** Token format: base64url(userId.expiresAt).signature */
export function createToken(userId: string): string {
  const expiresAt = Date.now() + env.sessionDays * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(`${userId}.${expiresAt}`, 'utf8').toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string): { userId: string } | null {
  const separator = token.lastIndexOf('.');
  if (separator <= 0) return null;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  const expected = Buffer.from(sign(payload), 'utf8');
  const provided = Buffer.from(signature, 'utf8');
  if (expected.length !== provided.length) return null;
  if (!crypto.timingSafeEqual(expected, provided)) return null;

  const [userId, expiresAt] = Buffer.from(payload, 'base64url').toString('utf8').split('.');
  if (!userId || !expiresAt) return null;
  if (Number(expiresAt) < Date.now()) return null;

  return { userId };
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const claims = token ? verifyToken(token) : null;

  if (!claims) {
    res.status(401).json({ error: 'Not signed in' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: claims.userId }, select: { id: true } });
  if (!user) {
    res.status(401).json({ error: 'Not signed in' });
    return;
  }

  req.userId = user.id;
  next();
}
