---
description: Pre-ship security, accessibility, and honesty gate
---

Run the release gate with `@sm-audit`. This is a **blocking** check: a single
High finding means do not ship.

Cover four areas:

**Security** — auth on every protected route · role from the database ·
ownership in the query · NoSQL injection resistance · upload type and size
limits · rate limits on login, upload, assistant · no secret in the repo · no
stack trace in a response · refresh rotation and reuse detection · CORS scope.

**Honesty** — grep the whole tree, including seed content, for salary figures,
job guarantees, and employment probabilities · no invented URL · the
disclaimer on every score · the impact dashboard computed rather than entered ·
unverified resources labelled.

**Accessibility** — labels · `aria-label` on icon buttons · focus · contrast ·
table equivalents · target size · heading structure · keyboard operability of
the whole journey.

**Performance** — per-route bundle size · charts and graph not in the landing
bundle · projections on queries.

End with **ship** or **do not ship**, and exactly what would change the answer.
