/**
 * The scoring formulas from spec §4, as pure functions.
 *
 * This module is intentionally dependency-free and side-effect-free so that:
 *  1. The server engine and the client "Explain this score" panel compute
 *     byte-identical numbers from the same inputs.
 *  2. Every formula is unit-testable without a database or a server.
 *  3. AI providers can be tested for "did it invent a number" by comparing
 *     their output against these functions.
 *
 * NO I/O, NO DATABASE, NO EXPRESS. If you need any of those, you are in the
 * wrong file.
 */

import {
  type GapLabel,
  GAP_THRESHOLDS,
  HIGH_IMPORTANCE_CRITICAL_GAP,
  type ImportanceLevel,
  IMPORTANCE_WEIGHTS,
  SKILL_LEVEL_MAX,
  SKILL_LEVEL_MIN,
  type SkillLevel,
} from './enums.js';
import {
  EFFORT_BOUNDS,
  PRIORITY_WEIGHTS,
  PRIORITY_WEIGHT_SUM,
  SIMILARITY_THRESHOLD,
  TRANSFERABLE_CREDIT_CAP,
  TRANSFERABLE_MIN_SIMILARITY,
} from './constants.js';

// ─── Types ──────────────────────────────────────────────────────────────────

/** A skill the student has, as far as gap analysis is concerned. */
export interface OwnedSkill {
  skillId: string;
  /** Effective level after any transferable credit has been applied. */
  currentLevel: SkillLevel;
  /** Similarity of the best related owned skill, 0 when there is none. */
  bestRelatedSimilarity?: number;
  /** Name of the owned skill that produced `bestRelatedSimilarity`. */
  bestRelatedSkillName?: string;
}

/** A skill a career requires, as far as gap analysis is concerned. */
export interface RequiredSkill {
  skillId: string;
  skillName: string;
  requiredLevel: SkillLevel;
  importance: ImportanceLevel;
  isCore: boolean;
  /** IDs of skills that should be learned before this one. */
  prerequisites: string[];
  estimatedEffortHours: number;
}

export interface SkillGap {
  skillId: string;
  skillName: string;
  currentLevel: SkillLevel;
  requiredLevel: SkillLevel;
  /** max(0, required - current) */
  gap: number;
  /** min(current / required, 1); 1 when required is 0. */
  normalized: number;
  importance: ImportanceLevel;
  importanceWeight: number;
  isCore: boolean;
  label: GapLabel;
  prerequisites: string[];
  estimatedEffortHours: number;
  /** True when transferable credit raised the effective current level. */
  usedTransferableCredit: boolean;
  transferableCredit: number;
  transferSource?: string;
  /** Plain-language reason, safe to show to the student. */
  reason: string;
}

export interface WeightedNormalized {
  skillId: string;
  weight: number;
  normalized: number;
  contribution: number;
}

export interface AlignmentResult {
  /** 0–100, rounded to one decimal. */
  percent: number;
  weightedNormalized: WeightedNormalized[];
  totalWeight: number;
  /** Sum of weight*normalized across all required skills. */
  achieved: number;
  skillCount: number;
  /** Count of owned skills, including ones not required by this career. */
  ownedCount: number;
  gapsByLabel: Record<GapLabel, number>;
}

export interface PriorityFactorBreakdown {
  gapSize: number;
  importance: number;
  prerequisitePosition: number;
  inverseEffort: number;
  existingSkillRelevance: number;
}

