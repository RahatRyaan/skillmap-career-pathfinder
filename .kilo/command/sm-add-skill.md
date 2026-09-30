---
description: Add a skill to the library correctly
---

Add a skill with `@sm-content`, following `.kilo/rules/sm-content.md`.

1. Add to `packages/content/src/skills.ts` with a unique `slug`, a category,
   a description, and real aliases. Aliases are how `MS Excel` becomes `Excel`,
   so include the abbreviations people actually type.
2. If a career should require it, add a mapping in
   `server/src/scripts/seedCareers.ts` with a required level, an importance, an
   effort estimate, and prerequisites that exist.
3. Add resources only if you can verify the URL. Otherwise skip, or mark it
   `isSample: true`.
4. Run `npm run seed` twice and confirm nothing duplicates.
5. Run `npm test`. The content tests assert the minimum counts and that no
   reference is broken.

Report the slug, the category, the aliases, and which careers now require it.
