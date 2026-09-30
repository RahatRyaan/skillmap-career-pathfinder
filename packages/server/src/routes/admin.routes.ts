/**
 * Admin API.
 *
 * Every route requires both a valid token and the admin role, checked against
 * the database rather than the token's claim, so a stale or forged role cannot
 * grant access.
 *
 * Impact numbers are computed, never entered. See impactService.
 */

import { Router } from 'express';
import type { Express, Response } from 'express';
import { Types } from 'mongoose';
import {
  careerSkillMappingSchema,
  careerUpsertSchema,
  paginationQuerySchema,
  projectUpsertSchema,
  resourceUpsertSchema,
  skillUpsertSchema,
} from '@skillmap/shared';
import { asyncHandler, validate, type ValidatedRequest } from '../middleware/validate.js';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.js';
import { conflict, notFound } from '../utils/errors.js';
import { models } from '../models/index.js';
import { computeImpact, computePlatformStats } from '../services/impactService.js';
import { writeAuditLog } from '../services/auditService.js';
import { getUserId } from '../middleware/auth.js';

type AdminBody = Record<string, unknown>;

export function registerAdminRoutes(app: Express): void {
  const router = Router();
  router.use(requireAuth, requireRole('admin'));

  // ─── Impact and platform statistics ───────────────────────────────────
  router.get(
    '/admin/impact',
    asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
      res.json(await computeImpact());
    }),
  );

  router.get(
    '/admin/stats',
    asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
      res.json(await computePlatformStats());
    }),
  );

  // ─── Careers ──────────────────────────────────────────────────────────
  router.get(
    '/admin/careers',
    validate({ query: paginationQuerySchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { page, limit } = (req as ValidatedRequest<never, { page: number; limit: number }>)
        .validated.query!;
      const [total, docs] = await Promise.all([
        models.Career.countDocuments({}),
        models.Career.find({})
          .sort({ name: 1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
      ]);
      res.json({ items: docs, total, page, limit });
    }),
  );

  router.post(
    '/admin/careers',
    validate({ body: careerUpsertSchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const body = (req as ValidatedRequest<import('@skillmap/shared').CareerUpsertRequest>)
        .validated.body!;
      await assertSlugFree(models.Career, body.slug, null);
      const doc = await models.Career.create(body);
      await audit(req, 'admin.career.create', 'career', doc._id);
      res.status(201).json(doc);
    }),
  );

  router.put(
    '/admin/careers/:id',
    validate({ body: careerUpsertSchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const id = parseId((req.params as { id: string }).id);
      const body = (req as ValidatedRequest<import('@skillmap/shared').CareerUpsertRequest>)
        .validated.body!;
      await assertSlugFree(models.Career, body.slug, id);
      const doc = await models.Career.findByIdAndUpdate(id, { $set: body }, { new: true });
      if (!doc) throw notFound('Career');
      await audit(req, 'admin.career.update', 'career', id);
      res.json(doc);
    }),
  );

  router.delete(
    '/admin/careers/:id',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const id = parseId((req.params as { id: string }).id);
      const inUse = await models.CareerSkill.countDocuments({ careerId: id });
      const hasStudents = await models.StudentProfile.countDocuments({ targetCareerId: id });
      if (hasStudents > 0) {
        throw conflict(
          `${hasStudents} student${hasStudents === 1 ? ' has' : 's have'} this career as their target, so it cannot be deleted. Unpublish it instead.`,
        );
      }
      await models.CareerSkill.deleteMany({ careerId: id });
      await models.Career.deleteOne({ _id: id });
      await audit(req, 'admin.career.delete', 'career', id, { removedMappings: inUse });
      res.status(204).send();
    }),
  );

  // ─── Skills ───────────────────────────────────────────────────────────
  router.get(
    '/admin/skills',
    validate({ query: paginationQuerySchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { page, limit } = (req as ValidatedRequest<never, { page: number; limit: number }>)
        .validated.query!;
      const [total, docs] = await Promise.all([
        models.Skill.countDocuments({}),
        models.Skill.find({})
          .sort({ category: 1, name: 1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
      ]);
      res.json({ items: docs, total, page, limit });
    }),
  );

  router.post(
    '/admin/skills',
    validate({ body: skillUpsertSchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const body = (req as ValidatedRequest<import('@skillmap/shared').SkillUpsertRequest>)
        .validated.body!;
      await assertSlugFree(models.Skill, body.slug, null);
      const doc = await models.Skill.create(body);
      for (const alias of body.aliases) {
        await models.SkillAlias.updateOne(
          { alias: alias.toLowerCase() },
          { $set: { alias: alias.toLowerCase(), skillId: doc._id } },
          { upsert: true },
        );
      }
      await audit(req, 'admin.skill.create', 'skill', doc._id);
      res.status(201).json(doc);
    }),
  );

  router.put(
    '/admin/skills/:id',
    validate({ body: skillUpsertSchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const id = parseId((req.params as { id: string }).id);
      const body = (req as ValidatedRequest<import('@skillmap/shared').SkillUpsertRequest>)
        .validated.body!;
      await assertSlugFree(models.Skill, body.slug, id);
      const doc = await models.Skill.findByIdAndUpdate(id, { $set: body }, { new: true });
      if (!doc) throw notFound('Skill');
      await audit(req, 'admin.skill.update', 'skill', id);
      res.json(doc);
    }),
  );

  router.delete(
    '/admin/skills/:id',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const id = parseId((req.params as { id: string }).id);
      const heldBy = await models.UserSkill.countDocuments({ skillId: id });
      const requiredBy = await models.CareerSkill.countDocuments({ skillId: id });
      if (requiredBy > 0) {
        throw conflict(
          `${requiredBy} career requirement${requiredBy === 1 ? '' : 's'} still reference this skill. Remove those mappings first.`,
        );
      }
      await models.SkillAlias.deleteMany({ skillId: id });
      await models.Skill.deleteOne({ _id: id });
      await audit(req, 'admin.skill.delete', 'skill', id, { studentsAffected: heldBy });
      res.status(204).send();
    }),
  );

  // ─── Career-skill mappings ────────────────────────────────────────────
  router.get(
    '/admin/career-skills',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const careerId = (req.query as { careerId?: string }).careerId;
      const filter = careerId ? { careerId: new Types.ObjectId(careerId) } : {};
      const docs = await models.CareerSkill.find(filter)
        .populate('careerId', 'name slug')
        .populate('skillId', 'name slug category')
        .sort({ importance: 1 })
        .lean();
      res.json({ items: docs });
    }),
  );

  router.post(
    '/admin/career-skills',
    validate({ body: careerSkillMappingSchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const body = (req as ValidatedRequest<import('@skillmap/shared').CareerSkillMappingRequest>)
        .validated.body!;

      const careerId = new Types.ObjectId(body.careerId);
      const skillId = new Types.ObjectId(body.skillId);

      const [career, skill] = await Promise.all([
        models.Career.findById(careerId).select('_id').lean(),
        models.Skill.findById(skillId).select('_id').lean(),
      ]);
      if (!career) throw notFound('Career');
      if (!skill) throw notFound('Skill');

      // A self-referencing prerequisite would make the roadmap engine loop.
      if (body.prerequisiteSkillIds.some((p) => p === body.skillId)) {
        throw conflict('A skill cannot be its own prerequisite.');
      }

      const doc = await models.CareerSkill.updateOne(
        { careerId, skillId },
        {
          $set: {
            careerId,
            skillId,
            requiredLevel: body.requiredLevel,
            importance: body.importance,
            isCore: body.isCore,
            prerequisiteSkillIds: body.prerequisiteSkillIds,
            estimatedEffortHours: body.estimatedEffortHours,
          },
        },
        { upsert: true },
      );

      await audit(req, 'admin.careerSkill.upsert', 'careerSkill', skillId, { careerId });
      res.status(doc.upsertedCount > 0 ? 201 : 200).json({ careerId, skillId, updated: true });
    }),
  );

  router.delete(
    '/admin/career-skills/:careerId/:skillId',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const careerId = parseId((req.params as { careerId: string }).careerId);
      const skillId = parseId((req.params as { skillId: string }).skillId);
      await models.CareerSkill.deleteOne({ careerId, skillId });
      await audit(req, 'admin.careerSkill.delete', 'careerSkill', skillId, { careerId });
      res.status(204).send();
    }),
  );

  // ─── Resources ────────────────────────────────────────────────────────
  router.get(
    '/admin/resources',
    validate({ query: paginationQuerySchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { page, limit } = (req as ValidatedRequest<never, { page: number; limit: number }>)
        .validated.query!;
      const [total, docs] = await Promise.all([
        models.LearningResource.countDocuments({}),
        models.LearningResource.find({})
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('skillId', 'name')
          .lean(),
      ]);
      res.json({ items: docs, total, page, limit });
    }),
  );

  router.post(
    '/admin/resources',
    validate({ body: resourceUpsertSchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const body = (req as ValidatedRequest<import('@skillmap/shared').ResourceUpsertRequest>)
        .validated.body!;
      const doc = await models.LearningResource.create(body);
      await audit(req, 'admin.resource.create', 'resource', doc._id);
      res.status(201).json(doc);
    }),
  );

  router.put(
    '/admin/resources/:id',
    validate({ body: resourceUpsertSchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const id = parseId((req.params as { id: string }).id);
      const body = (req as ValidatedRequest<import('@skillmap/shared').ResourceUpsertRequest>)
        .validated.body!;
      const doc = await models.LearningResource.findByIdAndUpdate(
        id,
        { $set: body },
        { new: true },
      );
      if (!doc) throw notFound('Resource');
      await audit(req, 'admin.resource.update', 'resource', id);
      res.json(doc);
    }),
  );

  router.delete(
    '/admin/resources/:id',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const id = parseId((req.params as { id: string }).id);
      await models.LearningResource.deleteOne({ _id: id });
      await audit(req, 'admin.resource.delete', 'resource', id);
      res.status(204).send();
    }),
  );

  // ─── Projects ─────────────────────────────────────────────────────────
  router.get(
    '/admin/projects',
    validate({ query: paginationQuerySchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { page, limit } = (req as ValidatedRequest<never, { page: number; limit: number }>)
        .validated.query!;
      const [total, docs] = await Promise.all([
        models.Project.countDocuments({}),
        models.Project.find({})
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('careerId', 'name')
          .populate('skillIds')
          .lean(),
      ]);
      res.json({ items: docs, total, page, limit });
    }),
  );

  router.post(
    '/admin/projects',
    validate({ body: projectUpsertSchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const body = (req as ValidatedRequest<import('@skillmap/shared').ProjectUpsertRequest>)
        .validated.body!;
      await assertSlugFree(models.Project, body.slug, null);
      const doc = await models.Project.create(body);
      await audit(req, 'admin.project.create', 'project', doc._id);
      res.status(201).json(doc);
    }),
  );

  router.put(
    '/admin/projects/:id',
    validate({ body: projectUpsertSchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const id = parseId((req.params as { id: string }).id);
      const body = (req as ValidatedRequest<import('@skillmap/shared').ProjectUpsertRequest>)
        .validated.body!;
      await assertSlugFree(models.Project, body.slug, id);
      const doc = await models.Project.findByIdAndUpdate(id, { $set: body }, { new: true });
      if (!doc) throw notFound('Project');
      await audit(req, 'admin.project.update', 'project', id);
      res.json(doc);
    }),
  );

  router.delete(
    '/admin/projects/:id',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const id = parseId((req.params as { id: string }).id);
      await models.UserProject.deleteMany({ projectId: id });
      await models.Project.deleteOne({ _id: id });
      await audit(req, 'admin.project.delete', 'project', id);
      res.status(204).send();
    }),
  );

  // ─── Job descriptions ─────────────────────────────────────────────────
  router.get(
    '/admin/job-descriptions',
    validate({ query: paginationQuerySchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { page, limit } = (req as ValidatedRequest<never, { page: number; limit: number }>)
        .validated.query!;
      const [total, docs] = await Promise.all([
        models.JobDescription.countDocuments({}),
        models.JobDescription.find({})
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('userId', 'name email')
          .lean(),
      ]);
      res.json({ items: docs, total, page, limit });
    }),
  );

  router.delete(
    '/admin/job-descriptions/:id',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const id = parseId((req.params as { id: string }).id);
      await models.JobDescription.deleteOne({ _id: id });
      await audit(req, 'admin.jobDescription.delete', 'jobDescription', id);
      res.status(204).send();
    }),
  );

  // ─── Users ────────────────────────────────────────────────────────────
  router.get(
    '/admin/users',
    validate({ query: paginationQuerySchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { page, limit } = (req as ValidatedRequest<never, { page: number; limit: number }>)
        .validated.query!;
      const [total, docs] = await Promise.all([
        models.User.countDocuments({}),
        // The password hash is never selected, and never serialised.
        models.User.find({})
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .select('-passwordHash -refreshTokens')
          .lean(),
      ]);
      res.json({ items: docs, total, page, limit });
    }),
  );

  router.patch(
    '/admin/users/:id/active',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const id = parseId((req.params as { id: string }).id);
      const isActive = (req.body as AdminBody).isActive === true;

      // An admin must not be able to deactivate themselves and lock everyone out.
      if (getUserId(req).toString() === id.toString() && !isActive) {
        throw conflict('You cannot deactivate your own account.');
      }

      const user = await models.User.findByIdAndUpdate(id, { $set: { isActive } }, { new: true });
      if (!user) throw notFound('User');

      // Deactivating must take effect immediately, so sessions are revoked.
      if (!isActive) await models.User.updateOne({ _id: id }, { $set: { refreshTokens: [] } });

      await audit(req, 'admin.user.active', 'user', id, { isActive });
      res.json({ id: id.toString(), isActive: user.isActive });
    }),
  );

  app.use('/api', router);
}

async function assertSlugFree(
  model: { findOne: (f: AdminBody) => { lean: () => Promise<unknown> } },
  slug: string,
  currentId: Types.ObjectId | null,
): Promise<void> {
  const found = (await model.findOne({ slug }).lean()) as { _id: Types.ObjectId } | null;
  if (found && (!currentId || found._id.toString() !== currentId.toString())) {
    throw conflict(`The slug "${slug}" is already in use.`);
  }
}

function parseId(value: string): Types.ObjectId {
  if (!/^[a-f\d]{24}$/i.test(value)) {
    throw conflict('Invalid id');
  }
  return new Types.ObjectId(value);
}

async function audit(
  req: AuthenticatedRequest,
  action: string,
  entity: string,
  entityId: Types.ObjectId,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await writeAuditLog({
    actorUserId: getUserId(req),
    action,
    entity,
    entityId: entityId.toString(),
    metadata,
  });
}
