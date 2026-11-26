import { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { AppError } from '../utils/errors';

interface PgError extends Error {
  code?: string;
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  const pgErr = err as PgError;
  if (pgErr.code === '23505') {
    res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: 'A record with that value already exists',
      },
    });
    return;
  }

  if (pgErr.code === '23503') {
    res.status(400).json({
      error: {
        code: 'INVALID_REFERENCE',
        message: 'Referenced record does not exist',
      },
    });
    return;
  }

  if (env.nodeEnv !== 'test') {
    console.error('[Error]', err);
  }

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}
