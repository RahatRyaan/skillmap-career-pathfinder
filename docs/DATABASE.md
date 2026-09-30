# Database

MongoDB 7 with Mongoose 8. Twenty-seven collections across seven groups.

**MongoDB has no foreign keys.** Reference integrity is therefore enforced by
compound unique indexes, schema constraints, and service-layer checks. This
document lists every collection, its indexes, and the rules that stand in for
the constraints a relational database would give you.

---

## Design decisions

**Every owned record carries `userId`.** There is no join table and no
indirect ownership. A cascade delete is a list of `deleteMany({ userId })` calls,
which is a table you can read.

**The unique compound indexes are the integrity mechanism.** The specification
names two: a student holds a skill at most once, and a career requires a skill
at most once. Both are declared as indexes rather than enforced in application
code, because application code has races and indexes do not.

**A skill's embedding is `select: false`.** A 384-element float array on every
document would be returned by every accidental `.find()` and would dominate
query size. It is fetched deliberately.

**Audit logs have no `updatedAt`.** An audit record is immutable; a field
suggesting otherwise is misleading.

---

## Collections

### Identity

#### `users`

| Field             | Type                   | Notes                                                   |
| ----------------- | ---------------------- | ------------------------------------------------------- |
| `name`            | String                 | required, max 120                                       |
| `email`           | String                 | **unique**, lowercased                                  |
| `passwordHash`    | String                 | `select: false` — never returned by default             |
| `role`            | `'student' \| 'admin'` | indexed, defaults to `student`                          |
| `isActive`        | Boolean                | deactivated accounts are refused immediately            |
| `lastLoginAt`     | Date \| null           |                                                         |
| `refreshTokens[]` | subdocuments           | `tokenHash`, `expiresAt`, `userAgent` — `select: false` |

**Indexes:** `{ email: 1 }` unique · `{ role: 1 }` · `{ 'refreshTokens.expiresAt': 1 }` with `expireAfterSeconds: 0`

The TTL index prunes refresh tokens without a cron job. Only the SHA-256 hash of
a token is stored; the plaintext is returned once at issue.

#### `userpreferences`

`userId` (unique), `language`, `theme`, `fontScale` (0.85–1.5), `lowDataMode`,
`weeklyStudyHours` (1–80), `contentPreference`, `costPreference`,
`contentLanguage`, `analyticsOptIn`, `remindersOptIn`.

**Index:** `{ userId: 1 }` unique

#### `studentprofiles`

`userId` (unique), `university`, `department`, `academicYear`,
`educationLevel`, `graduationYear`, `interests[]`, `bio`, `targetCareerId`,
`onboarding { currentStep, completedSteps[], finished }`.

**Indexes:** `{ userId: 1 }` unique · `{ targetCareerId: 1 }`

---

### Skills

#### `skills`

`name`, `slug` (**unique**), `category` (one of four), `description`,
`aliases[]`, `embedding` (`select: false`), `embeddingModel`
(`select: false`), `isPublished`.

**Indexes:** `{ slug: 1 }` unique · `{ name: 'text', description: 'text', aliases: 'text' }` · `{ name: 1, category: 1 }` · `{ category: 1 }` · `{ isPublished: 1 }`

The text index serves the search box. The `name` field is also
`index: true` for sorting.

#### `skillaliases`

`alias` (lowercased, **unique**), `skillId`.

**Index:** `{ alias: 1 }` unique

Alias resolution is therefore an indexed lookup rather than a scan, which is
what makes `MS Excel` → `Excel` and `Postgres` → `PostgreSQL` fast.

#### `skillcategories`

`slug` (**unique**), `name`, `description`, `order`.

#### `userskills`

`userId`, `skillId`, `level` (0–5, enum), `source`, `evidence`,
`confirmedByProject`.

**Index:** `{ userId: 1, skillId: 1 }` **unique** — _the integrity rule from the specification_

`source` is one of `self_reported`, `ai_extracted`, `quiz_verified`,
`roadmap_completed`, `project_completed`. Only `ai_extracted` renders a
"review needed" badge, so a student can always see which numbers a model
proposed.

