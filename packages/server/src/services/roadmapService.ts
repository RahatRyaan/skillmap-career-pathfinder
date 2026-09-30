/**
 * Roadmap generation and adaptive re-planning.
 *
 * Pure logic lives in ./roadmapEngine.ts and is unit-testable without a
 * database. This file owns persistence, versioning, and change-log writing.
 *
 * Versioning rule: exactly one roadmap per (user, career) is `isCurrent`.
 * A re-plan bumps the version, retires the previous one, and records why it
 * changed. Progress is copied forward for items the student had already
 * finished, so a re-plan never loses their work.
 */

import type { Types, Types as T } from 'mongoose';
import { ROADMAP_DEFAULTS, type RoadmapItem, type RoadmapResponse } from '@skillmap/shared';
import { models } from '../models/index.js';
import { analyzeCareer, type CareerAnalysis } from './analysisService.js';
import { buildRoadmapPlan, type RoadmapPlan } from './roadmapEngine.js';
import { notFound } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export interface GenerateOptions {
  userId: Types.ObjectId;
  careerId: Types.ObjectId;
  weeklyStudyHours?: number;
  months?: number;
  /** Called only when a previous roadmap existed, with the human-readable reasons. */
}

export interface GenerateResult {
  roadmap: RoadmapResponse;
  changeLog: string[];
  isFirstPlan: boolean;
  carriedOverItems: number;
}

export async function generateRoadmap(options: GenerateOptions): Promise<GenerateResult> {
  const { userId, careerId } = options;

  const analysis = await analyzeCareer(userId, careerId);
  const prefs = (await models.UserPreferences.findOne({ userId }).lean()) as {
    weeklyStudyHours?: number;
    costPreference?: string;
    contentPreference?: string;
  } | null;

  const weeklyStudyHours =
    options.weeklyStudyHours ?? prefs?.weeklyStudyHours ?? ROADMAP_DEFAULTS.weeklyStudyHours;
  const months = options.months ?? ROADMAP_DEFAULTS.monthsHorizon;

  const plan: RoadmapPlan = await buildRoadmapPlan(analysis, {
    weeklyStudyHours,
    months,
    freeFirst: (prefs?.costPreference ?? 'free_only') === 'free_only',
  });

  const previous = (await models.Roadmap.findOne({
    userId,
    careerId,
    isCurrent: true,
  }).lean()) as unknown as {
    version: number;
    items: {
      _id: T.ObjectId;
      title: string;
      skillId: Types.ObjectId | null;
      skillName: string | null;
      status: string;
      month: number;
      week: number;
      order: number;
    }[];
  } | null;

  const completedTitles = new Set(
    (previous?.items ?? []).filter((i) => i.status === 'done').map((i) => i.title),
  );

  const isFirstPlan = previous === null;
  const nextVersion = (previous?.version ?? 0) + 1;

  // Carry finished work forward so re-planning never erases progress.
  const items = plan.items.map((item) => ({
    order: item.order,
    month: item.month,
    week: item.week,
    type: item.type,
    title: item.title,
    description: item.description,
    skillId: item.skillId,
    skillName: item.skillName,
    estimatedHours: item.estimatedHours,
    status: completedTitles.has(item.title) ? 'done' : 'todo',
    whyThisOrder: item.whyThisOrder,
    resourceIds: item.resourceIds,
  }));

  const carriedOverItems = items.filter((i) => i.status === 'done').length;

  const changeLog = buildChangeLog(
    analysis,
    plan,
    previous
      ? {
          version: previous.version,
          items: previous.items.map((i) => ({
            title: i.title,
            month: i.month,
            skillName: i.skillName,
          })),
        }
      : null,
    isFirstPlan,
  );

  if (previous) {
    await models.Roadmap.updateOne(
      { userId, careerId, isCurrent: true },
      { $set: { isCurrent: false } },
    );
  }

  const created = await models.Roadmap.create({
    userId,
    careerId,
    version: nextVersion,
    isCurrent: true,
    weeklyStudyHours,
    monthsHorizon: months,
    items,
    changeLog,
    generatedBy: 'engine',
  });

  logger.info('Roadmap generated', {
    userId: userId.toString(),
    careerId: careerId.toString(),
    version: nextVersion,
    items: items.length,
    isReplan: !isFirstPlan,
  });

  return {
    roadmap: await toResponse(created._id, userId, careerId),
    changeLog,
    isFirstPlan,
    carriedOverItems,
  };
}

function buildChangeLog(
  analysis: CareerAnalysis,
  plan: RoadmapPlan,
  previous: {
    version: number;
    items: { title: string; month: number; skillName: string | null }[];
  } | null,
  isFirstPlan: boolean,
): string[] {
  if (isFirstPlan || previous === null) {
    return [
      `First roadmap generated from your ${analysis.gaps.filter((g) => g.gap > 0).length} skill gaps, paced at ${plan.weeklyStudyHours} hours a week.`,
    ];
  }

  const log: string[] = [];

  // Which skills closed since the last plan, in plain language.
  const closed = plan.completedSkillNames;
  if (closed.length > 0) {
    log.push(
      `You completed ${closed.slice(0, 3).join(', ')}${closed.length > 3 ? ` and ${closed.length - 3} more` : ''}, so ${closed.length === 1 ? 'that skill' : 'those skills'} ${closed.length === 1 ? 'is' : 'are'} no longer on your plan.`,
    );
  }

  // Which skills moved earlier or later, by month.
  const previousMonthBySkill = new Map<string, number>();
  for (const item of previous.items) {
    if (item.skillName) previousMonthBySkill.set(item.skillName, item.month);
  }

  const moved: { name: string; from: number; to: number }[] = [];
  for (const item of plan.items) {
    if (!item.skillName) continue;
    const before = previousMonthBySkill.get(item.skillName);
    if (before !== undefined && before !== item.month) {
      moved.push({ name: item.skillName, from: before, to: item.month });
    }
  }

  for (const move of moved.slice(0, 5)) {
    if (move.to < move.from) {
      log.push(
        `${move.name} moved earlier, from Month ${move.from} to Month ${move.to}, because the skills it depends on are now done.`,
      );
    } else {
      log.push(
        `${move.name} moved later, from Month ${move.from} to Month ${move.to}, to keep the pace achievable at your study hours.`,
      );
    }
  }

  const stillOpen = plan.topPriorityNames.slice(0, 3);
  if (stillOpen.length > 0) {
    log.push(`Your next focus is ${stillOpen.join(', ')}.`);
  }

  if (log.length === 0) {
    log.push(
      'Your plan was rebuilt. Nothing changed in your priorities, so the order stayed the same.',
    );
  }

  return log;
}

