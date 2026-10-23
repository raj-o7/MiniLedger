import jwt from 'jsonwebtoken';
import { phoneSchema, verifyOtpSchema } from '../../src/auth/authSchemas';
import { generateOtp, hashOtp, otpMatches } from '../../src/auth/otp';
import { signToken, verifyToken } from '../../src/auth/token';

const SECRET = 'unit-test-secret-that-is-long-enough!!';

describe('OTP helpers', () => {
  it('generates six-digit codes', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generateOtp()).toMatch(/^\d{6}$/);
    }
  });

  it('matches only the original code', () => {
    const hash = hashOtp('123456', SECRET);
    expect(hash).not.toContain('123456');
    expect(otpMatches('123456', hash, SECRET)).toBe(true);
    expect(otpMatches('654321', hash, SECRET)).toBe(false);
    expect(otpMatches('123456', hash, 'a-different-secret-that-is-long-enough')).toBe(false);
  });
});

describe('tokens', () => {
  it('round-trips the user id', () => {
    const token = signToken(42, SECRET, 60);
    expect(verifyToken(token, SECRET)).toBe(42);
  });

  it('rejects tokens signed with another secret, tampered or expired tokens', () => {
    const token = signToken(42, SECRET, 60);
    expect(verifyToken(token, 'another-secret-that-is-also-long-enough')).toBeNull();
    expect(verifyToken(`${token}x`, SECRET)).toBeNull();
    expect(verifyToken('not-a-token', SECRET)).toBeNull();

    const expired = jwt.sign({ sub: '42', exp: Math.floor(Date.now() / 1000) - 10 }, SECRET);
    expect(verifyToken(expired, SECRET)).toBeNull();
  });

  it('rejects tokens using the "none" algorithm', () => {
    const unsigned = jwt.sign({ sub: '42' }, '', { algorithm: 'none' });
    expect(verifyToken(unsigned, SECRET)).toBeNull();
  });
});

describe('auth input validation', () => {
  it('normalises phone numbers with spaces and dashes', () => {
    expect(phoneSchema.parse('+91 98765-43210')).toBe('+919876543210');
  });

  it('rejects phone numbers without a country code or with letters', () => {
    expect(phoneSchema.safeParse('9876543210').success).toBe(false);
    expect(phoneSchema.safeParse('+91abc').success).toBe(false);
    expect(phoneSchema.safeParse(12345).success).toBe(false);
  });

  it('requires a six-digit code', () => {
    expect(verifyOtpSchema.safeParse({ phone: '+919876543210', code: '123456' }).success).toBe(true);
    expect(verifyOtpSchema.safeParse({ phone: '+919876543210', code: '12345' }).success).toBe(false);
    expect(verifyOtpSchema.safeParse({ phone: '+919876543210', code: '12345a' }).success).toBe(false);
  });
});
