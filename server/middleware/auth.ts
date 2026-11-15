import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../db.ts';
import { AUTH_COOKIE_NAME, verifyAuthToken } from '../utils/authUtils.ts';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'VENDOR';
  organizationName: string;
  organizationType: string;
  wasteAlertThreshold: number;
  emailAlerts: boolean;
  surplusAlerts: boolean;
  dailyDigest: boolean;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts. Please wait a few minutes and try again.',
  },
});

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
    const authHeader = req.headers.authorization;
    const bearerToken =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : '';
    const token = cookieToken || bearerToken;

    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const decoded = verifyAuthToken(token);
    if (!decoded) {
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organizationName: true,
        organizationType: true,
        wasteAlertThreshold: true,
        emailAlerts: true,
        surplusAlerts: true,
        dailyDigest: true,
      },
    });

    if (!user) {
      res.status(401).json({ error: 'Account no longer exists' });
      return;
    }

    req.user = {
      ...user,
      role: user.role === 'ADMIN' ? 'ADMIN' : 'VENDOR',
    };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}
