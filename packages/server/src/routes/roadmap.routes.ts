/**
 * Roadmap endpoints: generate, read, versions, and changes.
 */

import { Router } from 'express';
import type { Express, Response } from 'express';
import { Types } from 'mongoose';
import {
  generateRoadmapSchema,
  progressUpdateSchema,
  studySessionSchema,
  type GenerateRoadmapRequest,
  type ProgressUpdateRequest,
  type StudySessionRequest,
} from '@skillmap/shared';
import { asyncHandler, validate, type ValidatedRequest } from '../middleware/validate.js';
import { getUserId, requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { notFound, validationFailed } from '../utils/errors.js';
import { models } from '../models/index.js';
import {
  generateRoadmap,
  getCurrentRoadmap,
  getRoadmapById,
  listVersions,
  getChanges,
} from '../services/roadmapService.js';
import { recordSnapshot, pruneOldSnapshots } from '../services/snapshotService.js';
import { analyzeCareer } from '../services/analysisService.js';
import { evaluateAchievements } from '../services/achievementService.js';

export function registerRoadmapRoutes(app: Express): void {
  const router = Router();
  router.use(requireAuth);

  // ─── Generate or re-plan ──────────────────────────────────────────────
  router.post(
    '/roadmap/generate',
    validate({ body: generateRoadmapSchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = getUserId(req);
      const body = (req as ValidatedRequest<GenerateRoadmapRequest>).validated.body!;

      const careerId = new Types.ObjectId(body.careerId);
      const result = await generateRoadmap({
        userId,
        careerId,
        ...(body.weeklyStudyHours !== undefined ? { weeklyStudyHours: body.weeklyStudyHours } : {}),
        ...(body.months !== undefined ? { months: body.months } : {}),
      });

      const newAchievements = await evaluateAchievements(userId);

      res.status(result.isFirstPlan ? 201 : 200).json({
        ...result.roadmap,
        isReplan: !result.isFirstPlan,
        carriedOverItems: result.carriedOverItems,
        newAchievements,
      });
    }),
  );

  // ─── Current roadmap ──────────────────────────────────────────────────
  router.get(
    '/roadmap',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = getUserId(req);
      const careerIdRaw = (req.query as { careerId?: string }).careerId;

      const careerId = careerIdRaw
        ? parseId(careerIdRaw, 'careerId')
        : await currentCareerId(userId);
      if (!careerId) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'No roadmap yet. Choose a target career first.',
            requestId: 'no-career',
          },
        });
        return;
      }

      const roadmap = await getCurrentRoadmap(userId, careerId);
      if (!roadmap) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'No roadmap yet for this career. Generate one to get started.',
            requestId: 'no-roadmap',
          },
        });
        return;
      }

      res.json(roadmap);
    }),
  );

  // ─── A specific version ───────────────────────────────────────────────
  router.get(
    '/roadmap/:id',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = getUserId(req);
      const id = parseId((req.params as { id: string }).id, 'roadmap id');
      const roadmap = await getRoadmapById(userId, id);
      res.json(roadmap);
    }),
  );

  // ─── Version history ──────────────────────────────────────────────────
  router.get(
    '/roadmap/versions',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = getUserId(req);
      const careerIdRaw = (req.query as { careerId?: string }).careerId;
      if (!careerIdRaw) throw validationFailed('careerId is required');
      const careerId = parseId(careerIdRaw, 'careerId');
      res.json({ versions: await listVersions(userId, careerId) });
    }),
  );

  // ─── What changed in the last re-plan ─────────────────────────────────
  router.get(
    '/roadmap/changes',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = getUserId(req);
      const careerIdRaw = (req.query as { careerId?: string }).careerId;
      if (!careerIdRaw) throw validationFailed('careerId is required');
      const careerId = parseId(careerIdRaw, 'careerId');
      const changes = await getChanges(userId, careerId);
      res.json(
        changes ?? {
          fromVersion: 0,
          toVersion: 0,
          changeLog: [],
          changedItemCount: 0,
          createdAt: null,
        },
      );
    }),
  );

  // ─── Update one item's status ─────────────────────────────────────────
  /**
   * Marking an item done is the trigger for adaptation: the skill level can be
   * raised here, a snapshot is taken, and achievements are re-evaluated.
   */
  router.put(
    '/progress/:itemId',
    validate({ body: progressUpdateSchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = getUserId(req);
      const itemId = parseId((req.params as { itemId: string }).itemId, 'item id');
      const body = (req as ValidatedRequest<ProgressUpdateRequest>).validated.body!;

      const roadmap = await models.Roadmap.findOne({
        userId,
        'items._id': itemId,
      });
      if (!roadmap) throw notFound('Roadmap item');

      const item = roadmap.items.id(itemId);
      if (!item) throw notFound('Roadmap item');

      item.status = body.status;
      if (body.actualHours !== undefined) item.actualHours = body.actualHours;
      item.completedAt = body.status === 'done' ? new Date() : null;

      await roadmap.save();

      await models.UserProgress.updateOne(
        { userId, roadmapId: roadmap._id, itemId },
        {
          $set: {
            status: body.status,
            completedAt: body.status === 'done' ? new Date() : null,
            note: body.note ?? '',
          },
        },
        { upsert: true },
      );

      // A completed skill session can raise the level, but only if the student
      // confirms the new level. SkillMap never raises it on its own.
      let levelRaised = false;
      if (body.status === 'done' && body.newLevel !== undefined && item.skillId) {
        const skillId = item.skillId;
        const existing = await models.UserSkill.findOne({ userId, skillId });
        if (existing) {
          if ((body.newLevel as number) > existing.level) {
            existing.level = body.newLevel as 0 | 1 | 2 | 3 | 4 | 5;
            existing.source = 'roadmap_completed';
            await existing.save();
            levelRaised = true;
          }
        } else {
          await models.UserSkill.create({
            userId,
            skillId,
            level: body.newLevel,
            source: 'roadmap_completed',
          });
          levelRaised = true;
        }
      }

      const analysis = await analyzeCareer(userId, roadmap.careerId as Types.ObjectId);
      await recordSnapshot(userId, roadmap.careerId as Types.ObjectId, analysis);
      await pruneOldSnapshots(userId);
      const newAchievements = await evaluateAchievements(userId);

      res.json({
        itemId: itemId.toString(),
        status: item.status,
        levelRaised,
        alignmentPercent: analysis.alignment.percent,
        newAchievements,
        // The client uses this to offer a re-plan with a specific reason.
        replanSuggested: levelRaised,
        replanReason: levelRaised
          ? `You updated ${item.skillName ?? 'a skill'}. Re-planning will move the skills that depend on it earlier.`
          : null,
      });
    }),
  );

  // ─── Study sessions ───────────────────────────────────────────────────
  router.post(
    '/study-sessions',
    validate({ body: studySessionSchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = getUserId(req);
      const body = (req as ValidatedRequest<StudySessionRequest>).validated.body!;

      await models.StudySession.create({
        userId,
        minutes: body.minutes,
        skillId: body.skillId ?? null,
        roadmapItemId: body.roadmapItemId ?? null,
        note: body.note ?? '',
        loggedOn: body.loggedOn ?? new Date(),
      });

      const newAchievements = await evaluateAchievements(userId);
      res.status(201).json({ logged: true, newAchievements });
    }),
  );

  app.use('/api', router);
}

async function currentCareerId(userId: Types.ObjectId): Promise<Types.ObjectId | null> {
  const profile = (await models.StudentProfile.findOne({ userId })
    .select('targetCareerId')
    .lean()) as { targetCareerId: Types.ObjectId | null } | null;
  return profile?.targetCareerId ?? null;
}

function parseId(value: string, field: string): Types.ObjectId {
  if (!/^[a-f\d]{24}$/i.test(value)) throw validationFailed(`Invalid ${field}`);
  return new Types.ObjectId(value);
}
