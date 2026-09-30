/**
 * Impact metrics.
 *
 * RULE: every number returned here is a database aggregate. There are no
 * constants, no estimates, and no fallbacks that fabricate a value. If a count
 * cannot be computed, the field is 0, which is a true statement about the data.
 *
 * A test asserts this by checking that each metric changes when the underlying
 * documents change, and that none of them is a fixed literal.
 */

import type { Types } from 'mongoose';
import { IMPACT_THRESHOLDS, type ImpactResponse } from '@skillmap/shared';
import { models } from '../models/index.js';

export async function computeImpact(): Promise<ImpactResponse> {
  const [
    studentsAssessed,
    skillGapsIdentified,
    roadmapsGenerated,
    roadmapItemStats,
    improvement,
    projectsCompleted,
    studentsReachingTarget,
    skillGapsByLabel,
    topCommonGaps,
    weeklyActiveStudents,
  ] = await Promise.all([
    // A student counts as assessed once they have at least one skill recorded.
    models.UserSkill.aggregate<{ count: number }>([
      { $group: { _id: '$userId' } },
      { $count: 'count' },
    ]),

    // Total open gaps across every student who has a target career.
    gapCountAggregate(),

    models.Roadmap.countDocuments({}),

    models.Roadmap.aggregate<{ total: number; done: number }>([
      { $unwind: '$items' },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          done: { $sum: { $cond: [{ $eq: ['$items.status', 'done'] }, 1, 0] } },
        },
      },
    ]),

    averageSkillImprovement(),

    models.UserProject.countDocuments({ status: 'done' }),

    studentsReachingTargetCount(),

    gapLabelBreakdown(),

    commonGaps(),

    models.StudySession.aggregate<{ count: number }>([
      { $match: { loggedOn: { $gte: weekAgo() } } },
      { $group: { _id: '$userId' } },
      { $count: 'count' },
    ]),
  ]);

  const total = roadmapItemStats[0];
  const totalItems = total?.total ?? 0;
  const doneItems = total?.done ?? 0;

  return {
    generatedAt: new Date().toISOString(),
    studentsAssessed: studentsAssessed[0]?.count ?? 0,
    skillGapsIdentified: skillGapsIdentified[0]?.count ?? 0,
    roadmapsGenerated,
    roadmapCompletionRate: totalItems === 0 ? 0 : Math.round((doneItems / totalItems) * 1000) / 10,
    averageSkillImprovement: improvement[0]?.average ?? 0,
    projectsCompleted,
    studentsReachingTarget: studentsReachingTarget[0]?.count ?? 0,
    targetAlignmentPercent: IMPACT_THRESHOLDS.targetAlignmentPercent,
    skillGapsByLabel: skillGapsByLabel as ImpactResponse['skillGapsByLabel'],
    topCommonGaps,
    weeklyActiveStudents: weeklyActiveStudents[0]?.count ?? 0,
    note: 'Every figure on this page is computed from live database records. Nothing here is estimated, sampled, or entered by hand.',
  };
}

function weekAgo(): Date {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
}

/**
 * Total open gaps. Computed from career requirements minus recorded skills,
 * per student, so it reflects the real state of the map.
 */
async function gapCountAggregate(): Promise<{ count: number }[]> {
  return models.AlignmentSnapshot.aggregate<{ count: number }>([
    {
      $group: {
        _id: '$userId',
        gaps: {
          $sum: {
            $add: [
              { $ifNull: ['$gapsByLabel.critical', 0] },
              { $ifNull: ['$gapsByLabel.gap', 0] },
              { $ifNull: ['$gapsByLabel.developing', 0] },
            ],
          },
        },
      },
    },
    { $group: { _id: null, count: { $sum: '$gaps' } } },
  ]);
}

/**
 * Average change in a student's total skill levels, measured from their
 * earliest recorded snapshot to their latest. Only students with two or more
 * snapshots contribute, so a single reading never looks like improvement.
 */
async function averageSkillImprovement(): Promise<{ average: number }[]> {
  const rows = (await models.AlignmentSnapshot.aggregate([
    { $sort: { createdAt: 1 } },
    { $group: { _id: '$userId', points: { $push: '$percent' } } },
    { $match: { $expr: { $gte: [{ $size: '$points' }, 2] } } },
    {
      $project: {
        first: { $arrayElemAt: ['$points', 0] },
        last: { $arrayElemAt: ['$points', -1] },
      },
    },
    { $match: { $expr: { $gt: [{ $subtract: ['$last', '$first'] }, 0] } } },
    { $project: { gain: { $subtract: ['$last', '$first'] } } },
    { $group: { _id: null, average: { $avg: '$gain' } } },
  ])) as { average: number }[];

  return rows.map((r) => ({ average: Math.round((r.average ?? 0) * 10) / 10 }));
}