export async function getCurrentRoadmap(
  userId: Types.ObjectId,
  careerId: Types.ObjectId,
): Promise<RoadmapResponse | null> {
  const current = await models.Roadmap.findOne({ userId, careerId, isCurrent: true }).select('_id');
  if (!current) return null;
  return toResponse(current._id, userId, careerId);
}

export async function getRoadmapById(
  userId: Types.ObjectId,
  roadmapId: Types.ObjectId,
): Promise<RoadmapResponse> {
  const roadmap = await models.Roadmap.findOne({ _id: roadmapId, userId }).select('_id');
  if (!roadmap) throw notFound('Roadmap');
  return toResponse(roadmap._id, userId, roadmap!.careerId as Types.ObjectId);
}

export async function listVersions(
  userId: Types.ObjectId,
  careerId: Types.ObjectId,
): Promise<{ version: number; isCurrent: boolean; createdAt: string; changeLog: string[] }[]> {
  const rows = (await models.Roadmap.find({ userId, careerId })
    .sort({ version: -1 })
    .select('version isCurrent createdAt changeLog')
    .lean()) as unknown as {
    version: number;
    isCurrent: boolean;
    createdAt: Date;
    changeLog: string[];
  }[];

  return rows.map(
    (r: { version: number; isCurrent: boolean; createdAt: Date; changeLog: string[] }) => ({
      version: r.version,
      isCurrent: r.isCurrent,
      createdAt: new Date(r.createdAt).toISOString(),
      changeLog: r.changeLog,
    }),
  );
}

export async function getChanges(
  userId: Types.ObjectId,
  careerId: Types.ObjectId,
): Promise<{
  fromVersion: number;
  toVersion: number;
  changeLog: string[];
  changedItemCount: number;
  createdAt: string;
} | null> {
  const current = (await models.Roadmap.findOne({ userId, careerId, isCurrent: true })
    .select('version changeLog createdAt')
    .lean()) as { version: number; changeLog: string[]; createdAt: Date } | null;

  if (!current || current.version <= 1) return null;

  const previous = (await models.Roadmap.findOne({ userId, careerId, version: current.version - 1 })
    .select('items')
    .lean()) as { items: { title: string }[] } | null;

  const now = (await models.Roadmap.findOne({ userId, careerId, isCurrent: true })
    .select('items')
    .lean()) as { items: { title: string }[] } | null;

  const previousTitles = new Set((previous?.items ?? []).map((i) => i.title));
  const changedItemCount = (now?.items ?? []).filter((i) => !previousTitles.has(i.title)).length;

  return {
    fromVersion: current.version - 1,
    toVersion: current.version,
    changeLog: current.changeLog,
    changedItemCount,
    createdAt: new Date(current.createdAt).toISOString(),
  };
}

async function toResponse(
  roadmapId: Types.ObjectId,
  _userId: Types.ObjectId,
  _careerId: Types.ObjectId,
): Promise<RoadmapResponse> {
  const roadmap = (await models.Roadmap.findById(roadmapId)
    .populate('careerId', 'name')
    .lean()) as unknown as {
    _id: Types.ObjectId;
    careerId: Types.ObjectId & { name?: string };
    version: number;
    isCurrent: boolean;
    weeklyStudyHours: number;
    items: RoadmapItem & { _id: Types.ObjectId }[];
    changeLog: string[];
    createdAt: Date;
  };

  const items: RoadmapItem[] = ((roadmap.items ?? []) as Record<string, any>[]).map((item) => ({
    id: item._id.toString(),
    month: item.month,
    week: item.week,
    order: item.order,
    type: item.type,
    title: item.title,
    description: item.description,
    skillId: item.skillId?.toString() ?? null,
    skillName: item.skillName,
    estimatedHours: item.estimatedHours,
    status: item.status,
    whyThisOrder: item.whyThisOrder,
    resourceIds: (item.resourceIds ?? []).map((r: Types.ObjectId) => r.toString()),
  }));

  const totalHours = items.reduce((sum, i) => sum + i.estimatedHours, 0);
  const doneHours = items
    .filter((i) => i.status === 'done')
    .reduce((sum, i) => sum + i.estimatedHours, 0);
  const progressPercent = totalHours === 0 ? 0 : Math.round((doneHours / totalHours) * 100);

  return {
    id: roadmap._id.toString(),
    version: roadmap.version,
    careerId: (roadmap.careerId as Types.ObjectId).toString(),
    careerName:
      typeof roadmap.careerId === 'object' && roadmap.careerId?.name ? roadmap.careerId.name : '',
    weeklyStudyHours: roadmap.weeklyStudyHours,
    changeLog: roadmap.changeLog,
    items,
    progressPercent,
    createdAt: new Date(roadmap.createdAt).toISOString(),
    isCurrent: roadmap.isCurrent,
  };
}