---

### Careers

#### `careers`

`name`, `slug` (**unique**), `category`, `summary`, `description`,
`responsibilities[]`, `typicalProjects[]`, `isPublished`.

**Indexes:** `{ slug: 1 }` unique · `{ name: 'text', summary: 'text', description: 'text' }` · `{ category: 1 }` · `{ isPublished: 1 }`

#### `careerskills`

`careerId`, `skillId`, `requiredLevel` (0–5), `importance`
(`high|medium|low`), `isCore`, `prerequisiteSkillIds[]`,
`estimatedEffortHours` (1–500).

**Index:** `{ careerId: 1, skillId: 1 }` **unique** — _the second integrity rule from the specification_

This is the table every alignment score is computed from. Editing a row here
changes what every student targeting that career sees, which is why it has its
own admin page and its own audit trail.

---

### CV

#### `cvdocuments`

`userId`, `storedFileName` (**`select: false`**), `originalFileName`,
`mimeType`, `sizeBytes`, `status` (`uploaded|extracted|reviewed`),
`textLength`, `extractionMode`, `extractedText` (**`select: false`**).

**Index:** `{ userId: 1 }`

`storedFileName` is randomised with `crypto.randomBytes`, and the extension
comes from the MIME allow-list rather than the uploaded filename. A crafted
filename cannot introduce a new extension or predict the on-disk name.

#### `extractedskills`

`cvDocumentId`, `userId`, `extractionId`, `type`, `rawValue`,
`normalizedSkillId`, `normalizedSkillName`, `confidence` (0–1),
`lowConfidence`, `suggestedLevel`, `context`, `decision`
(`pending|accepted|rejected|edited`).

**Indexes:** `{ cvDocumentId: 1, extractionId: 1 }` **unique** · `{ userId: 1 }` · `{ lowConfidence: 1 }`

Every extracted row is written with `decision: 'pending'`. Nothing reaches a
student's profile until the review endpoint promotes an accepted row. A test
asserts that uploading a CV does not change the skill count.

---

### Learning

#### `roadmaps`

`userId`, `careerId`, `version`, `isCurrent`, `weeklyStudyHours`,
`monthsHorizon`, `items[]`, `changeLog[]`, `generatedBy`.

`items[]` subdocuments: `order`, `month`, `week`, `type`, `title`,
`description`, `skillId`, `skillName`, `estimatedHours`, `status`,
`whyThisOrder`, `resourceIds[]`, `actualHours`, `completedAt`.

**Indexes:** `{ userId: 1, careerId: 1, version: 1 }` **unique** · `{ userId: 1, careerId: 1, isCurrent: 1 }`

The compound unique index means a version number can never be reused, and
`isCurrent` is kept to exactly one document per (user, career) by the service
layer.

#### `learningresources`

`title`, `description`, `skillId`, `level`, `type`, `durationMinutes`, `url`,
`provider`, `isFree`, `language`, `isSample`, `isPublished`.

**Indexes:** `{ title: 'text', description: 'text', provider: 'text' }` · `{ skillId: 1 }` · `{ isFree: 1 }` · `{ language: 1 }` · `{ isSample: 1 }`

`isSample: true` means the URL was not verified. The API always returns free
resources first, and the UI shows a "sample — link not verified" badge. A
content test asserts no entry points at `example.com` while claiming to be
verified.

#### `projects`

`title`, `slug` (**unique**), `description`, `careerId`, `level`,
`estimatedHours`, `skillIds[]`, `steps[]`, `isPublished`.

#### `userprojects`

`userId`, `projectId`, `status`, `completedAt`, `skillUpdates[]`.

**Index:** `{ userId: 1, projectId: 1 }` unique

#### `userprogress`

`userId`, `roadmapId`, `itemId`, `status`, `completedAt`, `note`.

**Index:** `{ userId: 1, roadmapId: 1, itemId: 1 }` unique

---

### AI and analysis

#### `aiinteractions`

