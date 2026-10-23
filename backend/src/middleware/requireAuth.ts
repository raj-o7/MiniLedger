import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { verifyToken } from '../auth/token';
import { AppError } from '../utils/errors';

// Tell TypeScript that authenticated requests carry the logged-in user's id.
declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

/** Rejects requests without a valid "Authorization: Bearer <token>" header. */
export function requireAuth(jwtSecret: string): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new AppError(401, 'UNAUTHORIZED', 'Please log in to continue.');
    }

    const userId = verifyToken(header.slice('Bearer '.length).trim(), jwtSecret);
    if (userId === null) {
      throw new AppError(401, 'UNAUTHORIZED', 'Your session has expired. Please log in again.');
    }

    req.userId = userId;
    next();
  };
}

/** Reads the user id set by requireAuth. Use only in routes protected by requireAuth. */
export function getUserId(req: Request): number {
  if (req.userId === undefined) {
    throw new AppError(401, 'UNAUTHORIZED', 'Please log in to continue.');
  }
  return req.userId;
}
