import { describe, expect, it } from 'vitest';
import {
  calculateAlignment,
  calculateGap,
  calculateNormalized,
  calculatePriorities,
  calculateWeight,
  classifyGap,
  analyzeSkillGaps,
  transferableCredit,
  type OwnedSkill,
  type RequiredSkill,
} from '../scoring.js';
import {
  IMPORTANCE_WEIGHTS,
  PRIORITY_WEIGHTS,
  SCORE_DISCLAIMER,
  SIMILARITY_THRESHOLD,
  TRANSFERABLE_CREDIT_CAP,
  PROHIBITED_AI_PHRASES,
} from '../index.js';

const required = (
  overrides: Partial<RequiredSkill> & Pick<RequiredSkill, 'skillId'>,
): RequiredSkill => ({
  skillName: overrides.skillId,
  requiredLevel: 3,
  importance: 'medium',
  isCore: false,
  prerequisites: [],
  estimatedEffortHours: 10,
  ...overrides,
});

const owned = (skillId: string, currentLevel: number): OwnedSkill => ({
  skillId,
  currentLevel: currentLevel as OwnedSkill['currentLevel'],
});

describe('gap formula', () => {
  it('is max(0, required - current)', () => {
    expect(calculateGap(2, 4)).toBe(2);
    expect(calculateGap(4, 2)).toBe(0);
    expect(calculateGap(0, 5)).toBe(5);
    expect(calculateGap(3, 3)).toBe(0);
  });
});

describe('normalized formula', () => {
  it('is min(current / required, 1)', () => {
    expect(calculateNormalized(2, 4)).toBe(0.5);
    expect(calculateNormalized(4, 4)).toBe(1);
    expect(calculateNormalized(5, 2)).toBe(1);
    expect(calculateNormalized(0, 3)).toBe(0);
  });

  it('treats a requirement of zero as satisfied at any level', () => {
    expect(calculateNormalized(0, 0)).toBe(1);
  });
});

describe('weight formula', () => {
  it('maps importance High=3, Med=2, Low=1', () => {
    expect(IMPORTANCE_WEIGHTS.high).toBe(3);
    expect(IMPORTANCE_WEIGHTS.medium).toBe(2);
    expect(IMPORTANCE_WEIGHTS.low).toBe(1);
  });

  it('multiplies by the dependency factor', () => {
    expect(calculateWeight('high')).toBe(3);
    expect(calculateWeight('high', 1.5)).toBe(4.5);
  });
});

describe('gap labels', () => {
  it('labels gap 0 as strong', () => {
    expect(classifyGap(0, 'high')).toBe('strong');
  });

  it('labels gap 1 as developing', () => {
    expect(classifyGap(1, 'low')).toBe('developing');
    expect(classifyGap(1, 'high')).toBe('developing');
  });

  it('labels gap 2 as gap for low importance', () => {
    expect(classifyGap(2, 'low')).toBe('gap');
    expect(classifyGap(2, 'medium')).toBe('gap');
  });

  it('labels a high-importance skill with gap 2 as critical', () => {
    expect(classifyGap(2, 'high')).toBe('critical');
  });

  it('labels gap 3 or more as critical regardless of importance', () => {
    expect(classifyGap(3, 'low')).toBe('critical');
    expect(classifyGap(5, 'medium')).toBe('critical');
  });
});

describe('transferable credit', () => {
  it('never exceeds the configured cap of the requirement', () => {
    const { credit } = transferableCredit(5, 'excel', 0.99, true);
    expect(credit).toBeLessThanOrEqual(5 * TRANSFERABLE_CREDIT_CAP);
  });

  it('contributes nothing below the minimum similarity', () => {
    expect(transferableCredit(5, 'excel', 0.5, true).credit).toBe(0);
  });

  it('contributes nothing when the category does not match', () => {
    expect(transferableCredit(5, 'excel', 0.95, false).credit).toBe(0);
  });

  it('contributes nothing when there is no related skill', () => {
    expect(transferableCredit(5, undefined, 0.95, true).credit).toBe(0);
  });

  it('credits more as similarity rises', () => {
    const low = transferableCredit(5, 'excel', 0.7, true).credit;
    const high = transferableCredit(5, 'excel', 0.95, true).credit;
    expect(high).toBeGreaterThan(low);
  });
});

