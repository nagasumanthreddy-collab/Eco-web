import { describe, expect, it } from 'vitest';
import {
  comparePassword,
  evaluatePasswordStrength,
  hashPassword,
  isValidEmail,
  sanitizeText,
  signAuthToken,
  verifyAuthToken,
} from '../server/utils/authUtils.ts';

describe('EcoPredict Auth Utilities', () => {
  it('validates password complexity and strength scoring', () => {
    const weak = evaluatePasswordStrength('abc');
    expect(weak.valid).toBe(false);
    expect(weak.score).toBeLessThan(4);

    const strong = evaluatePasswordStrength('EcoPredict@2026');
    expect(strong.valid).toBe(true);
    expect(strong.score).toBe(4);
    expect(strong.label).toBe('Strong');
  });

  it('hashes passwords with bcrypt and verifies accurately', async () => {
    const hash = await hashPassword('Vendor@1234');
    expect(hash).not.toBe('Vendor@1234');
    expect(await comparePassword('Vendor@1234', hash)).toBe(true);
    expect(await comparePassword('WrongPass1', hash)).toBe(false);
  });

  it('signs and verifies JWT payloads with role enforcement', () => {
    const token = signAuthToken({
      userId: 'usr_123',
      email: 'vendor@ecopredict.io',
      role: 'VENDOR',
    });
    const decoded = verifyAuthToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe('usr_123');
    expect(decoded?.role).toBe('VENDOR');
    expect(verifyAuthToken('invalid.jwt.token')).toBeNull();
  });

  it('sanitizes input strings and validates emails', () => {
    expect(sanitizeText('  <script>Kitchen</script>  ')).toBe('scriptKitchen/script');
    expect(isValidEmail('chef@ecopredict.io')).toBe(true);
    expect(isValidEmail('not-an-email')).toBe(false);
  });
});
