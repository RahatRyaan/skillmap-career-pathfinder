/**
 * API tests: auth, profile, catalog, and the security boundaries.
 *
 * These mount the real Express app against an in-memory MongoDB, so they
 * exercise routing, middleware, validation, and the database layer together.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  buildApp,
  createTestUser,
  DEMO_SKILLS,
  assignSkills,
  seedTestFixtures,
  startTestDatabase,
  stopTestDatabase,
  type SeededFixture,
} from './harness.js';
import { models } from '../models/index.js';

let app: Express;
let fixture: SeededFixture;

beforeAll(async () => {
  await startTestDatabase();
  app = buildApp();
  fixture = await seedTestFixtures();
}, 120_000);

afterAll(async () => {
  await stopTestDatabase();
});

// The fixture set is re-seeded once in beforeAll. Tests that mutate shared
// content create their own throwaway users instead of resetting the database,
// so tests stay independent without paying for a full re-seed between each one.

describe('GET /api/health', () => {
  it('reports a connected database and the active AI mode', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.database).toBe('connected');
    expect(response.body.aiMode).toBe('demo');
  });
});

describe('GET /api/system/ai-mode', () => {
  it('describes demo mode honestly', async () => {
    const response = await request(app).get('/api/system/ai-mode');

    expect(response.status).toBe(200);
    expect(response.body.mode).toBe('demo');
    expect(response.body.usesRealLlm).toBe(false);
    expect(response.body.deterministic).toBe(true);
    expect(response.body.notice).toContain('Demo Mode');
  });
});

describe('POST /api/auth/register', () => {
  it('creates an account and returns a usable token pair', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'New Student',
        email: 'new.student@test.skillmap.ai',
        password: 'ValidPass123',
        university: 'Test University',
        department: 'Computer Science',
        academicYear: 'Third year',
        educationLevel: 'undergraduate',
        interests: ['data'],
      });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe('new.student@test.skillmap.ai');
    expect(response.body.user.role).toBe('student');
    expect(response.body.accessToken).toBeTruthy();
    expect(response.body.refreshToken).toBeTruthy();
    // The password must never come back in any form.
    expect(JSON.stringify(response.body)).not.toContain('ValidPass123');
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
  });

  it('creates the profile, preferences, and study goal', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Profile Test',
      email: 'profile@test.skillmap.ai',
      password: 'ValidPass123',
      university: 'Test University',
      department: 'Statistics',
      academicYear: 'Final year',
      educationLevel: 'undergraduate',
    });

    const user = await models.User.findOne({ email: 'profile@test.skillmap.ai' });
    expect(user).not.toBeNull();
    expect(await models.StudentProfile.countDocuments({ userId: user!._id })).toBe(1);
    expect(await models.UserPreferences.countDocuments({ userId: user!._id })).toBe(1);
    expect(await models.StudyGoal.countDocuments({ userId: user!._id })).toBe(1);
    expect(response.status).toBe(201);
  });

  it('rejects a duplicate email', async () => {
    const payload = {
      name: 'Duplicate',
      email: 'dupe@test.skillmap.ai',
      password: 'ValidPass123',
      university: 'U',
      department: 'D',
      academicYear: 'Third',
      educationLevel: 'undergraduate',
    };

    await request(app).post('/api/auth/register').send(payload);
    const response = await request(app).post('/api/auth/register').send(payload);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('DUPLICATE_RESOURCE');
  });

  it('rejects a short password with a field-level error', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Weak Password',
      email: 'weak@test.skillmap.ai',
      password: 'short',
      university: 'U',
      department: 'D',
      academicYear: 'Third',
      educationLevel: 'undergraduate',
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(
      response.body.error.details.some((d: { path: string }) => d.path.includes('password')),
    ).toBe(true);
  });

  it('rejects a malformed email', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Bad Email',
      email: 'not-an-email',
      password: 'ValidPass123',
      university: 'U',
      department: 'D',
      academicYear: 'Third',
      educationLevel: 'undergraduate',
    });

    expect(response.status).toBe(422);
  });

  it('refuses to let a client set its own role', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Escalation',
      email: 'escalate@test.skillmap.ai',
      password: 'ValidPass123',
      university: 'U',
      department: 'D',
      academicYear: 'Third',
      educationLevel: 'undergraduate',
      role: 'admin',
    });

    // role is not in the schema, so it is stripped rather than honoured.
    expect(response.status).toBe(201);
    expect(response.body.user.role).toBe('student');
  });
});

describe('POST /api/auth/login', () => {
  it('returns a token pair for valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: fixture.student.email, password: fixture.student.password });

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toBeTruthy();
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
  });

  it('gives the same error for an unknown email and a wrong password', async () => {
    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.skillmap.ai', password: 'WrongPass123' });

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: fixture.student.email, password: 'WrongPass123' });

    expect(unknown.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    // Identical messages: the endpoint must not reveal which emails exist.
    expect(unknown.body.error.message).toBe(wrongPassword.body.error.message);
  });
});

describe('POST /api/auth/refresh', () => {
  it('rotates the refresh token and invalidates the old one', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: fixture.student.email, password: fixture.student.password });

    const original = login.body.refreshToken;

    const first = await request(app).post('/api/auth/refresh').send({ refreshToken: original });
    expect(first.status).toBe(200);
    expect(first.body.refreshToken).not.toBe(original);

    // Reusing a rotated token must fail.
    const reuse = await request(app).post('/api/auth/refresh').send({ refreshToken: original });
    expect(reuse.status).toBe(401);
  });

  it('rejects a garbage token', async () => {
    const response = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'not-a-real-token-at-all' });

    expect(response.status).toBe(401);
  });
});

describe('authentication guards', () => {
  it('rejects a missing token with 401', async () => {
    const response = await request(app).get('/api/profile');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a malformed token with 401', async () => {
    const response = await request(app)
      .get('/api/profile')
      .set('Authorization', 'Bearer not.a.token');

    expect(response.status).toBe(401);
  });

  it('rejects a token signed with the wrong secret', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const forged = jwt.sign(
      { sub: fixture.student.id, role: 'admin', email: fixture.student.email, type: 'access' },
      'a-completely-different-secret-that-is-long-enough-32',
      { expiresIn: '1h', issuer: 'skillmap-ai' },
    );

    const response = await request(app)
      .get('/api/profile')
      .set('Authorization', `Bearer ${forged}`);

    expect(response.status).toBe(401);
  });

  it('rejects a token that claims a role it does not have', async () => {
    // requireActiveAccount re-reads the role from the database, so a token
    // claiming admin cannot escalate.
    const jwt = (await import('jsonwebtoken')).default;
    const escalated = jwt.sign(
      { sub: fixture.student.id, role: 'admin', email: fixture.student.email, type: 'access' },
      process.env['JWT_ACCESS_SECRET']!,
      { expiresIn: '1h', issuer: 'skillmap-ai' },
    );

    const response = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${escalated}`);
    expect(response.status).toBe(404);
  });
});

describe('GET/PUT /api/profile', () => {
  it('returns the current profile', async () => {
    const response = await request(app)
      .get('/api/profile')
      .set('Authorization', `Bearer ${fixture.student.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.email).toBe(fixture.student.email);
    expect(response.body.targetCareerName).toBe('Data Analyst');
    expect(response.body.preferences.weeklyStudyHours).toBe(6);
  });

  it('updates editable fields', async () => {
    const response = await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${fixture.student.accessToken}`)
      .send({ university: 'New University', bio: 'Updated bio' });

    expect(response.status).toBe(200);
    expect(response.body.university).toBe('New University');
    expect(response.body.bio).toBe('Updated bio');
  });

  it('never returns the password hash', async () => {
    const response = await request(app)
      .get('/api/profile')
      .set('Authorization', `Bearer ${fixture.student.accessToken}`);

    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
  });
});

describe('PUT /api/preferences', () => {
  it('accepts a low-data mode preference', async () => {
    const response = await request(app)
      .put('/api/preferences')
      .set('Authorization', `Bearer ${fixture.student.accessToken}`)
      .send({ lowDataMode: true, language: 'bn', fontScale: 1.2 });

    expect(response.status).toBe(200);
    expect(response.body.lowDataMode).toBe(true);
    expect(response.body.language).toBe('bn');
  });

  it('rejects an out-of-range font scale', async () => {
    const response = await request(app)
      .put('/api/preferences')
      .set('Authorization', `Bearer ${fixture.student.accessToken}`)
      .send({ fontScale: 5 });

    expect(response.status).toBe(422);
  });

  it('rejects zero study hours', async () => {
    const response = await request(app)
      .put('/api/preferences')
      .set('Authorization', `Bearer ${fixture.student.accessToken}`)
      .send({ weeklyStudyHours: 0 });

    expect(response.status).toBe(422);
  });
});

describe('GET /api/skills', () => {
  it('lists the seeded skill catalog publicly', async () => {
    const response = await request(app).get('/api/skills');

    expect(response.status).toBe(200);
    expect(response.body.total).toBeGreaterThanOrEqual(50);
    expect(response.body.items[0]).toHaveProperty('name');
    expect(response.body.items[0]).toHaveProperty('category');
  });

  it('filters by category', async () => {
    const response = await request(app).get('/api/skills?category=Analytical');

    expect(response.status).toBe(200);
    for (const item of response.body.items) {
      expect(item.category).toBe('Analytical');
    }
  });

  it('searches by alias, so MS Excel finds Excel', async () => {
    const response = await request(app).get('/api/skills?search=ms%20excel');

    expect(response.status).toBe(200);
    expect(response.body.items.some((i: { name: string }) => i.name === 'Excel')).toBe(true);
  });

  it('paginates', async () => {
    const response = await request(app).get('/api/skills?page=1&limit=5');

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(5);
    expect(response.body.hasNext).toBe(true);
  });
});

describe('user skills', () => {
  it('adds, updates, and removes a skill', async () => {
    const auth = `Bearer ${fixture.student.accessToken}`;
    const sqlId = fixture.skillIds['sql'];

    const create = await request(app)
      .post('/api/user-skills')
      .set('Authorization', auth)
      .send({ skillId: sqlId, level: 2 });
    expect(create.status).toBe(201);
    expect(create.body.level).toBe(2);
    expect(create.body.levelDescription).toContain('guided');

    const update = await request(app)
      .put(`/api/user-skills/${create.body.id}`)
      .set('Authorization', auth)
      .send({ level: 4 });
    expect(update.status).toBe(200);
    expect(update.body.level).toBe(4);

    const remove = await request(app)
      .delete(`/api/user-skills/${create.body.id}`)
      .set('Authorization', auth);
    expect(remove.status).toBe(204);
  });

  it('rejects adding the same skill twice, matching the unique index', async () => {
    const auth = `Bearer ${fixture.student.accessToken}`;
    const sqlId = fixture.skillIds['sql'];

    await request(app)
      .post('/api/user-skills')
      .set('Authorization', auth)
      .send({ skillId: sqlId, level: 2 });
    const second = await request(app)
      .post('/api/user-skills')
      .set('Authorization', auth)
      .send({ skillId: sqlId, level: 3 });

    expect(second.status).toBe(409);
  });

  it('rejects a level outside 0-5', async () => {
    const response = await request(app)
      .post('/api/user-skills')
      .set('Authorization', `Bearer ${fixture.student.accessToken}`)
      .send({ skillId: fixture.skillIds['sql'], level: 9 });

    expect(response.status).toBe(422);
  });

  it('marks an AI-extracted skill as needing review', async () => {
    const user = await createTestUser('review.badge@test.skillmap.ai', 'ReviewPass123', 'student');

    const response = await request(app)
      .post('/api/user-skills')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ skillId: fixture.skillIds['sql'], level: 2, source: 'ai_extracted' });

    expect(response.status).toBe(201);
    expect(response.body.needsReview).toBe(true);
  });

  it('will not let one student edit another student skill record', async () => {
    // The owner is a throwaway user, so the shared fixture user is unaffected.
    const owner = await createTestUser('skill.owner@test.skillmap.ai', 'OwnerPass123', 'student');
    const created = await request(app)
      .post('/api/user-skills')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ skillId: fixture.skillIds['sql'], level: 2 });
    expect(created.status).toBe(201);

    const attempt = await request(app)
      .put(`/api/user-skills/${created.body.id}`)
      .set('Authorization', `Bearer ${fixture.student.accessToken}`)
      .send({ level: 5 });

    // The record exists but is not this user's, so it must not be found.
    expect(attempt.status).toBe(404);
  });
});

describe('GET /api/careers', () => {
  it('lists careers publicly without alignment', async () => {
    const response = await request(app).get('/api/careers');

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(10);
    expect(response.body.items[0].alignmentPercent).toBeNull();
  });

  it('includes alignment when authenticated', async () => {
    const user = await createTestUser(
      'alignment.reader@test.skillmap.ai',
      'AlignPass123',
      'student',
    );
    await assignSkills(user.id, DEMO_SKILLS, fixture.skillIds);

    const response = await request(app)
      .get('/api/careers')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(response.status).toBe(200);
    const dataAnalyst = response.body.items.find(
      (c: { slug: string }) => c.slug === 'data-analyst',
    );
    expect(dataAnalyst.alignmentPercent).toBeGreaterThan(0);
    expect(dataAnalyst.alignmentPercent).toBeLessThan(100);
    expect(dataAnalyst.requiredSkillCount).toBeGreaterThan(0);
  });

  it('carries the disclaimer on career detail', async () => {
    const response = await request(app).get(`/api/careers/${fixture.careerIds['data-analyst']}`);

    expect(response.status).toBe(200);
    expect(response.body.disclaimer).toContain('not a prediction of employment');
    expect(response.body.skills.length).toBeGreaterThan(0);
  });

  it('rejects a malformed career id without a 500', async () => {
    const response = await request(app).get('/api/careers/not-an-id');

    expect(response.status).toBe(422);
  });

  it('returns 404 for a well-formed id that does not exist', async () => {
    const response = await request(app).get('/api/careers/0123456789abcdef01234567');

    expect(response.status).toBe(404);
  });
});

describe('GET /api/careers/compare', () => {
  it('compares two to three careers', async () => {
    const ids = [fixture.careerIds['data-analyst'], fixture.careerIds['software-engineer']].join(
      ',',
    );

    const response = await request(app).get(`/api/careers/compare?ids=${ids}`);

    expect(response.status).toBe(200);
    expect(response.body.careers).toHaveLength(2);
    expect(response.body.disclaimer).toContain('not predictions of employment');
  });

  it('refuses to compare more than three', async () => {
    const ids = [
      fixture.careerIds['data-analyst'],
      fixture.careerIds['software-engineer'],
      fixture.careerIds['data-scientist'],
      fixture.careerIds['web-developer'],
    ].join(',');

    const response = await request(app).get(`/api/careers/compare?ids=${ids}`);

    expect(response.status).toBe(422);
  });
});

describe('NoSQL injection resistance', () => {
  it('does not treat a query operator as a valid email', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: { $ne: null }, password: { $ne: null } });

    expect([400, 401, 422]).toContain(response.status);
    expect(JSON.stringify(response.body)).not.toContain('accessToken');
  });

  it('does not allow operator injection through search', async () => {
    const response = await request(app).get('/api/skills?search[$ne]=x');

    expect([200, 422]).toContain(response.status);
    // Whatever the status, it must not return every document as a bypass.
    if (response.status === 200) {
      expect(response.body.total).toBeLessThan(100);
    }
  });

  it('does not let a body operator escalate a role', async () => {
    const response = await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${fixture.student.accessToken}`)
      .send({ $set: { role: 'admin' } });

    // The sanitizer strips the operator key, so this either becomes an empty
    // update or is rejected. Either way the role must not change, and the
    // response must never confirm an admin role.
    expect([200, 422]).toContain(response.status);
    expect(JSON.stringify(response.body)).not.toContain('"role":"admin"');

    const user = await models.User.findById(fixture.student.id);
    expect(user!.role).toBe('student');
  });
});

describe('error handling', () => {
  it('returns a structured 404 for an unknown route', async () => {
    const response = await request(app).get('/api/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.error.requestId).toBeTruthy();
  });

  it('never leaks a stack trace', async () => {
    const response = await request(app).get('/api/does-not-exist');
    const body = JSON.stringify(response.body);

    expect(body).not.toContain('at ');
    expect(body).not.toContain('.ts:');
    expect(body).not.toContain('node_modules');
  });

  it('returns a requestId so a user error report is traceable', async () => {
    const response = await request(app).get('/api/does-not-exist');
    expect(response.body.error.requestId).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
  });
});

describe('DELETE /api/account', () => {
  it('removes the account and all of its owned data', async () => {
    const user = await createTestUser('delete.me1@test.skillmap.ai', 'DeletePass123', 'student');
    await assignSkills(user.id, [{ skillSlug: 'sql', level: 2 }], fixture.skillIds);

    const response = await request(app)
      .delete('/api/account')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(response.status).toBe(204);
    expect(await models.User.findById(user.id)).toBeNull();
    expect(await models.UserSkill.countDocuments({ userId: user.id })).toBe(0);
    expect(await models.StudentProfile.countDocuments({ userId: user.id })).toBe(0);
  });

  it('invalidates the token immediately after deletion', async () => {
    const user = await createTestUser('gone1@test.skillmap.ai', 'GonePass123', 'student');
    expect(
      (await request(app).delete('/api/account').set('Authorization', `Bearer ${user.accessToken}`))
        .status,
    ).toBe(204);

    // The token is still cryptographically valid, so the request is rejected
    // when the account lookup fails. Either 401 or 404 proves it is dead.
    const after = await request(app)
      .get('/api/profile')
      .set('Authorization', `Bearer ${user.accessToken}`);
    expect([401, 404]).toContain(after.status);

    const relogin = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });
    expect(relogin.status).toBe(401);
  });
});

describe('CORS', () => {
  it('allows a configured origin', async () => {
    const response = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('does not allow an unknown origin', async () => {
    const response = await request(app)
      .get('/api/health')
      .set('Origin', 'https://evil.example.com');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('security headers', () => {
  it('sets helmet headers and hides the framework', async () => {
    const response = await request(app).get('/api/health');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});
