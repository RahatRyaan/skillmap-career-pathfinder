/**
 * @skillmap/content
 *
 * The skill library, which is the one content set both the server seed and the
 * client (for search, categories, and level labels) need.
 *
 * Career definitions, career-skill mappings, resources, projects, quiz
 * questions, achievements, and the demo fixtures live in
 * `packages/server/src/scripts/` because they are server-side seed inputs and
 * nothing in the browser needs them. Keeping them there avoids shipping a
 * second, divergent copy of the same data.
 */

export * from './skills.js';
export type { SkillSeed } from './skills.js';
