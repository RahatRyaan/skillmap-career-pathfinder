---
description: Ship gate
---

Run everything, in this order, and stop at the first failure.

```bash
npm run verify          # format, lint, typecheck, test, build
npm run test:e2e        # 20 Playwright tests
npm run smoke           # environment pre-flight
```

Then:

1. Confirm `.env` is not tracked: `git ls-files --error-unmatch .env` must fail.
2. Confirm the build output contains no `.env`, no key, and no connection
   string.
3. Run the `sm-audit` gate. One High finding blocks.
4. List the env vars the deployment needs, and their values' source, without
   printing any value.
5. Print the deployment checklist from `docs/SETUP.md`.

Report a single verdict: **ship** or **do not ship**, and exactly what would
change the answer. Do not merge or deploy.
