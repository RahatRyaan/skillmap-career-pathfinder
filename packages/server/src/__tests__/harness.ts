/**
 * Test harness: an in-memory MongoDB plus a seeded fixture set.
 *
 * Using mongodb-memory-server means the suite never touches a real database,
 * a real user's data, or the network. It does need to download a mongod binary
 * on first run, which is cached afterwards.
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import type { Express } from 'express';
import { createApp } from '../app.js';
import { models } from '../models/index.js';
import { hashPassword } from '../utils/tokens.js';
import { CAREERS, CAREER_SKILLS } from '../scripts/seedCareers.js';
import { SKILLS } from '@skillmap/content';

let mongod: MongoMemoryServer | null = null;

export async function startTestDatabase(): Promise<string> {
  mongod = await MongoMemoryServer.create({
    binary: { version: '7.0.14' },
  });
  const uri = mongod.getUri();
  await mongoose.connect(uri, { dbName: 'skillmap-test' });
  return uri;
}

export async function stopTestDatabase(): Promise<void> {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
    mongod = null;
  }
}

export async function clearDatabase(): Promise<void> {
  const collections = await mongoose.connection.db?.collections();
  for (const collection of collections ?? []) {
    await collection.deleteMany({});
  }
  // Collections created by createMany() have no documents to delete, so they
  // must be dropped for a re-seed to recreate indexes.
  const db = mongoose.connection.db;
  if (db) await db.dropDatabase();
}

export function buildApp(): Express {
  return createApp();
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  accessToken: string;
  role: 'student' | 'admin';
}

export interface SeededFixture {
  student: TestUser;
  admin: TestUser;
  careerIds: Record<string, string>;
  skillIds: Record<string, string>;
}

/** Seeds the real content so tests exercise production-shaped data. */
export async function seedTestFixtures(): Promise<SeededFixture> {
  const skillIds: Record<string, string> = {};
  for (const skill of SKILLS) {
    const doc = await models.Skill.create({ ...skill, isPublished: true });
    skillIds[skill.slug] = doc._id.toString();
  }

  const careerIds: Record<string, string> = {};
  for (const career of CAREERS) {
    const doc = await models.Career.create({ ...career, isPublished: true });
    careerIds[career.slug] = doc._id.toString();
  }

  for (const mapping of CAREER_SKILLS) {
    const careerId = careerIds[mapping.careerSlug];
    const skillId = skillIds[mapping.skillSlug];
    if (!careerId || !skillId) continue;
    await models.CareerSkill.create({
      careerId,
      skillId,
      requiredLevel: mapping.requiredLevel,
      importance: mapping.importance,
      isCore: mapping.isCore ?? false,
      estimatedEffortHours: mapping.estimatedEffortHours,
      prerequisiteSkillIds: (mapping.prerequisiteSkillSlugs ?? [])
        .map((slug) => skillIds[slug])
        .filter(Boolean),
    });
  }

  const student = await createTestUser('student@skillmap.test', 'StudentPass123', 'student');
  const admin = await createTestUser('admin@skillmap.test', 'AdminPass123', 'admin');

  // createTestUser already creates a bare StudentProfile; the fixture only
  // needs to enrich it. Creating a second one would violate the unique index.
  await models.StudentProfile.updateOne(
    { userId: student.id },
    {
      $set: {
        university: 'Test University',
        department: 'Statistics',
        academicYear: 'Final year',
        educationLevel: 'undergraduate',
        targetCareerId: careerIds['data-analyst'],
        onboarding: { currentStep: 'done', completedSteps: ['done'], finished: true },
      },
    },
  );
  await models.UserPreferences.updateOne({ userId: student.id }, { $set: { weeklyStudyHours: 6 } });

  return { student, admin, careerIds, skillIds };
}

export async function createTestUser(
  email: string,
  password: string,
  role: 'student' | 'admin' = 'student',
): Promise<TestUser> {
  const passwordHash = await hashPassword(password);
  const user = await models.User.create({
    name: `Test ${role}`,
    email,
    passwordHash,
    role,
  });
  await models.UserPreferences.create({ userId: user._id });
  await models.StudentProfile.create({ userId: user._id });

  const { signAccessToken } = await import('../utils/tokens.js');
  return {
    id: user._id.toString(),
    email,
    password,
    accessToken: signAccessToken({ userId: user._id.toString(), role, email }),
    role,
  };
}

/** Gives a user the spec's demo skill profile. */
export async function assignSkills(
  userId: string,
  entries: { skillSlug: string; level: number }[],
  skillIds: Record<string, string>,
): Promise<void> {
  for (const entry of entries) {
    const skillId = skillIds[entry.skillSlug];
    if (!skillId) continue;
    await models.UserSkill.create({
      userId,
      skillId,
      level: entry.level,
      source: 'self_reported',
    });
  }
}

export const DEMO_SKILLS = [
  { skillSlug: 'python', level: 3 },
  { skillSlug: 'excel', level: 3 },
  { skillSlug: 'sql', level: 1 },
  { skillSlug: 'statistics', level: 2 },
  { skillSlug: 'communication', level: 3 },
];
