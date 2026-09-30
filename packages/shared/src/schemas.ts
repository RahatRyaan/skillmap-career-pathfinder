/**
 * Domain request/response schemas — one definition per API operation.
 *
 * Rule for every agent touching this file: a change here is a breaking change
 * for any agent working in parallel. Update docs/API.md in the same commit.
 */

import { z } from 'zod';
import {
  aiInteractionKindSchema,
  aiSourceTagSchema,
  contentPreferenceSchema,
  costPreferenceSchema,
  emailSchema,
  educationLevelSchema,
  importanceSchema,
  languageSchema,
  nameSchema,
  objectIdSchema,
  onboardingStepSchema,
  paginationQuerySchema,
  passwordSchema,
  projectLevelSchema,
  resourceTypeSchema,
  roadmapItemStatusSchema,
  roadmapItemTypeSchema,
  skillCategorySchema,
  skillLevelSchema,
  skillSourceSchema,
  urlSchema,
} from './primitives.js';
import { type AlignmentResult, type PriorityItem, type SkillGap } from './scoring.js';
import { type GapLabel } from './enums.js';
import { SCORE_DISCLAIMER } from './constants.js';

// ─── Profile ────────────────────────────────────────────────────────────────

export const profileUpdateSchema = z.object({
  name: nameSchema.optional(),
  university: z.string().trim().min(1).max(160).optional(),
  department: z.string().trim().min(1).max(160).optional(),
  academicYear: z.string().trim().min(1).max(40).optional(),
  educationLevel: educationLevelSchema.optional(),
  graduationYear: z.coerce.number().int().min(1950).max(2100).optional(),
  interests: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  bio: z.string().trim().max(600).optional(),
  targetCareerId: objectIdSchema.nullable().optional(),
});
export type ProfileUpdateRequest = z.infer<typeof profileUpdateSchema>;

export const preferencesUpdateSchema = z.object({
  language: languageSchema.optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  fontScale: z.coerce.number().min(0.85).max(1.5).optional(),
  lowDataMode: z.boolean().optional(),
  weeklyStudyHours: z.coerce.number().int().min(1).max(80).optional(),
  contentPreference: contentPreferenceSchema.optional(),
  costPreference: costPreferenceSchema.optional(),
  contentLanguage: languageSchema.optional(),
  analyticsOptIn: z.boolean().optional(),
  remindersOptIn: z.boolean().optional(),
});
export type PreferencesUpdateRequest = z.infer<typeof preferencesUpdateSchema>;

export const onboardingUpdateSchema = z.object({
  currentStep: onboardingStepSchema,
  completedSteps: z.array(onboardingStepSchema).max(10).default([]),
  skipped: z.boolean().default(false),
});
export type OnboardingUpdateRequest = z.infer<typeof onboardingUpdateSchema>;

export interface ProfileResponse {
  id: string;
  userId: string;
  name: string;
  email: string;
  university: string;
  department: string;
  academicYear: string;
  educationLevel: string;
  graduationYear: number | null;
  interests: string[];
  bio: string | null;
  targetCareerId: string | null;
  targetCareerName: string | null;
  onboarding: {
    currentStep: string;
    completedSteps: string[];
    finished: boolean;
  };
  preferences: PreferencesResponse;
  createdAt: string;
  updatedAt: string;
}

export interface PreferencesResponse {
  language: string;
  theme: 'light' | 'dark' | 'system';
  fontScale: number;
  lowDataMode: boolean;
  weeklyStudyHours: number;
  contentPreference: string;
  costPreference: string;
  contentLanguage: string;
  analyticsOptIn: boolean;
  remindersOptIn: boolean;
}

// ─── Skills ─────────────────────────────────────────────────────────────────

export interface SkillCatalogItem {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  aliases: string[];
}

export const userSkillCreateSchema = z.object({
  skillId: objectIdSchema,
  level: skillLevelSchema,
  source: skillSourceSchema.default('self_reported'),
  evidence: z.string().trim().max(500).optional(),
});
export type UserSkillCreateRequest = z.infer<typeof userSkillCreateSchema>;

export const userSkillUpdateSchema = z.object({
  level: skillLevelSchema.optional(),
  evidence: z.string().trim().max(500).optional(),
  source: skillSourceSchema.optional(),
});
export type UserSkillUpdateRequest = z.infer<typeof userSkillUpdateSchema>;

