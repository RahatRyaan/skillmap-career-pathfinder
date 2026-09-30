/**
 * Profile and preferences routes.
 */

import { Router } from 'express';
import type { Express } from 'express';
import type { Response } from 'express';
import type { Types } from 'mongoose';
import {
  onboardingUpdateSchema,
  preferencesUpdateSchema,
  profileUpdateSchema,
  type ProfileResponse,
  type PreferencesResponse,
  type OnboardingUpdateRequest,
  type PreferencesUpdateRequest,
  type ProfileUpdateRequest,
} from '@skillmap/shared';
import { asyncHandler, validate, type ValidatedRequest } from '../middleware/validate.js';
import { getUserId, requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { notFound } from '../utils/errors.js';
import { models } from '../models/index.js';

export function registerProfileRoutes(app: Express): void {
  const router = Router();

  // Scoped to this module's own paths. Two traps avoided here:
  //  - Mounting at '/api' would look for /api/api inside a router already
  //    mounted at /api, so the guard would never match and these routes would
  //    be silently unauthenticated.
  //  - A bare router.use() would guard every /api route in the app, including
  //    the public catalog endpoints.
  router.use('/profile', requireAuth);
  router.use('/preferences', requireAuth);

  router.get(
    '/profile',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = getUserId(req);
      const profile = await loadProfile(userId);
      res.json(profile);
    }),
  );

  router.put(
    '/profile',
    validate({ body: profileUpdateSchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = getUserId(req);
      const body = (req as ValidatedRequest<ProfileUpdateRequest>).validated.body!;

      const update: Record<string, unknown> = { ...body };
      if (body.name !== undefined) {
        delete update['name'];
        await models.User.findByIdAndUpdate(userId, { $set: { name: body.name } });
      }

      await models.StudentProfile.findOneAndUpdate(
        { userId },
        { $set: update },
        { new: true, upsert: true },
      );

      res.json(await loadProfile(userId));
    }),
  );

  router.put(
    '/preferences',
    validate({ body: preferencesUpdateSchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = getUserId(req);
      const body = (req as ValidatedRequest<PreferencesUpdateRequest>).validated.body!;

      const prefs = await models.UserPreferences.findOneAndUpdate(
        { userId },
        { $set: body },
        { new: true, upsert: true },
      ).lean();

      // A study-hours change must be visible to the roadmap generator immediately.
      if (body.weeklyStudyHours !== undefined) {
        const current = (await models.StudyGoal.findOne({ userId }).lean()) as {
          weeklyMinutes: number;
        } | null;
        const targetMinutes = body.weeklyStudyHours * 60;
        await models.StudyGoal.findOneAndUpdate(
          { userId },
          { $set: { weeklyMinutes: current?.weeklyMinutes ?? targetMinutes } },
          { upsert: true },
        );
      }

      res.json(toPreferencesResponse(prefs as Record<string, unknown>));
    }),
  );

  router.put(
    '/profile/onboarding',
    validate({ body: onboardingUpdateSchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = getUserId(req);
      const body = (req as ValidatedRequest<OnboardingUpdateRequest>).validated.body!;

      const completed = new Set(body.completedSteps);
      if (body.currentStep === 'done') completed.add('done');

      await models.StudentProfile.findOneAndUpdate(
        { userId },
        {
          $set: {
            'onboarding.currentStep': body.currentStep,
            'onboarding.completedSteps': [...completed],
            'onboarding.finished': body.currentStep === 'done',
          },
        },
      );

      res.json(await loadProfile(userId));
    }),
  );

  app.use('/api', router);
}

async function loadProfile(userId: Types.ObjectId): Promise<ProfileResponse> {
  // Each query is awaited separately: destructuring inside Promise.all would
  // shadow these identifiers with their own TDZ bindings inside the callbacks.
  const user = (await models.User.findById(userId).lean()) as {
    _id: Types.ObjectId;
    name: string;
    email: string;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  const prefs = (await models.UserPreferences.findOne({ userId }).lean()) as Record<
    string,
    any
  > | null;
  const profile = (await models.StudentProfile.findOne({ userId }).lean()) as Record<
    string,
    any
  > | null;
  if (!user) throw notFound('Account');

  const targetId = (profile?.['targetCareerId'] ?? null) as Types.ObjectId | null;
  const career = targetId
    ? ((await models.Career.findById(targetId).select('name').lean()) as { name: string } | null)
    : null;

  return {
    id: user._id.toString(),
    userId: user._id.toString(),
    name: user.name,
    email: user.email,
    university: profile?.['university'] ?? '',
    department: profile?.['department'] ?? '',
    academicYear: profile?.['academicYear'] ?? '',
    educationLevel: profile?.['educationLevel'] ?? 'undergraduate',
    graduationYear: profile?.['graduationYear'] ?? null,
    interests: profile?.['interests'] ?? [],
    bio: profile?.['bio'] ?? null,
    targetCareerId: profile?.['targetCareerId']?.toString() ?? null,
    targetCareerName: career?.name ?? null,
    onboarding: {
      currentStep: profile?.['onboarding']?.currentStep ?? 'profile',
      completedSteps: profile?.['onboarding']?.completedSteps ?? [],
      finished: profile?.['onboarding']?.finished ?? false,
    },
    preferences: toPreferencesResponse(prefs),
    createdAt: new Date(user.createdAt).toISOString(),
    updatedAt: new Date(user.updatedAt ?? user.createdAt).toISOString(),
  };
}

function toPreferencesResponse(prefs: Record<string, any> | null): PreferencesResponse {
  return {
    language: prefs?.['language'] ?? 'en',
    theme: prefs?.['theme'] ?? 'system',
    fontScale: prefs?.['fontScale'] ?? 1,
    lowDataMode: prefs?.['lowDataMode'] ?? false,
    weeklyStudyHours: prefs?.['weeklyStudyHours'] ?? 5,
    contentPreference: prefs?.['contentPreference'] ?? 'mixed',
    costPreference: prefs?.['costPreference'] ?? 'free_only',
    contentLanguage: prefs?.['contentLanguage'] ?? 'en',
    analyticsOptIn: prefs?.['analyticsOptIn'] ?? true,
    remindersOptIn: prefs?.['remindersOptIn'] ?? false,
  };
}
