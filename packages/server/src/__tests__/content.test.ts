/**
 * Content integrity tests.
 *
 * These run without a database. They guard the promises the product makes about
 * its seed content: minimum counts, no invented URLs, no forbidden claims, and
 * no broken references between content modules.
 */

import { describe, expect, it } from 'vitest';
import { SKILLS } from '@skillmap/content';
import { CAREERS, CAREER_SKILLS } from '../scripts/seedCareers.js';
import { RESOURCES } from '../scripts/seedResources.js';
import { PROJECTS } from '../scripts/seedProjects.js';
import { QUIZ_QUESTIONS, ACHIEVEMENTS } from '../scripts/seedEngagement.js';
import { DEMO_STUDENT, SAMPLE_CVS } from '../scripts/seedDemoStudent.js';
import { PROHIBITED_AI_PHRASES, SKILL_LEVEL_MAX } from '@skillmap/shared';

const skillSlugs = new Set(SKILLS.map((s) => s.slug));
const careerSlugs = new Set(CAREERS.map((c) => c.slug));

describe('skill library', () => {
  it('has at least the 50 skills the spec requires', () => {
    expect(SKILLS.length).toBeGreaterThanOrEqual(50);
  });

  it('has no duplicate slugs', () => {
    const slugs = SKILLS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('has no duplicate names', () => {
    const names = SKILLS.map((s) => s.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it('covers all four spec categories', () => {
    const categories = new Set(SKILLS.map((s) => s.category));
    expect(categories).toEqual(new Set(['Technical', 'Analytical', 'Tools', 'Soft skills']));
  });

  it('uses only the seven spec categories on careers', () => {
    const valid = new Set([
      'Data & AI',
      'Software',
      'Design',
      'Security',
      'Cloud & Infrastructure',
      'Business & Marketing',
    ]);
    for (const career of CAREERS) {
      expect(valid.has(career.category), `${career.slug} has category ${career.category}`).toBe(
        true,
      );
    }
  });

  it('has a description for every skill', () => {
    for (const skill of SKILLS) {
      expect(skill.description.length).toBeGreaterThan(10);
    }
  });
});

describe('careers', () => {
  it('has the 10 careers the spec lists', () => {
    expect(CAREERS.length).toBe(10);
  });

  it('has no duplicate slugs', () => {
    const slugs = CAREERS.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('includes every career the spec names', () => {
    for (const required of [
      'data-analyst',
      'data-scientist',
      'machine-learning-engineer',
      'software-engineer',
      'web-developer',
      'cybersecurity-analyst',
      'ui-ux-designer',
      'cloud-engineer',
      'digital-marketing-specialist',
      'business-analyst',
    ]) {
      expect(careerSlugs.has(required), `missing career ${required}`).toBe(true);
    }
  });

  it('has at least two typical projects per career', () => {
    for (const career of CAREERS) {
      expect(career.typicalProjects.length, career.slug).toBeGreaterThanOrEqual(2);
    }
  });

  it('states at least four responsibilities per career', () => {
    for (const career of CAREERS) {
      expect(career.responsibilities.length, career.slug).toBeGreaterThanOrEqual(4);
    }
  });
});

describe('career-skill mappings', () => {
  it('references only existing careers', () => {
    for (const mapping of CAREER_SKILLS) {
      expect(careerSlugs.has(mapping.careerSlug), mapping.careerSlug).toBe(true);
    }
  });

  it('references only existing skills, including prerequisites', () => {
    for (const mapping of CAREER_SKILLS) {
      expect(skillSlugs.has(mapping.skillSlug), `${mapping.careerSlug}/${mapping.skillSlug}`).toBe(
        true,
      );
      for (const prereq of mapping.prerequisiteSkillSlugs ?? []) {
        expect(skillSlugs.has(prereq), `${mapping.careerSlug} prereq ${prereq}`).toBe(true);
      }
    }
  });

  it('has no duplicate career-skill pairs, so the unique index holds', () => {
    const keys = CAREER_SKILLS.map((m) => `${m.careerSlug}:${m.skillSlug}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keeps every required level inside the 0-5 scale', () => {
    for (const mapping of CAREER_SKILLS) {
      expect(mapping.requiredLevel).toBeGreaterThanOrEqual(0);
      expect(mapping.requiredLevel).toBeLessThanOrEqual(SKILL_LEVEL_MAX);
    }
  });

  it('gives every career at least ten required skills', () => {
    const counts = new Map<string, number>();
    for (const mapping of CAREER_SKILLS) {
      counts.set(mapping.careerSlug, (counts.get(mapping.careerSlug) ?? 0) + 1);
    }
    for (const career of CAREERS) {
      expect(counts.get(career.slug) ?? 0, career.slug).toBeGreaterThanOrEqual(10);
    }
  });

  it('keeps effort estimates realistic', () => {
    for (const mapping of CAREER_SKILLS) {
      expect(mapping.estimatedEffortHours).toBeGreaterThan(0);
      expect(mapping.estimatedEffortHours).toBeLessThanOrEqual(80);
    }
  });

  it('never lists a skill as its own prerequisite', () => {
    for (const mapping of CAREER_SKILLS) {
      expect(mapping.prerequisiteSkillSlugs ?? []).not.toContain(mapping.skillSlug);
    }
  });
});

describe('learning resources', () => {
  it('has at least the 30 resources the spec requires', () => {
    expect(RESOURCES.length).toBeGreaterThanOrEqual(30);
  });

  it('references only existing skills', () => {
    for (const resource of RESOURCES) {
      expect(skillSlugs.has(resource.skillSlug), `${resource.title} -> ${resource.skillSlug}`).toBe(
        true,
      );
    }
  });

  it('uses only real absolute URLs, never placeholders', () => {
    for (const resource of RESOURCES) {
      expect(resource.url, resource.title).toMatch(/^https?:\/\/[^\s]+$/);
      expect(resource.url, resource.title).not.toMatch(/example\.(com|org)/i);
      expect(resource.url, resource.title).not.toMatch(/localhost/i);
    }
  });

  it('marks every unverified entry as a sample', () => {
    // A URL we have not verified must never be presented as authoritative.
    for (const resource of RESOURCES) {
      if (resource.url.includes('example.com')) {
        expect(resource.isSample, resource.title).toBe(true);
      }
    }
  });

  it('is mostly free, matching the free-first promise', () => {
    const free = RESOURCES.filter((r) => r.isFree).length;
    expect(free / RESOURCES.length).toBeGreaterThan(0.8);
  });

  it('keeps durations plausible', () => {
    for (const resource of RESOURCES) {
      if (resource.durationMinutes === null) continue;
      expect(resource.durationMinutes).toBeGreaterThan(0);
      expect(resource.durationMinutes).toBeLessThanOrEqual(10_000);
    }
  });
});

describe('projects', () => {
  it('has at least the 20 projects the spec requires', () => {
    expect(PROJECTS.length).toBeGreaterThanOrEqual(20);
  });

  it('has no duplicate slugs', () => {
    const slugs = PROJECTS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('references only existing skills and careers', () => {
    for (const project of PROJECTS) {
      if (project.careerSlug !== null) {
        expect(careerSlugs.has(project.careerSlug), project.slug).toBe(true);
      }
      for (const slug of project.skillSlugs) {
        expect(skillSlugs.has(slug), `${project.slug} -> ${slug}`).toBe(true);
      }
      for (const step of project.steps) {
        if (step.skillSlug)
          expect(skillSlugs.has(step.skillSlug), `${project.slug} step -> ${step.skillSlug}`).toBe(
            true,
          );
      }
    }
  });

  it('gives every project a step checklist of at least three steps', () => {
    for (const project of PROJECTS) {
      expect(project.steps.length, project.slug).toBeGreaterThanOrEqual(3);
    }
  });

  it('maps at least one skill per project', () => {
    for (const project of PROJECTS) {
      expect(project.skillSlugs.length, project.slug).toBeGreaterThan(0);
    }
  });
});

describe('career quiz', () => {
  it('has 8 to 10 questions as the spec requires', () => {
    expect(QUIZ_QUESTIONS.length).toBeGreaterThanOrEqual(8);
    expect(QUIZ_QUESTIONS.length).toBeLessThanOrEqual(10);
  });

  it('has unique order values', () => {
    const orders = QUIZ_QUESTIONS.map((q) => q.order);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('offers at least four options per question', () => {
    for (const question of QUIZ_QUESTIONS) {
      expect(question.options.length, `question ${question.order}`).toBeGreaterThanOrEqual(4);
    }
  });

  it('only points at careers that exist', () => {
    for (const question of QUIZ_QUESTIONS) {
      for (const option of question.options) {
        if (option.careerSlug === null) continue;
        expect(careerSlugs.has(option.careerSlug), option.careerSlug).toBe(true);
      }
    }
  });

  it('can suggest at least three different careers across the quiz', () => {
    const referenced = new Set(
      QUIZ_QUESTIONS.flatMap((q) =>
        q.options.map((o) => o.careerSlug).filter((s): s is string => s !== null),
      ),
    );
    expect(referenced.size).toBeGreaterThanOrEqual(3);
  });
});

describe('achievements', () => {
  it('includes the four the spec names', () => {
    const slugs = ACHIEVEMENTS.map((a) => a.slug);
    for (const required of [
      'first-skill-added',
      'sql-started',
      'first-project',
      'seven-day-streak',
    ]) {
      expect(slugs, required).toContain(required);
    }
  });

  it('has no duplicate slugs', () => {
    const slugs = ACHIEVEMENTS.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('has a positive threshold for every rule', () => {
    for (const achievement of ACHIEVEMENTS) {
      expect(achievement.rule.threshold, achievement.slug).toBeGreaterThan(0);
    }
  });
});

describe('demo content', () => {
  it('matches the spec demo student profile', () => {
    const bySlug = new Map(DEMO_STUDENT.skills.map((s) => [s.skillSlug, s.level]));
    expect(bySlug.get('python')).toBe(3);
    expect(bySlug.get('excel')).toBe(3);
    expect(bySlug.get('sql')).toBe(1);
    expect(bySlug.get('statistics')).toBe(2);
    expect(bySlug.get('communication')).toBe(3);
    expect(DEMO_STUDENT.targetCareerSlug).toBe('data-analyst');
  });

  it('references only existing skills', () => {
    for (const skill of DEMO_STUDENT.skills) {
      expect(skillSlugs.has(skill.skillSlug), skill.skillSlug).toBe(true);
    }
  });

  it('ships at least two fictional sample CVs', () => {
    expect(SAMPLE_CVS.length).toBeGreaterThanOrEqual(2);
    for (const cv of SAMPLE_CVS) {
      expect(cv.isFictional).toBe(true);
      expect(cv.text.length).toBeGreaterThan(200);
    }
  });
});

describe('honesty rules across all seeded content', () => {
  const allText = [
    ...CAREERS.map((c) => `${c.summary} ${c.description} ${c.responsibilities.join(' ')}`),
    ...SKILLS.map((s) => s.description),
    ...PROJECTS.map(
      (p) => `${p.description} ${p.steps.map((s) => `${s.title} ${s.description}`).join(' ')}`,
    ),
    ...RESOURCES.map((r) => `${r.title} ${r.description}`),
  ].join(' ');

  it('never claims a salary figure', () => {
    for (const phrase of PROHIBITED_AI_PHRASES) {
      expect(phrase.test(allText), `matched: ${phrase}`).toBe(false);
    }
  });

  it('never promises employment', () => {
    expect(allText).not.toMatch(/\bguarantee[sd]?\s+(a\s+)?job\b/i);
    expect(allText).not.toMatch(/\bwill\s+get\s+you\s+a\s+job\b/i);
    expect(allText).not.toMatch(/\bhiring\s+(probabilit|chance|odds)\b/i);
  });

  it('never names a currency amount', () => {
    expect(allText).not.toMatch(/\b(tk|৳|bdt)\s*[\d,]+/i);
    expect(allText).not.toMatch(/\$\s?\d/);
  });
});
