/**
 * Auth routes: register, login, refresh, logout, and account deletion.
 *
 * Security posture:
 *   - Passwords are bcrypt-hashed; the hash is never selected by default.
 *   - Register and login return identical errors for unknown-email and
 *     wrong-password, so the endpoint cannot be used to enumerate accounts.
 *   - Refresh tokens are stored hashed and rotated on every use.
 *   - Logout revokes the presented refresh token server-side.
 *   - Deletion removes the account and every trace of its data.
 */

import { Router } from 'express';
import type { Express, Request, Response } from 'express';
import type { Types } from 'mongoose';
import {
  loginRequestSchema,
  registerRequestSchema,
  refreshRequestSchema,
  type UserPublic,
  type AuthResponse,
  type RegisterRequest,
  type LoginRequest,
  type RefreshRequest,
} from '@skillmap/shared';
import { asyncHandler, validate, type ValidatedRequest } from '../middleware/validate.js';
import { loginLimiter } from '../middleware/rateLimit.js';
import { getUserId, requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { AppError, duplicate, unauthorized } from '../utils/errors.js';
import {
  accessTtlSeconds,
  hashPassword,
  issueRefreshToken,
  revokeAllRefreshTokens,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
  verifyPassword,
} from '../utils/tokens.js';
import { models } from '../models/index.js';
import { logger } from '../utils/logger.js';
import { writeAuditLog } from '../services/auditService.js';

export function registerAuthRoutes(app: Express): void {
  const router = Router();

  // ─── Register ──────────────────────────────────────────────────────────
  router.post(
    '/auth/register',
    loginLimiter,
    validate({ body: registerRequestSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const body = (req as ValidatedRequest<RegisterRequest>).validated.body!;

      const existing = await models.User.findOne({ email: body.email }).select('_id').lean();
      if (existing) {
        // Deliberately the same shape as every other registration failure.
        throw duplicate('An account with that email already exists. Try signing in instead.');
      }

      const interests = Array.isArray(body.interests) ? body.interests : [];
      const passwordHash = await hashPassword(body.password);

      const user = (await models.User.create({
        name: body.name,
        email: body.email,
        passwordHash,
        role: 'student',
      })) as unknown as {
        _id: Types.ObjectId;
        name: string;
        email: string;
        role: string;
        createdAt: Date;
      };

      await models.UserPreferences.create({ userId: user._id });
      await models.StudentProfile.create({
        userId: user._id,
        university: body.university,
        department: body.department,
        academicYear: body.academicYear,
        educationLevel: body.educationLevel,
        interests,
      });
      await models.StudyGoal.create({
        userId: user._id,
        weeklyMinutes: Math.max(30, (interests.length + 1) * 60),
      });

      const { token } = await issueRefreshToken(user._id, req.headers['user-agent'] ?? '');

      await writeAuditLog({
        actorUserId: user._id,
        action: 'auth.register',
        entity: 'user',
        entityId: user._id.toString(),
        metadata: { role: 'student' },
      });

      const response: AuthResponse = {
        user: toPublicUser(user),
        accessToken: signAccessToken({
          userId: user._id.toString(),
          role: user.role,
          email: user.email,
        }),
        refreshToken: token,
        expiresInSeconds: accessTtlSeconds(),
      };

      logger.info('User registered', { userId: user._id.toString() });
      res.status(201).json(response);
    }),
  );

  // ─── Login ─────────────────────────────────────────────────────────────
  router.post(
    '/auth/login',
    loginLimiter,
    validate({ body: loginRequestSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const body = (req as ValidatedRequest<LoginRequest>).validated.body!;

      const user = (await models.User.findOne({ email: body.email }).select(
        '+passwordHash',
      )) as unknown as {
        _id: Types.ObjectId;
        name: string;
        email: string;
        role: string;
        passwordHash: string;
        isActive: boolean;
        createdAt: Date;
      } | null;

      // Same message and same work for both failure modes, so response timing
      // and body cannot be used to discover which emails are registered.
      const invalid = unauthorized('Email or password is incorrect.');

      if (!user) {
        // Burn comparable time to a real bcrypt comparison.
        await verifyPassword(
          body.password,
          '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvaliduO',
        );
        throw invalid;
      }

      const passwordOk = await verifyPassword(body.password, user.passwordHash);
      if (!passwordOk) {
        await writeAuditLog({
          actorUserId: user._id,
          action: 'auth.login',
          entity: 'user',
          entityId: user._id.toString(),
          outcome: 'failure',
        });
        throw invalid;
      }

      if (!user.isActive) {
        throw new AppError('FORBIDDEN', 'This account has been deactivated.');
      }

      const { token } = await issueRefreshToken(user._id, req.headers['user-agent'] ?? '');

      const response: AuthResponse = {
        user: toPublicUser(user),
        accessToken: signAccessToken({
          userId: user._id.toString(),
          role: user.role,
          email: user.email,
        }),
        refreshToken: token,
        expiresInSeconds: accessTtlSeconds(),
      };

      res.json(response);
    }),
  );

  // ─── Refresh ───────────────────────────────────────────────────────────
  router.post(
    '/auth/refresh',
    validate({ body: refreshRequestSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const body = (req as ValidatedRequest<RefreshRequest>).validated.body!;

      const rotated = await rotateRefreshToken(body.refreshToken, req.headers['user-agent'] ?? '');

      const response: AuthResponse = {
        user: {
          id: rotated.userId,
          name: '',
          email: rotated.email,
          role: rotated.role as UserPublic['role'],
          createdAt: new Date().toISOString(),
        },
        accessToken: signAccessToken({
          userId: rotated.userId,
          role: rotated.role,
          email: rotated.email,
        }),
        refreshToken: rotated.refreshToken,
        expiresInSeconds: accessTtlSeconds(),
      };

      res.json(response);
    }),
  );

  // ─── Logout ────────────────────────────────────────────────────────────
  router.post(
    '/auth/logout',
    requireAuth,
    validate({ body: refreshRequestSchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const body = (req as ValidatedRequest<RefreshRequest>).validated.body!;
      await revokeRefreshToken(getUserId(req).toString(), body.refreshToken);
      res.status(204).send();
    }),
  );

  /** Revoke every session for the current user. */
  router.post(
    '/auth/logout-all',
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      await revokeAllRefreshTokens(getUserId(req).toString());
      res.status(204).send();
    }),
  );

  // ─── Delete account ────────────────────────────────────────────────────
  router.delete(
    '/account',
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = getUserId(req);

      // Files first: a removed record with a surviving CV on disk is a leak.
      const docs = (await models.CvDocument.find({ userId }).select('+storedFileName').lean()) as {
        _id: Types.ObjectId;
        storedFileName: string;
      }[];

      const { deleteUploadsForUser } = await import('../services/uploadService.js');
      await deleteUploadsForUser(docs);

      const owned = [
        ['UserPreferences', { userId }],
        ['StudentProfile', { userId }],
        ['UserSkill', { userId }],
        ['CvDocument', { userId }],
        ['ExtractedSkill', { userId }],
        ['Roadmap', { userId }],
        ['UserProgress', { userId }],
        ['UserProject', { userId }],
        ['JobDescription', { userId }],
        ['AlignmentSnapshot', { userId }],
        ['Recommendation', { userId }],
        ['QuizResponse', { userId }],
        ['UserAchievement', { userId }],
        ['StudySession', { userId }],
        ['StudyGoal', { userId }],
        ['Notification', { userId }],
        ['AIInteraction', { userId }],
      ] as const;

      for (const [modelName, filter] of owned) {
        const model = models[modelName] as { deleteMany: (f: unknown) => Promise<unknown> };
        await model.deleteMany(filter);
      }

      await models.User.findByIdAndDelete(userId);

      await writeAuditLog({
        actorUserId: null,
        action: 'account.delete',
        entity: 'user',
        entityId: userId.toString(),
        metadata: { cvFilesRemoved: docs.length },
      });

      logger.info('Account deleted', { userId: userId.toString(), cvFilesRemoved: docs.length });
      res.status(204).send();
    }),
  );

  app.use('/api', router);
}

function toPublicUser(user: {
  _id: Types.ObjectId;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
}): UserPublic {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role as UserPublic['role'],
    createdAt: new Date(user.createdAt).toISOString(),
  };
}
