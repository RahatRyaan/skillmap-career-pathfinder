/**
 * Achievement evaluation.
 *
 * Rules are data (seeded into the achievement collection) and are evaluated
 * here against real counts. Nothing awards an achievement from the UI, and
 * nothing hardcodes a badge.
 *
 * Idempotent: a unique index on (userId, achievementId) means re-evaluating
 * cannot double-award.
 */

import type { Types } from 'mongoose';
import { models } from '../models/index.js';
import { logger } from '../utils/logger.js';

export interface EarnedAchievement {
  id: string;
  name: string;
  description: string;
  earnedAt: string;
}

export async function evaluateAchievements(userId: Types.ObjectId): Promise<EarnedAchievement[]> {
  try {
    const achievements = (await models.Achievement.find().lean()) as {
      _id: Types.ObjectId;
      slug: string;
      name: string;
      description: string;
      rule: { type: string; threshold: number };
    }[];

    if (achievements.length === 0) return [];

    const alreadyEarned = new Set(
      (
        (await models.UserAchievement.find({ userId }).select('achievementId').lean()) as {
          achievementId: Types.ObjectId;
        }[]
      ).map((a) => a.achievementId.toString()),
    );

    const metrics = await collectMetrics(userId);

    const newlyEarned: EarnedAchievement[] = [];

    for (const achievement of achievements) {
      if (alreadyEarned.has(achievement._id.toString())) continue;

      const metricKey = achievement.rule.type as MetricKey;
      const actual = metrics[metricKey];
      if (actual === undefined) continue;
      if (actual < achievement.rule.threshold) continue;

      try {
        await models.UserAchievement.create({
          userId,
          achievementId: achievement._id,
          earnedAt: new Date(),
        });
        newlyEarned.push({
          id: achievement._id.toString(),
          name: achievement.name,
          description: achievement.description,
          earnedAt: new Date().toISOString(),
        });
      } catch {
        // A duplicate key here means a concurrent request awarded it first,
        // which is the correct outcome.
      }
    }

    return newlyEarned;
  } catch (error) {
    logger.warn('Achievement evaluation failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return [];
  }
}

type MetricKey =
  | 'user_skill_count'
  | 'career_chosen'
  | 'roadmap_count'
  | 'roadmap_version_count'
  | 'completed_item_count'
  | 'project_completed'
  | 'study_session_count'
  | 'streak_days'
  | 'alignment_percent';

async function collectMetrics(userId: Types.ObjectId): Promise<Record<string, number>> {
  const profile = (await models.StudentProfile.findOne({ userId })
    .select('targetCareerId')
    .lean()) as { targetCareerId: Types.ObjectId | null } | null;

  const [
    userSkillCount,
    roadmapCount,
    completedItemCount,
    projectCompleted,
    studySessionCount,
    latestSnapshot,
  ] = await Promise.all([
    models.UserSkill.countDocuments({ userId }),
    models.Roadmap.countDocuments({ userId }),
    models.Roadmap.aggregate<{ count: number }>([
      { $match: { userId } },
      { $unwind: '$items' },
      { $match: { 'items.status': 'done' } },
      { $count: 'count' },
    ]),
    models.UserProject.countDocuments({ userId, status: 'done' }),
    models.StudySession.countDocuments({ userId }),
    (async () => {
      if (!profile?.targetCareerId) return null;
      return models.AlignmentSnapshot.findOne({ userId, careerId: profile.targetCareerId })
        .sort({ createdAt: -1 })
        .lean() as Promise<{ percent: number } | null>;
    })(),
  ]);

  return {
    user_skill_count: userSkillCount,
    career_chosen: profile?.targetCareerId ? 1 : 0,
    roadmap_count: roadmapCount,
    roadmap_version_count: roadmapCount,
    completed_item_count: completedItemCount[0]?.count ?? 0,
    project_completed: projectCompleted,
    study_session_count: studySessionCount,
    streak_days: await currentStreak(userId),
    alignment_percent: latestSnapshot?.percent ?? 0,
  };
}

/**
 * Consecutive days with at least one logged session, counting back from today.
 * A missed day does not reset the number in the UI copy, but it does end the
 * streak, because that is the honest reading of the word.
 */
export async function currentStreak(userId: Types.ObjectId): Promise<number> {
  const sessions = (await models.StudySession.find({ userId })
    .sort({ loggedOn: -1 })
    .limit(400)
    .select('loggedOn')
    .lean()) as { loggedOn: Date }[];

  if (sessions.length === 0) return 0;

  const days = new Set(sessions.map((s) => new Date(s.loggedOn).toISOString().slice(0, 10)));

  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);

  let streak = 0;
  // Today not being logged yet should not break yesterday's streak.
  if (!days.has(cursor.toISOString().slice(0, 10))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (!days.has(cursor.toISOString().slice(0, 10))) return 0;
  }

  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
}