export interface UserSkillResponse {
  id: string;
  skillId: string;
  skillName: string;
  skillSlug: string;
  category: string;
  level: number;
  levelDescription: string;
  source: string;
  needsReview: boolean;
  evidence: string | null;
  updatedAt: string;
}

export const skillSearchQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  category: skillCategorySchema.optional(),
});
export type SkillSearchQuery = z.infer<typeof skillSearchQuerySchema>;

// ─── Careers ────────────────────────────────────────────────────────────────

export interface CareerListItem {
  id: string;
  slug: string;
  name: string;
  category: string;
  summary: string;
  /** Present only when the request carried a valid student token. */
  alignmentPercent: number | null;
  matchedSkillCount: number;
  requiredSkillCount: number;
  topGapSkillNames: string[];
}

export const careerSearchQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  category: z.string().trim().max(60).optional(),
});
export type CareerSearchQuery = z.infer<typeof careerSearchQuerySchema>;

export interface CareerSkillDetail {
  skillId: string;
  skillName: string;
  skillSlug: string;
  category: string;
  requiredLevel: number;
  importance: string;
  importanceWeight: number;
  isCore: boolean;
  prerequisites: { skillId: string; skillName: string }[];
  estimatedEffortHours: number;
  studentLevel: number | null;
  gap: number;
  label: GapLabel;
}

export interface CareerDetail {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  responsibilities: string[];
  typicalProjects: { title: string; description: string }[];
  skills: CareerSkillDetail[];
  alignmentPercent: number | null;
  missingSkillCount: number;
  disclaimer: string;
}

export const compareQuerySchema = z.object({
  ids: z
    .string()
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .pipe(z.array(objectIdSchema).min(2).max(3)),
});
export type CompareQuery = z.infer<typeof compareQuerySchema>;

// ─── Skill gap & analysis ───────────────────────────────────────────────────

export interface SkillGapResponse {
  careerId: string;
  careerName: string;
  alignment: AlignmentResult;
  gaps: SkillGap[];
  categoryAverages: { category: string; average: number; count: number }[];
  disclaimer: string;
  /** Present when the engine applied transferable credit. */
  transferableNotes: { skillId: string; skillName: string; source: string; credit: number }[];
}

export const simulateRequestSchema = z.object({
  careerId: objectIdSchema,
  /** Skill id → hypothetical new level. */
  changes: z
    .array(
      z.object({
        skillId: objectIdSchema,
        newLevel: skillLevelSchema,
      }),
    )
    .max(20),
});
export type SimulateRequest = z.infer<typeof simulateRequestSchema>;

export interface SimulationResult {
  careerId: string;
  baselinePercent: number;
  projectedPercent: number;
  deltaPercent: number;
  perChange: {
    skillId: string;
    skillName: string;
    fromLevel: number;
    toLevel: number;
    baselinePercent: number;
    projectedPercent: number;
    deltaPercent: number;
  }[];
  disclaimer: string;
}

export const jobDescriptionAnalyzeSchema = z.object({
  text: z.string().trim().min(40).max(20_000),
  careerId: objectIdSchema.optional(),
});
export type JobDescriptionAnalyzeRequest = z.infer<typeof jobDescriptionAnalyzeSchema>;

// ─── CV ─────────────────────────────────────────────────────────────────────

export const cvReviewSchema = z.object({
  items: z
    .array(
      z.object({
        extractionId: z.string().min(1),
        decision: z.enum(['accept', 'reject', 'edit']),
        skillId: objectIdSchema.optional(),
        level: skillLevelSchema.optional(),
        value: z.string().trim().max(300).optional(),
      }),
    )
    .min(1),
});
export type CvReviewRequest = z.infer<typeof cvReviewSchema>;

export interface ExtractedItem {
  extractionId: string;
  type:
    | 'skill'
    | 'education'
    | 'project'
    | 'certification'
    | 'experience'
    | 'tool'
    | 'language'
    | 'soft_skill';
  rawValue: string;
  normalizedSkillId: string | null;
  normalizedSkillName: string | null;
  confidence: number;
  lowConfidence: boolean;
  suggestedLevel: number | null;
  context: string | null;
}

export interface CvDocumentResponse {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: 'uploaded' | 'extracted' | 'reviewed';
  textLength: number;
  extractionMode: string;
  items: ExtractedItem[];
  createdAt: string;
}

// ─── Roadmap ────────────────────────────────────────────────────────────────