export interface PriorityItem {
  skillId: string;
  skillName: string;
  /** 0–100, rounded to one decimal. Higher means learn sooner. */
  score: number;
  rank: number;
  factors: PriorityFactorBreakdown;
  gap: number;
  importance: ImportanceLevel;
  estimatedEffortHours: number;
  prerequisites: string[];
  /** Plain-language explanation, spec §6 "why is this first". */
  reason: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function clampLevel(value: number): SkillLevel {
  if (!Number.isFinite(value)) return SKILL_LEVEL_MIN;
  const rounded = Math.round(value);
  return Math.min(SKILL_LEVEL_MAX, Math.max(SKILL_LEVEL_MIN, rounded)) as SkillLevel;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Gap_i = max(0, Required_i - Current_i)
 */
export function calculateGap(current: SkillLevel, required: SkillLevel): number {
  return Math.max(0, required - current);
}

/**
 * Normalized_i = min(Current_i / Required_i, 1)
 * A required level of 0 means the skill is satisfied at any level.
 */
export function calculateNormalized(current: SkillLevel, required: SkillLevel): number {
  if (required <= 0) return 1;
  return clamp01(current / required);
}

/**
 * Weight_i = ImportanceValue_i x DependencyFactor_i
 *
 * ImportanceValue is High=3, Med=2, Low=1. The dependency factor is applied by
 * the caller through `dependencyFactor` (default 1) so that graph-aware callers
 * can raise the weight of a skill many others depend on.
 */
export function calculateWeight(importance: ImportanceLevel, dependencyFactor = 1): number {
  return IMPORTANCE_WEIGHTS[importance] * dependencyFactor;
}

/**
 * Gap label from spec §4.
 * Critical is a gap of 3+, or any high-importance skill with a gap of 2+.
 */
export function classifyGap(gap: number, importance: ImportanceLevel): GapLabel {
  if (gap <= 0) return 'strong';
  if (importance === 'high' && gap >= HIGH_IMPORTANCE_CRITICAL_GAP) return 'critical';
  if (gap >= GAP_THRESHOLDS.critical) return 'critical';
  if (gap >= GAP_THRESHOLDS.gap) return 'gap';
  return 'developing';
}

/**
 * Transferable credit from a related owned skill.
 *
 * Capped at TRANSFERABLE_CREDIT_CAP of the requirement so a related skill can
 * never fully close a gap, and blocked below TRANSFERABLE_MIN_SIMILARITY so
 * loosely related names contribute nothing.
 */
export function transferableCredit(
  requiredLevel: SkillLevel,
  relatedSkillId: string | undefined,
  bestRelatedSimilarity: number | undefined,
  categoryMatches: boolean,
): { credit: number; source?: string } {
  if (relatedSkillId === undefined) return { credit: 0 };
  if (!categoryMatches) return { credit: 0 };
  const similarity = bestRelatedSimilarity ?? 0;
  if (similarity < TRANSFERABLE_MIN_SIMILARITY) return { credit: 0 };

  const allowance = requiredLevel * TRANSFERABLE_CREDIT_CAP;
  // Similarity above the threshold earns proportionally more of the allowance.
  const similaritySpan = Math.max(0.0001, 1 - TRANSFERABLE_MIN_SIMILARITY);
  const scaled = Math.min(1, (similarity - TRANSFERABLE_MIN_SIMILARITY) / similaritySpan);
  const credit = round1(allowance * scaled);

  return credit > 0 ? { credit, source: relatedSkillId } : { credit: 0 };
}

// ─── Gap analysis ───────────────────────────────────────────────────────────

/**
 * Build the full per-skill gap list for a career.
 *
 * `owned` supplies the student's effective levels, already including any
 * transferable credit applied by the caller (which owns the similarity model).
 */
export function analyzeSkillGaps(
  required: readonly RequiredSkill[],
  owned: readonly OwnedSkill[],
): SkillGap[] {
  const ownedById = new Map(owned.map((o) => [o.skillId, o]));

  return required.map((req) => {
    const held = ownedById.get(req.skillId);
    const baseLevel = held?.currentLevel ?? (SKILL_LEVEL_MIN as SkillLevel);
    const gap = calculateGap(baseLevel, req.requiredLevel);
    const label = classifyGap(gap, req.importance);

    const usedCredit = (held?.bestRelatedSimilarity ?? 0) >= SIMILARITY_THRESHOLD;
    const credit = usedCredit ? (held?.bestRelatedSimilarity ?? 0) : 0;

    return {
      skillId: req.skillId,
      skillName: req.skillName,
      currentLevel: clampLevel(baseLevel),
      requiredLevel: req.requiredLevel,
      gap,
      normalized: calculateNormalized(baseLevel, req.requiredLevel),
      importance: req.importance,
      importanceWeight: IMPORTANCE_WEIGHTS[req.importance],
      isCore: req.isCore,
      label,
      prerequisites: req.prerequisites,
      estimatedEffortHours: req.estimatedEffortHours,
      usedTransferableCredit: usedCredit,
      transferableCredit: round1(credit),
      ...(held?.bestRelatedSkillName !== undefined
        ? { transferSource: held.bestRelatedSkillName }
        : {}),
      reason: buildGapReason(req, baseLevel, gap, label, req.isCore),
    };
  });
}

function buildGapReason(
  req: RequiredSkill,
  current: SkillLevel,
  gap: number,
  label: GapLabel,
  isCore: boolean,
): string {
  const core = isCore ? ' a core skill' : '';
  if (gap === 0) {
    return `You are at level ${current}, which meets the required level ${req.requiredLevel} for this ${req.skillName}.`;
  }
  if (label === 'critical') {
    return `${req.skillName} is${core} marked ${req.importance} importance and you are ${gap} level${gap === 1 ? '' : 's'} below the requirement of ${req.requiredLevel}. This is the most urgent gap on your map.`;
  }
  return `You are at level ${current} and ${req.skillName} requires level ${req.requiredLevel}, so there is a gap of ${gap}. It is marked ${req.importance} importance.`;
}

// ─── Alignment ──────────────────────────────────────────────────────────────

/**
 * Career Alignment (%) = sum(Weight_i x Normalized_i) / sum(Weight_i) x 100
 *
 * Returns 0 when the career requires nothing, rather than dividing by zero.
 */
export function calculateAlignment(
  required: readonly RequiredSkill[],
  owned: readonly OwnedSkill[],
  dependencyFactors: ReadonlyMap<string, number> = new Map(),
): AlignmentResult {
  const ownedById = new Map(owned.map((o) => [o.skillId, o]));
  const gapsByLabel: Record<GapLabel, number> = {
    strong: 0,
    developing: 0,
    gap: 0,
    critical: 0,
  };

  const weightedNormalized: WeightedNormalized[] = required.map((req) => {
    const current = ownedById.get(req.skillId)?.currentLevel ?? (SKILL_LEVEL_MIN as SkillLevel);
    const weight = calculateWeight(req.importance, dependencyFactors.get(req.skillId) ?? 1);
    const normalized = calculateNormalized(current, req.requiredLevel);
    gapsByLabel[classifyGap(calculateGap(current, req.requiredLevel), req.importance)] += 1;

    return { skillId: req.skillId, weight, normalized, contribution: weight * normalized };
  });

  const totalWeight = weightedNormalized.reduce((sum, w) => sum + w.weight, 0);
  const achieved = weightedNormalized.reduce((sum, w) => sum + w.contribution, 0);
  const percent = totalWeight === 0 ? 0 : round1((achieved / totalWeight) * 100);

  return {
    percent,
    weightedNormalized,
    totalWeight: round1(totalWeight),
    achieved: round1(achieved),
    skillCount: required.length,
    ownedCount: owned.length,
    gapsByLabel,
  };
}

// ─── Priority engine ────────────────────────────────────────────────────────

/**
 * Rank the skills a student should learn next.
 *
 * The score is a weighted combination of five factors, each normalised to
 * 0–1 before weighting. All five are returned so the UI can show its work.
 *
 * Prerequisite ordering is a HARD constraint, not a soft term: any skill
 * listed in another skill's `prerequisites` is always ranked ahead of the
 * skills that depend on it, even if its weighted score is lower. A student is
 * never told to study Power BI before the SQL it depends on.
 */
export function calculatePriorities(
  gaps: readonly SkillGap[],
  options: { existingSkillIds?: ReadonlySet<string>; requiredEfforts?: readonly number[] } = {},
): PriorityItem[] {
  const existing = options.existingSkillIds ?? new Set<string>();
  const requiredEfforts = options.requiredEfforts ?? [];

  const withGaps = gaps.filter((g) => g.gap > 0);
  if (withGaps.length === 0) return [];

  const maxGap = Math.max(...withGaps.map((g) => g.gap), 1);

  // Effort is a property of the CAREER requirement, not of this student, so it
  // is normalised against the full required set (all required skills, including
  // ones the student already meets) rather than only the subset with a gap.
  const allRequiredEfforts = [...requiredEfforts, ...withGaps.map((g) => g.estimatedEffortHours)];
  const clampedEfforts = allRequiredEfforts.map((e) =>
    Number.isFinite(e)
      ? Math.min(EFFORT_BOUNDS.maxHours, Math.max(EFFORT_BOUNDS.minHours, e))
      : EFFORT_BOUNDS.maxHours,
  );
  const maxEffort = Math.max(...clampedEfforts, EFFORT_BOUNDS.maxHours);
  const minEffort = Math.min(...clampedEfforts, EFFORT_BOUNDS.minHours);
  const effortSpan = Math.max(1, maxEffort - minEffort);

  const inverseEffortOf = (hours: number): number => {
    const clamped = Number.isFinite(hours)
      ? Math.min(EFFORT_BOUNDS.maxHours, Math.max(EFFORT_BOUNDS.minHours, hours))
      : EFFORT_BOUNDS.maxHours;
    return clamp01((maxEffort - clamped) / effortSpan);
  };

  // How many other gap skills depend on each skill. Prerequisite roots first.
  const dependents = new Map<string, number>();
  const gapIds = new Set(withGaps.map((g) => g.skillId));
  for (const g of withGaps) {
    for (const prereq of g.prerequisites) {
      if (gapIds.has(prereq)) {
        dependents.set(prereq, (dependents.get(prereq) ?? 0) + 1);
      }
    }
  }
  const maxDependents = Math.max(0, ...dependents.values());

  // Which gap skills each skill unlocks. Used both as a scoring factor and to
  // write a reason that names the actual skills instead of counting them.
  const unlocks = new Map<string, string[]>();
  for (const g of withGaps) {
    for (const prereq of g.prerequisites) {
      if (gapIds.has(prereq)) {
        unlocks.set(prereq, [...(unlocks.get(prereq) ?? []), g.skillId]);
      }
    }
  }

  const scored = withGaps.map((g) => {
    const factors: PriorityFactorBreakdown = {
      gapSize: clamp01(g.gap / maxGap),
      importance: clamp01(g.importanceWeight / IMPORTANCE_WEIGHTS.high),
      prerequisitePosition:
        maxDependents === 0 ? 1 : clamp01((dependents.get(g.skillId) ?? 0) / maxDependents),
      inverseEffort: inverseEffortOf(g.estimatedEffortHours),
      existingSkillRelevance: existing.has(g.skillId) ? 1 : clamp01(g.normalized),
    };

    const raw =
      factors.gapSize * PRIORITY_WEIGHTS.gapSize +
      factors.importance * PRIORITY_WEIGHTS.importance +
      factors.prerequisitePosition * PRIORITY_WEIGHTS.prerequisitePosition +
      factors.inverseEffort * PRIORITY_WEIGHTS.inverseEffort +
      factors.existingSkillRelevance * PRIORITY_WEIGHTS.existingSkillRelevance;

    return { gap: g, factors, raw, score: round1(clamp01(raw) * 100) };
  });

  return topologicalSortByScore(scored).map((s, index) => {
    const nameOf = (id: string): string | undefined =>
      scored.find((x) => x.gap.skillId === id)?.gap.skillName;

    return {
      skillId: s.gap.skillId,
      skillName: s.gap.skillName,
      score: s.score,
      rank: index + 1,
      factors: s.factors,
      gap: s.gap.gap,
      importance: s.gap.importance,
      estimatedEffortHours: s.gap.estimatedEffortHours,
      prerequisites: s.gap.prerequisites,
      reason: buildPriorityReason(
        s.gap,
        s.factors,
        index + 1,
        s.gap.prerequisites.map(nameOf).filter((n): n is string => typeof n === 'string'),
        (unlocks.get(s.gap.skillId) ?? []).map(nameOf).filter((n) => typeof n === 'string'),
      ),
    };
  });
}

/**
 * Kahn's algorithm over the prerequisite graph, always emitting the
 * highest-scoring currently-available skill.
 *
 * Cycles in admin-authored prerequisite data are tolerated: any skill still
 * unplaced when the queue empties is appended in score order rather than
 * dropped, so one bad mapping can never produce a short roadmap.
 */
function topologicalSortByScore<T extends { gap: SkillGap; raw: number }>(scored: T[]): T[] {
  const byId = new Map(scored.map((s) => [s.gap.skillId, s]));
  const indegree = new Map<string, number>();
  const outEdges = new Map<string, string[]>();

  for (const s of scored) {
    const prereqs = s.gap.prerequisites.filter((p) => byId.has(p));
    indegree.set(s.gap.skillId, prereqs.length);
    for (const p of prereqs) {
      outEdges.set(p, [...(outEdges.get(p) ?? []), s.gap.skillId]);
    }
  }

  const tiebreak = (a: T, b: T) => {
    if (b.raw !== a.raw) return b.raw - a.raw;
    if (a.gap.estimatedEffortHours !== b.gap.estimatedEffortHours) {
      return a.gap.estimatedEffortHours - b.gap.estimatedEffortHours;
    }
    return a.gap.skillName.localeCompare(b.gap.skillName);
  };

  const ready = scored.filter((s) => (indegree.get(s.gap.skillId) ?? 0) === 0).sort(tiebreak);
  const ordered: T[] = [];
  const placed = new Set<string>();

  while (ready.length > 0) {
    const next = ready.shift();
    if (next === undefined) break;
    ordered.push(next);
    placed.add(next.gap.skillId);

    for (const dependentId of outEdges.get(next.gap.skillId) ?? []) {
      const remaining = (indegree.get(dependentId) ?? 0) - 1;
      indegree.set(dependentId, remaining);
      if (remaining === 0) {
        const candidate = byId.get(dependentId);
        if (candidate !== undefined) {
          ready.push(candidate);
          ready.sort(tiebreak);
        }
      }
    }
  }

  if (placed.size < scored.length) {
    const remaining = scored.filter((s) => !placed.has(s.gap.skillId)).sort(tiebreak);
    ordered.push(...remaining);
  }

  return ordered;
}

function buildPriorityReason(
  gap: SkillGap,
  factors: PriorityFactorBreakdown,
  rank: number,
  prerequisiteSkillNames: string[],
  dependentsSkillNames: string[],
): string {
  const parts: string[] = [];
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  parts.push(`${gap.skillName} is number ${rank} to learn`);

  if (factors.gapSize > 0.6) {
    parts.push(`it is one of your largest gaps at ${gap.gap} level${gap.gap === 1 ? '' : 's'}`);
  } else if (factors.gapSize > 0) {
    parts.push(`your gap is ${gap.gap} level${gap.gap === 1 ? '' : 's'}`);
  }

  parts.push(`it is marked ${gap.importance} importance for this career`);

  if (dependentsSkillNames.length > 0) {
    const list = dependentsSkillNames.slice(0, 3).join(', ');
    const more =
      dependentsSkillNames.length > 3 ? ` and ${dependentsSkillNames.length - 3} more` : '';
    parts.push(`it unlocks ${list}${more}, so it has to come early`);
  }

  if (prerequisiteSkillNames.length > 0) {
    parts.push(
      `you should cover ${prerequisiteSkillNames
        .slice(0, 3)
        .join(', ')} before it, which sets your order`,
    );
  }

  if (factors.inverseEffort > 0.6) {
    parts.push(`it is relatively quick at around ${gap.estimatedEffortHours} hours`);
  }

  if (factors.existingSkillRelevance > 0.5) {
    parts.push('it builds on skills you already have');
  }

  const sentence = parts.join(', ');
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}. Ranking factors: gap ${pct(factors.gapSize)}, importance ${pct(factors.importance)}, prerequisite position ${pct(factors.prerequisitePosition)}, effort ${pct(factors.inverseEffort)}, relevance to your current skills ${pct(factors.existingSkillRelevance)}.`;
}

// ─── Aggregate helpers ──────────────────────────────────────────────────────

/** Category-level averages, used by the radar chart. */
export function aggregateByCategory<T extends { category: string; normalized: number }>(
  entries: readonly T[],
): { category: string; average: number; count: number }[] {
  const buckets = new Map<string, { sum: number; count: number }>();
  for (const entry of entries) {
    const bucket = buckets.get(entry.category) ?? { sum: 0, count: 0 };
    bucket.sum += entry.normalized;
    bucket.count += 1;
    buckets.set(entry.category, bucket);
  }
  return [...buckets.entries()].map(([category, { sum, count }]) => ({
    category,
    average: round1(count === 0 ? 0 : (sum / count) * 100),
    count,
  }));
}

export const scoringInternals = {
  clampLevel,
  clamp01,
  round1,
  calculateGap,
  calculateNormalized,
  calculateWeight,
  classifyGap,
  transferableCredit,
  PRIORITY_WEIGHT_SUM,
};