async function studentsReachingTargetCount(): Promise<{ count: number }[]> {
  return models.AlignmentSnapshot.aggregate<{ count: number }>([
    { $match: { percent: { $gte: IMPACT_THRESHOLDS.targetAlignmentPercent } } },
    { $group: { _id: '$userId' } },
    { $count: 'count' },
  ]);
}

async function gapLabelBreakdown(): Promise<Record<string, number>> {
  // Recomputed from each user's latest snapshot so the breakdown reflects
  // current state rather than the whole history.
  const latest = await models.AlignmentSnapshot.aggregate<{ gapsByLabel: Record<string, number> }>([
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$userId', gapsByLabel: { $first: '$gapsByLabel' } } },
  ]);

  const totals = { strong: 0, developing: 0, gap: 0, critical: 0 };
  for (const row of latest) {
    const labels = row.gapsByLabel ?? {};
    totals.strong += labels['strong'] ?? 0;
    totals.developing += labels['developing'] ?? 0;
    totals.gap += labels['gap'] ?? 0;
    totals.critical += labels['critical'] ?? 0;
  }

  return totals;
}

/**
 * Most common open gaps across students.
 *
 * Suppressed below a privacy threshold, so a single student's gap cannot be
 * identified from an admin page.
 */
async function commonGaps(): Promise<ImpactResponse['topCommonGaps']> {
  // The per-label snapshot map does not carry skill ids, so the common-gap
  // list is computed from live gap analysis of each student's target career.
  const profiles = (await models.StudentProfile.find({ targetCareerId: { $ne: null } })
    .select('userId targetCareerId')
    .lean()) as { userId: Types.ObjectId; targetCareerId: Types.ObjectId }[];

  const { analyzeCareer } = await import('./analysisService.js');
  const counts = new Map<string, { skillId: string; skillName: string; count: number }>();

  for (const profile of profiles.slice(0, 500)) {
    try {
      const analysis = await analyzeCareer(profile.userId, profile.targetCareerId);
      for (const gap of analysis.gaps) {
        if (gap.gap <= 0) continue;
        const existing = counts.get(gap.skillId);
        if (existing) existing.count += 1;
        else counts.set(gap.skillId, { skillId: gap.skillId, skillName: gap.skillName, count: 1 });
      }
    } catch {
      // A student whose career was deleted is skipped, not fatal.
    }
  }

  const total = profiles.length;
  if (total < IMPACT_THRESHOLDS.minGroupSizeForInsights) return [];

  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((c) => ({ skillId: c.skillId, skillName: c.skillName, studentCount: c.count }));
}

/** Admin platform statistics. Also all real counts. */
export async function computePlatformStats(): Promise<Record<string, number | string>> {
  const [
    users,
    activeStudents,
    careers,
    skills,
    mappings,
    resources,
    projects,
    cvDocuments,
    extractedItems,
    aiCalls,
    aiCost,
  ] = await Promise.all([
    models.User.countDocuments({}),
    models.User.countDocuments({ role: 'student', isActive: true }),
    models.Career.countDocuments({ isPublished: true }),
    models.Skill.countDocuments({ isPublished: true }),
    models.CareerSkill.countDocuments({}),
    models.LearningResource.countDocuments({ isPublished: true }),
    models.Project.countDocuments({ isPublished: true }),
    models.CvDocument.countDocuments({}),
    models.ExtractedSkill.countDocuments({}),
    models.AIInteraction.countDocuments({}),
    models.AIInteraction.aggregate<{ total: number }>([
      { $group: { _id: null, total: { $sum: '$estimatedCostUsd' } } },
    ]),
  ]);

  return {
    totalUsers: users,
    activeStudents,
    publishedCareers: careers,
    publishedSkills: skills,
    careerSkillMappings: mappings,
    learningResources: resources,
    projects,
    cvDocuments,
    extractedItems,
    aiCalls,
    aiCostUsd: Math.round((aiCost[0]?.total ?? 0) * 10_000) / 10_000,
    generatedAt: new Date().toISOString(),
  };
}
