# Rule: content

Content is data, and it reviews like code.

## Where it lives

| Content            | Location                                                    | Key                           |
| ------------------ | ----------------------------------------------------------- | ----------------------------- |
| Skill library      | `packages/content/src/skills.ts`                            | `slug`                        |
| Careers, mappings  | `server/src/scripts/seedCareers.ts`                         | `slug`, `(careerId, skillId)` |
| Resources          | `server/src/scripts/seedProjects.ts` and `seedResources.ts` | `(url, skillId)`              |
| Projects           | `server/src/scripts/seedProjects.ts`                        | `slug`                        |
| Quiz, achievements | `server/src/scripts/seedEngagement.ts`                      | `order`, `slug`               |
| Demo fixtures      | `server/src/scripts/seedDemoStudent.ts`                     | —                             |

## Minimums, asserted by a test

- 50 skills (there are 80), across all four categories
- 10 careers, each with at least 10 required skills
- 30 resources (there are 50+), more than 80% free
- 20 projects, each with a step checklist
- 8–10 quiz questions, each offering at least 4 options

## Rules for resources

- **Only real, long-lived public URLs.** Never invent one.
- An unverified URL is seeded with `isSample: true` and the UI shows a badge.
- A test asserts no entry points at `example.com` while claiming to be verified.
- `isFree` is enforced in the query, not the client, because free-first is a
  product promise.

## Rules for careers

- No salary figures and no employment-probability claims. A content test
  scans every seeded string against the prohibited patterns.
- A skill is never its own prerequisite.
- Required levels stay inside 0–5, effort inside 1–500 hours.
- A mapping to an unknown skill slug is a hard seed error, not a skip.
