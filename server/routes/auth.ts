import crypto from 'crypto';
import type { CookieOptions, Response } from 'express';
import { Router } from 'express';
import { prisma } from '../db.ts';
import { authRateLimiter, requireAuth, type AuthRequest } from '../middleware/auth.ts';
import {
  AUTH_COOKIE_NAME,
  comparePassword,
  evaluatePasswordStrength,
  hashPassword,
  isValidEmail,
  sanitizeText,
  signAuthToken,
} from '../utils/authUtils.ts';

const router = Router();

const ALLOWED_ORG_TYPES = ['Restaurant', 'Hostel', 'Canteen', 'Event'] as const;

function getCookieOptions(req: AuthRequest): CookieOptions {
  const isHttps =
    req.secure || req.headers['x-forwarded-proto'] === 'https';
  return {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: Boolean(isHttps),
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  };
}

function formatUserResponse(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationName: string;
  organizationType: string;
  wasteAlertThreshold: number;
  emailAlerts: boolean;
  surplusAlerts: boolean;
  dailyDigest: boolean;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role === 'ADMIN' ? 'ADMIN' : 'VENDOR',
    organizationName: user.organizationName,
    organizationType: user.organizationType,
    wasteAlertThreshold: user.wasteAlertThreshold,
    emailAlerts: user.emailAlerts,
    surplusAlerts: user.surplusAlerts,
    dailyDigest: user.dailyDigest,
  };
}

router.post('/signup', authRateLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const name = sanitizeText(req.body?.name, 100);
    const email = sanitizeText(req.body?.email, 150).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const organizationName = sanitizeText(req.body?.organizationName, 140);
    const organizationTypeRaw = sanitizeText(req.body?.organizationType, 40);

    if (!name || name.length < 2) {
      res.status(400).json({ error: 'Full name must be at least 2 characters.' });
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    const strength = evaluatePasswordStrength(password);
    if (!strength.valid) {
      res.status(400).json({
        error: `Password requirements not met: ${strength.issues.join(', ')}.`,
      });
      return;
    }
    if (!organizationName || organizationName.length < 2) {
      res.status(400).json({ error: 'Organization name is required.' });
      return;
    }
    if (!ALLOWED_ORG_TYPES.includes(organizationTypeRaw as (typeof ALLOWED_ORG_TYPES)[number])) {
      res.status(400).json({ error: 'Please select a valid organization type.' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: 'VENDOR', // Self-registration always defaults to VENDOR for RBAC safety
        organizationName,
        organizationType: organizationTypeRaw,
      },
    });

    const token = signAuthToken({
      userId: user.id,
      email: user.email,
      role: 'VENDOR',
    });

    res.cookie(AUTH_COOKIE_NAME, token, getCookieOptions(req));
    res.status(201).json({ user: formatUserResponse(user), token });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Unable to create account right now.' });
  }
});

router.post('/login', authRateLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const email = sanitizeText(req.body?.email, 150).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!isValidEmail(email) || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const role = user.role === 'ADMIN' ? 'ADMIN' : 'VENDOR';
    const token = signAuthToken({ userId: user.id, email: user.email, role });

    res.cookie(AUTH_COOKIE_NAME, token, getCookieOptions(req));
    res.json({ user: formatUserResponse(user), token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Authentication failed. Please try again.' });
  }
});

router.post('/logout', (req: AuthRequest, res: Response) => {
  const opts = getCookieOptions(req);
  res.clearCookie(AUTH_COOKIE_NAME, { ...opts, maxAge: undefined });
  res.json({ message: 'Logged out successfully' });
});

router.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

router.post('/forgot-password', authRateLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const email = sanitizeText(req.body?.email, 150).toLowerCase();
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Return clear status without leaking existence in production, or provide simulated code for valid demo flow
      res.json({
        message: 'If an account matches this email, a reset verification code has been generated.',
        demoResetCode: null,
      });
      return;
    }

    const rawCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        token: rawCode,
        userId: user.id,
        expiresAt,
      },
    });

    // Mocked email delivery: return verification code in response so the user can test end-to-end
    res.json({
      message: 'Verification code generated (simulated email delivery).',
      demoResetCode: rawCode,
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Could not initiate password reset.' });
  }
});

router.post('/reset-password', authRateLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const email = sanitizeText(req.body?.email, 150).toLowerCase();
    const code = sanitizeText(req.body?.code, 20);
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (!isValidEmail(email) || !code) {
      res.status(400).json({ error: 'Email and verification code are required.' });
      return;
    }

    const strength = evaluatePasswordStrength(newPassword);
    if (!strength.valid) {
      res.status(400).json({
        error: `Password requirements not met: ${strength.issues.join(', ')}.`,
      });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(400).json({ error: 'Invalid verification code or email.' });
      return;
    }

    const tokenRecord = await prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        token: code,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!tokenRecord) {
      res.status(400).json({ error: 'Verification code is invalid or expired.' });
      return;
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: tokenRecord.id },
        data: { used: true },
      }),
    ]);

    res.json({ message: 'Password updated successfully. You can now sign in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Unable to reset password.' });
  }
});

router.put('/profile', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const name = sanitizeText(req.body?.name, 100);
    const organizationName = sanitizeText(req.body?.organizationName, 140);
    const organizationType = sanitizeText(req.body?.organizationType, 40);
    const wasteAlertThreshold = Number(req.body?.wasteAlertThreshold);
    const emailAlerts = Boolean(req.body?.emailAlerts);
    const surplusAlerts = Boolean(req.body?.surplusAlerts);
    const dailyDigest = Boolean(req.body?.dailyDigest);

    if (!name || name.length < 2) {
      res.status(400).json({ error: 'Name must be at least 2 characters.' });
      return;
    }
    if (!organizationName || organizationName.length < 2) {
      res.status(400).json({ error: 'Organization name is required.' });
      return;
    }
    if (!ALLOWED_ORG_TYPES.includes(organizationType as (typeof ALLOWED_ORG_TYPES)[number])) {
      res.status(400).json({ error: 'Invalid organization type.' });
      return;
    }
    if (Number.isNaN(wasteAlertThreshold) || wasteAlertThreshold < 2 || wasteAlertThreshold > 50) {
      res.status(400).json({ error: 'Waste alert threshold must be between 2% and 50%.' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        organizationName,
        organizationType,
        wasteAlertThreshold,
        emailAlerts,
        surplusAlerts,
        dailyDigest,
      },
    });

    res.json({ user: formatUserResponse(updated) });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

router.put('/password', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const matches = await comparePassword(currentPassword, user.passwordHash);
    if (!matches) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }

    const strength = evaluatePasswordStrength(newPassword);
    if (!strength.valid) {
      res.status(400).json({
        error: `New password requirements not met: ${strength.issues.join(', ')}.`,
      });
      return;
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Unable to update password.' });
  }
});

export default router;
