/**
 * Mongoose document interfaces.
 *
 * Declared separately from the schemas so the schema file stays readable and
 * so `lean()` queries return real shapes. Field names here are the contract the
 * rest of the server codes against.
 */

import type { Types } from 'mongoose';

export type ObjectId = Types.ObjectId;

export interface RefreshTokenEntry {
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  userAgent: string;
}

export interface UserDoc {
  _id: ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: 'student' | 'admin';
  isActive: boolean;
  lastLoginAt: Date | null;
  refreshTokens: RefreshTokenEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferencesDoc {
  _id: ObjectId;
  userId: ObjectId;
  language: 'en' | 'bn';
  theme: 'light' | 'dark' | 'system';
  fontScale: number;
  lowDataMode: boolean;
  weeklyStudyHours: number;
  contentPreference: 'video' | 'reading' | 'mixed';
  costPreference: 'free_only' | 'any';
  contentLanguage: 'en' | 'bn';
  analyticsOptIn: boolean;
  remindersOptIn: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OnboardingState {
  currentStep: 'profile' | 'skills' | 'cv' | 'career' | 'done';
  completedSteps: string[];
  finished: boolean;
}

export interface StudentProfileDoc {
  _id: ObjectId;
  userId: ObjectId;
  university: string;
  department: string;
  academicYear: string;
  educationLevel: 'undergraduate' | 'graduation_completed' | 'postgraduate';
  graduationYear: number | null;
  interests: string[];
  bio: string | null;
  targetCareerId: ObjectId | null;
  onboarding: OnboardingState;
  createdAt: Date;
  updatedAt: Date;
}

export interface SkillCategoryDoc {
  _id: ObjectId;
  slug: string;
  name: string;
  description: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export type SkillCategoryName = 'Technical' | 'Analytical' | 'Tools' | 'Soft skills';

export interface SkillDoc {
  _id: ObjectId;
  name: string;
  slug: string;
  category: SkillCategoryName;
  description: string;
  aliases: string[];
  embedding: number[] | null;
  embeddingModel: string | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SkillAliasDoc {
  _id: ObjectId;
  alias: string;
  skillId: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type SkillSourceValue =
  'self_reported' | 'ai_extracted' | 'quiz_verified' | 'roadmap_completed' | 'project_completed';

export interface UserSkillDoc {
  _id: ObjectId;
  userId: ObjectId;
  skillId: ObjectId;
  level: 0 | 1 | 2 | 3 | 4 | 5;
  source: SkillSourceValue;
  evidence: string | null;
  confirmedByProject: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CareerCategoryName =
  | 'Data & AI'
  | 'Software'
  | 'Design'
  | 'Security'
  | 'Cloud & Infrastructure'
  | 'Business & Marketing';

export interface TypicalProject {
  title: string;
  description: string;
}

export interface CareerDoc {
  _id: ObjectId;
  name: string;
  slug: string;
  category: CareerCategoryName;
  summary: string;
  description: string;
  responsibilities: string[];
  typicalProjects: TypicalProject[];
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ImportanceValue = 'high' | 'medium' | 'low';

export interface CareerSkillDoc {
  _id: ObjectId;
  careerId: ObjectId;
  skillId: ObjectId;
  requiredLevel: 0 | 1 | 2 | 3 | 4 | 5;
  importance: ImportanceValue;
  isCore: boolean;
  prerequisiteSkillIds: ObjectId[];
  estimatedEffortHours: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CvDocumentDoc {
  _id: ObjectId;
  userId: ObjectId;
  storedFileName: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  status: 'uploaded' | 'extracted' | 'reviewed';
  textLength: number;
  extractionMode: string;
  extractedText: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ExtractedItemType =
  | 'skill'
  | 'education'
  | 'project'
  | 'certification'
  | 'experience'
  | 'tool'
  | 'language'
  | 'soft_skill';

export interface ExtractedSkillDoc {
  _id: ObjectId;
  cvDocumentId: ObjectId;
  userId: ObjectId;
  extractionId: string;
  type: ExtractedItemType;
  rawValue: string;
  normalizedSkillId: ObjectId | null;
  normalizedSkillName: string | null;
  confidence: number;
  lowConfidence: boolean;
  suggestedLevel: 0 | 1 | 2 | 3 | 4 | 5 | null;
  context: string | null;
  decision: 'pending' | 'accepted' | 'rejected' | 'edited';
  createdAt: Date;
  updatedAt: Date;
}

export interface RoadmapItemDoc {
  _id: ObjectId;
  order: number;
  month: number;
  week: number;
  type: 'skill' | 'project' | 'milestone';
  title: string;
  description: string;
  skillId: ObjectId | null;
  skillName: string | null;
  estimatedHours: number;
  status: 'todo' | 'in_progress' | 'done' | 'skipped';
  whyThisOrder: string;
  resourceIds: ObjectId[];
  actualHours: number;
  completedAt: Date | null;
}

export interface RoadmapDoc {
  _id: ObjectId;
  userId: ObjectId;
  careerId: ObjectId;
  version: number;
  isCurrent: boolean;
  weeklyStudyHours: number;
  monthsHorizon: number;
  items: Types.DocumentArray<RoadmapItemDoc>;
  changeLog: string[];
  generatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ResourceTypeValue =
  'video' | 'article' | 'course' | 'documentation' | 'practice' | 'book';

export interface LearningResourceDoc {
  _id: ObjectId;
  title: string;
  description: string;
  skillId: ObjectId;
  level: 0 | 1 | 2 | 3 | 4 | 5;
  type: ResourceTypeValue;
  durationMinutes: number | null;
  url: string;
  provider: string;
  isFree: boolean;
  language: 'en' | 'bn';
  isSample: boolean;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectStepDoc {
  order: number;
  title: string;
  description: string;
  skillId: ObjectId | null;
}

export interface ProjectDoc {
  _id: ObjectId;
  title: string;
  slug: string;
  description: string;
  careerId: ObjectId | null;
  level: 'beginner' | 'intermediate' | 'advanced';
  estimatedHours: number;
  skillIds: ObjectId[];
  steps: ProjectStepDoc[];
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SkillUpdateEntry {
  skillId: ObjectId;
  newLevel: number;
}

export interface UserProjectDoc {
  _id: ObjectId;
  userId: ObjectId;
  projectId: ObjectId;
  status: 'todo' | 'in_progress' | 'done' | 'abandoned';
  completedAt: Date | null;
  skillUpdates: SkillUpdateEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProgressDoc {
  _id: ObjectId;
  userId: ObjectId;
  roadmapId: ObjectId;
  itemId: ObjectId;
  status: 'todo' | 'in_progress' | 'done' | 'skipped';
  completedAt: Date | null;
  note: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobDescriptionDoc {
  _id: ObjectId;
  userId: ObjectId;
  title: string;
  company: string;
  text: string;
  analysisMode: string;
  matchedCareerId: ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIInteractionDoc {
  _id: ObjectId;
  userId: ObjectId | null;
  kind:
    | 'cv_extraction'
    | 'skill_normalization'
    | 'similarity'
    | 'job_description_analysis'
    | 'assistant_chat';
  mode: string;
  model: string | null;
  inputHash: string;
  result: unknown;
  tokensUsed: number;
  estimatedCostUsd: number;
  latencyMs: number;
  cacheHit: boolean;
  success: boolean;
  notice: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlignmentSnapshotDoc {
  _id: ObjectId;
  userId: ObjectId;
  careerId: ObjectId;
  percent: number;
  ownedSkillCount: number;
  requiredSkillCount: number;
  gapsByLabel: Map<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecommendationDoc {
  _id: ObjectId;
  userId: ObjectId;
  careerId: ObjectId;
  kind: string;
  items: unknown[];
  mode: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuizOption {
  text: string;
  careerSlug: string | null;
}

export interface QuizQuestionDoc {
  _id: ObjectId;
  order: number;
  prompt: string;
  options: QuizOption[];
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuizAnswerEntry {
  questionId: ObjectId;
  optionIndex: number;
}

export interface QuizResponseDoc {
  _id: ObjectId;
  userId: ObjectId;
  answers: QuizAnswerEntry[];
  suggestedCareerIds: ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AchievementRule {
  type: string;
  threshold: number;
}

export interface AchievementDoc {
  _id: ObjectId;
  slug: string;
  name: string;
  description: string;
  icon: string;
  rule: AchievementRule;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserAchievementDoc {
  _id: ObjectId;
  userId: ObjectId;
  achievementId: ObjectId;
  earnedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface StudySessionDoc {
  _id: ObjectId;
  userId: ObjectId;
  minutes: number;
  skillId: ObjectId | null;
  roadmapItemId: ObjectId | null;
  note: string;
  loggedOn: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface StudyGoalDoc {
  _id: ObjectId;
  userId: ObjectId;
  weeklyMinutes: number;
  startDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationDoc {
  _id: ObjectId;
  userId: ObjectId;
  kind: string;
  title: string;
  body: string;
  readAt: Date | null;
  link: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLogDoc {
  _id: ObjectId;
  actorUserId: ObjectId | null;
  action: string;
  entity: string;
  entityId: string | null;
  outcome: 'success' | 'failure';
  metadata: Record<string, unknown>;
  ip: string | null;
  createdAt: Date;
  updatedAt: Date;
}