describe('gap analysis', () => {
  it('produces one entry per required skill', () => {
    const gaps = analyzeSkillGaps(
      [required({ skillId: 'a' }), required({ skillId: 'b' })],
      [owned('a', 3)],
    );
    expect(gaps).toHaveLength(2);
  });

  it('treats a missing skill as level 0', () => {
    const [gap] = analyzeSkillGaps([required({ skillId: 'sql', requiredLevel: 4 })], []);
    expect(gap?.currentLevel).toBe(0);
    expect(gap?.gap).toBe(4);
    expect(gap?.label).toBe('critical');
  });

  it('always returns a human-readable reason', () => {
    const gaps = analyzeSkillGaps(
      [required({ skillId: 'sql', skillName: 'SQL', requiredLevel: 4, importance: 'high' })],
      [owned('sql', 1)],
    );
    expect(gaps[0]?.reason).toContain('SQL');
    expect(gaps[0]?.reason.length).toBeGreaterThan(20);
  });
});

describe('career alignment', () => {
  it('is 100 when every required skill is fully met', () => {
    const reqs = [
      required({ skillId: 'a', requiredLevel: 3, importance: 'high' }),
      required({ skillId: 'b', requiredLevel: 2, importance: 'low' }),
    ];
    const result = calculateAlignment(reqs, [owned('a', 3), owned('b', 2)]);
    expect(result.percent).toBe(100);
  });

  it('is 0 when no required skill is met', () => {
    const reqs = [required({ skillId: 'a', requiredLevel: 3, importance: 'high' })];
    expect(calculateAlignment(reqs, []).percent).toBe(0);
  });

  it('gives the same percent regardless of importance, but different total weight', () => {
    // normalized is level/required, so it is identical for the same levels.
    // Importance changes how much the skill COUNTS, not the ratio itself.
    const high = calculateAlignment(
      [required({ skillId: 'a', requiredLevel: 4, importance: 'high' })],
      [owned('a', 2)],
    );
    const low = calculateAlignment(
      [required({ skillId: 'a', requiredLevel: 4, importance: 'low' })],
      [owned('a', 2)],
    );
    expect(high.percent).toBe(50);
    expect(low.percent).toBe(50);
    expect(high.totalWeight).toBe(3);
    expect(low.totalWeight).toBe(1);
  });

  it('lets a high-importance unmet skill drag the total down more', () => {
    const reqs = [
      required({ skillId: 'met', requiredLevel: 3, importance: 'low' }),
      required({ skillId: 'unmet', requiredLevel: 3, importance: 'high' }),
    ];
    // Weight 1 met + 3 unmet = 4 total; achieved 1 -> 25%.
    // If both skills carried equal weight the result would be 50%.
    expect(calculateAlignment(reqs, [owned('met', 3)]).percent).toBe(25);
    expect(calculateAlignment(reqs, [owned('met', 3), owned('unmet', 3)]).percent).toBe(100);
  });

  it('returns 0 rather than dividing by zero for an empty career', () => {
    const result = calculateAlignment([], []);
    expect(result.percent).toBe(0);
    expect(result.totalWeight).toBe(0);
  });

  it('counts gaps by label', () => {
    const reqs = [
      // a: met -> strong
      required({ skillId: 'a', requiredLevel: 3, importance: 'low' }),
      // b: gap 2 on a HIGH-importance skill -> critical (not plain "gap")
      required({ skillId: 'b', requiredLevel: 3, importance: 'high' }),
      // c: gap 1 -> developing
      required({ skillId: 'c', requiredLevel: 3, importance: 'low' }),
      // d: gap 2 on a LOW-importance skill -> gap
      required({ skillId: 'd', requiredLevel: 2, importance: 'low' }),
    ];
    const result = calculateAlignment(reqs, [
      owned('a', 3),
      owned('b', 1),
      owned('c', 2),
      owned('d', 0),
    ]);
    expect(result.gapsByLabel).toEqual({ strong: 1, developing: 1, gap: 1, critical: 1 });
  });

  it('handles the spec demo student without dividing by zero or NaN', () => {
    const reqs = [
      required({ skillId: 'python', requiredLevel: 4, importance: 'high' }),
      required({ skillId: 'excel', requiredLevel: 3, importance: 'medium' }),
      required({ skillId: 'sql', requiredLevel: 3, importance: 'high' }),
      required({ skillId: 'statistics', requiredLevel: 3, importance: 'high' }),
      required({ skillId: 'powerbi', requiredLevel: 3, importance: 'medium' }),
    ];
    const result = calculateAlignment(reqs, [
      owned('python', 3),
      owned('excel', 3),
      owned('sql', 1),
      owned('statistics', 2),
      owned('communication', 3),
    ]);
    expect(Number.isFinite(result.percent)).toBe(true);
    expect(result.percent).toBeGreaterThan(0);
    expect(result.percent).toBeLessThan(100);
  });
});