export const generateRoadmapSchema = z.object({
  careerId: objectIdSchema,
  weeklyStudyHours: z.coerce.number().int().min(1).max(80).optional(),
  months: z.coerce.number().int().min(1).max(12).optional(),
});
export type GenerateRoadmapRequest = z.infer<typeof generateRoadmapSchema>;

export interface RoadmapItem {
  id: string;
  month: number;
  week: number;
  order: number;
  type: string;
  title: string;
  description: string;
  skillId: string | null;
  skillName: string | null;
  estimatedHours: number;
  status: string;
  whyThisOrder: string;
  resourceIds: string[];
}

export interface RoadmapResponse {
  id: string;
  version: number;
  careerId: string;
  careerName: string;
  weeklyStudyHours: number;
  changeLog: string[];
  items: RoadmapItem[];
  progressPercent: number;
  createdAt: string;
  isCurrent: boolean;
}

export interface RoadmapChangeResponse {
  fromVersion: number;
  toVersion: number;
  changeLog: string[];
  changedItemCount: number;
  createdAt: string;
}

// ─── Progress ───────────────────────────────────────────────────────────────

export const progressUpdateSchema = z.object({
  status: roadmapItemStatusSchema,
  actualHours: z.coerce.number().min(0).max(1000).optional(),
  note: z.string().trim().max(400).optional(),
  /** When the student completed a skill, they may raise their level. */
  newLevel: skillLevelSchema.optional(),
});
export type ProgressUpdateRequest = z.infer<typeof progressUpdateSchema>;

export const studySessionSchema = z.object({
  minutes: z.coerce.number().int().min(1).max(600),
  skillId: objectIdSchema.optional(),
  roadmapItemId: z.string().min(1).optional(),
  note: z.string().trim().max(300).optional(),
  loggedOn: z.coerce.date().optional(),
});
export type StudySessionRequest = z.infer<typeof studySessionSchema>;

// ─── Projects ───────────────────────────────────────────────────────────────

export const userProjectUpdateSchema = z.object({
  status: z.enum(['todo', 'in_progress', 'done', 'abandoned']),
  confirmSkillUpdates: z.boolean().default(false),
});
export type UserProjectUpdateRequest = z.infer<typeof userProjectUpdateSchema>;

export interface ProjectResponse {
  id: string;
  slug: string;
  title: string;
  description: string;
  careerId: string | null;
  careerName: string | null;
  level: string;
  estimatedHours: number;
  skills: { skillId: string; skillName: string }[];
  steps: { order: number; title: string; description: string; skillId: string | null }[];
  status: string | null;
  matchReason: string | null;
}

// ─── Assistant ──────────────────────────────────────────────────────────────

export const assistantChatSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  conversationId: z.string().min(1).max(64).optional(),
  pageContext: z.string().trim().max(200).optional(),
});
export type AssistantChatRequest = z.infer<typeof assistantChatSchema>;

export interface AssistantResponse {
  conversationId: string;
  answer: string;
  sourceTags: { tag: string; reason: string }[];
  mode: string;
  notice: string | null;
  suggestedChips: string[];
}

// ─── Quiz ───────────────────────────────────────────────────────────────────

export const quizSubmitSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: objectIdSchema,
        optionIndex: z.coerce.number().int().min(0).max(10),
      }),
    )
    .min(1)
    .max(20),
});
export type QuizSubmitRequest = z.infer<typeof quizSubmitSchema>;

