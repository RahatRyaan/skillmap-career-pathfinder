/**
 * Career analysis, gap, priority, and what-if endpoints.
 *
 * Every score returned here is computed by the deterministic engine in
 * @skillmap/shared and carries the disclaimer. Nothing is invented, and the
 * factors behind each number are returned so the UI can show its work.
 */

import { Router } from 'express';
import type { Express, Response } from 'express';
import { Types } from 'mongoose';
import {
  SCORE_DISCLAIMER,
  analyzeSkillGaps as computeGaps,
  calculateAlignment,
  calculatePriorities,
  simulateSchema,
  type SkillGapResponse,
  type SimulationResult,
  type PrioritiesResponse,
  type OwnedSkill,
  type SkillLevel,
  type SimulateRequest,
  type JobDescriptionAnalyzeRequest,
} from '@skillmap/shared';
import { asyncHandler, validate, type ValidatedRequest } from '../middleware/validate.js';
import { getUserId, requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { validationFailed } from '../utils/errors.js';
import { models } from '../models/index.js';
import { analyzeCareer, type CareerAnalysis } from '../services/analysisService.js';
import { recordSnapshot, getTrend } from '../services/snapshotService.js';
import { jobDescriptionAnalyzeSchema } from '@skillmap/shared';
import { analyzeJobDescription } from '../ai/aiService.js';
import { writeAuditLog } from '../services/auditService.js';

export function registerAnalysisRoutes(app: Express): void {
  const router = Router();
  router.use(requireAuth);

  // ─── Skill gap for a career ───────────────────────────────────────────
  router.get(
    '/skill-gap/:careerId',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = getUserId(req);
      const careerId = parseId((req.params as { careerId: string }).careerId, 'careerId');

      const analysis = await analyzeCareer(userId, careerId);
      await recordSnapshot(userId, careerId, analysis);

      const body: SkillGapResponse = {
        careerId: analysis.careerId,
        careerName: analysis.careerName,
        alignment: analysis.alignment,
        gaps: analysis.gaps,
        categoryAverages: analysis.categoryAverages,
        disclaimer: analysis.disclaimer,
        transferableNotes: analysis.transferableNotes,
      };

      res.json(body);
    }),
  );

  // ─── Priority list ────────────────────────────────────────────────────
  router.get(
    '/careers/:careerId/priorities',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = getUserId(req);
      const careerId = parseId((req.params as { careerId: string }).careerId, 'careerId');

      const analysis = await analyzeCareer(userId, careerId);

      const body: PrioritiesResponse = {
        careerId: analysis.careerId,
        items: analysis.priorities,
        disclaimer: SCORE_DISCLAIMER,
      };

      res.json(body);
    }),
  );

  // ─── What-if simulator ────────────────────────────────────────────────
  /**
   * Answers "what if I raised this skill?" without writing anything.
   *
   * Each hypothetical level is applied to the same effective levels the real
   * engine uses, so the delta shown is exactly what would happen if the student
   * actually made that change.
   */
  router.post(
    '/skill-gap/simulate',
    validate({ body: simulateSchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = getUserId(req);
      const body = (req as ValidatedRequest<SimulateRequest>).validated.body!;

      const careerId = new Types.ObjectId(body.careerId);
      const baseline = await analyzeCareer(userId, careerId);

      const required = toRequired(baseline);
      const changedIds = new Set(body.changes.map((c) => c.skillId));

      /** Effective levels with the given overrides applied on top. */
      const levelsWith = (overrides: Map<string, SkillLevel>): OwnedSkill[] =>
        baseline.gaps.map((g) => ({
          skillId: g.skillId,
          currentLevel: overrides.get(g.skillId) ?? (g.currentLevel as SkillLevel),
        }));

      const allOverrides = new Map<string, SkillLevel>(
        body.changes.map((c) => [c.skillId, c.newLevel as SkillLevel]),
      );
      const projectedPercent = calculateAlignment(required, levelsWith(allOverrides)).percent;

      const perChange: SimulationResult['perChange'] = body.changes.map((change) => {
        const singlePercent = calculateAlignment(
          required,
          levelsWith(new Map([[change.skillId, change.newLevel as SkillLevel]])),
        ).percent;
        const gap = baseline.gaps.find((g) => g.skillId === change.skillId);

        return {
          skillId: change.skillId,
          skillName: gap?.skillName ?? 'Unknown skill',
          fromLevel: gap?.currentLevel ?? 0,
          toLevel: change.newLevel,
          baselinePercent: baseline.alignment.percent,
          projectedPercent: singlePercent,
          deltaPercent: round1(singlePercent - baseline.alignment.percent),
        };
      });

      // Gaps recomputed for the combined projection, so the "what if all of
      // these at once" view is consistent with the headline number.
      const projectedGaps = computeGaps(required, levelsWith(allOverrides));
      const projectedPriorities = calculatePriorities(projectedGaps, {
        requiredEfforts: required.map((r) => r.estimatedEffortHours),
      });

      const result: SimulationResult & {
        projectedGaps: typeof projectedGaps;
        projectedPriorities: typeof projectedPriorities;
        changedSkillCount: number;
      } = {
        careerId: careerId.toString(),
        baselinePercent: baseline.alignment.percent,
        projectedPercent,
        deltaPercent: round1(projectedPercent - baseline.alignment.percent),
        perChange,
        projectedGaps,
        projectedPriorities,
        changedSkillCount: changedIds.size,
        disclaimer: SCORE_DISCLAIMER,
      };

      res.json(result);
    }),
  );

  // ─── Skill map graph ──────────────────────────────────────────────────
  /**
   * Node and edge data for the React Flow graph. Returns the whole career
   * requirement set with the student's level attached, plus edges from
   * prerequisites, so the client can lay out and colour it.
   */
  router.get(
    '/skill-map/:careerId',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = getUserId(req);
      const careerId = parseId((req.params as { careerId: string }).careerId, 'careerId');

      const analysis = await analyzeCareer(userId, careerId);
      const skillIds = analysis.gaps.map((g) => g.skillId);

      const skillDocs = (await models.Skill.find({ _id: { $in: skillIds } })
        .select('name category')
        .lean()) as { _id: Types.ObjectId; name: string; category: string }[];
      const categoryById = new Map(skillDocs.map((s) => [s._id.toString(), s.category]));

      const nodes = analysis.gaps.map((g) => ({
        id: g.skillId,
        label: g.skillName,
        category: categoryById.get(g.skillId) ?? 'Other',
        currentLevel: g.currentLevel,
        requiredLevel: g.requiredLevel,
        gap: g.gap,
        importance: g.importance,
        isCore: g.isCore,
        status: g.label,
        reason: g.reason,
      }));

      const edges = analysis.gaps.flatMap((g) =>
        g.prerequisites
          .filter((p) => skillIds.includes(p))
          .map((p) => ({ source: p, target: g.skillId })),
      );

      res.json({
        careerId: analysis.careerId,
        careerName: analysis.careerName,
        nodes,
        edges,
        alignmentPercent: analysis.alignment.percent,
        disclaimer: analysis.disclaimer,
      });
    }),
  );

  // ─── Alignment trend ──────────────────────────────────────────────────
  router.get(
    '/dashboard/trends',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = getUserId(req);
      const careerIdRaw = (req.query as { careerId?: string }).careerId;
      const careerId = careerIdRaw ? new Types.ObjectId(careerIdRaw) : null;

      if (careerId) {
        res.json({ points: await getTrend(userId, careerId) });
        return;
      }

      const points = await models.AlignmentSnapshot.aggregate<{
        _id: { careerId: Types.ObjectId };
        points: { takenAt: string; percent: number }[];
      }>([
        { $match: { userId } },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: '$careerId',
            points: {
              $push: { takenAt: '$createdAt', percent: '$percent' },
            },
          },
        },
      ]);

      res.json({
        byCareer: points.map((p) => ({ careerId: p._id.careerId.toString(), points: p.points })),
      });
    }),
  );

  // ─── Job description analyzer ─────────────────────────────────────────
  router.post(
    '/job-description/analyze',
    validate({ body: jobDescriptionAnalyzeSchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = getUserId(req);
      const body = (req as ValidatedRequest<JobDescriptionAnalyzeRequest>).validated.body!;

      const analysis = await analyzeJobDescription(body.text, userId.toString());

      await models.JobDescription.create({
        userId,
        text: body.text,
        analysisMode: analysis.mode,
        matchedCareerId: null,
      });

      // Match detected skills to the catalogue so the UI can show the student's
      // standing against this specific posting.
      const catalog = (await models.Skill.find({ isPublished: true })
        .select('name slug')
        .lean()) as { _id: Types.ObjectId; name: string; slug: string }[];

      const matched = analysis.detectedSkills
        .map((d) => {
          const found = catalog.find((s) => s.name.toLowerCase() === d.name.toLowerCase());
          return found
            ? { id: found._id.toString(), name: found.name, confidence: d.confidence }
            : null;
        })
        .filter((m): m is { id: string; name: string; confidence: number } => m !== null);

      const owned = await models.UserSkill.find({ userId }).select('skillId').lean();
      const ownedIds = new Set(owned.map((o) => o.skillId.toString()));
      const matchedCount = matched.filter((m) => ownedIds.has(m.id)).length;

      await writeAuditLog({
        actorUserId: userId,
        action: 'job_description.analyze',
        entity: 'jobDescription',
        metadata: { mode: analysis.mode, detected: analysis.detectedSkills.length },
      });

      res.json({
        ...analysis,
        matchedSkills: matched,
        studentHasMatched: matchedCount,
        matchPercent:
          matched.length === 0 ? null : Math.round((matchedCount / matched.length) * 100),
        notice:
          analysis.notice ??
          'Job description analysis compares the skills a posting lists with your recorded skills. It is not a prediction of whether you would be hired.',
      });
    }),
  );

  app.use('/api', router);
}

function parseId(value: string, field: string): Types.ObjectId {
  if (!/^[a-f\d]{24}$/i.test(value)) {
    throw validationFailed(`Invalid ${field}`);
  }
  return new Types.ObjectId(value);
}

function toRequired(analysis: CareerAnalysis) {
  return analysis.gaps.map((g) => ({
    skillId: g.skillId,
    skillName: g.skillName,
    requiredLevel: g.requiredLevel,
    importance: g.importance,
    isCore: g.isCore,
    prerequisites: g.prerequisites,
    estimatedEffortHours: g.estimatedEffortHours,
  }));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
