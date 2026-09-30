/**
 * API error taxonomy.
 *
 * The server never sends a stack trace, a raw exception message, or a Mongo
 * error to a client. It sends one of these codes plus a safe message.
 * The client maps `code` to a localized string, so codes are part of the
 * public contract and must stay stable.
 */

import { z } from 'zod';

export const ERROR_CODES = [
  'BAD_REQUEST',
  'VALIDATION_FAILED',
  'UNAUTHORIZED',
  'TOKEN_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'DUPLICATE_RESOURCE',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'RATE_LIMITED',
  'AI_UNAVAILABLE',
  'AI_OUTPUT_INVALID',
  'DATABASE_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const errorCodeSchema = z.enum(ERROR_CODES);

/** Default HTTP status for each code. */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_FAILED: 422,
  UNAUTHORIZED: 401,
  TOKEN_EXPIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  DUPLICATE_RESOURCE: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RATE_LIMITED: 429,
  AI_UNAVAILABLE: 503,
  AI_OUTPUT_INVALID: 502,
  DATABASE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

/** Field-level validation failure, safe to show next to an input. */
export const fieldErrorSchema = z.object({
  path: z.string(),
  message: z.string(),
});
export type FieldError = z.infer<typeof fieldErrorSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    details: z.array(fieldErrorSchema).optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export function buildApiError(code: ErrorCode, message: string, details?: FieldError[]): ApiError {
  return details && details.length > 0
    ? { error: { code, message, details } }
    : { error: { code, message } };
}

/** Client-side helper to read the code out of an unknown error response. */
export function extractErrorCode(payload: unknown): ErrorCode | null {
  const parsed = apiErrorSchema.safeParse(payload);
  return parsed.success ? parsed.data.error.code : null;
}
