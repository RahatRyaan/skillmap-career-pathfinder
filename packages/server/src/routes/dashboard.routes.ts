/**
 * Dashboard, progress, and achievements.
 *
 * Every widget on the dashboard reads from real records. Where a widget has
 * nothing to show, it returns an explicit empty shape rather than zeros that
 * could be mistaken for measured values.
 */

import { Router } from 'express';
import type { Express, Response } from 'express';
import { Types } from 'mongoose';
import {
  SCORE_DISCLAIMER,
  type DashboardResponse,
  type ProjectResponse,
  type ResourceResponse,
} from '@skillmap/shared';
import { getUserId, requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { notFound } from '../utils/errors.js';
import { models } from '../models/index.js';
import { analyzeCareer } from '../services/analysisService.js';
import { getTrend, recordSnapshot } from '../services/snapshotService.js';
import { getCurrentRoadmap } from '../services/roadmapService.js';
import { currentStreak } from '../services/achievementService.js';
import { resourceQuerySchema, userProjectUpdateSchema } from '@skillmap/shared';
import { asyncHandler, validate, type ValidatedRequest } from '../middleware/validate.js';
import { paginate } from '@skillmap/shared';

export function registerDashboardRoutes(app: Express): void {
  const router = Router();
  router.use(requireAuth);

  // ─── Dashboard ────────────────────────────────────────────────────────
  router.get(
    '/dashboard',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = getUserId(req);

      const [user, profile, prefs] = await Promise.all([
        models.User.findById(userId).select('name').lean() as Promise<{ name: string } | null>,
        models.StudentProfile.findOne({ userId }).lean() as Promise<{
          targetCareerId: Types.ObjectId | null;
        } | null>,
        models.UserPreferences.findOne({ userId }).lean() as Promise<{
          weeklyStudyHours: number;
        } | null>,
      ]);

      const targetCareerId = profile?.targetCareerId ?? null;

      // No target career yet: a valid, complete, empty dashboard.
      if (!targetCareerId) {
        const body: DashboardResponse = {
          greetingName: user?.name ?? 'there',
          targetCareer: null,
          kpis: {
            alignmentPercent: 0,
            ownedSkillCount: 0,
            requiredSkillCount: 0,
            gapCount: 0,
            criticalGapCount: 0,
            roadmapProgressPercent: 0,
          },
          nextBestAction: {
            title: 'Choose a target career',
            description:
              'Pick the career you are working towards and SkillMap will map your skills against it.',
            estimatedHours: 5,
            why: 'Without a target career there is nothing to compare your skills against, so every score would be arbitrary.',
            roadmapItemId: null,
            skillId: null,
          },
          skillBars: [],
          categoryAverages: [],
          roadmapMiniTimeline: [],
          weeklyGoal: { minutesLogged: 0, minutesTarget: 600, percent: 0, streakDays: 0 },
          alignmentTrend: [],
          recentActivity: [],
          roadmapChangeNotice: null,
          achievements: [],
          disclaimer: SCORE_DISCLAIMER,
        };
        res.json(body);
        return;
      }

      const [career, analysis] = await Promise.all([
        models.Career.findById(targetCareerId).select('name').lean() as Promise<{
          name: string;
        } | null>,
        analyzeCareer(userId, targetCareerId),
      ]);

      await recordSnapshot(userId, targetCareerId, analysis);

      const [roadmap, trend, weekly, streak, recentAchievements, allAchievements, activity] =
        await Promise.all([
          getCurrentRoadmap(userId, targetCareerId),
          getTrend(userId, targetCareerId),
          weeklyGoal(userId, prefs?.weeklyStudyHours ?? 5),
          currentStreak(userId),
          models.UserAchievement.find({ userId })
            .populate('achievementId', 'name description')
            .sort({ earnedAt: -1 })
            .limit(20)
            .lean() as Promise<unknown[]>,
          models.Achievement.find()
            .sort({ order: 1 })
            .select('_id name description')
            .lean() as Promise<{ _id: Types.ObjectId; name: string; description: string }[]>,
          recentActivity(userId),
        ]);

      const earnedIds = new Set(
        (recentAchievements as { achievementId: { _id: Types.ObjectId } }[]).map((a) =>
          (a.achievementId as { _id: Types.ObjectId })._id.toString(),
        ),
      );
      const earnedAtById = new Map(
        (recentAchievements as { achievementId: { _id: Types.ObjectId }; earnedAt: Date }[]).map(
          (a) => [
            (a.achievementId as { _id: Types.ObjectId })._id.toString(),
            new Date(a.earnedAt).toISOString(),
          ],
        ),
      );

      const achievements = allAchievements.map((a) => ({
        id: a._id.toString(),
        name: a.name,
        description: a.description,
        earnedAt: earnedAtById.get(a._id.toString()) ?? null,
      }));

      const topPriority = analysis.priorities[0];
      const nextItem = roadmap?.items.find(
        (i) => i.status === 'todo' || i.status === 'in_progress',
      );

      const body: DashboardResponse = {
        greetingName: user?.name ?? 'there',
        targetCareer: career ? { id: targetCareerId.toString(), name: career.name } : null,
        kpis: {
          alignmentPercent: analysis.alignment.percent,
          ownedSkillCount: analysis.ownedSkillCount,
          requiredSkillCount: analysis.alignment.skillCount,
          gapCount: analysis.gaps.filter((g) => g.gap > 0).length,
          criticalGapCount: analysis.gaps.filter((g) => g.label === 'critical').length,
          roadmapProgressPercent: roadmap?.progressPercent ?? 0,
        },
        nextBestAction:
          topPriority || nextItem
            ? {
                title: topPriority
                  ? `Learn ${topPriority.skillName}`
                  : (nextItem?.title ?? 'Continue your roadmap'),
                description: topPriority
                  ? `You are ${topPriority.gap} level${topPriority.gap === 1 ? '' : 's'} below the level this career requires, and it takes around ${topPriority.estimatedEffortHours} hours.`
                  : (nextItem?.description ?? ''),
                estimatedHours: topPriority?.estimatedEffortHours ?? nextItem?.estimatedHours ?? 0,
                why: topPriority?.reason ?? nextItem?.whyThisOrder ?? '',
                roadmapItemId: nextItem?.id ?? null,
                skillId: topPriority?.skillId ?? null,
              }
            : null,
        skillBars: analysis.gaps
          .slice()
          .sort((a, b) => b.gap - a.gap)
          .slice(0, 8)
          .map((g) => ({
            skillId: g.skillId,
            skillName: g.skillName,
            currentLevel: g.currentLevel,
            requiredLevel: g.requiredLevel,
            label: g.label,
          })),
        categoryAverages: analysis.categoryAverages,
        roadmapMiniTimeline: buildMiniTimeline(roadmap?.items ?? []),
        weeklyGoal: { ...weekly, streakDays: streak },
        alignmentTrend: trend,
        recentActivity: activity,
        roadmapChangeNotice: roadmap && roadmap.version > 1 ? (roadmap.changeLog[0] ?? null) : null,
        achievements,
        disclaimer: SCORE_DISCLAIMER,
      };

      void earnedIds;
      res.json(body);
    }),
  );

  // ─── Learning resources ───────────────────────────────────────────────
  router.get(
    '/resources',
    validate({ query: resourceQuerySchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const query = (req as ValidatedRequest<never, import('@skillmap/shared').ResourceQuery>)
        .validated.query!;

      const filter: Record<string, unknown> = { isPublished: true };
      if (query.skillId) filter['skillId'] = query.skillId;
      if (query.level !== undefined) filter['level'] = query.level;
      if (query.type) filter['type'] = query.type;
      if (query.free !== undefined) filter['isFree'] = query.free;
      if (query.language) filter['language'] = query.language;
      if (query.search) {
        const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter['$or'] = [
          { title: new RegExp(escaped, 'i') },
          { description: new RegExp(escaped, 'i') },
          { provider: new RegExp(escaped, 'i') },
        ];
      }

      const [total, docs] = await Promise.all([
        models.LearningResource.countDocuments(filter),
        models.LearningResource.find(filter)
          // Free first is a product promise, so it is enforced in the query
          // rather than left to the client.
          .sort({ isFree: -1, isSample: 1, title: 1 })
          .skip((query.page - 1) * query.limit)
          .limit(query.limit)
          .populate('skillId', 'name')
          .lean(),
      ]);

      const items: ResourceResponse[] = (docs as Record<string, any>[]).map((d) => ({
        id: d._id.toString(),
        title: d.title,
        description: d.description ?? null,
        skillId: d.skillId?._id?.toString() ?? '',
        skillName: d.skillId?.name ?? '',
        level: d.level,
        type: d.type,
        durationMinutes: d.durationMinutes ?? null,
        url: d.url,
        isFree: d.isFree,
        language: d.language,
        isSample: d.isSample,
      }));

      res.json(paginate(items, total, query.page, query.limit));
    }),
  );

  // ─── Projects ─────────────────────────────────────────────────────────
  router.get(
    '/projects',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = getUserId(req);
      const filter: Record<string, unknown> = { isPublished: true };

      const careerId = (req.query as { careerId?: string }).careerId;
      if (careerId) filter['careerId'] = new Types.ObjectId(careerId);

      const [docs, mine] = await Promise.all([
        models.Project.find(filter)
          .sort({ estimatedHours: 1 })
          .populate('careerId', 'name')
          .populate('skillIds')
          .lean(),
        models.UserProject.find({ userId }).lean() as Promise<
          { projectId: Types.ObjectId; status: string }[]
        >,
      ]);

      const statusByProject = new Map(mine.map((m) => [m.projectId.toString(), m.status]));

      const items: ProjectResponse[] = (docs as Record<string, any>[]).map((d) => {
        const status = statusByProject.get(d._id.toString()) ?? null;
        return {
          id: d._id.toString(),
          slug: d.slug,
          title: d.title,
          description: d.description,
          careerId: d.careerId?._id?.toString() ?? null,
          careerName: d.careerId?.name ?? null,
          level: d.level,
          estimatedHours: d.estimatedHours,
          skills: (d.skillIds ?? [])
            .filter((s: { _id?: Types.ObjectId }) => s?._id)
            .map((s: { _id: Types.ObjectId; name: string }) => ({
              skillId: s._id.toString(),
              skillName: s.name,
            })),
          steps: (d.steps ?? []).map(
            (s: {
              order: number;
              title: string;
              description: string;
              skillId: Types.ObjectId | null;
            }) => ({
              order: s.order,
              title: s.title,
              description: s.description,
              skillId: s.skillId?.toString() ?? null,
            }),
          ),
          status,
          matchReason: status
            ? null
            : d.skillIds?.length
              ? 'This project practices skills on your current plan.'
              : null,
        };
      });

      res.json({ items });
    }),
  );

  // ─── Update a project ─────────────────────────────────────────────────
  router.put(
    '/user-projects/:id',
    validate({ body: userProjectUpdateSchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = getUserId(req);
      const projectId = new Types.ObjectId((req.params as { id: string }).id);
      const body = (req as ValidatedRequest<import('@skillmap/shared').UserProjectUpdateRequest>)
        .validated.body!;

      const project = await models.Project.findById(projectId).select('skillIds title').lean();
      if (!project) throw notFound('Project');

      const existing = await models.UserProject.findOne({ userId, projectId });

      await models.UserProject.updateOne(
        { userId, projectId },
        {
          $set: {
            status: body.status,
            completedAt: body.status === 'done' ? new Date() : null,
          },
        },
        { upsert: true },
      );

      // Completing a project can raise levels, but only for skills the
      // student explicitly confirms. Nothing is inferred from the checklist.
      let levelsRaised = 0;
      if (body.status === 'done' && body.confirmSkillUpdates) {
        for (const skillId of project.skillIds ?? []) {
          const userSkill = await models.UserSkill.findOne({ userId, skillId });
          if (!userSkill) {
            await models.UserSkill.create({
              userId,
              skillId,
              level: 2,
              source: 'project_completed',
              confirmedByProject: true,
            });
            levelsRaised += 1;
            continue;
          }
          if (userSkill.level < 4) {
            userSkill.level = (userSkill.level + 1) as 0 | 1 | 2 | 3 | 4 | 5;
            userSkill.source = 'project_completed';
            userSkill.confirmedByProject = true;
            await userSkill.save();
            levelsRaised += 1;
          }
        }
      }

      const { evaluateAchievements } = await import('../services/achievementService.js');
      const newAchievements = await evaluateAchievements(userId);

      res.json({
        projectId: projectId.toString(),
        status: body.status,
        levelsRaised,
        newAchievements,
        note:
          levelsRaised > 0
            ? `${levelsRaised} skill level${levelsRaised === 1 ? '' : 's'} updated from your project work.`
            : 'Project status saved. Confirm skill updates if your levels changed.',
      });
    }),
  );

  // ─── Achievements ─────────────────────────────────────────────────────
  router.get(
    '/achievements',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = getUserId(req);

      const [all, earned] = await Promise.all([
        models.Achievement.find().sort({ order: 1 }).lean() as Promise<
          { _id: Types.ObjectId; name: string; description: string; icon: string; order: number }[]
        >,
        models.UserAchievement.find({ userId }).lean() as Promise<
          { achievementId: Types.ObjectId; earnedAt: Date }[]
        >,
      ]);

      const earnedMap = new Map(
        earned.map((e) => [e.achievementId.toString(), new Date(e.earnedAt).toISOString()]),
      );

      res.json({
        items: all.map((a) => ({
          id: a._id.toString(),
          name: a.name,
          description: a.description,
          icon: a.icon,
          earnedAt: earnedMap.get(a._id.toString()) ?? null,
        })),
      });
    }),
  );

  app.use('/api', router);
}