export interface QuizSuggestion {
  careerId: string;
  careerName: string;
  matchPercent: number;
  explanation: string;
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

export interface DashboardResponse {
  greetingName: string;
  targetCareer: { id: string; name: string } | null;
  kpis: {
    alignmentPercent: number;
    ownedSkillCount: number;
    requiredSkillCount: number;
    gapCount: number;
    criticalGapCount: number;
    roadmapProgressPercent: number;
  };
  nextBestAction: {
    title: string;
    description: string;
    estimatedHours: number;
    why: string;
    roadmapItemId: string | null;
    skillId: string | null;
  } | null;
  skillBars: {
    skillId: string;
    skillName: string;
    currentLevel: number;
    requiredLevel: number;
    label: string;
  }[];
  categoryAverages: { category: string; average: number; count: number }[];
  roadmapMiniTimeline: { month: number; itemsDone: number; itemsTotal: number }[];
  weeklyGoal: {
    minutesLogged: number;
    minutesTarget: number;
    percent: number;
    streakDays: number;
  };
  alignmentTrend: { takenAt: string; percent: number }[];
  recentActivity: { at: string; kind: string; text: string }[];
  roadmapChangeNotice: string | null;
  achievements: { id: string; name: string; description: string; earnedAt: string | null }[];
  disclaimer: string;
}

export interface TrendPoint {
  takenAt: string;
  percent: number;
}

// ─── Resources ──────────────────────────────────────────────────────────────

export const resourceQuerySchema = paginationQuerySchema.extend({
  skillId: objectIdSchema.optional(),
  level: z.coerce.number().int().min(0).max(5).optional(),
  type: resourceTypeSchema.optional(),
  free: z.coerce.boolean().optional(),
  language: languageSchema.optional(),
  search: z.string().trim().max(120).optional(),
});
export type ResourceQuery = z.infer<typeof resourceQuerySchema>;

export interface ResourceResponse {
  id: string;
  title: string;
  description: string | null;
  skillId: string;
  skillName: string;
  level: number;
  type: string;
  durationMinutes: number | null;
  url: string;
  isFree: boolean;
  language: string;
  /** True when the URL could not be verified. Spec requires a visible label. */
  isSample: boolean;
}

// ─── Admin ──────────────────────────────────────────────────────────────────

export const careerUpsertSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  category: z.string().trim().min(2).max(60),
  summary: z.string().trim().min(10).max(400),
  description: z.string().trim().min(20).max(6000),
  responsibilities: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
  typicalProjects: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(160),
        description: z.string().trim().max(600),
      }),
    )
    .max(12)
    .default([]),
  isPublished: z.boolean().default(true),
});
export type CareerUpsertRequest = z.infer<typeof careerUpsertSchema>;

export const careerSkillMappingSchema = z.object({
  careerId: objectIdSchema,
  skillId: objectIdSchema,
  requiredLevel: skillLevelSchema,
  importance: importanceSchema,
  isCore: z.boolean().default(false),
  prerequisiteSkillIds: z.array(objectIdSchema).max(8).default([]),
  estimatedEffortHours: z.coerce.number().int().min(1).max(500),
});
export type CareerSkillMappingRequest = z.infer<typeof careerSkillMappingSchema>;

export const skillUpsertSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  category: skillCategorySchema,
  description: z.string().trim().max(500).optional(),
  aliases: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  isPublished: z.boolean().default(true),
});
export type SkillUpsertRequest = z.infer<typeof skillUpsertSchema>;

export const resourceUpsertSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(600).optional(),
  skillId: objectIdSchema,
  level: skillLevelSchema,
  type: resourceTypeSchema,
  durationMinutes: z.coerce.number().int().min(1).max(10_000).optional(),
  url: urlSchema,
  isFree: z.boolean().default(true),
  language: languageSchema.default('en'),
  isSample: z.boolean().default(false),
});
export type ResourceUpsertRequest = z.infer<typeof resourceUpsertSchema>;

export const projectUpsertSchema = z.object({
  title: z.string().trim().min(2).max(200),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().min(20).max(4000),
  careerId: objectIdSchema.nullable().default(null),
  level: projectLevelSchema,
  estimatedHours: z.coerce.number().int().min(1).max(1000),
  skillIds: z.array(objectIdSchema).min(1).max(12),
  steps: z
    .array(
      z.object({
        title: z.string().trim().min(2).max(200),
        description: z.string().trim().max(600),
        skillId: objectIdSchema.nullable().default(null),
      }),
    )
    .min(1)
    .max(20),
  isPublished: z.boolean().default(true),
});
export type ProjectUpsertRequest = z.infer<typeof projectUpsertSchema>;

// ─── Impact ─────────────────────────────────────────────────────────────────

/**
 * Every field here must be computed from a real database aggregate.
 * The server test suite asserts that none of these is a constant.
 */
export interface ImpactResponse {
  generatedAt: string;
  studentsAssessed: number;
  skillGapsIdentified: number;
  roadmapsGenerated: number;
  roadmapCompletionRate: number;
  averageSkillImprovement: number;
  projectsCompleted: number;
  studentsReachingTarget: number;
  targetAlignmentPercent: number;
  skillGapsByLabel: Record<GapLabel, number>;
  topCommonGaps: { skillId: string; skillName: string; studentCount: number }[];
  weeklyActiveStudents: number;
  note: string;
}

// ─── Priorities ─────────────────────────────────────────────────────────────

export interface PrioritiesResponse {
  careerId: string;
  items: PriorityItem[];
  disclaimer: string;
}

export { SCORE_DISCLAIMER };
