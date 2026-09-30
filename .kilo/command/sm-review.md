---
description: Adversarial review of the working tree
---

Review the uncommitted changes as a hostile reviewer, using `@code-reviewer` and
`@security-reviewer`.

For each changed file, look specifically for:

- **A number that was computed outside `packages/shared`** — the highest-value
  defect in this codebase, because the client and server will disagree
- **A business rule inside a route** that belongs in a service
- **`req.body` read after `validate()`** instead of `req.validated`
- **A route registered after a parameterised route that shadows it**
- **A role read from a token claim rather than the database**
- **A `unique: true` in application code instead of an index**
- **A swallowed error with no log and no user-visible failure**
- **An empty state that reads as an error**
- **A chart with no table equivalent**
- **A place colour carries meaning alone**
- **A seed reference to a slug that does not exist**
- **A test that would still pass if the feature were deleted**

Report findings as a numbered list with severity, file, line, impact, and fix.
Say plainly whether this is ready to merge.
