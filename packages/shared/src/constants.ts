/**
 * Scoring constants and the disclaimer contract.
 *
 * Spec §4. These are the ONLY place a scoring number may be defined.
 * The deterministic engine (packages/server/src/services/engine) imports from
 * here. AI providers may import the wording constants but MUST NOT compute
 * scores — see .kilo/rules/sm-scoring.md.
 */

/**
 * Shown next to every alignment or score in the product.
 * If you change this string, update docs/AI_MODEL.md and the i18n bundles.
 */
export const SCORE_DISCLAIMER =
  'This score represents alignment with the selected skill requirements and is not a prediction of employment.';

export const SCORE_DISCLAIMER_KEY = 'score.disclaimer';

/** Cosine similarity above which two skill names are considered related. */
export const SIMILARITY_THRESHOLD = 0.75;

/**
 * Maximum fraction of a missing skill's requirement that transferable skills
 * may cover. Prevents "I know Excel so I basically know statistics".
 */
export const TRANSFERABLE_CREDIT_CAP = 0.4;

/** Minimum similarity for a transferable skill to contribute at all. */
export const TRANSFERABLE_MIN_SIMILARITY = 0.6;

/** Weights used by the priority engine. Must sum to 1 for readability checks. */
export const PRIORITY_WEIGHTS = {
  /** Raw size of the gap. Bigger gap → learn sooner. */
  gapSize: 0.35,
  /** How much the career says this skill matters. */
  importance: 0.25,
  /** How many other priority skills depend on it (prerequisites first). */
  prerequisitePosition: 0.2,
  /** Inverse of estimated effort. Quick wins surface earlier. */
  inverseEffort: 0.12,
  /** Synergy with skills the student already owns. */
  existingSkillRelevance: 0.08,
} as const;

/** Sum of all priority weights — asserted to equal 1 in unit tests. */
export const PRIORITY_WEIGHT_SUM = Object.values(PRIORITY_WEIGHTS).reduce((a, b) => a + b, 0);

/** Bounds for the inverse-effort term, in estimated hours. */
export const EFFORT_BOUNDS = {
  minHours: 1,
  maxHours: 80,
} as const;

/** Roadmap pacing defaults, used when a student has not set study hours. */
export const ROADMAP_DEFAULTS = {
  weeklyStudyHours: 5,
  monthsHorizon: 6,
  minItemsPerWeek: 2,
  maxItemsPerWeek: 8,
} as const;

/** Alignment snapshot cadence for the trend chart. */
export const SNAPSHOT_RETENTION_DAYS = 180;

/** Badge/achievement thresholds that must stay consistent across modules. */
export const IMPACT_THRESHOLDS = {
  /** A student "reaches target" at or above this alignment percentage. */
  targetAlignmentPercent: 60,
  /** Minimum group size before anonymised gap insights may be shown. */
  minGroupSizeForInsights: 20,
} as const;

/** Categories that must never be inferred or recommended from user data. */
export const PROHIBITED_INFERENCE_FIELDS = [
  'age',
  'gender',
  'religion',
  'caste',
  'marital_status',
  'disability',
  'nationality',
  'political_affiliation',
] as const;

/**
 * Phrases that must never appear in AI-generated copy.
 * Enforced by a test that scans provider output in all three AI modes.
 * These encode the spec's safety rules: no job guarantees, no salary claims.
 */
export const PROHIBITED_AI_PHRASES: readonly RegExp[] = [
  // Job guarantees
  /\bguarantee[sd]?\b[^.?!]{0,20}\b(job|employment|work|hiring|role)\b/i,
  /\b(job|employment|work|hiring|role)\b[^.?!]{0,20}\bguarantee[sd]?\b/i,
  /\bwill\s+get\s+you\s+(a\s+)?job\b/i,
  /\bguaranteed\s+employment\b/i,
  /\bwill\s+be\s+hired\b/i,
  /\bcertain\s+to\s+be\s+(hired|employed)\b/i,
  /\b100%\s+(sure|guaranteed|certain)\b/i,
  /\b(you\s+will|you'll)\s+(definitely|guaranteedly|certainly)\s+(get|earn|receive|land)\b/i,

  // Salary and income claims
  /\b(salary|earn|earning|income|ctc|pay)\s*(of|is|:)?\s*(tk|৳|bdt|usd|\$)\s*\d/i,
  /\b(tk|৳|bdt)\s*[\d,]+/i,
  /\b\d[\d,]*\s*(taka|টাকা)\b/i,
  /\b(salary|ctc)\s*(range|of|is)\s*\d/i,

  // Employment-probability claims
  /\bprobabilit(y|ies)\s+of\s+(getting|securing|obtaining|landing)\b/i,
  /\bemployment\s+probabilit(y|ies)\b/i,
  /\bhiring\s+(probabilit(y|ies)|chance|odds)\b/i,
  /\b\d{1,3}\s*%\s*(chance|likelihood)\s+of\s+(getting|being)\s+hired\b/i,
] as const;

/** Required safe framing when AI discusses a student's career alignment. */
export const SAFE_FRAMING_PHRASES: readonly string[] = [
  'your profile shows',
  'based on the skills you have recorded',
  'this is not a prediction',
  'alignment with the selected skill requirements',
] as const;
