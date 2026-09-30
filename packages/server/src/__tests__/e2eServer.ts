/**
 * E2E test server.
 *
 * Boots the real Express app against an in-memory MongoDB, seeds the real
 * content, and creates the demo student. The client is served from its
 * production build, so the tests exercise the same bundle a user would load.
 */

import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { models } from '../models/index.js';
import { hashPassword } from '../utils/tokens.js';
import { CAREERS, CAREER_SKILLS } from '../scripts/seedCareers.js';
import { RESOURCES } from '../scripts/seedResources.js';
import { PROJECTS } from '../scripts/seedProjects.js';
import { QUIZ_QUESTIONS, ACHIEVEMENTS } from '../scripts/seedEngagement.js';
import { DEMO_STUDENT } from '../scripts/seedDemoStudent.js';
import { SKILLS } from '@skillmap/content';

const PORT = Number(process.env['PORT'] ?? 4010);

if (process.env['PORT'] && Number(process.env['PORT']) !== PORT) {
  process.stderr.write(`PORT env ignored: ${process.env['PORT']}\n`);
}

// A test harness is a process entrypoint: exiting is the correct way to report
// failure, so the library rule is relaxed for this file only.
/* eslint-disable no-process-exit */

async function main(): Promise<void> {
  // A fixed dbpath, cleaned first. The default lands in the OS temp dir, and
  // an unclean run leaves a 300MB data directory behind every time, which fills
  // a tmpfs and makes the next run fail with "Disk quota exceeded".
  const dbPath = resolve(tmpdir(), 'skillmap-mongo-data');
  await rm(dbPath, { recursive: true, force: true });
  await mkdir(dbPath, { recursive: true });

  const mongod = await MongoMemoryServer.create({
    binary: { version: '7.0.14' },
    instance: {
      storageEngine: 'wiredTiger',
      dbPath,
      // A small fixed cache. The default is derived from total RAM, and on a
      // memory-constrained machine the engine refuses to start as a result.
      args: ['--wiredTigerCacheSizeGB', '0.25'],
    },
  });
  await mongoose.connect(mongod.getUri(), { dbName: 'skillmap-e2e' });

  const skillIds = new Map<string, string>();
  for (const skill of SKILLS) {
    const doc = await models.Skill.create({ ...skill, isPublished: true });
    skillIds.set(skill.slug, doc._id.toString());
  }

  const careerIds = new Map<string, string>();
  for (const career of CAREERS) {
    const doc = await models.Career.create({ ...career, isPublished: true });
    careerIds.set(career.slug, doc._id.toString());
  }

  for (const mapping of CAREER_SKILLS) {
    const careerId = careerIds.get(mapping.careerSlug);
    const skillId = skillIds.get(mapping.skillSlug);
    if (!careerId || !skillId) continue;
    await models.CareerSkill.create({
      careerId,
      skillId,
      requiredLevel: mapping.requiredLevel,
      importance: mapping.importance,
      isCore: mapping.isCore ?? false,
      estimatedEffortHours: mapping.estimatedEffortHours,
      prerequisiteSkillIds: (mapping.prerequisiteSkillSlugs ?? [])
        .map((s) => skillIds.get(s))
        .filter(Boolean),
    });
  }

  for (const resource of RESOURCES) {
    const skillId = skillIds.get(resource.skillSlug);
    if (!skillId) continue;
    await models.LearningResource.create({ ...resource, skillId, isPublished: true });
  }

  for (const project of PROJECTS) {
    await models.Project.create({
      title: project.title,
      slug: project.slug,
      description: project.description,
      careerId: project.careerSlug ? (careerIds.get(project.careerSlug) ?? null) : null,
      level: project.level,
      estimatedHours: project.estimatedHours,
      skillIds: project.skillSlugs.map((s) => skillIds.get(s)).filter(Boolean),
      steps: project.steps.map((step, i) => ({
        order: i + 1,
        title: step.title,
        description: step.description,
        skillId: step.skillSlug ? (skillIds.get(step.skillSlug) ?? null) : null,
      })),
      isPublished: true,
    });
  }

  for (const question of QUIZ_QUESTIONS) {
    await models.QuizQuestion.create({ ...question, isPublished: true });
  }
  for (const achievement of ACHIEVEMENTS) {
    await models.Achievement.create(achievement);
  }

  const passwordHash = await hashPassword(DEMO_STUDENT.password);
  const student = await models.User.create({
    name: DEMO_STUDENT.name,
    email: DEMO_STUDENT.email,
    passwordHash,
    role: 'student',
  });
  await models.UserPreferences.create({
    userId: student._id,
    weeklyStudyHours: DEMO_STUDENT.weeklyStudyHours,
  });
  await models.StudyGoal.create({ userId: student._id, weeklyMinutes: 360 });
  await models.StudentProfile.create({
    userId: student._id,
    university: DEMO_STUDENT.university,
    department: DEMO_STUDENT.department,
    academicYear: DEMO_STUDENT.academicYear,
    educationLevel: 'undergraduate',
    graduationYear: 2026,
    interests: DEMO_STUDENT.interests,
    targetCareerId: careerIds.get(DEMO_STUDENT.targetCareerSlug),
    onboarding: { currentStep: 'done', completedSteps: ['done'], finished: true },
  });
  for (const entry of DEMO_STUDENT.skills) {
    const skillId = skillIds.get(entry.skillSlug);
    if (!skillId) continue;
    await models.UserSkill.create({
      userId: student._id,
      skillId,
      level: entry.level,
      source: entry.source,
    });
  }

  const adminHash = await hashPassword('E2eAdminPass123');
  const admin = await models.User.create({
    name: 'E2E Admin',
    email: 'admin@e2e.skillmap.ai',
    passwordHash: adminHash,
    role: 'admin',
  });
  await models.UserPreferences.create({ userId: admin._id });
  await models.StudentProfile.create({ userId: admin._id });

  // Serve the built client so the tests hit the real bundle.
  // Resolved relative to this file, not the cwd, so the path is correct
  // whether the server is started from the repo root or from this package.
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, '../../../client/dist'),
    resolve(process.cwd(), 'packages/client/dist'),
  ];
  const dist = candidates.find((path) => existsSync(path));
  if (!dist) {
    process.stderr.write(
      `client build not found at ${candidates.join(' or ')}. Run npm run build first.\n`,
    );
  }

  const app = createApp((instance) => {
    if (!dist) return;
    instance.use(express.static(dist));
    // Client-side routing: any non-API path returns the SPA shell.
    instance.get(/^(?!\/api).*/, (_req, res) => res.sendFile(resolve(dist, 'index.html')));
  });

  createServer(app).listen(PORT, () => {
    process.stdout.write(`e2e server ready on http://127.0.0.1:${PORT}\n`);
  });

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
      await mongoose.disconnect();
      await mongod.stop();
    } catch {
      // Shutdown must not throw.
    } finally {
      await rm(dbPath, { recursive: true, force: true }).catch(() => undefined);
      process.exit(0);
    }
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}

main().catch((error: unknown) => {
  process.stderr.write(
    `e2e server failed: ${error instanceof Error ? error.stack : String(error)}\n`,
  );
  process.exit(1);
});
