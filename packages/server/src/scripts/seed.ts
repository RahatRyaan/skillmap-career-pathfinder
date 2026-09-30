/**
 * Idempotent seed.
 *
 * Running it twice must not create duplicates, so every write is keyed on a
 * stable natural key (slug or email) and upserted. Safe to run on every deploy.
 *
 * Content lives in @skillmap/content as typed data modules, so it reviews like
 * code rather than living in an untyped JSON blob.
 *
 * Usage:
 *   npm run seed                 # seed everything
 *   npm run seed -- --demo-only  # only the demo student account
 *   npm run seed -- --fresh      # drop seeded content first (DESTRUCTIVE)
 */

import type { Types } from 'mongoose';
import { config } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../db/connect.js';
import { models } from '../models/index.js';
import { hashPassword } from '../utils/tokens.js';
import { logger } from '../utils/logger.js';
import { SKILLS } from '@skillmap/content';
import { CAREERS, CAREER_SKILLS } from './seedCareers.js';
import { RESOURCES } from './seedResources.js';
import { PROJECTS } from './seedProjects.js';
import { QUIZ_QUESTIONS, ACHIEVEMENTS } from './seedEngagement.js';
import { DEMO_STUDENT } from './seedDemoStudent.js';

const args = new Set(process.argv.slice(2));
const FRESH = args.has('--fresh');
const DEMO_ONLY = args.has('--demo-only');

