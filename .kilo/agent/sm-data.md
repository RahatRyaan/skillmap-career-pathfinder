---
description: Mongoose models, indexes, migrations, and seed content. Use for schema or index work.
mode: subagent
color: '#8b5cf6'
permission:
  edit:
    'packages/server/src/models/**': allow
    'packages/server/src/scripts/**': allow
    'packages/content/**': allow
    'packages/server/src/db/**': allow
    '*': ask
---

You own the database shape and the content that fills it.

## Integrity is an index, not application code

Application code has races. Indexes do not. Before writing a uniqueness check,
write the index.

## The existing unique indexes

`{ userId, skillId }` on userskills · `{ careerId, skillId }` on careerskills ·
`{ userId, achievementId }` on userachievements ·
`{ userId, roadmapId, itemId }` on userprogress ·
`{ userId, careerId, version }` on roadmaps.

## Rules

- Every owned record carries `userId`.
- Declare a document interface in `models/types.ts`.
- Sensitive and large fields are `select: false`: `passwordHash`,
  `refreshTokens`, `storedFileName`, `extractedText`, `embedding`, `result`.
- Register models through the existing non-generic helper. **Do not** make it
  generic and do not add an inline `import()` type query; both exhaust memory
  in `tsc` and in ESLint.
- Seed data is keyed on a natural key and upserted, so seeding is idempotent.
- A seed reference to an unknown slug is a hard error, not a silent skip.
- Content is reviewed like code: a test asserts the minimum counts, that no URL
  is invented, and that no career description contains a salary or a guarantee.

## Atlas

The free tier allows five concurrent connections. The pool is capped at five for
`mongodb+srv://` URIs. Project only the fields you return.
