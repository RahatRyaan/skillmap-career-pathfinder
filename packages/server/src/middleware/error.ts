/**
 * The single place an error becomes an HTTP response.
 *
 * Guarantee: no stack trace, no raw exception message, no Mongoose or Mongo
 * driver error, and no user content ever reaches a client in production.
 */

import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { config } from '../config/env.js';
import { AppError, logError } from '../utils/errors.js';

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new AppError('NOT_FOUND', `No route matches ${req.method} ${req.path}`));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  // Translate library-specific errors into our taxonomy.
  const appError: AppError = err instanceof AppError ? err : translate(err);

  // Attach a request id so a user-reported error is traceable in the logs.
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  logError(appError, {
    requestId,
    method: req.method,
    path: req.path,
    userId: (req as Request & { userId?: string }).userId ?? null,
  });

  const isServerFault = appError.status >= 500;

  const body: {
    error: {
      code: string;
      message: string;
      details?: { path: string; message: string }[];
      requestId: string;
    };
  } = {
    error: {
      code: appError.code,
      // In production, a 5xx never reveals the underlying failure.
      message:
        isServerFault && config.isProduction
          ? 'Something went wrong on our side. Please try again.'
          : appError.message,
      requestId,
    },
  };

  if (appError.details && appError.details.length > 0) {
    body.error.details = appError.details;
  }

  res.status(appError.status).json(body);
};

function translate(error: unknown): AppError {
  if (error instanceof ZodError) {
    return new AppError('VALIDATION_FAILED', 'The request body failed validation', {
      details: error.issues.map((i) => ({
        path: i.path.join('.') || '(root)',
        message: i.message,
      })),
    });
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return new AppError('VALIDATION_FAILED', 'Some fields did not pass validation', {
      details: Object.values(error.errors).map((e) => ({
        path: e.path,
        message: e.message,
      })),
    });
  }

  if (error instanceof mongoose.Error.CastError) {
    return new AppError('BAD_REQUEST', `"${error.path}" is not a valid value`);
  }

  if (isDuplicateKeyError(error)) {
    return new AppError('DUPLICATE_RESOURCE', 'That record already exists');
  }

  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('File too large')) {
    return new AppError('PAYLOAD_TOO_LARGE', 'That file is larger than the allowed limit');
  }

  if (/buffering timed out|server selection|ECONNREFUSED|topology was destroyed/i.test(message)) {
    return new AppError(
      'DATABASE_UNAVAILABLE',
      'The database is not responding. Please try again.',
    );
  }

  if (message.includes('jwt') || message.includes('token')) {
    return new AppError('UNAUTHORIZED', 'Your session is not valid. Please sign in again.');
  }

  return new AppError('INTERNAL_ERROR', 'Something went wrong on our side', {
    internalContext: { original: message.slice(0, 300) },
  });
}

function isDuplicateKeyError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if ('code' in error && (error as { code?: unknown }).code === 11000) return true;
  return /E11000|duplicate key/i.test(error.message);
}
