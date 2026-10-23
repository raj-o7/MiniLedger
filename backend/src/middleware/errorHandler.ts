import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: { field: string; message: string }[];
  };
}

/** express.json() reports bad bodies as errors with a "type" such as "entity.parse.failed". */
function bodyParserErrorType(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'type' in error) {
    return typeof error.type === 'string' ? error.type : null;
  }
  return null;
}

export function notFoundHandler(req: Request, res: Response<ErrorBody>): void {
  res.status(404).json({
    error: { code: 'ROUTE_NOT_FOUND', message: `No route for ${req.method} ${req.path}` },
  });
}

/**
 * Turns any thrown error into a consistent JSON response: { error: { code, message } }.
 * Express recognises error handlers by their four parameters, so `_next` must stay.
 */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response<ErrorBody>,
  _next: NextFunction,
): void {
  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: details[0]?.message ?? 'Invalid input',
        details,
      },
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
    return;
  }

  const parserErrorType = bodyParserErrorType(error);
  if (parserErrorType === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON.' } });
    return;
  }
  if (parserErrorType === 'entity.too.large') {
    res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' } });
    return;
  }

  // Anything else is a bug or an outage. Log the details, but don't leak them to the client.
  console.error('Unhandled error:', error);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } });
}
