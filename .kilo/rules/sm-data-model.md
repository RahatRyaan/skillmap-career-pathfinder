# Rule: data modelling

MongoDB has no foreign keys, so integrity is enforced deliberately.

## The unique indexes are the integrity mechanism

| Index                                                             | Prevents                            |
| ----------------------------------------------------------------- | ----------------------------------- |
| `{ userId: 1, skillId: 1 }` unique on `userskills`                | A student holding a skill twice     |
| `{ careerId: 1, skillId: 1 }` unique on `careerskills`            | A career requiring a skill twice    |
| `{ userId: 1, achievementId: 1 }` unique on `userachievements`    | A badge awarded twice               |
| `{ userId: 1, roadmapId: 1, itemId: 1 }` unique on `userprogress` | Progress recorded twice             |
| `{ userId: 1, careerId: 1, version: 1 }` unique on `roadmaps`     | A version number reused             |
| `{ userId: 1, careerId: 1, isCurrent: 1 }`                        | Two current roadmaps for one career |

Declare integrity as an index, not as application code. Application code has
races; indexes do not.

## Conventions

- Every owned record carries `userId`. Cascade deletion is a readable list.
- A document interface in `models/types.ts`. `lean()` returns a real shape.
- Sensitive or large fields are `select: false`: `passwordHash`,
  `refreshTokens`, `storedFileName`, `extractedText`, `embedding`, `result`.
- Enums are declared, not free strings.
- Seed data is keyed on a natural key and upserted, so seeding is idempotent.
- A seed reference to an unknown slug is a **hard error**, not a skip.

## Deletion

Removing an account removes seventeen owned collections and the CV file. The
file goes first: a removed record with a surviving file is a leak.
