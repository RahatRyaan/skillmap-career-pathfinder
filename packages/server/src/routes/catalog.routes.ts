/**
 * Skills catalog, user skills, and careers.
 *
 * The career endpoints return a student's alignment when a valid token is
 * present, and behave as a plain public catalog when it is not.
 */

import { Router } from 'express';
import type { Express } from 'express';
import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import {
  SKILL_LEVEL_DESCRIPTIONS,
  careerSearchQuerySchema,
  compareQuerySchema,
  skillSearchQuerySchema,
  userSkillCreateSchema,
  userSkillUpdateSchema,
  type CareerDetail,
  type CareerListItem,
  type CareerSearchQuery,
  type CompareQuery,
  type SkillCatalogItem,
  type SkillSearchQuery,
  type UserSkillResponse,
  type UserSkillCreateRequest,
  type UserSkillUpdateRequest,
} from '@skillmap/shared';
import { asyncHandler, validate, type ValidatedRequest } from '../middleware/validate.js';
import {
  getUserId,
  optionalAuth,
  requireAuth,
  type AuthenticatedRequest,
} from '../middleware/auth.js';
import { conflict, notFound, validationFailed } from '../utils/errors.js';
import { models } from '../models/index.js';
import { paginate } from '@skillmap/shared';

export function registerCatalogRoutes(app: Express): void {
  const router = Router();

  // ─── Skill catalog (public) ───────────────────────────────────────────
  router.get(
    '/skills',
    validate({ query: skillSearchQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { page, limit, search, category } = (req as ValidatedRequest<never, SkillSearchQuery>)
        .validated.query!;

      const filter: Record<string, unknown> = { isPublished: true };
      if (category) filter['category'] = category;
      if (search) {
        const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter['$or'] = [
          { name: new RegExp(escaped, 'i') },
          { aliases: new RegExp(escaped, 'i') },
          { description: new RegExp(escaped, 'i') },
        ];
      }

      const [total, docs] = await Promise.all([
        models.Skill.countDocuments(filter),
        models.Skill.find(filter)
          .sort({ name: 1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
      ]);

      const items: SkillCatalogItem[] = (docs as Record<string, any>[]).map((d) => ({
        id: d._id.toString(),
        name: d.name,
        slug: d.slug,
        category: d.category,
        description: d.description ?? null,
        aliases: d.aliases ?? [],
      }));

      res.json(paginate(items, total, page, limit));
    }),
  );

  // ─── The current student's own skills ──────────────────────────────────
  router.get(
    '/user-skills',
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = getUserId(req);
      const rows = (await models.UserSkill.find({ userId })
        .populate('skillId', 'name slug category')
        .lean()) as Record<string, any>[];

      res.json({ items: rows.map(toUserSkillResponse) });
    }),
  );

  router.post(
    '/user-skills',
    requireAuth,
    validate({ body: userSkillCreateSchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = getUserId(req);
      const body = (req as ValidatedRequest<UserSkillCreateRequest>).validated.body!;

      const skill = await models.Skill.findById(body.skillId).select('_id isPublished').lean();
      if (!skill) throw notFound('Skill');

      const existing = await models.UserSkill.findOne({ userId, skillId: body.skillId })
        .select('_id')
        .lean();
      if (existing) {
        throw conflict('You have already added that skill. Edit its level instead.');
      }

      await models.UserSkill.create({
        userId,
        skillId: body.skillId,
        level: body.level,
        source: body.source,
        evidence: body.evidence ?? null,
      });

      const created = await models.UserSkill.findOne({ userId, skillId: body.skillId })
        .populate('skillId', 'name slug category')
        .lean();
      res.status(201).json(toUserSkillResponse(created as Record<string, any>));
    }),
  );

  router.put(
    '/user-skills/:id',
    requireAuth,
    validate({ body: userSkillUpdateSchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = getUserId(req);
      const body = (req as ValidatedRequest<UserSkillUpdateRequest>).validated.body!;
      const id = (req.params as { id: string }).id;

      if (!/^[a-f\d]{24}$/i.test(id)) throw validationFailed('Invalid skill record id');

      const updated = await models.UserSkill.findOneAndUpdate(
        { _id: id, userId },
        { $set: body },
        { new: true },
      ).populate('skillId', 'name slug category');

      if (!updated) throw notFound('Skill record');
      res.json(toUserSkillResponse(updated as unknown as Record<string, any>));
    }),
  );

  router.delete(
    '/user-skills/:id',
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = getUserId(req);
      const id = (req.params as { id: string }).id;
      if (!/^[a-f\d]{24}$/i.test(id)) throw validationFailed('Invalid skill record id');

      const result = await models.UserSkill.findOneAndDelete({ _id: id, userId });
      if (!result) throw notFound('Skill record');
      res.status(204).send();
    }),
  );

  // ─── Careers (public, alignment added when authenticated) ──────────────
  router.get(
    '/careers',
    optionalAuth,
    validate({ query: careerSearchQuerySchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { page, limit, search, category } = (req as ValidatedRequest<never, CareerSearchQuery>)
        .validated.query!;

      const filter: Record<string, unknown> = { isPublished: true };
      if (category) filter['category'] = category;
      if (search) {
        const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter['$or'] = [{ name: new RegExp(escaped, 'i') }, { summary: new RegExp(escaped, 'i') }];
      }

      const [total, docs] = await Promise.all([
        models.Career.countDocuments(filter),
        models.Career.find(filter)
          .sort({ name: 1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
      ]);

      const careers = docs as Record<string, any>[];
      const items: CareerListItem[] = await Promise.all(
        careers.map(async (career) => {
          const base = {
            id: career._id.toString(),
            slug: career.slug,
            name: career.name,
            category: career.category,
            summary: career.summary,
            alignmentPercent: null as number | null,
            matchedSkillCount: 0,
            requiredSkillCount: 0,
            topGapSkillNames: [] as string[],
          };

          if (!req.userId) {
            const count = await models.CareerSkill.countDocuments({ careerId: career._id });
            return { ...base, requiredSkillCount: count };
          }

          const { analyzeCareer } = await import('../services/analysisService.js');
          const analysis = await analyzeCareer(req.userId, career._id as Types.ObjectId);
          return {
            ...base,
            alignmentPercent: analysis.alignment.percent,
            matchedSkillCount: analysis.ownedRequiredCount,
            requiredSkillCount: analysis.alignment.skillCount,
            topGapSkillNames: analysis.gaps
              .filter((g) => g.gap > 0)
              .sort((a, b) => b.gap - a.gap)
              .slice(0, 3)
              .map((g) => g.skillName),
          };
        }),
      );

      res.json(paginate(items, total, page, limit));
    }),
  );

  router.get(
    '/careers/compare',
    optionalAuth,
    validate({ query: compareQuerySchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { ids } = (req as ValidatedRequest<never, CompareQuery>).validated.query!;

      const objectIds = ids.map((id) => new Types.ObjectId(id));
      const careers = (await models.Career.find({
        _id: { $in: objectIds },
        isPublished: true,
      }).lean()) as Record<string, any>[];
      if (careers.length < 2) throw notFound('Careers to compare');

      const { analyzeCareer } = await import('../services/analysisService.js');
      const compared = await Promise.all(
        careers.map(async (career) => {
          if (!req.userId) {
            return {
              id: career._id.toString(),
              name: career.name,
              category: career.category,
              summary: career.summary,
              alignmentPercent: null,
              requiredSkillCount: await models.CareerSkill.countDocuments({ careerId: career._id }),
              missingSkillCount: null,
              topGaps: [] as { skillName: string; gap: number; importance: string }[],
              sharedSkillCount: 0,
            };
          }
          const analysis = await analyzeCareer(req.userId, career._id as Types.ObjectId);
          return {
            id: career._id.toString(),
            name: career.name,
            category: career.category,
            summary: career.summary,
            alignmentPercent: analysis.alignment.percent,
            requiredSkillCount: analysis.alignment.skillCount,
            missingSkillCount: analysis.gaps.filter((g) => g.gap > 0).length,
            topGaps: analysis.gaps
              .filter((g) => g.gap > 0)
              .sort((a, b) => b.gap - a.gap)
              .slice(0, 5)
              .map((g) => ({ skillName: g.skillName, gap: g.gap, importance: g.importance })),
            sharedSkillCount: analysis.ownedRequiredCount,
          };
        }),
      );

      // Skills present in every compared career, so the UI can highlight overlap.
      const allSkillSets = await Promise.all(
        careers.map(async (c) => {
          const mappings = await models.CareerSkill.find({ careerId: c._id }).lean();
          return new Set(
            (mappings as { skillId: Types.ObjectId }[]).map((m) => m.skillId.toString()),
          );
        }),
      );
      const shared =
        allSkillSets.length > 0
          ? [...allSkillSets[0]!].filter((id) => allSkillSets.every((s) => s.has(id)))
          : [];

      res.json({
        careers: compared.map((c) => ({ ...c, sharedSkillCount: shared.length })),
        sharedSkillCount: shared.length,
        disclaimer:
          "These scores represent alignment with each role's listed skill requirements and are not predictions of employment.",
      });
    }),
  );

  router.get(
    '/careers/:id',
    optionalAuth,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const id = (req.params as { id: string }).id;
      if (!/^[a-f\d]{24}$/i.test(id)) throw validationFailed('Invalid career id');

      const career = (await models.Career.findById(id).lean()) as Record<string, any> | null;
      if (!career) throw notFound('Career');

      const mappings = (await models.CareerSkill.find({ careerId: career._id })
        .populate('skillId', 'name slug category')
        .lean()) as Record<string, any>[];

      const prereqNames = await resolvePrerequisiteNames(mappings);

      let alignmentPercent: number | null = null;
      let studentLevels = new Map<string, number>();
      let missingSkillCount = 0;

      if (req.userId) {
        const { analyzeCareer } = await import('../services/analysisService.js');
        const analysis = await analyzeCareer(req.userId, career._id as Types.ObjectId);
        alignmentPercent = analysis.alignment.percent;
        studentLevels = new Map(analysis.gaps.map((g) => [g.skillId, g.currentLevel]));
        missingSkillCount = analysis.gaps.filter((g) => g.gap > 0).length;
      }

      const detail: CareerDetail = {
        id: career._id.toString(),
        slug: career.slug,
        name: career.name,
        category: career.category,
        description: career.description,
        responsibilities: career.responsibilities ?? [],
        typicalProjects: career.typicalProjects ?? [],
        alignmentPercent,
        missingSkillCount,
        disclaimer:
          'This score represents alignment with the selected skill requirements and is not a prediction of employment.',
        skills: mappings
          .map((m) => {
            const skill = m.skillId as Record<string, any> | null;
            const current = studentLevels.get(skill?._id?.toString() ?? '') ?? null;
            const gap = current === null ? m.requiredLevel : Math.max(0, m.requiredLevel - current);
            return {
              skillId: skill?._id?.toString() ?? '',
              skillName: skill?.name ?? 'Unknown skill',
              skillSlug: skill?.slug ?? '',
              category: skill?.category ?? '',
              requiredLevel: m.requiredLevel,
              importance: m.importance,
              importanceWeight: m.importance === 'high' ? 3 : m.importance === 'medium' ? 2 : 1,
              isCore: m.isCore,
              prerequisites: (m.prerequisiteSkillIds as Types.ObjectId[]).map((pid) => ({
                skillId: pid.toString(),
                skillName: prereqNames.get(pid.toString()) ?? 'Unknown skill',
              })),
              estimatedEffortHours: m.estimatedEffortHours,
              studentLevel: current,
              gap,
              label: classifyForDisplay(gap, m.importance),
            };
          })
          .sort(
            (a, b) =>
              b.importanceWeight - a.importanceWeight || a.skillName.localeCompare(b.skillName),
          ),
      };

      res.json(detail);
    }),
  );

  app.use('/api', router);
}

