/**
 * Domain enums — the single source of truth for every closed set in SkillMap AI.
 *
 * These values are contractual. Changing one is a breaking API change and
 * requires a migration note in docs/API.md.
 */

// ─── Skills ─────────────────────────────────────────────────────────────────

/** Self-assessed or extracted proficiency, 0 through 5. */
export const SKILL_LEVELS = [0, 1, 2, 3, 4, 5] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const SKILL_LEVEL_MIN = 0;
export const SKILL_LEVEL_MAX = 5;

/** Plain-language description of each level, shown in the UI. */
export const SKILL_LEVEL_DESCRIPTIONS: Record<SkillLevel, string> = {
  0: 'Never used this',
  1: 'Tried it once or twice with help',
  2: 'Can do simple guided tasks',
  3: 'Can complete tasks independently',
  4: 'Can handle complex real-world tasks',
  5: 'Can teach others and advise on it',
};

export const SKILL_CATEGORIES = ['Technical', 'Analytical', 'Tools', 'Soft skills'] as const;
export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

/**
 * Where a user-skill record came from. Drives the "review needed" badge and
 * the honesty rules: only `self_reported` and `quiz_verified` are treated as
 * user-confirmed data.
 */
export const SKILL_SOURCES = [
  'self_reported',
  'ai_extracted',
  'quiz_verified',
  'roadmap_completed',
  'project_completed',
] as const;
export type SkillSource = (typeof SKILL_SOURCES)[number];

/** Sources that require explicit student review before being trusted. */
export const SKILL_SOURCES_NEEDING_REVIEW: readonly SkillSource[] = ['ai_extracted'];

// ─── Careers ────────────────────────────────────────────────────────────────

/** How much a required skill matters for a career. Maps to a numeric weight. */
export const IMPORTANCE_LEVELS = ['high', 'medium', 'low'] as const;
export type ImportanceLevel = (typeof IMPORTANCE_LEVELS)[number];

/**
 * Numeric weight per importance level.
 * Spec: High = 3, Med = 2, Low = 1.
 */
export const IMPORTANCE_WEIGHTS: Record<ImportanceLevel, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export const CAREER_CATEGORIES = [
  'Data & AI',
  'Software',
  'Design',
  'Security',
  'Cloud & Infrastructure',
  'Business & Marketing',
] as const;
export type CareerCategory = (typeof CAREER_CATEGORIES)[number];

// ─── Gap analysis ───────────────────────────────────────────────────────────

/** Spec §4 gap labels. Ordered from best to worst. */
export const GAP_LABELS = ['strong', 'developing', 'gap', 'critical'] as const;
export type GapLabel = (typeof GAP_LABELS)[number];

/** Gap thresholds. `critical` also triggers on the importance rule below. */
export const GAP_THRESHOLDS = {
  developing: 1,
  gap: 2,
  critical: 3,
} as const;

/** A high-importance skill with a gap of at least this size is always critical. */
export const HIGH_IMPORTANCE_CRITICAL_GAP = 2;

export const GAP_LABEL_COLORS: Record<GapLabel, 'success' | 'warning' | 'gap' | 'danger'> = {
  strong: 'success',
  developing: 'warning',
  gap: 'gap',
  critical: 'danger',
};

// ─── Users ──────────────────────────────────────────────────────────────────

export const USER_ROLES = ['student', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const EDUCATION_LEVELS = ['undergraduate', 'graduation_completed', 'postgraduate'] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

export const ONBOARDING_STEPS = ['profile', 'skills', 'cv', 'career', 'done'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const LANGUAGES = ['en', 'bn'] as const;
export type Language = (typeof LANGUAGES)[number];

export const CONTENT_PREFERENCES = ['video', 'reading', 'mixed'] as const;
export type ContentPreference = (typeof CONTENT_PREFERENCES)[number];

export const COST_PREFERENCES = ['free_only', 'any'] as const;
export type CostPreference = (typeof COST_PREFERENCES)[number];

// ─── Learning ───────────────────────────────────────────────────────────────

export const ROADMAP_ITEM_STATUSES = ['todo', 'in_progress', 'done', 'skipped'] as const;
export type RoadmapItemStatus = (typeof ROADMAP_ITEM_STATUSES)[number];

export const ROADMAP_ITEM_TYPES = ['skill', 'project', 'milestone'] as const;
export type RoadmapItemType = (typeof ROADMAP_ITEM_TYPES)[number];

export const RESOURCE_TYPES = [
  'video',
  'article',
  'course',
  'documentation',
  'practice',
  'book',
] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const PROJECT_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type ProjectLevel = (typeof PROJECT_LEVELS)[number];

// ─── AI ─────────────────────────────────────────────────────────────────────

/**
 * Spec: AI_MODE=openai | local | demo.
 * `demo` is deterministic and offline. `local` uses local embeddings.
 */
export const AI_MODES = ['openai', 'local', 'demo'] as const;
export type AIMode = (typeof AI_MODES)[number];

/** Provenance of an AI answer, surfaced in the UI as a source tag. */
export const AI_SOURCE_TAGS = ['profile', 'career_database', 'ai_suggestion'] as const;
export type AISourceTag = (typeof AI_SOURCE_TAGS)[number];

/** What an AI interaction record is allowed to be used for. */
export const AI_INTERACTION_KINDS = [
  'cv_extraction',
  'skill_normalization',
  'similarity',
  'job_description_analysis',
  'assistant_chat',
] as const;
export type AIInteractionKind = (typeof AI_INTERACTION_KINDS)[number];
