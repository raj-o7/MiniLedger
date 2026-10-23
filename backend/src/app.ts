import express, { type Express } from 'express';
import type { Pool } from 'pg';
import { createAuthRouter } from './auth/authRoutes';
import { logOtpToConsole, type OtpSender } from './auth/authService';
import type { AppConfig } from './config';
import { createLoanRouter } from './loans/loanRoutes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requireAuth } from './middleware/requireAuth';

export interface AppDependencies {
  db: Pool;
  config: AppConfig;
  /** Lets tests capture the OTP instead of printing it. */
  sendOtp?: OtpSender;
}

/** Builds the Express app without starting it, so tests can call it directly. */
export function createApp({ db, config, sendOtp = logOtpToConsole }: AppDependencies): Express {
  const app = express();

  app.disable('x-powered-by');
  // 4 MB leaves room for a ~2 MB receipt photo encoded as base64.
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', async (_req, res) => {
    await db.query('SELECT 1');
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', createAuthRouter(db, config, sendOtp));
  app.use('/api/loans', requireAuth(config.jwtSecret), createLoanRouter(db, config));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
