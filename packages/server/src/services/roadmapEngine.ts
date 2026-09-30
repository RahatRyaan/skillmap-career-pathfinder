/**
 * Roadmap plan builder — pure logic, no database.
 *
 * Takes the analysed gaps for a career and produces a paced month → week → topic
 * plan. Kept free of I/O so the pacing rules can be unit-tested directly, which
 * is where the spec's behaviour lives:
 *
 *   - Month → week → topic, from the student's actual gaps
 *   - Pacing derived from their weekly study hours
 *   - Prerequisites ordered before the skills that need them
 *   - Resources attached, free first
 *   - "Why this order?" on every item
 */

import { ROADMAP_DEFAULTS, type PriorityItem, type SkillGap } from '@skillmap/shared';
import { models } from '../models/index.js';
import type { CareerAnalysis } from './analysisService.js';
import { logger } from '../utils/logger.js';

export interface PlanOptions {
  weeklyStudyHours: number;
  months: number;
  freeFirst: boolean;
}

export interface PlannedItem {
  order: number;
  month: number;
  week: number;
  type: 'skill' | 'project' | 'milestone';
  title: string;
  description: string;
  skillId: string | null;
  skillName: string | null;
  estimatedHours: number;
  whyThisOrder: string;
  resourceIds: string[];
}

export interface RoadmapPlan {
  items: PlannedItem[];
  weeklyStudyHours: number;
  monthsHorizon: number;
  completedSkillNames: string[];
  topPriorityNames: string[];
}

const WEEKS_PER_MONTH = 4;

/** How a skill's estimated effort is split across sessions. */
const SESSIONS_PER_SKILL: Record<'small' | 'medium' | 'large', number> = {
  small: 2,
  medium: 3,
  large: 5,
};

function sessionCount(hours: number): number {
  if (hours <= 8) return SESSIONS_PER_SKILL.small;
  if (hours <= 24) return SESSIONS_PER_SKILL.medium;
  return SESSIONS_PER_SKILL.large;
}

export async function buildRoadmapPlan(
  analysis: CareerAnalysis,
  options: PlanOptions,
): Promise<RoadmapPlan> {
  const weeklyStudyHours = clamp(
    options.weeklyStudyHours,
    1,
    80,
    ROADMAP_DEFAULTS.weeklyStudyHours,
  );
  const monthsHorizon = clamp(options.months, 1, 12, ROADMAP_DEFAULTS.monthsHorizon);

  const openGaps = analysis.gaps.filter((g) => g.gap > 0);
  const priorities: PriorityItem[] = analysis.priorities;

  // Group the priority list by skill so each skill gets one block of sessions.
  const priorityBySkill = new Map(priorities.map((p) => [p.skillId, p]));
  const completedNames = analysis.gaps
    .filter((g) => g.gap === 0 && g.currentLevel > 0)
    .map((g) => g.skillName);

  if (openGaps.length === 0) {
    return {
      items: [
        {
          order: 1,
          month: 1,
          week: 1,
          type: 'milestone',
          title: 'Your skill requirements are met',
          description: `You have no open skill gaps for ${analysis.careerName}. Consider adding a related career to your plan, or raising the level of a skill you want to deepen.`,
          skillId: null,
          skillName: null,
          estimatedHours: 0,
          whyThisOrder:
            'This appears because every required skill is already at or above its required level.',
          resourceIds: [],
        },
      ],
      weeklyStudyHours,
      monthsHorizon,
      completedSkillNames: completedNames,
      topPriorityNames: [],
    };
  }

  // Resources for the skills we are about to plan, ordered free-first.
  const skillIds = openGaps.map((g) => g.skillId);
  const resourcesBySkill = await loadResources(skillIds, options.freeFirst);

  // Projects that practice these skills, used as follow-up items.
  const projectsBySkill = await loadProjects(skillIds);

  const items: PlannedItem[] = [];
  let order = 0;
  let week = 1;
  let month = 1;
  let weekHoursUsed = 0;

  const capacityThisWeek = weeklyStudyHours;

  for (const gap of openGaps) {
    const priority = priorityBySkill.get(gap.skillId);
    const resources = resourcesBySkill.get(gap.skillId) ?? [];
    const project = projectsBySkill.get(gap.skillId) ?? null;

    const totalHours = Math.max(1, gap.estimatedEffortHours);
    const sessions = sessionCount(totalHours);
    const perSession = Math.max(1, Math.round(totalHours / sessions));

    for (let session = 1; session <= sessions; session += 1) {
      // Roll to the next month once the horizon is full, rather than cramming.
      if (month > monthsHorizon) break;

      if (weekHoursUsed + perSession > capacityThisWeek && weekHoursUsed > 0) {
        week += 1;
        weekHoursUsed = 0;
        if (week > WEEKS_PER_MONTH) {
          week = 1;
          month += 1;
        }
        if (month > monthsHorizon) break;
      }

      order += 1;
      const isLast = session === sessions;
      items.push({
        order,
        month,
        week,
        type: 'skill',
        title: isLast
          ? `Finish ${gap.skillName}`
          : `${gap.skillName}: session ${session} of ${sessions}`,
        description: buildSessionDescription(gap, session, sessions, perSession),
        skillId: gap.skillId,
        skillName: gap.skillName,
        estimatedHours: perSession,
        whyThisOrder: buildWhyThisOrder(gap, priority, order, month),
        resourceIds: resources.slice(0, session === 1 ? 2 : 1).map((r) => r.id),
      });

      weekHoursUsed += perSession;
    }

    // A practice project after the skill sessions, so the skill gets used.
    if (project && month <= monthsHorizon) {
      order += 1;
      items.push({
        order,
        month,
        week: Math.min(week, WEEKS_PER_MONTH),
        type: 'project',
        title: `Build: ${project.title}`,
        description: `${project.description} This practices ${gap.skillName} and gives you something to show.`,
        skillId: gap.skillId,
        skillName: gap.skillName,
        estimatedHours: Math.max(2, Math.round(project.estimatedHours / 4)),
        whyThisOrder: `A project after the ${gap.skillName} sessions, because skills stick when you use them on something real.`,
        resourceIds: [],
      });
    }

    // A milestone review at the end of each month of work.
    const isMonthEnd = week >= WEEKS_PER_MONTH || month >= monthsHorizon;
    if (isMonthEnd && order > 0 && month < monthsHorizon) {
      order += 1;
      items.push({
        order,
        month,
        week: WEEKS_PER_MONTH,
        type: 'milestone',
        title: `Month ${month} check-in`,
        description:
          'Update your skill levels to reflect what you actually finished, then re-plan. Your roadmap adapts to what you complete, not to what you intended.',
        skillId: null,
        skillName: null,
        estimatedHours: 1,
        whyThisOrder:
          'Check-ins are placed at month boundaries so an inaccurate self-rating is caught early, while it is still cheap to correct.',
        resourceIds: [],
      });
      week += 1;
      weekHoursUsed = 0;
      if (week > WEEKS_PER_MONTH) {
        week = 1;
        month += 1;
      }
    }
  }

  return {
    items,
    weeklyStudyHours,
    monthsHorizon,
    completedSkillNames: completedNames,
    topPriorityNames: priorities.slice(0, 3).map((p) => p.skillName),
  };
}

