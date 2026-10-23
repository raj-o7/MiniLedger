import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

/** A random 6-digit code such as "042917" (leading zeros are kept). */
export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/**
 * We never store the OTP itself, only a keyed hash of it.
 * Using the server secret as the key means a leaked database alone is not enough to recover codes.
 */
export function hashOtp(code: string, secret: string): string {
  return createHmac('sha256', secret).update(code).digest('hex');
}

/** Compares in constant time so attackers cannot learn anything from response timing. */
export function otpMatches(code: string, storedHash: string, secret: string): boolean {
  const candidate = Buffer.from(hashOtp(code, secret), 'hex');
  const expected = Buffer.from(storedHash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
