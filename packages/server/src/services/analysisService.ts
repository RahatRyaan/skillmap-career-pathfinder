/**
 * Analysis service — the bridge between the database and the pure scoring
 * engine in @skillmap/shared.
 *
 * This is the ONLY place that loads a student's skills and a career's
 * requirements and hands them to the engine. Controllers call it; they never
 * call the scoring functions directly with hand-built inputs.
 *
 * Transferable credit is applied here, before the engine sees the levels, so
 * every consumer of the result (alignment, gaps, priorities, dashboard,
 * roadmap) gets the same effective levels.
 */

import type { Types } from 'mongoose';
import {
  calculateAlignment,
  analyzeSkillGaps,
  calculatePriorities,
  aggregateByCategory,
  transferableCredit,
  SIMILARITY_THRESHOLD,
  SCORE_DISCLAIMER,
  type AlignmentResult,
  type OwnedSkill,
  type PriorityItem,
  type RequiredSkill,
  type SkillGap,
} from '@skillmap/shared';
import { models } from '../models/index.js';
import { compareSkillSimilarity } from '../ai/aiService.js';
import { logger } from '../utils/logger.js';

export interface CareerAnalysis {
  careerId: string;
  careerName: string;
  alignment: AlignmentResult;
  gaps: SkillGap[];
  priorities: PriorityItem[];
  categoryAverages: { category: string; average: number; count: number }[];
  ownedRequiredCount: number;
  ownedSkillCount: number;
  transferableNotes: { skillId: string; skillName: string; source: string; credit: number }[];
  disclaimer: string;
}

export async function analyzeCareer(
  userId: Types.ObjectId | string,
  careerId: Types.ObjectId | string,
): Promise<CareerAnalysis> {
  const [career, mappings, userSkills] = await Promise.all([
    models.Career.findById(careerId).select('name').lean() as Promise<{ name: string } | null>,
    models.CareerSkill.find({ careerId }).populate('skillId', 'name category').lean() as Promise<
      Record<string, any>[]
    >,
    models.UserSkill.find({ userId }).lean() as Promise<Record<string, any>[]>,
  ]);

  if (!career) {
    throw new Error(`Career ${careerId.toString()} not found`);
  }

  const required: RequiredSkill[] = mappings.map((m) => {
    const skill = m.skillId as Record<string, any> | null;
    return {
      skillId: m.skillId?._id?.toString() ?? m.skillId?.toString() ?? '',
      skillName: skill?.name ?? 'Unknown skill',
      requiredLevel: m.requiredLevel as RequiredSkill['requiredLevel'],
      importance: m.importance,
      isCore: m.isCore,
      prerequisites: (m.prerequisiteSkillIds as Types.ObjectId[]).map((p) => p.toString()),
      estimatedEffortHours: m.estimatedEffortHours,
    };
  });

  const rawOwned = new Map<string, number>();
  for (const us of userSkills) {
    rawOwned.set(us.skillId.toString(), us.level as number);
  }

  // Skill metadata, needed for the category check that blocks false matches.
  const skillMeta = new Map<string, { name: string; category: string }>();
  for (const m of mappings) {
    const skill = m.skillId as Record<string, any> | null;
    if (skill?._id)
      skillMeta.set(skill._id.toString(), { name: skill.name, category: skill.category });
  }
  for (const us of userSkills) {
    if (!skillMeta.has(us.skillId.toString())) {
      skillMeta.set(us.skillId.toString(), { name: '', category: '' });
    }
  }

  const owned: OwnedSkill[] = [];
  const transferableNotes: CareerAnalysis['transferableNotes'] = [];

  for (const req of required) {
    const baseLevel = rawOwned.get(req.skillId) ?? 0;
    if (baseLevel >= req.requiredLevel) {
      owned.push({ skillId: req.skillId, currentLevel: baseLevel as OwnedSkill['currentLevel'] });
      continue;
    }

    // Look for a related owned skill that could partially cover this gap.
    const best = await findTransferSource(req, rawOwned, skillMeta, baseLevel);

    if (best) {
      const applied = transferableCredit(req.requiredLevel, best.skillId, best.similarity, true);
      if (applied.credit > 0) {
        const effective = Math.min(req.requiredLevel, baseLevel + applied.credit);
        owned.push({
          skillId: req.skillId,
          currentLevel: Math.round(effective) as OwnedSkill['currentLevel'],
          bestRelatedSimilarity: best.similarity,
          bestRelatedSkillName: best.name,
        });
        transferableNotes.push({
          skillId: req.skillId,
          skillName: req.skillName,
          source: best.name,
          credit: applied.credit,
        });
        continue;
      }
    }

    owned.push({ skillId: req.skillId, currentLevel: baseLevel as OwnedSkill['currentLevel'] });
  }

  const alignment = calculateAlignment(required, owned);
  const gaps = analyzeSkillGaps(required, owned);

  const priorities = calculatePriorities(gaps, {
    existingSkillIds: new Set(rawOwned.keys()),
    requiredEfforts: required.map((r) => r.estimatedEffortHours),
  });

  const categoryAverages = aggregateByCategory(
    gaps.map((g) => {
      const meta = skillMeta.get(g.skillId);
      return { category: meta?.category ?? 'Other', normalized: g.normalized };
    }),
  );

  return {
    careerId: careerId.toString(),
    careerName: career.name,
    alignment,
    gaps,
    priorities,
    categoryAverages,
    ownedRequiredCount: owned.filter((o) => o.currentLevel > 0).length,
    ownedSkillCount: rawOwned.size,
    transferableNotes,
    disclaimer: SCORE_DISCLAIMER,
  };
}

async function findTransferSource(
  req: RequiredSkill,
  rawOwned: Map<string, number>,
  skillMeta: Map<string, { name: string; category: string }>,
  baseLevel: number,
): Promise<{ skillId: string; name: string; similarity: number } | null> {
  const reqMeta = skillMeta.get(req.skillId);
  if (!reqMeta?.name) return null;

  // Only skills in the same category can grant credit, which is what stops
  // "I know Excel" from covering a gap in Statistics.
  const candidates = [...rawOwned.entries()].filter(([id, level]) => {
    if (id === req.skillId) return false;
    const meta = skillMeta.get(id);
    if (!meta?.name) return false;
    if (meta.category !== reqMeta.category) return false;
    return level > baseLevel;
  });

  if (candidates.length === 0) return null;

  let best: { skillId: string; name: string; similarity: number } | null = null;

  for (const [id] of candidates.slice(0, 40)) {
    const meta = skillMeta.get(id);
    if (!meta) continue;
    try {
      const result = await compareSkillSimilarity(meta.name, reqMeta.name, true);
      if (!result.eligibleForCredit || result.similarity < SIMILARITY_THRESHOLD) continue;
      if (!best || result.similarity > best.similarity) {
        best = { skillId: id, name: meta.name, similarity: result.similarity };
      }
    } catch (error) {
      logger.warn('Similarity check failed, skipping candidate', {
        skillId: id,
        message: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  return best;
}
