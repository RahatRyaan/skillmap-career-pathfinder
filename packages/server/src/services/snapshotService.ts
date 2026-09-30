/**
 * Alignment snapshots.
 *
 * Every score the student sees is recorded so the trend line is a real history
 * rather than a reconstructed guess. Snapshots are cheap: one small document
 * each, and a TTL index prunes old ones without a cron job.
 */

import type { Types } from 'mongoose';
import { SNAPSHOT_RETENTION_DAYS } from '@skillmap/shared';
import { models } from '../models/index.js';
import { analyzeCareer, type CareerAnalysis } from './analysisService.js';
import { logger } from '../utils/logger.js';

/**
 * Records the current alignment for a career.
 *
 * Skipped when nothing changed, so repeatedly opening a page does not fill the
 * collection with identical points.
 */
export async function recordSnapshot(
  userId: Types.ObjectId,
  careerId: Types.ObjectId,
  analysis: CareerAnalysis,
): Promise<boolean> {
  try {
    const latest = (await models.AlignmentSnapshot.findOne({ userId, careerId })
      .sort({ createdAt: -1 })
      .lean()) as { percent: number; ownedSkillCount: number } | null;

    const unchanged =
      latest !== null &&
      latest.percent === analysis.alignment.percent &&
      latest.ownedSkillCount === analysis.ownedSkillCount;

    if (unchanged) return false;

    await models.AlignmentSnapshot.create({
      userId,
      careerId,
      percent: analysis.alignment.percent,
      ownedSkillCount: analysis.ownedSkillCount,
      requiredSkillCount: analysis.alignment.skillCount,
      gapsByLabel: analysis.alignment.gapsByLabel,
    });

    return true;
  } catch (error) {
    // A failed snapshot must never fail the request that triggered it.
    logger.warn('Failed to record alignment snapshot', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return false;
  }
}

export interface TrendPoint {
  takenAt: string;
  percent: number;
}

export async function getTrend(
  userId: Types.ObjectId,
  careerId: Types.ObjectId,
  limit = 30,
): Promise<TrendPoint[]> {
  const snapshots = (await models.AlignmentSnapshot.find({ userId, careerId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()) as { percent: number; createdAt: Date }[];

  return snapshots
    .map((s) => ({ takenAt: new Date(s.createdAt).toISOString(), percent: s.percent }))
    .reverse();
}

/**
 * Keeps a rolling window per user. Called after a snapshot is written rather
 * than on a schedule, so it only does work when there is something to prune.
 */
export async function pruneOldSnapshots(userId: Types.ObjectId): Promise<number> {
  const cutoff = new Date(Date.now() - SNAPSHOT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const result = await models.AlignmentSnapshot.deleteMany({ userId, createdAt: { $lt: cutoff } });
  return result.deletedCount ?? 0;
}
