/**
 * Typed application errors and the single place an HTTP response is shaped.
 *
 * The central error handler MUST NOT leak a stack trace, a raw exception
 * message, a Mongo error, or an Mongoose validation dump to a client. Every
 * failure leaves this module as one of the codes in
 * `@skillmap/shared` → ERROR_CODES.
 */

import type { ErrorCode } from '@skillmap/shared';
import { ERROR_STATUS } from '@skillmap/shared';
import { logger } from './logger.js';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: { path: string; message: string }[];
  /** Logged with full detail, never sent to the client. */
  readonly internalContext?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    options: {
      details?: { path: string; message: string }[];
      internalContext?: Record<string, unknown>;
      cause?: unknown;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.details = options.details;
    this.internalContext = options.internalContext;
  }
}

export const badRequest = (m: string, ctx?: Record<string, unknown>) =>
  new AppError('BAD_REQUEST', m, { internalContext: ctx });

export const unauthorized = (m = 'Authentication required') => new AppError('UNAUTHORIZED', m);

export const tokenExpired = (m = 'Your session has expired. Please sign in again.') =>
  new AppError('TOKEN_EXPIRED', m);

export const forbidden = (m = 'You do not have access to this resource') =>
  new AppError('FORBIDDEN', m);

export const notFound = (resource = 'Resource') =>
  new AppError('NOT_FOUND', `${resource} was not found`);

export const conflict = (m: string) => new AppError('CONFLICT', m);

export const duplicate = (m: string) => new AppError('DUPLICATE_RESOURCE', m);

export const validationFailed = (message: string, details?: { path: string; message: string }[]) =>
  new AppError('VALIDATION_FAILED', message, { details });

export const rateLimited = (m = 'Too many requests. Please slow down and try again.') =>
  new AppError('RATE_LIMITED', m);

export const aiUnavailable = (m: string, ctx?: Record<string, unknown>) =>
  new AppError('AI_UNAVAILABLE', m, { internalContext: ctx });

export const internalError = (
  m = 'Something went wrong on our side',
  ctx?: Record<string, unknown>,
) => new AppError('INTERNAL_ERROR', m, { internalContext: ctx });

/** Log an error with full internal detail. Safe: never includes user content. */
export function logError(error: unknown, context: Record<string, unknown> = {}): void {
  if (error instanceof AppError) {
    const level = error.status >= 500 ? 'error' : 'warn';
    logger[level](error.message, {
      ...context,
      code: error.code,
      ...(error.internalContext ?? {}),
    });
    return;
  }

  if (error instanceof Error) {
    logger.error('Unhandled error', {
      ...context,
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join(' | '),
    });
    return;
  }

  logger.error('Unknown thrown value', { ...context, thrown: typeof error });
}
