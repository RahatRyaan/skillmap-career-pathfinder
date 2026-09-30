/**
 * Typed Mongoose model access.
 *
 * Every model is declared with a document interface, so `findById(...).lean()`
 * returns a real shape and TypeScript catches field-name drift at compile time
 * rather than at runtime in production.
 *
 * Document interfaces are defined in ./types.ts. This file only maps a name to
 * a typed model — it contains no schema logic.
 */

import mongoose, { Schema, type Model } from 'mongoose';
import type * as Docs from './types.js';

const S = Schema;

const { ObjectId } = mongoose.Types;
export type { ObjectId };

// ─── Identity ───────────────────────────────────────────────────────────────

const userSchema = new S(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['student', 'admin'], default: 'student', index: true },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
    refreshTokens: {
      type: [
        new S(
          {
            tokenHash: { type: String, required: true },
            expiresAt: { type: Date, required: true },
            createdAt: { type: Date, default: Date.now },
            userAgent: { type: String, default: '', maxlength: 300 },
          },
          { _id: false },
        ),
      ],
      default: [],
      select: false,
    },
  },
  { timestamps: true },
);
userSchema.index({ 'refreshTokens.expiresAt': 1 }, { expireAfterSeconds: 0 });

const userPreferencesSchema = new S(
  {
    userId: { type: ObjectId, ref: 'User', required: true, unique: true, index: true },
    language: { type: String, enum: ['en', 'bn'], default: 'en' },
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
    fontScale: { type: Number, default: 1, min: 0.85, max: 1.5 },
    lowDataMode: { type: Boolean, default: false },
    weeklyStudyHours: { type: Number, default: 5, min: 1, max: 80 },
    contentPreference: { type: String, enum: ['video', 'reading', 'mixed'], default: 'mixed' },
    costPreference: { type: String, enum: ['free_only', 'any'], default: 'free_only' },
    contentLanguage: { type: String, enum: ['en', 'bn'], default: 'en' },
    analyticsOptIn: { type: Boolean, default: true },
    remindersOptIn: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const studentProfileSchema = new S(
  {
    userId: { type: ObjectId, ref: 'User', required: true, unique: true, index: true },
    university: { type: String, trim: true, maxlength: 160, default: '' },
    department: { type: String, trim: true, maxlength: 160, default: '' },
    academicYear: { type: String, trim: true, maxlength: 40, default: '' },
    educationLevel: {
      type: String,
      enum: ['undergraduate', 'graduation_completed', 'postgraduate'],
      default: 'undergraduate',
    },
    graduationYear: { type: Number, min: 1950, max: 2100, default: null },
    interests: { type: [String], default: [] },
    bio: { type: String, maxlength: 600, default: null },
    targetCareerId: { type: ObjectId, ref: 'Career', default: null, index: true },
    onboarding: {
      currentStep: {
        type: String,
        enum: ['profile', 'skills', 'cv', 'career', 'done'],
        default: 'profile',
      },
      completedSteps: { type: [String], default: [] },
      finished: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
);

// ─── Skills ─────────────────────────────────────────────────────────────────

const skillCategorySchema = new S(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', maxlength: 500 },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const skillSchema = new S(
  {
    name: { type: String, required: true, trim: true, maxlength: 120, index: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    category: {
      type: String,
      enum: ['Technical', 'Analytical', 'Tools', 'Soft skills'],
      required: true,
      index: true,
    },
    description: { type: String, default: '', maxlength: 500 },
    aliases: { type: [String], default: [] },
    embedding: { type: [Number], default: null, select: false },
    embeddingModel: { type: String, default: null, select: false },
    isPublished: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);
skillSchema.index({ name: 'text', description: 'text', aliases: 'text' });
skillSchema.index({ name: 1, category: 1 });

const skillAliasSchema = new S(
  {
    alias: { type: String, required: true, lowercase: true, trim: true, unique: true, index: true },
    skillId: { type: ObjectId, ref: 'Skill', required: true, index: true },
  },
  { timestamps: true },
);

const userSkillSchema = new S(
  {
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    skillId: { type: ObjectId, ref: 'Skill', required: true, index: true },
    level: { type: Number, enum: [0, 1, 2, 3, 4, 5], required: true },
    source: {
      type: String,
      enum: [
        'self_reported',
        'ai_extracted',
        'quiz_verified',
        'roadmap_completed',
        'project_completed',
      ],
      default: 'self_reported',
    },
    evidence: { type: String, default: null, maxlength: 500 },
    confirmedByProject: { type: Boolean, default: false },
  },
  { timestamps: true },
);
// Spec integrity constraint: a student holds a given skill at most once.
userSkillSchema.index({ userId: 1, skillId: 1 }, { unique: true });

// ─── Careers ────────────────────────────────────────────────────────────────

const careerSchema = new S(
  {
    name: { type: String, required: true, trim: true, maxlength: 120, index: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    category: {
      type: String,
      enum: [
        'Data & AI',
        'Software',
        'Design',
        'Security',
        'Cloud & Infrastructure',
        'Business & Marketing',
      ],
      required: true,
      index: true,
    },
    summary: { type: String, required: true, maxlength: 400 },
    description: { type: String, required: true, maxlength: 6000 },
    responsibilities: { type: [String], default: [] },
    typicalProjects: {
      type: [
        new S(
          { title: { type: String, required: true }, description: { type: String, default: '' } },
          { _id: false },
        ),
      ],
      default: [],
    },
    isPublished: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);
careerSchema.index({ name: 'text', summary: 'text', description: 'text' });

const careerSkillSchema = new S(
  {
    careerId: { type: ObjectId, ref: 'Career', required: true, index: true },
    skillId: { type: ObjectId, ref: 'Skill', required: true, index: true },
    requiredLevel: { type: Number, enum: [0, 1, 2, 3, 4, 5], required: true },
    importance: { type: String, enum: ['high', 'medium', 'low'], required: true },
    isCore: { type: Boolean, default: false },
    prerequisiteSkillIds: { type: [ObjectId], default: [] },
    estimatedEffortHours: { type: Number, required: true, min: 1, max: 500 },
  },
  { timestamps: true },
);
// Spec integrity constraint: a career requires a given skill at most once.
careerSkillSchema.index({ careerId: 1, skillId: 1 }, { unique: true });

// ─── CV ─────────────────────────────────────────────────────────────────────

const cvDocumentSchema = new S(
  {
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    // Randomised on disk. Never derived from the uploaded filename.
    storedFileName: { type: String, required: true, select: false },
    originalFileName: { type: String, required: true, maxlength: 260 },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ['uploaded', 'extracted', 'reviewed'], default: 'uploaded' },
    textLength: { type: Number, default: 0 },
    extractionMode: { type: String, default: 'demo' },
    extractedText: { type: String, default: '', select: false },
  },
  { timestamps: true },
);

const extractedSkillSchema = new S(
  {
    cvDocumentId: { type: ObjectId, ref: 'CvDocument', required: true, index: true },
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    extractionId: { type: String, required: true },
    type: {
      type: String,
      enum: [
        'skill',
        'education',
        'project',
        'certification',
        'experience',
        'tool',
        'language',
        'soft_skill',
      ],
      required: true,
    },
    rawValue: { type: String, required: true, maxlength: 300 },
    normalizedSkillId: { type: ObjectId, ref: 'Skill', default: null },
    normalizedSkillName: { type: String, default: null },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    lowConfidence: { type: Boolean, default: false, index: true },
    suggestedLevel: { type: Number, enum: [0, 1, 2, 3, 4, 5], default: null },
    context: { type: String, default: null, maxlength: 500 },
    decision: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'edited'],
      default: 'pending',
    },
  },
  { timestamps: true },
);
extractedSkillSchema.index({ cvDocumentId: 1, extractionId: 1 }, { unique: true });

// ─── Learning ───────────────────────────────────────────────────────────────

const roadmapItemSchema = new S(
  {
    order: { type: Number, required: true },
    month: { type: Number, required: true, min: 1 },
    week: { type: Number, required: true, min: 1 },
    type: { type: String, enum: ['skill', 'project', 'milestone'], required: true },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 1000 },
    skillId: { type: ObjectId, ref: 'Skill', default: null },
    skillName: { type: String, default: null },
    estimatedHours: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['todo', 'in_progress', 'done', 'skipped'], default: 'todo' },
    whyThisOrder: { type: String, default: '', maxlength: 1000 },
    resourceIds: { type: [ObjectId], default: [] },
    actualHours: { type: Number, default: 0, min: 0 },
    completedAt: { type: Date, default: null },
  },
  { _id: true },
);

const roadmapSchema = new S(
  {
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    careerId: { type: ObjectId, ref: 'Career', required: true, index: true },
    version: { type: Number, required: true, min: 1 },
    isCurrent: { type: Boolean, default: true, index: true },
    weeklyStudyHours: { type: Number, required: true, min: 1 },
    monthsHorizon: { type: Number, default: 6, min: 1, max: 12 },
    items: { type: [roadmapItemSchema], default: [] },
    changeLog: { type: [String], default: [] },
    generatedBy: { type: String, default: 'engine' },
  },
  { timestamps: true },
);
roadmapSchema.index({ userId: 1, careerId: 1, version: 1 }, { unique: true });
roadmapSchema.index({ userId: 1, careerId: 1, isCurrent: 1 });

const learningResourceSchema = new S(
  {
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 600 },
    skillId: { type: ObjectId, ref: 'Skill', required: true, index: true },
    level: { type: Number, enum: [0, 1, 2, 3, 4, 5], required: true },
    type: {
      type: String,
      enum: ['video', 'article', 'course', 'documentation', 'practice', 'book'],
      required: true,
    },
    durationMinutes: { type: Number, default: null, min: 1, max: 10_000 },
    url: { type: String, required: true, maxlength: 2048 },
    provider: { type: String, default: '', maxlength: 120 },
    isFree: { type: Boolean, default: true, index: true },
    language: { type: String, enum: ['en', 'bn'], default: 'en', index: true },
    // Spec: anything unverified must be visibly marked as a sample.
    isSample: { type: Boolean, default: false, index: true },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true },
);
learningResourceSchema.index({ title: 'text', description: 'text', provider: 'text' });

const projectSchema = new S(
  {
    title: { type: String, required: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, required: true, maxlength: 4000 },
    careerId: { type: ObjectId, ref: 'Career', default: null, index: true },
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      required: true,
      index: true,
    },
    estimatedHours: { type: Number, required: true, min: 1, max: 1000 },
    skillIds: { type: [ObjectId], default: [] },
    steps: {
      type: [
        new S(
          {
            order: { type: Number, required: true },
            title: { type: String, required: true, maxlength: 200 },
            description: { type: String, default: '', maxlength: 600 },
            skillId: { type: ObjectId, default: null },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const userProjectSchema = new S(
  {
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    projectId: { type: ObjectId, ref: 'Project', required: true, index: true },
    status: { type: String, enum: ['todo', 'in_progress', 'done', 'abandoned'], default: 'todo' },
    completedAt: { type: Date, default: null },
    skillUpdates: {
      type: [
        new S(
          {
            skillId: { type: ObjectId, required: true },
            newLevel: { type: Number, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { timestamps: true },
);
userProjectSchema.index({ userId: 1, projectId: 1 }, { unique: true });

const userProgressSchema = new S(
  {
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    roadmapId: { type: ObjectId, ref: 'Roadmap', required: true, index: true },
    itemId: { type: ObjectId, required: true, index: true },
    status: { type: String, enum: ['todo', 'in_progress', 'done', 'skipped'], default: 'todo' },
    completedAt: { type: Date, default: null },
    note: { type: String, default: '', maxlength: 400 },
  },
  { timestamps: true },
);
userProgressSchema.index({ userId: 1, roadmapId: 1, itemId: 1 }, { unique: true });

// ─── AI and analysis ────────────────────────────────────────────────────────

const jobDescriptionSchema = new S(
  {
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, default: '', maxlength: 200 },
    company: { type: String, default: '', maxlength: 200 },
    text: { type: String, required: true, maxlength: 20_000 },
    analysisMode: { type: String, default: 'demo' },
    matchedCareerId: { type: ObjectId, ref: 'Career', default: null },
  },
  { timestamps: true },
);

const aiInteractionSchema = new S(
  {
    userId: { type: ObjectId, ref: 'User', default: null, index: true },
    kind: {
      type: String,
      enum: [
        'cv_extraction',
        'skill_normalization',
        'similarity',
        'job_description_analysis',
        'assistant_chat',
      ],
      required: true,
      index: true,
    },
    mode: { type: String, required: true },
    model: { type: String, default: null },
    inputHash: { type: String, required: true, index: true },
    result: { type: Schema.Types.Mixed, default: null, select: false },
    tokensUsed: { type: Number, default: 0 },
    estimatedCostUsd: { type: Number, default: 0 },
    latencyMs: { type: Number, default: 0 },
    cacheHit: { type: Boolean, default: false },
    success: { type: Boolean, default: true },
    notice: { type: String, default: null },
  },
  { timestamps: true },
);
aiInteractionSchema.index({ inputHash: 1, kind: 1, mode: 1 });

const alignmentSnapshotSchema = new S(
  {
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    careerId: { type: ObjectId, ref: 'Career', required: true, index: true },
    percent: { type: Number, required: true, min: 0, max: 100 },
    ownedSkillCount: { type: Number, default: 0 },
    requiredSkillCount: { type: Number, default: 0 },
    gapsByLabel: { type: Map, of: Number, default: {} },
  },
  { timestamps: true },
);
alignmentSnapshotSchema.index({ userId: 1, careerId: 1, createdAt: -1 });

const recommendationSchema = new S(
  {
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    careerId: { type: ObjectId, ref: 'Career', required: true, index: true },
    kind: { type: String, default: 'priority', index: true },
    items: { type: [Schema.Types.Mixed], default: [] },
    mode: { type: String, default: 'engine' },
  },
  { timestamps: true },
);
recommendationSchema.index({ userId: 1, careerId: 1, kind: 1, createdAt: -1 });

// ─── Engagement ─────────────────────────────────────────────────────────────

const quizQuestionSchema = new S(
  {
    order: { type: Number, required: true },
    prompt: { type: String, required: true, maxlength: 500 },
    options: {
      type: [
        new S(
          {
            text: { type: String, required: true, maxlength: 300 },
            careerSlug: { type: String, default: null },
          },
          { _id: false },
        ),
      ],
      required: true,
    },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const quizResponseSchema = new S(
  {
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    answers: {
      type: [
        new S(
          {
            questionId: { type: ObjectId, required: true },
            optionIndex: { type: Number, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    suggestedCareerIds: { type: [ObjectId], default: [] },
  },
  { timestamps: true },
);

const achievementSchema = new S(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, maxlength: 120 },
    description: { type: String, required: true, maxlength: 400 },
    icon: { type: String, default: 'star', maxlength: 40 },
    rule: {
      type: new S(
        { type: { type: String, required: true }, threshold: { type: Number, default: 1 } },
        { _id: false },
      ),
      required: true,
    },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const userAchievementSchema = new S(
  {
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    achievementId: { type: ObjectId, ref: 'Achievement', required: true, index: true },
    earnedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
userAchievementSchema.index({ userId: 1, achievementId: 1 }, { unique: true });

const studySessionSchema = new S(
  {
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    minutes: { type: Number, required: true, min: 1, max: 600 },
    skillId: { type: ObjectId, ref: 'Skill', default: null },
    roadmapItemId: { type: ObjectId, default: null },
    note: { type: String, default: '', maxlength: 300 },
    loggedOn: { type: Date, required: true, default: Date.now, index: true },
  },
  { timestamps: true },
);
studySessionSchema.index({ userId: 1, loggedOn: -1 });

const studyGoalSchema = new S(
  {
    userId: { type: ObjectId, ref: 'User', required: true, unique: true },
    weeklyMinutes: { type: Number, required: true, min: 30, max: 10_000 },
    startDate: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

const notificationSchema = new S(
  {
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, required: true },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, default: '', maxlength: 600 },
    readAt: { type: Date, default: null },
    link: { type: String, default: null, maxlength: 300 },
  },
  { timestamps: true },
);
notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });

// ─── System ─────────────────────────────────────────────────────────────────

const auditLogSchema = new S(
  {
    actorUserId: { type: ObjectId, ref: 'User', default: null, index: true },
    action: { type: String, required: true, index: true },
    entity: { type: String, required: true, index: true },
    entityId: { type: String, default: null },
    outcome: { type: String, enum: ['success', 'failure'], default: 'success' },
    // Never CV text, passwords, or tokens.
    metadata: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, default: null, maxlength: 64 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actorUserId: 1, action: 1, createdAt: -1 });

// ─── Registration ───────────────────────────────────────────────────────────

/**
 * Registers a model and returns it typed to its document interface.
 *
 * The call to mongoose.model is deliberately NOT generic. Instantiating
 * mongoose's five model type parameters from inside this helper makes
 * TypeScript and ESLint's type-aware linting exhaust memory on this file,
 * regardless of the generic used at the call site. The document interface is
 * applied here instead, which gives every consumer the same typed model and
 * keeps the checker fast.
 */
function register<T>(name: string, schema: Schema<any>): Model<T> {
  const existing = mongoose.models[name] as Model<T> | undefined;
  if (existing) return existing;
  return mongoose.model(name, schema) as unknown as Model<T>;
}

export const User = register<Docs.UserDoc>('User', userSchema);
export const UserPreferences = register<Docs.UserPreferencesDoc>(
  'UserPreferences',
  userPreferencesSchema,
);
export const StudentProfile = register<Docs.StudentProfileDoc>(
  'StudentProfile',
  studentProfileSchema,
);
export const SkillCategory = register<Docs.SkillCategoryDoc>('SkillCategory', skillCategorySchema);
export const Skill = register<Docs.SkillDoc>('Skill', skillSchema);
export const SkillAlias = register<Docs.SkillAliasDoc>('SkillAlias', skillAliasSchema);
export const UserSkill = register<Docs.UserSkillDoc>('UserSkill', userSkillSchema);
export const Career = register<Docs.CareerDoc>('Career', careerSchema);
export const CareerSkill = register<Docs.CareerSkillDoc>('CareerSkill', careerSkillSchema);
export const CvDocument = register<Docs.CvDocumentDoc>('CvDocument', cvDocumentSchema);
export const ExtractedSkill = register<Docs.ExtractedSkillDoc>(
  'ExtractedSkill',
  extractedSkillSchema,
);
export const Roadmap = register<Docs.RoadmapDoc>('Roadmap', roadmapSchema);
export const LearningResource = register<Docs.LearningResourceDoc>(
  'LearningResource',
  learningResourceSchema,
);
export const Project = register<Docs.ProjectDoc>('Project', projectSchema);
export const UserProject = register<Docs.UserProjectDoc>('UserProject', userProjectSchema);
export const UserProgress = register<Docs.UserProgressDoc>('UserProgress', userProgressSchema);
export const JobDescription = register<Docs.JobDescriptionDoc>(
  'JobDescription',
  jobDescriptionSchema,
);
export const AIInteraction = register<Docs.AIInteractionDoc>('AIInteraction', aiInteractionSchema);
export const AlignmentSnapshot = register<Docs.AlignmentSnapshotDoc>(
  'AlignmentSnapshot',
  alignmentSnapshotSchema,
);
export const Recommendation = register<Docs.RecommendationDoc>(
  'Recommendation',
  recommendationSchema,
);
export const QuizQuestion = register<Docs.QuizQuestionDoc>('QuizQuestion', quizQuestionSchema);
export const QuizResponse = register<Docs.QuizResponseDoc>('QuizResponse', quizResponseSchema);
export const Achievement = register<Docs.AchievementDoc>('Achievement', achievementSchema);
export const UserAchievement = register<Docs.UserAchievementDoc>(
  'UserAchievement',
  userAchievementSchema,
);
export const StudySession = register<Docs.StudySessionDoc>('StudySession', studySessionSchema);
export const StudyGoal = register<Docs.StudyGoalDoc>('StudyGoal', studyGoalSchema);
export const Notification = register<Docs.NotificationDoc>('Notification', notificationSchema);
export const AuditLog = register<Docs.AuditLogDoc>('AuditLog', auditLogSchema);

export const models = {
  User,
  UserPreferences,
  StudentProfile,
  SkillCategory,
  Skill,
  SkillAlias,
  UserSkill,
  Career,
  CareerSkill,
  CvDocument,
  ExtractedSkill,
  Roadmap,
  LearningResource,
  Project,
  UserProject,
  UserProgress,
  JobDescription,
  AIInteraction,
  AlignmentSnapshot,
  Recommendation,
  QuizQuestion,
  QuizResponse,
  Achievement,
  UserAchievement,
  StudySession,
  StudyGoal,
  Notification,
  AuditLog,
} as const;

export type Models = typeof models;
export type { UserDoc, SkillDoc, CareerDoc, RoadmapDoc } from './types.js';