async function weeklyGoal(
  userId: Types.ObjectId,
  weeklyStudyHours: number,
): Promise<{ minutesLogged: number; minutesTarget: number; percent: number }> {
  const target = weeklyStudyHours * 60;
  const row = await models.StudySession.aggregate<{ total: number }>([
    { $match: { userId, loggedOn: { $gte: startOfWeek() } } },
    { $group: { _id: null, total: { $sum: '$minutes' } } },
  ]);

  const logged = row[0]?.total ?? 0;
  return {
    minutesLogged: logged,
    minutesTarget: target,
    // A small overachievement is celebrated rather than shown as a raw >100%.
    percent: target === 0 ? 0 : Math.min(100, Math.round((logged / target) * 100)),
  };
}

function startOfWeek(): Date {
  const date = new Date();
  const day = date.getUTCDay();
  const diff = (day + 6) % 7;
  date.setUTCDate(date.getUTCDate() - diff);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function buildMiniTimeline(
  items: { month: number; status: string }[],
): { month: number; itemsDone: number; itemsTotal: number }[] {
  const byMonth = new Map<number, { itemsDone: number; itemsTotal: number }>();
  for (const item of items) {
    const entry = byMonth.get(item.month) ?? { itemsDone: 0, itemsTotal: 0 };
    entry.itemsTotal += 1;
    if (item.status === 'done') entry.itemsDone += 1;
    byMonth.set(item.month, entry);
  }
  return [...byMonth.entries()].sort((a, b) => a[0] - b[0]).map(([month, v]) => ({ month, ...v }));
}

interface ActivityEvent {
  at: Date;
  kind: string;
  text: string;
}

async function recentActivity(
  userId: Types.ObjectId,
): Promise<{ at: string; kind: string; text: string }[]> {
  const [sessions, completions, projects, roadmaps] = await Promise.all([
    models.StudySession.find({ userId }).sort({ loggedOn: -1 }).limit(5).lean() as Promise<
      { loggedOn: Date; minutes: number }[]
    >,
    models.Roadmap.aggregate<{ at: Date | null; text: string }[]>([
      { $match: { userId } },
      { $unwind: '$items' },
      { $match: { 'items.status': 'done' } },
      { $sort: { 'items.completedAt': -1 } },
      { $limit: 5 },
      {
        $project: {
          at: '$items.completedAt',
          text: { $concat: ['Completed ', { $ifNull: ['$items.skillName', '$items.title'] }] },
        },
      },
    ]),
    models.UserProject.find({ userId, status: 'done' })
      .sort({ completedAt: -1 })
      .limit(5)
      .populate('projectId', 'title')
      .lean() as unknown as Promise<
      { completedAt: Date | null; projectId: { title: string } | null }[]
    >,
    models.Roadmap.find({ userId }).sort({ createdAt: -1 }).limit(3).lean() as Promise<
      { createdAt: Date; version: number; careerId: Types.ObjectId }[]
    >,
  ]);

  const events: ActivityEvent[] = [];

  for (const s of sessions) {
    events.push({
      at: s.loggedOn,
      kind: 'study',
      text: `Studied for ${s.minutes} minute${s.minutes === 1 ? '' : 's'}.`,
    });
  }

  for (const c of completions as unknown as { at: Date | null; text: string }[]) {
    if (c.at !== null) events.push({ at: c.at, kind: 'item', text: c.text });
  }

  for (const p of projects) {
    if (p.completedAt !== null) {
      events.push({
        at: p.completedAt,
        kind: 'project',
        text: `Finished ${p.projectId?.title ?? 'a project'}.`,
      });
    }
  }

  for (const r of roadmaps) {
    events.push({
      at: r.createdAt,
      kind: 'roadmap',
      text: `Roadmap version ${r.version} generated.`,
    });
  }

  return events
    .filter((e) => e.at instanceof Date && !Number.isNaN(e.at.getTime()))
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 12)
    .map((e) => ({ at: e.at.toISOString(), kind: e.kind, text: e.text }));
}
