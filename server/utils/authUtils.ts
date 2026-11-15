import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const AUTH_COOKIE_NAME = 'ecopredict_token';

export interface JwtPayload {
  userId: string;
  email: string;
  role: 'ADMIN' | 'VENDOR';
}

const getJwtSecret = (): string => {
  return process.env.JWT_SECRET || 'ecopredict-local-dev-jwt-secret-key-2026';
};

export function sanitizeText(input: unknown, maxLength = 200): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function evaluatePasswordStrength(password: string): {
  valid: boolean;
  score: number;
  label: 'Weak' | 'Fair' | 'Good' | 'Strong';
  issues: string[];
} {
  const issues: string[] = [];
  if (password.length < 8) issues.push('At least 8 characters');
  if (!/[A-Z]/.test(password)) issues.push('At least one uppercase letter');
  if (!/[a-z]/.test(password)) issues.push('At least one lowercase letter');
  if (!/[0-9]/.test(password)) issues.push('At least one number');

  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password) && password.length >= 10) score += 1;

  const labels: Array<'Weak' | 'Fair' | 'Good' | 'Strong'> = [
    'Weak',
    'Weak',
    'Fair',
    'Good',
    'Strong',
  ];

  return {
    valid: issues.length === 0,
    score,
    label: labels[score] || 'Weak',
    issues,
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signAuthToken(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

export function verifyAuthToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;
    if (!decoded || !decoded.userId || !decoded.role) return null;
    return decoded;
  } catch {
    return null;
  }
}
