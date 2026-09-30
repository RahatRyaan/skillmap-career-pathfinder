# SkillMap AI — project constitution

This file is loaded into every agent's context. It is short on purpose.

## What this project is

A skill-gap and personalised-roadmap platform for students. Current skills →
target career → gap → priority → roadmap → progress → adaptive re-plan.

## The five rules

1. **Scores live in `packages/shared` and nowhere else.** If a number describes
   a student's position, it is computed by the shared engine. Never duplicate a
   formula, never approximate one, never let a component compute one locally.

2. **AI may supply wording. AI may never supply a number.** Alignment, gaps,
   priorities, and roadmap pacing are arithmetic. A provider is asked to read
   text or phrase an explanation, and for nothing else.

3. **The impact dashboard is computed, never entered.** Every metric is a
   database aggregate. No constants, no estimates, no fallback that fabricates
   a value. If a count cannot be computed it is `0`, which is true.

4. **Nothing from a CV reaches a profile without explicit confirmation.**
   Extraction writes `pending`. Only the review endpoint promotes a row.

5. **A test that cannot fail is not a test.** Every rule above has an assertion
   that would fail if the rule were broken.

## Hard prohibitions

- No salary figures. No job guarantees. No employment probabilities. These are
  stripped by `PROHIBITED_AI_PHRASES`.
- No invented URLs, statistics, or resource claims.
- No inference of age, gender, religion, or any protected attribute.
- No stack trace, raw exception message, or Mongo error in a response.
- No `role` or `_id` taken from a request body.
- No `console.log` in shipped code. Use the structured logger.
- No `any`. `@typescript-eslint/no-explicit-any` is an error.

## Layout

```
packages/shared   Pure contracts and scoring. No I/O. The source of truth.
packages/server   routes → services → models → MongoDB
packages/client   pages → components → lib/api
packages/content  The skill library as typed data
```

## Before you finish

```bash
npm run verify     # format, lint, typecheck, test, build
```

A change that does not pass `npm run verify` is not finished.

## Testing expectations

- `sm-engine` and anything touching a formula: tests first.
- Any endpoint: a test for the success path, the failure path, and the
  authorisation boundary.
- A bug fix: a test that fails before the fix and passes after.
- Never mock the database in an API test. The bugs worth catching here —
  an index that is not unique, a shape that differs on `lean()` — are exactly
  the ones a mock hides.

## Accessibility is not optional

Every input has a real `<label>`. Every icon-only button has `aria-label`.
Focus is visible. Every chart has a table equivalent. Colour is never the only
signal. Interactive targets are at least 44px.

## Honesty in the interface

If something was suggested by a model, say so. If a number is not measured, do
not show it. The disclaimer travels with every score.
