/**
 * Authentication and authorization middleware.
 */

import type { NextFunction, Request, Response } from 'express';
import type { Types } from 'mongoose';
import { forbidden, unauthorized } from '../utils/errors.js';
import { verifyAccessToken } from '../utils/tokens.js';
import { models } from '../models/index.js';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userRole?: string;
}

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (!value || scheme?.toLowerCase() !== 'bearer') return null;
  return value.trim() || null;
}

/** Optional auth: populates req.userId when a valid token is present. */
export async function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    req.userRole = payload.role;
  } catch {
    // An invalid token on an optional route is simply an anonymous request.
  }
  return next();
}

/** Required auth: 401 when the token is missing or invalid. */
export async function requireAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) return next(unauthorized('Please sign in to continue.'));

  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    req.userRole = payload.role;
    return next();
  } catch (error) {
    return next(error);
  }
}

/** Admin-only gate. Must always be mounted after requireAuth. */
/**
 * Role gate.
 *
 * The role is read from the DATABASE, never from the token's `role` claim.
 * A claim is only as trustworthy as the signing secret, and an attacker who
 * has it can mint an admin token for their own account. Reading the role from
 * the user document makes the token's claim irrelevant for authorization.
 */
export function requireRole(...roles: string[]) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.userId) return next(unauthorized('Please sign in to continue.'));

    try {
      const user = (await models.User.findById(req.userId).select('role isActive').lean()) as {
        role: string;
        isActive: boolean;
      } | null;

      if (!user) return next(unauthorized('Your account could not be found.'));
      if (!user.isActive) return next(forbidden('This account has been deactivated.'));

      if (!roles.includes(user.role)) {
        return next(forbidden('This area is restricted to administrators.'));
      }

      // Keep req.userRole accurate for any downstream handler.
      req.userRole = user.role;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

/**
 * Confirms the account still exists and is active.
 *
 * A deleted or deactivated account must stop working immediately, not when its
 * short-lived access token happens to expire.
 *
 * NOTE: this is opt-in (`router.use(requireAuth, requireActiveAccount)`), not
 * part of `requireAuth`. A single middleware that both reads and writes the
 * database is the kind of composition that silently consumes req.body.
 */
export async function requireActiveAccount(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.userId) return next(unauthorized('Please sign in to continue.'));

  const user = (await models.User.findById(req.userId).select('isActive role').lean()) as {
    isActive: boolean;
    role: string;
  } | null;

  if (!user) return next(unauthorized('Your account could not be found.'));
  if (!user.isActive) return next(forbidden('This account has been deactivated.'));

  // The token's role claim may be stale after a role change; trust the database.
  req.userRole = user.role;
  return next();
}

export function getUserId(req: AuthenticatedRequest): Types.ObjectId {
  if (!req.userId) throw unauthorized('Please sign in to continue.');
  return req.userId as unknown as Types.ObjectId;
}