`userId`, `kind`, `mode`, `model`, `inputHash`, `result` (**`select: false`**),
`tokensUsed`, `estimatedCostUsd`, `latencyMs`, `cacheHit`, `success`,
`notice`.

**Index:** `{ inputHash: 1, kind: 1, mode: 1 }` · `{ userId: 1 }` · `{ kind: 1 }`

This collection is both the audit trail ("which mode produced this answer, and
what did it cost") and the response cache.

#### `alignmentsnapshots`

`userId`, `careerId`, `percent`, `ownedSkillCount`, `requiredSkillCount`,
`gapsByLabel` (Map).

**Index:** `{ userId: 1, careerId: 1, createdAt: -1 }`

A snapshot is skipped when nothing changed, so opening a page repeatedly does
not fill the collection. Old snapshots are pruned on write rather than by a
scheduled job, so pruning only costs anything when there is something to remove.

#### `recommendations`, `jobdescriptions`

`{ userId, careerId, kind, items[], mode }` and
`{ userId, title, company, text, analysisMode, matchedCareerId }`.

---

### Engagement

`quizquestions` · `quizresponses` · `achievements` · `userachievements` ·
`studysessions` · `studygoals` · `notifications`

**Notable indexes:**

- `userachievements`: `{ userId: 1, achievementId: 1 }` unique — a badge cannot
  be awarded twice, so achievement evaluation is idempotent
- `studysessions`: `{ userId: 1, loggedOn: -1 }` — powers the weekly ring and
  the streak
- `notifications`: `{ userId: 1, readAt: 1, createdAt: -1 }`

**Achievements are data, not code.** Each has a `rule: { type, threshold }`
evaluated against real counts by `achievementService`. No component grants a
badge.

---

### System

#### `auditlogs`

`actorUserId`, `action`, `entity`, `entityId`, `outcome`, `metadata`, `ip`.

**Indexes:** `{ createdAt: -1 }` · `{ actorUserId: 1, action: 1, createdAt: -1 }`

`createdAt` only — a record is never updated.

**Redaction.** `sanitizeMetadata` strips any key matching password, token,
secret, apiKey, cvText, text, or body, and truncates long strings. An audit log
must never become a place where a secret is stored.

---

## Seeding

`npm run seed` is idempotent. Every write is keyed on a stable natural key and
upserted:

| Content               | Natural key           | Count |
| --------------------- | --------------------- | ----- |
| Skill categories      | `slug`                | 4     |
| Skills                | `slug`                | 80    |
| Skill aliases         | `alias`               | 150+  |
| Careers               | `slug`                | 10    |
| Career-skill mappings | `(careerId, skillId)` | 130   |
| Learning resources    | `(url, skillId)`      | 50+   |
| Projects              | `slug`                | 20    |
| Quiz questions        | `order`               | 10    |
| Achievements          | `slug`                | 16    |
| Admin account         | `email` + `role`      | 1     |
| Demo student          | `email`               | 1     |

Running it twice creates nothing new. A mapping that references an unknown
skill slug is a hard error, not a silent skip, so a content typo cannot ship as
a missing requirement.

`--fresh` drops the content collections first and refuses to run against a
production database.

---

## The demo student

Exactly the profile the specification describes, so the gap engine produces a
visible result on first load:

| Skill              | Level |
| ------------------ | ----- |
| Python             | 3     |
| Excel              | 3     |
| SQL                | 1     |
| Statistics         | 2     |
| Communication      | 3     |
| Data Visualization | 2     |
| Time Management    | 2     |

Target: **Data Analyst**. Alignment lands around 40% with SQL as a critical gap
and Statistics as a high-importance gap — enough to make the dashboard,
the skill map, the simulator, and the roadmap all show something real.

---

## Atlas notes

The free tier allows **five concurrent connections per cluster**. The pool is
capped at 5 when the URI is an `mongodb+srv://` string and 20 otherwise, and
operations retry with backoff because a paused free cluster takes about thirty
seconds to wake.

For the same reason, most read queries project only the fields they return. A
`find()` on `careers` with a full `alignmentsnapshots` payload would exhaust the
memory of a free instance.