async function resolvePrerequisiteNames(
  mappings: Record<string, any>[],
): Promise<Map<string, string>> {
  const ids = new Set<string>();
  for (const m of mappings) {
    for (const pid of (m.prerequisiteSkillIds ?? []) as Types.ObjectId[]) {
      ids.add(pid.toString());
    }
  }
  if (ids.size === 0) return new Map();

  const skills = (await models.Skill.find({ _id: { $in: [...ids] } })
    .select('name')
    .lean()) as { _id: Types.ObjectId; name: string }[];

  return new Map(skills.map((s) => [s._id.toString(), s.name]));
}

function classifyForDisplay(gap: number, importance: string) {
  if (gap <= 0) return 'strong' as const;
  if (importance === 'high' && gap >= 2) return 'critical' as const;
  if (gap >= 3) return 'critical' as const;
  if (gap >= 2) return 'gap' as const;
  return 'developing' as const;
}

function toUserSkillResponse(row: Record<string, any>): UserSkillResponse {
  const skill = row.skillId as Record<string, any> | null;
  return {
    id: row._id.toString(),
    skillId: skill?._id?.toString() ?? '',
    skillName: skill?.name ?? 'Unknown skill',
    skillSlug: skill?.slug ?? '',
    category: skill?.category ?? '',
    level: row.level,
    levelDescription: SKILL_LEVEL_DESCRIPTIONS[row.level as 0 | 1 | 2 | 3 | 4 | 5] ?? '',
    source: row.source,
    needsReview: row.source === 'ai_extracted',
    evidence: row.evidence ?? null,
    updatedAt: new Date(row.updatedAt ?? row.createdAt).toISOString(),
  };
}
