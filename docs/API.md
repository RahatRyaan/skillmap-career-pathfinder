# API

Base URL `/api`. All bodies and responses are JSON.

Every request and response shape is a Zod schema in `packages/shared`, imported
by both the server and the client. This document describes them; the code is
authoritative, and a change to either is a change to both.

---

## Conventions

**Authentication.** `Authorization: Bearer <accessToken>` on protected routes.

**Errors** always have the same shape:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Career was not found",
    "requestId": "m1a2b3-x4y5z"
  }
}
```

`requestId` appears in the server log too, so a user-reported problem is
traceable.

| Code                              | Status | Meaning                                     |
| --------------------------------- | ------ | ------------------------------------------- |
| `BAD_REQUEST`                     | 400    | Malformed request                           |
| `VALIDATION_FAILED`               | 422    | Failed schema; `details[]` names each field |
| `UNAUTHORIZED`                    | 401    | Missing or invalid token                    |
| `TOKEN_EXPIRED`                   | 401    | Session expired, refresh required           |
| `FORBIDDEN`                       | 403    | Authenticated but not permitted             |
| `NOT_FOUND`                       | 404    | No such resource                            |
| `CONFLICT` / `DUPLICATE_RESOURCE` | 409    | Already exists, or in use                   |
| `PAYLOAD_TOO_LARGE`               | 413    | Upload over the limit                       |
| `UNSUPPORTED_MEDIA_TYPE`          | 415    | Not an accepted file type                   |
| `RATE_LIMITED`                    | 429    | Too many requests                           |
| `AI_UNAVAILABLE`                  | 503    | Provider down and fallback unavailable      |
| `DATABASE_UNAVAILABLE`            | 503    | Database unreachable                        |
| `INTERNAL_ERROR`                  | 500    | Fixed message; the cause is only in the log |

**Pagination.** `?page=1&limit=20` (limit max 100).

```json
{
  "items": [],
  "page": 1,
  "limit": 20,
  "total": 0,
  "totalPages": 1,
  "hasNext": false,
  "hasPrev": false
}
```

**Rate limits.** Login 5 per 15 min · upload 10 per hour · assistant 20 per
minute · writes 60 per minute · global 300 per minute.

---

## System

### `GET /api/health`

No auth. Returns `503` when the database is unreachable, which is what a load
balancer needs.

```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptimeSeconds": 4210,
  "database": "connected",
  "aiMode": "demo",
  "timestamp": "2026-09-30T12:00:00.000Z"
}
```

### `GET /api/system/ai-mode`

No auth. Powers the AI Info page and the settings badge.

```json
{
  "mode": "demo",
  "available": true,
  "description": "Demo Mode uses deterministic rules and templates…",
  "usesRealLlm": false,
  "usesLocalEmbeddings": false,
  "deterministic": true,
  "notice": "Demo Mode is active. AI results here are produced by rules, not by a trained model."
}
```

### `GET /api/config/public`

No auth. Non-secret client bootstrap values.

---

## Auth

### `POST /api/auth/register`

```json
{
  "name": "Ayesha Rahman",
  "email": "ayesha@example.com",
  "password": "at least 8 characters",
  "university": "University of Dhaka",
  "department": "Statistics",
  "academicYear": "Final year",
  "educationLevel": "undergraduate",
  "interests": ["data analysis"]
}
```

`201` → `{ user, accessToken, refreshToken, expiresInSeconds }`

Creates the user, their preferences, their profile, and a study goal. The
`passwordHash` is never returned. A `role` in the body is ignored, so a client
cannot register itself as an admin.

### `POST /api/auth/login`

`{ email, password }` → the same envelope.

An unknown email and a wrong password return **the same message and take
comparable time**, so the endpoint cannot be used to discover which addresses
are registered.

### `POST /api/auth/refresh`

`{ refreshToken }` → a new pair. The presented token is removed and the new one
issued in the same operation. **Reusing a rotated token revokes every session
for that user** and is logged, because reuse means a token was stolen.

### `POST /api/auth/logout` · `POST /auth/logout-all`

Revokes one token, or all of them.

### `DELETE /api/account`

Removes the account and all owned data: profile, preferences, skills, CV record
**and its file**, extracted items, roadmaps, progress, projects, sessions,
achievements, and AI records. Permanent. The token stops working immediately.

---

## Profile

| Method | Path                      | Purpose                                            |
| ------ | ------------------------- | -------------------------------------------------- |
| `GET`  | `/api/profile`            | Full profile with preferences and onboarding state |
| `PUT`  | `/api/profile`            | Update editable fields                             |
| `PUT`  | `/api/preferences`        | Language, theme, font scale, low-data, study hours |
| `PUT`  | `/api/profile/onboarding` | Wizard progress, for resuming                      |

---

## Skills

| Method   | Path                   | Purpose                                                    |
| -------- | ---------------------- | ---------------------------------------------------------- |
| `GET`    | `/api/skills`          | Public catalogue. `?search=` matches names **and aliases** |
| `GET`    | `/api/user-skills`     | The student's own skills with source badges                |
| `POST`   | `/api/user-skills`     | Add `{ skillId, level, source? }`                          |
| `PUT`    | `/api/user-skills/:id` | Change level or evidence                                   |
| `DELETE` | `/api/user-skills/:id` | Remove                                                     |

`409` if the skill is already held, which matches the unique index.

---

## Careers

| Method | Path                           | Purpose                                                      |
| ------ | ------------------------------ | ------------------------------------------------------------ |
| `GET`  | `/api/careers`                 | Public list; includes alignment when authenticated           |
| `GET`  | `/api/careers/:id`             | Full requirements, prerequisites, and the student's standing |
| `GET`  | `/api/careers/compare?ids=a,b` | 2–3 careers side by side                                     |

> **Route order matters.** `/careers/compare` is registered **before**
> `/careers/:id`. Registered the other way, `compare` is captured as an id and
> rejected — which is exactly what happened during development.

---

## Analysis

### `GET /api/skill-gap/:careerId`

```json
{
  "careerId": "…",
  "careerName": "Data Analyst",
  "alignment": {
    "percent": 39.8,
    "totalWeight": 63,
    "achieved": 25.1,
    "skillCount": 13,
    "ownedCount": 5,
    "gapsByLabel": { "strong": 1, "developing": 1, "gap": 0, "critical": 11 },
    "weightedNormalized": [
      { "skillId": "…", "weight": 3, "normalized": 0.5, "contribution": 1.5 }
    ]
  },
  "gaps": [
    {
      "skillId": "…",
      "skillName": "SQL",
      "currentLevel": 1,
      "requiredLevel": 4,
      "gap": 3,
      "label": "critical",
      "importance": "high",
      "reason": "…"
    }
  ],
  "categoryAverages": [{ "category": "Analytical", "average": 42, "count": 4 }],
  "transferableNotes": [
    { "skillId": "…", "skillName": "…", "source": "Excel", "credit": 1.2 }
  ],
  "disclaimer": "This score represents alignment with the selected skill requirements and is not a prediction of employment."
}
```

Every gap carries a `reason` in plain language, which is what the "Why?" panel
renders. Takes a snapshot for the trend chart.

### `GET /api/careers/:careerId/priorities`

Ranked order with **all five factors** and a plain-language reason per item:

```json
{
  "items": [
    {
      "rank": 1,
      "skillId": "…",
      "skillName": "SQL",
      "score": 82.4,
      "gap": 3,
      "importance": "high",
      "estimatedEffortHours": 40,
      "prerequisites": [],
      "factors": {
        "gapSize": 1,
        "importance": 1,
        "prerequisitePosition": 1,
        "inverseEffort": 0.4,
        "existingSkillRelevance": 0
      },
      "reason": "SQL is number 1 to learn because…"
    }
  ],
  "disclaimer": "…"
}
```

### `POST /api/skill-gap/simulate`

`{ careerId, changes: [{ skillId, newLevel }] }` — up to 20 changes. **Writes
nothing.**

Returns the baseline and projected percentages, each change's effect in
isolation, and the gaps and priorities as they would be. The headline number
applies all changes together; the per-change rows show each alone.

### `GET /api/skill-map/:careerId`

Nodes and edges for the graph. `low-data mode` renders the same nodes as a
list, so the information is identical either way.

### `GET /api/dashboard/trends?careerId=`

Snapshot history, oldest first. Only written when something actually changed.

### `POST /api/job-description/analyze`

`{ text, careerId? }`, 40–20,000 characters. Returns the skills detected, which
of them the student has, and a match percentage. Always carries a notice that
this is a comparison against a posting, not a hiring prediction.

---

## CV

| Method   | Path                      | Purpose                                  |
| -------- | ------------------------- | ---------------------------------------- |
| `POST`   | `/api/cv/upload`          | PDF or DOCX, 5 MB max                    |
| `GET`    | `/api/cv` · `/api/cv/:id` | Documents and their extracted items      |
| `PUT`    | `/api/cv/:id/review`      | **The only path from a CV to a profile** |
| `DELETE` | `/api/cv/:id`             | Removes the record and the file          |
| `GET`    | `/api/cv/samples`         | Fictional sample CVs                     |
| `POST`   | `/api/cv/samples/:slug`   | Loads one for demonstration              |

Upload validates the MIME type against an allow-list and stores the file under a
random name with an extension derived from the MIME type, never from the
uploaded filename.

**Review.** Every extracted item starts as `pending`. Accepting one creates or
updates a `userskill`; rejecting one does nothing. An accepted item keeps the
`ai_extracted` source so the student can see it was suggested. A test asserts
that uploading a CV does not change the student's skill count.

---

## Roadmap and progress

| Method | Path                              | Purpose                                       |
| ------ | --------------------------------- | --------------------------------------------- |
| `POST` | `/api/roadmap/generate`           | Generate or re-plan                           |
| `GET`  | `/api/roadmap`                    | Current roadmap for the target career         |
| `GET`  | `/api/roadmap/:id`                | A specific version                            |
| `GET`  | `/api/roadmap/versions?careerId=` | Version history                               |
| `GET`  | `/api/roadmap/changes?careerId=`  | What the last re-plan changed, and why        |
| `PUT`  | `/api/progress/:itemId`           | Mark an item done, optionally raising a level |
| `POST` | `/api/study-sessions`             | Log study time                                |

**Re-planning** bumps the version, retires the previous roadmap, and writes a
`changeLog` in plain language: _"You completed SQL, so Statistics moved to Month
1."_ Completed items carry forward, so re-planning never erases progress.

**Marking an item done** optionally raises the skill level — only if the student
confirms the new level. The response includes `replanSuggested` and
`replanReason` so the client can offer a re-plan with a concrete justification.

---

## Learning content

`GET /api/resources` — free first, filterable by skill, level, type, cost, and
language. `isSample: true` means the URL is unverified and the UI says so.

`GET /api/projects` · `PUT /api/user-projects/:id`

Completing a project raises skill levels **only** when
`confirmSkillUpdates: true`, and the response says how many changed.

---

## Quiz

| Method | Path                  | Purpose                                    |
| ------ | --------------------- | ------------------------------------------ |
| `GET`  | `/api/quiz/questions` | 10 questions, options without their career |
| `POST` | `/api/quiz/submit`    | Scores the answers, returns 3 suggestions  |

Deterministic: each option carries a career slug internally, and the response
withholds it so the scoring cannot be reverse-engineered. `matchPercent` is the
share of answers pointing at that career, not a probability.

---

## Assistant

### `POST /api/assistant/chat`

`{ message, conversationId?, pageContext? }` → `{ answer, sourceTags[], mode, notice, suggestedChips[] }`

The server builds the grounding context from the student's real records, so the
model cannot invent a number. Every answer carries source tags —
`From your profile`, `From career database`, `AI suggestion` — and passes
through the safety filter. Asking for a salary gets a refusal, not a figure.

---

## Admin

All admin routes require `requireAuth` **and** `requireRole('admin')`, with the
role read from the database rather than the token.

| Method         | Path                                          | Purpose                                  |
| -------------- | --------------------------------------------- | ---------------------------------------- |
| `GET`          | `/api/admin/impact`                           | Every metric, computed                   |
| `GET`          | `/api/admin/stats`                            | Platform counts                          |
| `GET`/`POST`   | `/api/admin/careers`                          | List and create                          |
| `PUT`/`DELETE` | `/api/admin/careers/:id`                      | Update and delete                        |
| `GET`/`POST`   | `/api/admin/skills`                           | Library                                  |
| `PUT`/`DELETE` | `/api/admin/skills/:id`                       | Update and delete                        |
| `GET`/`POST`   | `/api/admin/career-skills`                    | The mapping table                        |
| `DELETE`       | `/api/admin/career-skills/:careerId/:skillId` | Remove one                               |
| `GET`/`POST`   | `/api/admin/resources`                        | Resources                                |
| `PUT`/`DELETE` | `/api/admin/resources/:id`                    | Update and delete                        |
| `GET`/`POST`   | `/api/admin/projects`                         | Projects                                 |
| `PUT`/`DELETE` | `/api/admin/projects/:id`                     | Update and delete                        |
| `GET`          | `/api/admin/users`                            | Never includes hashes or tokens          |
| `PATCH`        | `/api/admin/users/:id/active`                 | Deactivate; revokes sessions immediately |
| `GET`          | `/api/admin/job-descriptions`                 | Analyses submitted                       |

**Deletions are protected by meaning, not just by role.** A career that a
student has chosen as their target cannot be deleted — the response says so and
suggests unpublishing instead. A skill still referenced by a career cannot be
deleted either. An admin cannot deactivate their own account and lock everyone
out.

### `GET /api/admin/impact`

Every field is a database aggregate. There is no constant, no estimate, and no
fallback that fabricates a value — if a count cannot be computed it is `0`,
which is a true statement about the data.

```json
{
  "studentsAssessed": 1,
  "skillGapsIdentified": 24,
  "roadmapsGenerated": 3,
  "roadmapCompletionRate": 18.4,
  "averageSkillImprovement": 6.2,
  "projectsCompleted": 1,
  "studentsReachingTarget": 0,
  "targetAlignmentPercent": 60,
  "skillGapsByLabel": {
    "strong": 1,
    "developing": 4,
    "gap": 6,
    "critical": 13
  },
  "topCommonGaps": [{ "skillId": "…", "skillName": "SQL", "studentCount": 1 }],
  "weeklyActiveStudents": 1,
  "note": "Every figure on this page is computed from live database records. Nothing here is estimated, sampled, or entered by hand."
}
```

`averageSkillImprovement` uses only students with **two or more** snapshots, so
one reading can never look like improvement. `topCommonGaps` returns an empty
array below the privacy threshold, so an individual's gaps cannot be
identified from an admin page.
