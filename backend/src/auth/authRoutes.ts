import { Router } from 'express';
import type { Pool } from 'pg';
import type { AppConfig } from '../config';
import { getUserId, requireAuth } from '../middleware/requireAuth';
import { AppError } from '../utils/errors';
import { requestOtpSchema, verifyOtpSchema } from './authSchemas';
import { findUserById, requestOtp, verifyOtp, type OtpSender } from './authService';

export function createAuthRouter(db: Pool, config: AppConfig, sendOtp: OtpSender): Router {
  const router = Router();

  router.post('/request-otp', async (req, res) => {
    const { phone } = requestOtpSchema.parse(req.body);
    const { expiresInSeconds } = await requestOtp(db, config, sendOtp, phone);
    res.json({ message: 'Verification code sent.', phone, expiresInSeconds });
  });

  router.post('/verify-otp', async (req, res) => {
    const { phone, code } = verifyOtpSchema.parse(req.body);
    const result = await verifyOtp(db, config, phone, code);
    res.json(result);
  });

  router.get('/me', requireAuth(config.jwtSecret), async (req, res) => {
    const user = await findUserById(db, getUserId(req));
    if (!user) {
      throw new AppError(401, 'UNAUTHORIZED', 'This account no longer exists.');
    }
    res.json({ user });
  });

  return router;
}
