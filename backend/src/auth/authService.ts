import type { Pool } from 'pg';
import type { AppConfig } from '../config';
import { AppError } from '../utils/errors';
import { generateOtp, hashOtp, otpMatches } from './otp';
import { signToken } from './token';

export const OTP_TTL_SECONDS = 5 * 60;
export const OTP_RESEND_COOLDOWN_SECONDS = 30;
export const OTP_MAX_ATTEMPTS = 5;

/** How a generated code reaches the user. In development we just print it. */
export type OtpSender = (phone: string, code: string) => void;

export const logOtpToConsole: OtpSender = (phone, code) => {
  console.log(`\n[MOCK OTP] Login code for ${phone}: ${code} (valid for 5 minutes)\n`);
};

export interface PublicUser {
  id: number;
  phone: string;
  createdAt: string;
}

interface UserRow {
  id: number;
  phone: string;
  created_at: Date;
}

function toPublicUser(row: UserRow): PublicUser {
  return { id: row.id, phone: row.phone, createdAt: row.created_at.toISOString() };
}

export async function requestOtp(
  db: Pool,
  config: AppConfig,
  sendOtp: OtpSender,
  phone: string,
): Promise<{ expiresInSeconds: number }> {
  const recent = await db.query(
    `SELECT 1 FROM otp_codes
     WHERE phone = $1 AND created_at > NOW() - make_interval(secs => $2)
     LIMIT 1`,
    [phone, OTP_RESEND_COOLDOWN_SECONDS],
  );
  if (recent.rows.length > 0) {
    throw new AppError(
      429,
      'OTP_COOLDOWN',
      `Please wait ${OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting another code.`,
    );
  }

  // Only the newest code should work, so retire any older unused ones.
  await db.query(
    'UPDATE otp_codes SET consumed_at = NOW() WHERE phone = $1 AND consumed_at IS NULL',
    [phone],
  );

  const code = generateOtp();
  await db.query(
    `INSERT INTO otp_codes (phone, code_hash, expires_at)
     VALUES ($1, $2, NOW() + make_interval(secs => $3))`,
    [phone, hashOtp(code, config.jwtSecret), OTP_TTL_SECONDS],
  );

  sendOtp(phone, code);
  return { expiresInSeconds: OTP_TTL_SECONDS };
}

export async function verifyOtp(
  db: Pool,
  config: AppConfig,
  phone: string,
  code: string,
): Promise<{ token: string; user: PublicUser }> {
  // Count this attempt first, in one statement, so parallel guesses cannot bypass the limit.
  const attempt = await db.query<{ id: number; code_hash: string }>(
    `UPDATE otp_codes SET attempts = attempts + 1
     WHERE id = (
       SELECT id FROM otp_codes
       WHERE phone = $1 AND consumed_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1
     )
     AND attempts < $2
     RETURNING id, code_hash`,
    [phone, OTP_MAX_ATTEMPTS],
  );

  const otp = attempt.rows[0];
  if (!otp) {
    throw new AppError(
      401,
      'OTP_EXPIRED',
      'This code has expired or was tried too many times. Please request a new code.',
    );
  }

  if (!otpMatches(code, otp.code_hash, config.jwtSecret)) {
    throw new AppError(401, 'OTP_INCORRECT', 'Incorrect code. Please try again.');
  }

  // Mark the code as used. If another request used it a moment ago, no row is updated.
  const consumed = await db.query(
    'UPDATE otp_codes SET consumed_at = NOW() WHERE id = $1 AND consumed_at IS NULL RETURNING id',
    [otp.id],
  );
  if (consumed.rows.length === 0) {
    throw new AppError(401, 'OTP_EXPIRED', 'This code was already used. Please request a new code.');
  }

  // Create the user on first login, or fetch the existing one.
  const userResult = await db.query<UserRow>(
    `INSERT INTO users (phone) VALUES ($1)
     ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
     RETURNING id, phone, created_at`,
    [phone],
  );
  const userRow = userResult.rows[0];
  if (!userRow) {
    throw new Error('Failed to create or load user');
  }

  const token = signToken(userRow.id, config.jwtSecret, config.jwtExpiresInSeconds);
  return { token, user: toPublicUser(userRow) };
}

export async function findUserById(db: Pool, userId: number): Promise<PublicUser | null> {
  const result = await db.query<UserRow>('SELECT id, phone, created_at FROM users WHERE id = $1', [
    userId,
  ]);
  const row = result.rows[0];
  return row ? toPublicUser(row) : null;
}
