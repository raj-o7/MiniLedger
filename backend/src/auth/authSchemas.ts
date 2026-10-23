import { z } from 'zod';

export const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;

/** Accepts "+91 98765-43210" and normalises it to "+919876543210". */
export const phoneSchema = z
  .string({ error: 'Phone number is required' })
  .transform((value) => value.replace(/[\s\-()]/g, ''))
  .pipe(
    z
      .string()
      .regex(PHONE_PATTERN, 'Enter the phone number with country code, for example +919876543210'),
  );

export const requestOtpSchema = z.object({
  phone: phoneSchema,
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z
    .string({ error: 'Code is required' })
    .trim()
    .regex(/^\d{6}$/, 'Code must be exactly 6 digits'),
});
