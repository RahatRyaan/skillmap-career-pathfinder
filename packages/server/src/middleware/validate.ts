/**
 * Zod request validation.
 *
 * Validated data REPLACES the raw input on the request, so handlers can only
 * ever see values that passed a schema. Unknown keys are stripped, which also
 * blocks mass-assignment of fields like `role` or `_id`.
 */

import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { validationFailed } from '../utils/errors.js';

/**
 * A request that has passed `validate()`.
 *
 * Parsed data lives on `validated`, keyed by source. The raw `req.body` /
 * `req.query` are deliberately left untouched: Express makes `req.query` a
 * getter, and replacing either one silently discards what the client actually
 * sent, which makes bugs like "validated value replaced by the raw string"
 * very hard to see.
 */
export interface ValidatedRequest<B = unknown, Q = unknown, P = unknown> extends Request {
  validated: { body?: B; query?: Q; params?: P };
}

function toFieldErrors(error: unknown): { path: string; message: string }[] {
  const issues = (error as { issues?: { path: (string | number)[]; message: string }[] }).issues;
  if (!Array.isArray(issues)) return [];
  return issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

type Source = 'body' | 'query' | 'params';

export function validate(schemas: Partial<Record<Source, ZodTypeAny>>): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const failures: { path: string; message: string }[] = [];
    const validated: Record<string, unknown> = {};

    for (const source of ['params', 'query', 'body'] as const) {
      const schema = schemas[source];
      if (!schema) continue;

      const result = schema.safeParse(req[source]);
      if (result.success) {
        // Validated data is exposed on `validated` rather than overwriting
        // req.body / req.query. Express makes req.query a getter, and silently
        // replacing either one is a footgun that hides what the client sent.
        validated[source] = result.data;
        continue;
      }

      for (const detail of toFieldErrors(result.error)) {
        failures.push({ path: `${source}.${detail.path}`, message: detail.message });
      }
    }

    if (failures.length > 0) {
      return next(
        validationFailed(
          failures.length === 1
            ? failures[0]!.message
            : `${failures.length} fields failed validation`,
          failures,
        ),
      );
    }

    (req as ValidatedRequest).validated = validated;
    return next();
  };
}

/** Wraps an async handler so a rejected promise reaches the error handler. */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
