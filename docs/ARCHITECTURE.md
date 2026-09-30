# Architecture

This document explains how SkillMap AI is put together and, where a decision
had more than one reasonable answer, why that one was chosen.

---

## 1. The core idea

The product is a pipeline, not a feature set:

```
Current Skills → Target Career → Required Skills → Skill Gap → Priority
              → Personalised Roadmap → Progress Tracking → Adaptive Re-plan
```

Each arrow is a transformation. Keeping them separate is what makes the product
explainable: a student who asks "why is SQL first?" can be shown the gap, the
weight, the prerequisite relationship, and the effort estimate, in that order.

The single most important architectural decision follows from this: **the
scoring functions are pure, shared, and have no dependencies.** They live in
`packages/shared`, they take plain data, and they return every factor they used.
The server calls them, and the client calls the same code to draw the "Explain
this score" panel. The two can never disagree, because there is only one
implementation.

---

## 2. Layering

```
packages/shared     No I/O. Enums, constants, scoring, Zod contracts.
        ▲
        │  imports types and functions only
        │
packages/server    routes → controllers → services → repositories → MongoDB
        ▲
        │
packages/client    pages → features → components → lib/api → HTTP
```

**`packages/shared` must never import from `server` or `client`.** It is the
bottom of the graph. If it needs a new type, it defines it there and both sides
adopt it.

### Why a separate shared package

Because ten agents, or ten engineers, working in parallel on a single codebase
will drift. The failure mode is not sloppy code, it is _subtly wrong shapes_:
the client expects `level` as a number, the server sends a string; a new field
appears on one side only. A shared, compiled contract turns every one of those
into a build error at the point of change rather than a runtime 400 in
production.

---

## 3. Server internals

```
routes/       HTTP shape only: parse, authorise, delegate, respond
controllers/  (folded into routes — see below)
services/     Business logic, orchestration, transactions
repositories/ (folded into services — see below)
models/       Mongoose schemas and indexes
middleware/   auth, validation, rate limits, error translation
ai/           Provider interface, three implementations, cache, safety filter
```

**Routes are thin, and there is no separate controller layer.** A controller
that only forwards to a service is a file that must be navigated without adding
behaviour. The layering rule that earns its keep is: _a route may not contain
business logic, and a service may not touch `req` or `res`._ Everything between
the two is either worth extracting or not.

Services own the interesting behaviour:

| Service              | Responsibility                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------- |
| `analysisService`    | Loads a student's skills and a career's requirements, applies transferable credit, and calls the shared engine |
| `roadmapEngine`      | Pure: gaps and study hours become a paced plan                                                                 |
| `roadmapService`     | Persistence, versioning, and change-log writing                                                                |
| `impactService`      | Every metric, as a database aggregate                                                                          |
| `achievementService` | Evaluates rule data against real counts                                                                        |
| `snapshotService`    | Alignment history, with change detection and pruning                                                           |
| `auditService`       | Security-relevant actions, with redaction                                                                      |

---

## 4. The scoring engine

Spec §4, implemented in `packages/shared/src/scoring.ts`:

```
Gap_i         = max(0, Required_i − Current_i)
Normalized_i  = min(Current_i / Required_i, 1)
Weight_i      = ImportanceValue_i × DependencyFactor_i     (High=3, Med=2, Low=1)

Alignment (%) = Σ(Weight_i × Normalized_i) / Σ(Weight_i) × 100
```

Labels:

| Gap                                      | Label      |
| ---------------------------------------- | ---------- |
| 0                                        | Strong     |
| 1                                        | Developing |
| 2, low or medium importance              | Gap        |
| ≥3, **or** ≥2 on a high-importance skill | Critical   |

### Four decisions worth recording

**Prerequisites are a hard constraint, not a weighted term.** The obvious
implementation adds a "prerequisite position" score and sorts. That fails: a
quick, low-gap dependent skill can outscore its own prerequisite and the
student is told to learn Power BI before SQL. The engine instead runs a Kahn
topological sort that always emits the highest-scoring _currently available_
skill. Cycles in admin-authored prerequisite data are tolerated by appending
the remainder in score order, so one bad mapping cannot produce a short plan.

