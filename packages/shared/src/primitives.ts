/**
 * Shared primitive schemas and pagination.
 * Domain request/response schemas live in ./schemas.ts
 */

import { z } from 'zod';
import {
  AI_INTERACTION_KINDS,
  AI_MODES,
  AI_SOURCE_TAGS,
  CAREER_CATEGORIES,
  CONTENT_PREFERENCES,
  COST_PREFERENCES,
  EDUCATION_LEVELS,
  GAP_LABELS,
  IMPORTANCE_LEVELS,
  LANGUAGES,
  ONBOARDING_STEPS,
  PROJECT_LEVELS,
  RESOURCE_TYPES,
  ROADMAP_ITEM_STATUSES,
  ROADMAP_ITEM_TYPES,
  SKILL_CATEGORIES,
  SKILL_LEVELS,
  SKILL_SOURCES,
  USER_ROLES,
} from './enums.js';

// ─── Primitives ─────────────────────────────────────────────────────────────

export const skillLevelSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);
export type SkillLevelInput = z.infer<typeof skillLevelSchema>;

export const skillCategorySchema = z.enum(SKILL_CATEGORIES);
export const skillSourceSchema = z.enum(SKILL_SOURCES);
export const importanceSchema = z.enum(IMPORTANCE_LEVELS);
export const gapLabelSchema = z.enum(GAP_LABELS);
export const userRoleSchema = z.enum(USER_ROLES);
export const educationLevelSchema = z.enum(EDUCATION_LEVELS);
export const onboardingStepSchema = z.enum(ONBOARDING_STEPS);
export const languageSchema = z.enum(LANGUAGES);
export const contentPreferenceSchema = z.enum(CONTENT_PREFERENCES);
export const costPreferenceSchema = z.enum(COST_PREFERENCES);
export const roadmapItemStatusSchema = z.enum(ROADMAP_ITEM_STATUSES);
export const roadmapItemTypeSchema = z.enum(ROADMAP_ITEM_TYPES);
export const resourceTypeSchema = z.enum(RESOURCE_TYPES);
export const projectLevelSchema = z.enum(PROJECT_LEVELS);
export const careerCategorySchema = z.enum(CAREER_CATEGORIES);
export const aiModeSchema = z.enum(AI_MODES);
export const aiSourceTagSchema = z.enum(AI_SOURCE_TAGS);
export const aiInteractionKindSchema = z.enum(AI_INTERACTION_KINDS);

/** MongoDB ObjectId as a 24-char hex string, validated at every boundary. */
export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'must be a 24-character hex id');

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z
  .string()
  .min(8, 'password must be at least 8 characters')
  .max(128, 'password must be at most 128 characters');
export const nameSchema = z.string().trim().min(1).max(120);
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be a lowercase hyphenated slug');
export const urlSchema = z.string().url().max(2048);

/**
 * Percentage the client may send to the what-if simulator. Clamped server-side
 * too, but validating here keeps the UI honest.
 */
export const percentSchema = z.coerce.number().min(0).max(100);

// ─── Pagination ─────────────────────────────────────────────────────────────

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function paginate<T>(items: T[], total: number, page: number, limit: number): Paginated<T> {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    items,
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

// ─── Envelope ───────────────────────────────────────────────────────────────

export interface HealthResponse {
  status: 'ok' | 'degraded';
  version: string;
  uptimeSeconds: number;
  database: 'connected' | 'disconnected';
  aiMode: (typeof AI_MODES)[number];
  timestamp: string;
}

export interface AiModeResponse {
  mode: (typeof AI_MODES)[number];
  /** True when the configured provider answered during startup self-test. */
  available: boolean;
  /** Human-readable explanation shown on the AI Info page. */
  description: string;
  usesRealLlm: boolean;
  usesLocalEmbeddings: boolean;
  deterministic: boolean;
  notice: string | null;
}

// ─── Auth payloads ──────────────────────────────────────────────────────────

export const registerRequestSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  university: z.string().trim().min(1).max(160),
  department: z.string().trim().min(1).max(160),
  academicYear: z.string().trim().min(1).max(40),
  educationLevel: educationLevelSchema,
  interests: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(10),
});
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

export interface UserPublic {
  id: string;
  name: string;
  email: string;
  role: (typeof USER_ROLES)[number];
  createdAt: string;
}

export interface AuthResponse {
  user: UserPublic;
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export const skillLevelInputSchema = skillLevelSchema;
export { SKILL_LEVELS };
