---
description: Prove every impact number is computed
---

Audit the impact dashboard with `@sm-audit`. This is the claim the project
makes most strongly, so it needs evidence.

1. For each field in `ImpactResponse`, find the aggregate that produces it. A
   field with no aggregate is a violation, not a gap to be filled later.
2. Confirm there is no constant, no default, and no catch that returns a
   plausible number. A metric that cannot be computed must be `0`, which is
   true.
3. Confirm `averageSkillImprovement` only counts students with two or more
   snapshots, so one reading cannot look like improvement.
4. Confirm `topCommonGaps` returns an empty array below the privacy threshold,
   so an individual's gaps cannot be identified from an admin page.
5. Change the underlying data and confirm the numbers move. A metric that does
   not respond to reality is a constant with extra steps.
6. Confirm the page states that every figure is computed from live records.

Report each field with the aggregate behind it, and flag anything that does not
have one.