**Transferable credit is capped and category-gated.** Excel must not close a
gap in Statistics. A related skill may contribute at most 40% of the
requirement, and only within the same category, and only above a 0.75
similarity threshold. The cap is what stops "I know a related thing" from
becoming "I have this skill".

**The inverse-effort factor normalises against the whole required set,** not
only the skills that happen to have a gap. Effort is a property of the career,
not of the student, so including only gapped skills would make the factor
collapse to zero for a student who is doing well.

**An empty career returns 0, not NaN.** Division by zero is guarded.

---

## 5. The AI layer

One interface, three implementations, selected by `AI_MODE`:

| Mode     | Implementation                                     | Used for                              |
| -------- | -------------------------------------------------- | ------------------------------------- |
| `demo`   | `DemoProvider` — deterministic rules and templates | Offline demos, CI, the competition    |
| `local`  | Local embeddings via `@xenova/transformers`        | Free similarity without an API key    |
| `openai` | `OpenAIProvider` — any OpenAI-compatible endpoint  | Real extraction and assistant wording |

The seam exists so the three modes are genuinely interchangeable, and the
server test suite runs the same contract against all of them.

**The division of labour is the point:**

| Concern                             | Owner                                     |
| ----------------------------------- | ----------------------------------------- |
| Extracting skills from a CV         | AI                                        |
| Mapping `MS Excel` to `Excel`       | AI (alias table first, embeddings second) |
| Deciding two skills are related     | AI                                        |
| The gap for a skill                 | Arithmetic                                |
| Alignment, priority, roadmap pacing | Arithmetic                                |
| How an answer is worded             | AI                                        |

A test asserts the model is never asked for a score, and `enforceAiSafety`
strips job guarantees, salary figures, and employment probabilities from
outbound text using the patterns in `PROHIBITED_AI_PHRASES`.

**Cost control:** embeddings are cached on the skill document, responses are
cached by input hash of `(kind, mode, input)`, concurrent identical requests
collapse into one, and `AI_BUDGET_USD` caps spend per process. When a real
provider fails, `AIService` falls back to demo mode **with a visible notice** —
never silently.

---

## 6. Client architecture

**Typed endpoint wrappers.** Pages call `skillsApi.add(...)`, never
`api.post('/user-skills', ...)`. A contract change breaks in one file.

**One API client owns tokens.** A 401 triggers a single refresh, and concurrent
401s share that refresh rather than each firing their own. A 401 with _no_
session is not an expired session; it just means the endpoint is protected, and
treating it as an expiry bounced signed-out visitors off the landing page.

**Route-level lazy loading with real chunking.** Each page is 5–11 kB
gzipped. Recharts and the flow graph sit behind the routes that need them, so
the landing page never downloads them.

**Accessibility is structural, not a pass.** Every input has a real `<label>`,
focus is visible globally, `ChartFrame` guarantees a table equivalent for every
chart, and the 44px target-size rule is set once in the button primitive.

---

## 7. Recorded decisions

| Decision               | Chosen                           | Rejected              | Why                                                                                                                                                                                                       |
| ---------------------- | -------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Language**           | TypeScript                       | JavaScript + JSDoc    | The original spec asked for JS for team readability. But the contract is shared across ten packages; a compile-time check catches drift that a runtime test finds after deployment. Documented as an ADR. |
| **Framework**          | React + Vite                     | Next.js               | The spec chose Vite. Vite's build is faster and the client is a pure SPA talking to a separate API, which suits the Render + Vercel split.                                                                |
| **Auth**               | JWT with rotating refresh tokens | Sessions in a store   | Stateless API, horizontally scalable, and revocation is explicit.                                                                                                                                         |
| **AI mode default**    | `demo`                           | `openai`              | A public demo must not depend on a paid key, and demo mode is deterministic, so a demo cannot fail mid-presentation.                                                                                      |
| **Model registration** | One non-generic helper           | Generic per model     | A generic `mongoose.model<T>()` call, even with every type argument pinned, exhausts memory in `tsc` and in ESLint's type-aware linting. The document interface is applied at the boundary instead.       |
| **Validated data**     | `req.validated`                  | Overwrite `req.body`  | Express makes `req.query` a getter. Replacing it silently discards what the client actually sent, which is how a validated array became a raw string and crashed a route.                                 |
| **Role checks**        | Read from the database           | Trust the token claim | A claim is only as trustworthy as the signing secret. Reading the role from the user document makes the claim irrelevant.                                                                                 |