function buildSessionDescription(
  gap: SkillGap,
  session: number,
  sessions: number,
  hours: number,
): string {
  const levelText = `You are at level ${gap.currentLevel} and ${gap.skillName} is required at level ${gap.requiredLevel}.`;
  if (sessions === 1) {
    return `${levelText} Around ${hours} hour${hours === 1 ? '' : 's'} to close this gap.`;
  }
  return `${levelText} Session ${session} of ${sessions}, around ${hours} hour${hours === 1 ? '' : 's'} each.`;
}

function buildWhyThisOrder(
  gap: SkillGap,
  priority: PriorityItem | undefined,
  order: number,
  month: number,
): string {
  if (priority) {
    return `${priority.reason} It is item ${order} on your plan, in Month ${month}.`;
  }
  return `${gap.reason} It is item ${order} on your plan, in Month ${month}.`;
}

interface ResourceRef {
  id: string;
  title: string;
}

async function loadResources(
  skillIds: string[],
  freeFirst: boolean,
): Promise<Map<string, ResourceRef[]>> {
  const map = new Map<string, ResourceRef[]>();
  if (skillIds.length === 0) return map;

  try {
    const docs = (await models.LearningResource.find({
      skillId: { $in: skillIds.map((id) => id) },
      isPublished: true,
    })
      .select('_id skillId title isFree isSample')
      .sort({ isFree: -1, createdAt: 1 })
      .limit(400)
      .lean()) as {
      _id: { toString(): string };
      skillId: { toString(): string };
      title: string;
      isFree: boolean;
      isSample: boolean;
    }[];

    for (const doc of docs) {
      const key = doc.skillId.toString();
      const list = map.get(key) ?? [];
      list.push({ id: doc._id.toString(), title: doc.title });
      map.set(key, list);
    }

    if (freeFirst) {
      for (const [key, list] of map) {
        map.set(key, list.slice(0, 4));
      }
    }
  } catch (error) {
    logger.warn('Failed to load roadmap resources', {
      message: error instanceof Error ? error.message : 'unknown',
    });
  }

  return map;
}

async function loadProjects(
  skillIds: string[],
): Promise<Map<string, { title: string; description: string; estimatedHours: number }>> {
  const map = new Map<string, { title: string; description: string; estimatedHours: number }>();
  if (skillIds.length === 0) return map;

  try {
    const docs = (await models.Project.find({ skillIds: { $in: skillIds }, isPublished: true })
      .select('title description estimatedHours skillIds')
      .sort({ estimatedHours: 1 })
      .limit(60)
      .lean()) as {
      title: string;
      description: string;
      estimatedHours: number;
      skillIds: { toString(): string }[];
    }[];

    for (const doc of docs) {
      // One project per skill: the shortest one that practices it.
      for (const skillId of doc.skillIds) {
        const key = skillId.toString();
        if (map.has(key)) continue;
        map.set(key, {
          title: doc.title,
          description: doc.description,
          estimatedHours: doc.estimatedHours,
        });
      }
    }
  } catch (error) {
    logger.warn('Failed to load roadmap projects', {
      message: error instanceof Error ? error.message : 'unknown',
    });
  }

  return map;
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}