describe('priority engine', () => {
  const buildGaps = () =>
    analyzeSkillGaps(
      [
        required({
          skillId: 'sql',
          skillName: 'SQL',
          requiredLevel: 4,
          importance: 'high',
          estimatedEffortHours: 20,
        }),
        required({
          skillId: 'statistics',
          skillName: 'Statistics',
          requiredLevel: 3,
          importance: 'medium',
          estimatedEffortHours: 15,
        }),
        required({
          skillId: 'powerbi',
          skillName: 'Power BI',
          requiredLevel: 3,
          importance: 'low',
          prerequisites: ['sql', 'statistics'],
          estimatedEffortHours: 8,
        }),
      ],
      [owned('sql', 1), owned('statistics', 2), owned('powerbi', 0)],
    );

  it('weights sum to 1', () => {
    const sum = Object.values(PRIORITY_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it('ranks 1..n without gaps', () => {
    const items = calculatePriorities(buildGaps());
    expect(items.map((i) => i.rank)).toEqual([1, 2, 3]);
  });

  it('puts a large high-importance gap first', () => {
    const items = calculatePriorities(buildGaps());
    expect(items[0]?.skillName).toBe('SQL');
  });

  it('never suggests a skill before its prerequisite', () => {
    const items = calculatePriorities(buildGaps());
    const powerBiIndex = items.findIndex((i) => i.skillName === 'Power BI');
    const sqlIndex = items.findIndex((i) => i.skillName === 'SQL');
    const statsIndex = items.findIndex((i) => i.skillName === 'Statistics');
    expect(powerBiIndex).toBeGreaterThan(sqlIndex);
    expect(powerBiIndex).toBeGreaterThan(statsIndex);
  });

  it('enforces prerequisites even when the dependent skill scores higher', () => {
    // Power BI is quick (8h) and would outrank SQL on score alone.
    // The hard constraint must still put SQL first.
    const items = calculatePriorities(buildGaps());
    const byName = new Map(items.map((i) => [i.skillName, i]));
    expect(byName.get('Power BI')?.score ?? 0).toBeGreaterThan(0);
    expect(byName.get('SQL')?.rank).toBeLessThan(byName.get('Power BI')?.rank ?? 99);
  });

  it('handles a prerequisite cycle without dropping skills', () => {
    const gaps = analyzeSkillGaps(
      [
        required({ skillId: 'a', skillName: 'A', requiredLevel: 3, prerequisites: ['b'] }),
        required({ skillId: 'b', skillName: 'B', requiredLevel: 3, prerequisites: ['a'] }),
      ],
      [owned('a', 0), owned('b', 0)],
    );
    const items = calculatePriorities(gaps);
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.skillId).sort()).toEqual(['a', 'b']);
  });

  it('variates inverse effort across different effort spreads', () => {
    const tight = analyzeSkillGaps(
      [
        required({
          skillId: 'slow',
          skillName: 'Slow',
          requiredLevel: 3,
          estimatedEffortHours: 40,
        }),
        required({
          skillId: 'quick',
          skillName: 'Quick',
          requiredLevel: 3,
          estimatedEffortHours: 38,
        }),
      ],
      [owned('slow', 0), owned('quick', 0)],
    );
    const quick = calculatePriorities(tight).find((i) => i.skillName === 'Quick');
    const slow = calculatePriorities(tight).find((i) => i.skillName === 'Slow');
    expect(quick?.factors.inverseEffort).toBeGreaterThan(slow?.factors.inverseEffort ?? 1);
  });

  it('excludes skills with no gap', () => {
    const gaps = analyzeSkillGaps(
      [required({ skillId: 'a', requiredLevel: 3 }), required({ skillId: 'b', requiredLevel: 3 })],
      [owned('a', 3), owned('b', 0)],
    );
    const items = calculatePriorities(gaps);
    expect(items).toHaveLength(1);
    expect(items[0]?.skillId).toBe('b');
  });

  it('returns an empty list when there are no gaps', () => {
    const gaps = analyzeSkillGaps([required({ skillId: 'a', requiredLevel: 3 })], [owned('a', 3)]);
    expect(calculatePriorities(gaps)).toEqual([]);
  });

  it('returns all five factors for every item so the UI can explain it', () => {
    for (const item of calculatePriorities(buildGaps())) {
      expect(Object.keys(item.factors).sort()).toEqual(
        [
          'existingSkillRelevance',
          'gapSize',
          'importance',
          'inverseEffort',
          'prerequisitePosition',
        ].sort(),
      );
      for (const value of Object.values(item.factors)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  it('explains every item in plain language', () => {
    for (const item of calculatePriorities(buildGaps())) {
      expect(item.reason).toContain(item.skillName);
      expect(item.reason.length).toBeGreaterThan(40);
    }
  });

  it('produces scores in the 0-100 range', () => {
    for (const item of calculatePriorities(buildGaps())) {
      expect(item.score).toBeGreaterThanOrEqual(0);
      expect(item.score).toBeLessThanOrEqual(100);
    }
  });
});

describe('product honesty rules', () => {
  it('ships a disclaimer that denies predicting employment', () => {
    expect(SCORE_DISCLAIMER).toContain('not a prediction of employment');
  });

  it('flags the phrases the spec forbids', () => {
    const banned = [
      'We guarantee you a job',
      'You will get you a job in 3 months',
      'You will definitely earn ৳50,000 per month',
      'Salary of $60,000 per year',
      'Your employment probability is 80%',
      'You are certain to be hired',
    ];
    for (const phrase of banned) {
      const caught = PROHIBITED_AI_PHRASES.some((re) => re.test(phrase));
      expect(caught, `should have been flagged: ${phrase}`).toBe(true);
    }
  });

  it('does not flag honest alignment wording', () => {
    const honest = [
      'Your profile shows stronger alignment with these requirements.',
      'Based on the skills you have recorded, SQL is the most urgent gap.',
    ];
    for (const phrase of honest) {
      const caught = PROHIBITED_AI_PHRASES.some((re) => re.test(phrase));
      expect(caught, `should not have been flagged: ${phrase}`).toBe(false);
    }
  });

  it('uses the spec similarity threshold', () => {
    expect(SIMILARITY_THRESHOLD).toBe(0.75);
  });
});