---

## 8. Request lifecycle

```
Client
  apiRequest(path)
    ├─ attach Authorization from tokenStore
    ├─ 401 and a session exists?
    │    └─ refreshSession()  ── one in-flight promise, shared
    │         ├─ success → retry once
    │         └─ failure → clear session, redirect to /login
    └─ error → ApiRequestError with a stable code

Server
  helmet → cors (same-origin or allow-list) → compression → body parser
  → mongo-sanitize → global rate limit
  → route
      → Zod validation  (parsed data on req.validated)
      → auth / role guard (role read from the database)
      → service
          → repository / model
          → shared scoring engine
      → response
  → error handler  (one shape, no stack traces, requestId for tracing)
```

`express-mongo-sanitize` strips `$` and `.` keys from the body, query, and
params, which is what blocks `{"email": {"$ne": null}}` from becoming a query.

---

## 9. Error handling

One shape, always:

```json
{ "error": { "code": "NOT_FOUND", "message": "…", "requestId": "…" } }
```

`requestId` appears in the client report and in the server log, so a
user-reported bug is traceable without asking the user for anything technical.

In production a 5xx never reveals its cause. Zod, Mongoose, duplicate-key, and
Multer errors are all translated into the closed code set before a response is
built. The `INTERNAL_ERROR` message the client sees is fixed text.

---

## 10. Data integrity without foreign keys

MongoDB has no referential constraints, so integrity is enforced in four
places:

1. **Compound unique indexes** — `(userId, skillId)`, `(careerId, skillId)`.
   A student cannot hold a skill twice; a career cannot require one twice.
2. **Schema-level enums and ranges** — the 0–5 level, the importance set, the
   effort bounds.
3. **Service-layer existence checks** — resolved ids, not assumed ones.
4. **Cascade deletes on account removal** — seventeen owned collections, plus
   the CV file on disk, removed in a fixed order so nothing is orphaned.

The account-deletion path is the reason the CV file is deleted _first_: a
removed record with a surviving file on disk is a leak.

---

## 11. Testing strategy

| Level                             | What it proves                                                      | Count |
| --------------------------------- | ------------------------------------------------------------------- | ----- |
| Shared unit                       | The formulas, including edge cases and cycle handling               | 41    |
| Content integrity                 | Counts, no invented URLs, no forbidden claims, no broken references | 43    |
| API (Supertest + in-memory Mongo) | Routing, auth, validation, ownership, injection resistance          | 49    |
| Client unit                       | The primitives, and the formatting helpers                          | 20    |
| E2E (Playwright)                  | The real journey, against a real server and the production build    | 20    |

The API tests run against a real MongoDB rather than mocks, because the bugs
worth catching in this project — a unique index that is not actually unique, a
`lean()` returning an unexpected shape — are exactly the ones a mock cannot
surface.

---

## 12. What would be done differently with more time

- **Admin create and edit forms.** The endpoints exist and are role-protected;
  the admin UI currently offers read and delete. The content is small enough
  that seeding covers it.
- **Rate limiting on a shared store.** The in-memory limiter is per-process, so
  multiple instances would each allow the full quota.
- **Embedding precomputation.** Skill embeddings are generated on demand. A
  batch job after seeding would remove the first-request latency.
- **Bengali review.** The translations are generated and need a native speaker
  before a demo.