async function seedSkills(): Promise<Map<string, Types.ObjectId>> {
  const ids = new Map<string, Types.ObjectId>();

  for (const category of [
    { slug: 'technical', name: 'Technical', order: 1 },
    { slug: 'analytical', name: 'Analytical', order: 2 },
    { slug: 'tools', name: 'Tools', order: 3 },
    { slug: 'soft-skills', name: 'Soft skills', order: 4 },
  ]) {
    await models.SkillCategory.updateOne(
      { slug: category.slug },
      { $set: category },
      { upsert: true },
    );
  }

  for (const skill of SKILLS) {
    const doc = await models.Skill.findOneAndUpdate(
      { slug: skill.slug },
      {
        $set: {
          name: skill.name,
          slug: skill.slug,
          category: skill.category,
          description: skill.description,
          aliases: skill.aliases,
          isPublished: true,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    ids.set(skill.slug, doc._id);

    // Alias rows keep normalization an indexed lookup instead of a scan.
    for (const alias of skill.aliases) {
      await models.SkillAlias.updateOne(
        { alias: alias.toLowerCase() },
        { $set: { alias: alias.toLowerCase(), skillId: doc._id } },
        { upsert: true },
      );
    }
  }

  logger.info('Skills seeded', { count: ids.size });
  return ids;
}

async function seedCareers(
  skillIds: Map<string, Types.ObjectId>,
): Promise<Map<string, Types.ObjectId>> {
  const careerIds = new Map<string, Types.ObjectId>();

  for (const career of CAREERS) {
    const doc = await models.Career.findOneAndUpdate(
      { slug: career.slug },
      { $set: { ...career, isPublished: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    careerIds.set(career.slug, doc._id);
  }

  logger.info('Careers seeded', { count: careerIds.size });

  let mappingCount = 0;
  let skipped = 0;

  for (const mapping of CAREER_SKILLS) {
    const careerId = careerIds.get(mapping.careerSlug);
    const skillId = skillIds.get(mapping.skillSlug);

    if (!careerId || !skillId) {
      skipped += 1;
      logger.warn('Skipping mapping with unknown slug', {
        career: mapping.careerSlug,
        skill: mapping.skillSlug,
      });
      continue;
    }

    // Prerequisites are stored as ids, so they resolve in a second pass.
    const prerequisiteSkillIds = (mapping.prerequisiteSkillSlugs ?? [])
      .map((slug) => skillIds.get(slug))
      .filter((id): id is Types.ObjectId => Boolean(id));

    await models.CareerSkill.updateOne(
      { careerId, skillId },
      {
        $set: {
          careerId,
          skillId,
          requiredLevel: mapping.requiredLevel,
          importance: mapping.importance,
          isCore: mapping.isCore ?? false,
          estimatedEffortHours: mapping.estimatedEffortHours,
          prerequisiteSkillIds,
        },
      },
      { upsert: true },
    );
    mappingCount += 1;
  }

  if (skipped > 0) {
    throw new Error(
      `${skipped} career-skill mappings referenced an unknown slug. Fix the content before seeding.`,
    );
  }

  logger.info('Career-skill mappings seeded', { count: mappingCount });
  return careerIds;
}

async function seedResources(skillIds: Map<string, Types.ObjectId>): Promise<void> {
  let count = 0;
  for (const resource of RESOURCES) {
    const skillId = skillIds.get(resource.skillSlug);
    if (!skillId)
      throw new Error(
        `Resource "${resource.title}" references unknown skill ${resource.skillSlug}`,
      );
    await models.LearningResource.updateOne(
      { url: resource.url, skillId },
      { $set: { ...resource, skillId, isPublished: true } },
      { upsert: true },
    );
    count += 1;
  }
  logger.info('Resources seeded', { count });
}

async function seedProjects(
  skillIds: Map<string, Types.ObjectId>,
  careerIds: Map<string, Types.ObjectId>,
): Promise<void> {
  let count = 0;
  for (const project of PROJECTS) {
    const resolved = project.skillSlugs.map((slug) => {
      const id = skillIds.get(slug);
      if (!id) throw new Error(`Project "${project.title}" references unknown skill ${slug}`);
      return id;
    });

    await models.Project.updateOne(
      { slug: project.slug },
      {
        $set: {
          title: project.title,
          slug: project.slug,
          description: project.description,
          careerId: project.careerSlug ? (careerIds.get(project.careerSlug) ?? null) : null,
          level: project.level,
          estimatedHours: project.estimatedHours,
          skillIds: resolved,
          steps: project.steps.map((step, index) => ({
            order: index + 1,
            title: step.title,
            description: step.description,
            skillId: step.skillSlug ? (skillIds.get(step.skillSlug) ?? null) : null,
          })),
          isPublished: true,
        },
      },
      { upsert: true },
    );
    count += 1;
  }
  logger.info('Projects seeded', { count });
}

async function seedEngagement(): Promise<void> {
  for (const question of QUIZ_QUESTIONS) {
    await models.QuizQuestion.updateOne(
      { order: question.order },
      { $set: { ...question, isPublished: true } },
      { upsert: true },
    );
  }
  logger.info('Quiz questions seeded', { count: QUIZ_QUESTIONS.length });

  for (const achievement of ACHIEVEMENTS) {
    await models.Achievement.updateOne(
      { slug: achievement.slug },
      { $set: achievement },
      { upsert: true },
    );
  }
  logger.info('Achievements seeded', { count: ACHIEVEMENTS.length });
}

/**
 * Demo student from the spec: Data Analyst target with
 * Python 3, Excel 3, SQL 1, Statistics 2, Communication 3.
 */
async function seedDemoStudent(
  skillIds: Map<string, Types.ObjectId>,
  careerIds: Map<string, Types.ObjectId>,
): Promise<void> {
  const passwordHash = await hashPassword(DEMO_STUDENT.password);

  const user = await models.User.findOneAndUpdate(
    { email: DEMO_STUDENT.email },
    {
      $set: {
        name: DEMO_STUDENT.name,
        email: DEMO_STUDENT.email,
        passwordHash,
        role: 'student',
        isActive: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const targetCareerId = careerIds.get(DEMO_STUDENT.targetCareerSlug);
  if (!targetCareerId) throw new Error('Demo student target career not found in seed data');

  await models.StudentProfile.updateOne(
    { userId: user._id },
    {
      $set: {
        userId: user._id,
        university: DEMO_STUDENT.university,
        department: DEMO_STUDENT.department,
        academicYear: DEMO_STUDENT.academicYear,
        educationLevel: 'undergraduate',
        graduationYear: 2026,
        interests: DEMO_STUDENT.interests,
        targetCareerId,
        onboarding: {
          currentStep: 'done',
          completedSteps: ['profile', 'skills', 'career', 'done'],
          finished: true,
        },
      },
    },
    { upsert: true },
  );

  await models.UserPreferences.updateOne(
    { userId: user._id },
    {
      $set: {
        userId: user._id,
        weeklyStudyHours: DEMO_STUDENT.weeklyStudyHours,
        lowDataMode: false,
      },
    },
    { upsert: true },
  );

  await models.StudyGoal.updateOne(
    { userId: user._id },
    { $set: { userId: user._id, weeklyMinutes: DEMO_STUDENT.weeklyStudyHours * 60 } },
    { upsert: true },
  );

  for (const entry of DEMO_STUDENT.skills) {
    const skillId = skillIds.get(entry.skillSlug);
    if (!skillId) throw new Error(`Demo student references unknown skill ${entry.skillSlug}`);
    await models.UserSkill.updateOne(
      { userId: user._id, skillId },
      {
        $set: {
          userId: user._id,
          skillId,
          level: entry.level,
          source: entry.source,
        },
      },
      { upsert: true },
    );
  }

  logger.info('Demo student seeded', {
    email: DEMO_STUDENT.email,
    skills: DEMO_STUDENT.skills.length,
  });
}

async function freshDrop(): Promise<void> {
  if (!FRESH) return;
  if (config.isProduction) {
    throw new Error('Refusing to run --fresh against a production database');
  }
  logger.warn('Dropping seeded collections (--fresh)');
  await Promise.all([
    models.Skill.deleteMany({}),
    models.SkillAlias.deleteMany({}),
    models.SkillCategory.deleteMany({}),
    models.Career.deleteMany({}),
    models.CareerSkill.deleteMany({}),
    models.LearningResource.deleteMany({}),
    models.Project.deleteMany({}),
    models.QuizQuestion.deleteMany({}),
    models.Achievement.deleteMany({}),
  ]);
}

async function main(): Promise<void> {
  logger.info('Seeding database', { mode: config.db.mode, fresh: FRESH, demoOnly: DEMO_ONLY });
  await connectDatabase();

  if (!DEMO_ONLY) {
    await freshDrop();
    const skillIds = await seedSkills();
    const careerIds = await seedCareers(skillIds);
    await seedResources(skillIds);
    await seedProjects(skillIds, careerIds);
    await seedEngagement();
    await seedDemoStudent(skillIds, careerIds);
  }

  const counts = {
    skills: await models.Skill.countDocuments(),
    careers: await models.Career.countDocuments(),
    mappings: await models.CareerSkill.countDocuments(),
    resources: await models.LearningResource.countDocuments(),
    projects: await models.Project.countDocuments(),
    quizQuestions: await models.QuizQuestion.countDocuments(),
    achievements: await models.Achievement.countDocuments(),
  };

  logger.info('Seed complete', counts);
  await disconnectDatabase();
}

main().catch(async (error: unknown) => {
  logger.error('Seed failed', {
    message: error instanceof Error ? error.message : String(error),
  });
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
