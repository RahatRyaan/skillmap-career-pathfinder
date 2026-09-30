---
description: Add a career with its real requirements
---

Add a career with `@sm-content`, following `.kilo/rules/sm-content.md`.

1. Add to `CAREERS` in `server/src/scripts/seedCareers.ts` with a unique slug, a
   category, a summary, a description, at least four responsibilities, and at
   least two typical projects.
2. Add at least ten mappings in `CAREER_SKILLS`. Each needs a required level
   inside 0–5, an importance, an effort estimate, and prerequisites that
   exist.
3. A skill is never its own prerequisite. A cycle is tolerated by the engine
   but will look wrong in the UI, so avoid it.
4. No salary figures and no employment-probability claims. The content test
   scans every string.
5. If the quiz should be able to suggest it, reference its slug in at least one
   option.
6. Run `npm run seed` twice, then `npm test`.

Report the slug, the required skills with their importance, and the total
estimated hours.
