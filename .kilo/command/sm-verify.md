---
description: Full verification gate
---

Run the complete gate and report exactly what failed.

```bash
npm run verify
```

That runs, in order: Prettier check, ESLint, typecheck across all four
packages, unit and API tests, and the production build.

Then report:

1. The result of each stage, separately. A failure in lint and a failure in
   tests are different problems.
2. For each failure, the file, the line, and what the rule is protecting.
3. The fix, if it is unambiguous. Otherwise say so rather than guessing.

Do not skip a stage that fails. Do not report success for a stage you did not
run. If a stage cannot run, say which and why.
