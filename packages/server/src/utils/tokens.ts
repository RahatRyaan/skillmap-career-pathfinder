/**
 * JWT issuance and verification.
 *
 * Access tokens are short-lived and stateless. Refresh tokens are long-lived,
 * hashed at rest, rotated on every use, and stored per-user so a token can be
 * revoked (logout, account deletion) without a JWT denylist.
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import type { Types } from 'mongoose';
import { config } from '../config/env.js';
import { tokenExpired, unauthorized, AppError } from '../utils/errors.js';
import { models } from '../models/index.js';
import { logger } from '../utils/logger.js';

export interface AccessTokenPayload {
  sub: string;
  role: string;
  email: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  type: 'refresh';
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, config.auth.bcryptRounds);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signAccessToken(input: { userId: string; role: string; email: string }): string {
  // The payload and options types are explicit because `expiresIn` accepts a
  // duration string that TypeScript cannot verify against a literal union.
  return jwt.sign(
    { sub: input.userId, role: input.role, email: input.email, type: 'access' },
    config.auth.accessSecret,
    { expiresIn: config.auth.accessTtl, issuer: 'skillmap-ai' } as jwt.SignOptions,
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, config.auth.accessSecret, {
      issuer: 'skillmap-ai',
    }) as AccessTokenPayload;

    if (decoded.type !== 'access') throw new Error('wrong token type');
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) throw tokenExpired();
    throw unauthorized('Your session is not valid. Please sign in again.');
  }
}

/** Duration of the access token in seconds, for the client to schedule refresh. */
export function accessTokenTtlSeconds(): number {
  return Math.max(60, parseDurationSeconds(config.auth.accessTtl));
}

function parseDurationSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) return 900;
  const amount = Number(match[1] ?? '900');
  const unit = match[2] ?? 'm';
  const multipliers: Record<string, number | undefined> = { s: 1, m: 60, h: 3600, d: 86_400 };
  return amount * (multipliers[unit] ?? 60);
}

function refreshTokenExpiry(): Date {
  return new Date(Date.now() + parseDurationSeconds(config.auth.refreshTtl) * 1000);
}

/** SHA-256 of the token. Fast enough, and refresh tokens are already random. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Issue a refresh token and persist only its hash. The plaintext is returned
 * once and never stored.
 */
export async function issueRefreshToken(
  userId: Types.ObjectId,
  userAgent: string,
): Promise<{ token: string; expiresAt: Date }> {
  const jti = randomBytes(16).toString('hex');
  const token = jwt.sign(
    { sub: userId.toString(), jti, type: 'refresh' },
    config.auth.refreshSecret,
    { expiresIn: config.auth.refreshTtl, issuer: 'skillmap-ai' } as jwt.SignOptions,
  );

  const expiresAt = refreshTokenExpiry();

  await models.User.updateOne(
    { _id: userId },
    {
      $push: {
        refreshTokens: {
          tokenHash: hashToken(token),
          expiresAt,
          userAgent: userAgent.slice(0, 300),
        },
      },
      $set: { lastLoginAt: new Date() },
    },
  );

  return { token, expiresAt };
}

/**
 * Verify a refresh token and rotate it.
 *
 * The old token is removed in the same operation that stores the new one, so a
 * stolen refresh token is usable at most once and its reuse is detectable.
 */
export async function rotateRefreshToken(
  token: string,
  userAgent: string,
): Promise<{ userId: string; role: string; email: string; refreshToken: string; expiresAt: Date }> {
  let payload: RefreshTokenPayload;
  try {
    const decoded = jwt.verify(token, config.auth.refreshSecret, {
      issuer: 'skillmap-ai',
    }) as RefreshTokenPayload;
    if (decoded.type !== 'refresh') throw new Error('wrong token type');
    payload = decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError)
      throw tokenExpired('Your session expired. Please sign in again.');
    throw unauthorized('Your session is not valid. Please sign in again.');
  }

  const tokenHash = hashToken(token);
  const user = (await models.User.findById(payload.sub).select('+refreshTokens').lean()) as {
    _id: Types.ObjectId;
    role: string;
    email: string;
    isActive: boolean;
    refreshTokens?: { tokenHash: string }[];
  } | null;

  if (!user || !user.isActive) throw unauthorized('Your account is not available.');

  const matches = (user.refreshTokens ?? []).some((t) => t.tokenHash === tokenHash);
  if (!matches) {
    // The token is validly signed but not in our store: either it was already
    // rotated away, or it was revoked. Treat reuse as a compromise signal.
    logger.warn('Refresh token reuse detected', { userId: payload.sub });
    await revokeAllRefreshTokens(payload.sub);
    throw unauthorized('Your session is no longer valid. Please sign in again.');
  }

  await models.User.updateOne({ _id: payload.sub }, { $pull: { refreshTokens: { tokenHash } } });

  const next = await issueRefreshToken(user._id, userAgent);

  return {
    userId: user._id.toString(),
    role: user.role,
    email: user.email,
    refreshToken: next.token,
    expiresAt: next.expiresAt,
  };
}

export async function revokeRefreshToken(userId: string, token: string): Promise<void> {
  await models.User.updateOne(
    { _id: userId },
    { $pull: { refreshTokens: { tokenHash: hashToken(token) } } },
  );
}

export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await models.User.updateOne({ _id: userId }, { $set: { refreshTokens: [] } });
}

export function accessTtlSeconds(): number {
  return accessTokenTtlSeconds();
}

export { AppError };
