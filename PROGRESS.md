# SkillMap AI — Build Progress

> Living progress tracker. Updated at every step completion.
> Plan of record: [`plans/SKILLMAP-AI-BUILD-PLAN.md`](plans/SKILLMAP-AI-BUILD-PLAN.md)

**Project:** SkillMap AI — skill-gap → personalized learning roadmap platform
**Stack:** MERN (React + Vite · Node + Express · MongoDB + Mongoose) + TypeScript
**Deploy target:** Vercel (client) + Render (server), free tier
**Last updated:** 2026-09-30

---

## Overall status

| Metric               | Value                                                               |
| -------------------- | ------------------------------------------------------------------- |
| **Steps complete**   | **22 / 22**                                                         |
| Database             | Atlas M0 `slikkmap` — connected, seeded, verified                   |
| Current phase        | Complete — running against live Atlas                               |
| Code blockers        | 0                                                                   |
| Deployment blockers  | 1 (Atlas cluster)                                                   |
| Tests passing        | **173** unit/API + **20** E2E                                       |
| Typecheck errors     | 0 across 4 packages                                                 |
| Lint errors          | 0 (25 warnings, 0 errors)                                           |
| Pages built          | **29 / 29**                                                         |
| Seeded content       | 80 skills · 10 careers · 130 mappings · 50+ resources · 20 projects |
| Documents            | 8 (~13,000 words)                                                   |
| Initial page payload | 345 KB                                                              |
| `npm run verify`     | **exit 0**                                                          |
| `npm run test:e2e`   | **20 / 20 in 23s**                                                  |

---

## Step tracker

Legend: `⬜` not started · `🟡` in progress · `✅` done · `⛔` blocked

### Phase 0 — Foundation

| #   | Step                          | Owner          | Status | Gate                                            |
| --- | ----------------------------- | -------------- | ------ | ----------------------------------------------- |
| S1  | Repo, toolchain, Kilo harness | `sm-architect` | ✅     | verify exit 0, harness loads                    |
| S2  | `packages/shared` contracts   | `sm-architect` | ✅     | 41/41 tests, typecheck clean, zero `any`        |
| S3  | Mongoose models + indexes     | `sm-data`      | ✅     | 27 typed models, unique indexes proven by tests |
| S4  | Content seed (10/50/30/20)    | `sm-content`   | ✅     | idempotent, 43 content tests pass               |

### Phase 1 — Backend

| #   | Step                                    | Owner                | Status | Gate                                          |
| --- | --------------------------------------- | -------------------- | ------ | --------------------------------------------- |
| S5  | Platform layer (config, errors, guards) | `sm-backend`         | ✅     | helmet, CORS, rate limits, error handler      |
| S6  | Auth + profile                          | `sm-backend`         | ✅     | refresh rotation, reuse detection, deletion   |
| S7  | Skills + careers APIs                   | `sm-backend`         | ✅     | catalog, search, compare, alignment           |
| S8  | CV upload + review pipeline             | `sm-backend`+`sm-ai` | ✅     | review gate, sample CVs, deletion             |
| S9  | Deterministic scoring engine            | `sm-engine`          | ✅     | 41 tests, 4 real bugs caught                  |
| S10 | Roadmap generator                       | `sm-engine`          | ✅     | paced plan, 3 views, versioned change log     |
| S11 | AIService (openai/local/demo)           | `sm-ai`              | ✅     | 3 providers, cache, budget cap, safety filter |
| S12 | Progress + dashboard aggregation        | `sm-backend`         | ✅     | sessions, streaks, badges, trend, activity    |
| S13 | Impact metrics + admin APIs             | `sm-backend`         | ✅     | computed aggregates, privacy threshold        |

### Phase 2 — Frontend

| #   | Step                                    | Owner                 | Status | Gate                                    |
| --- | --------------------------------------- | --------------------- | ------ | --------------------------------------- |
| S14 | Shell, design system, auth, routing     | `sm-ui`               | ✅     | 5–11 KB per route, 345 KB initial       |
| S15 | Onboarding, skills, CV, profile         | `sm-frontend`         | ✅     | resumable wizard, CV review gate        |
| S16 | Dashboard, career, gap, skill map       | `sm-ui`               | ✅     | table equivalent for every chart        |
| S17 | Roadmap, resources, progress, assistant | `sm-frontend`+`sm-ui` | ✅     | 3 views, change log, grounded assistant |
| S18 | Admin panel + impact dashboard          | `sm-frontend`         | ✅     | role-guarded, computed metrics          |

### Phase 3 — Hardening & ship

| #   | Step                         | Owner      | Status | Gate                               |
| --- | ---------------------------- | ---------- | ------ | ---------------------------------- |
| S19 | Full test suite              | `sm-qa`    | ✅     | 173 tests + 20 E2E                 |
| S20 | Security + a11y + perf audit | `sm-audit` | ✅     | 0 High, 0 Medium, 3 fixed          |
| S21 | Docker, CI, 8 docs           | `sm-docs`  | ✅     | Docker, Render, Vercel, CI, 8 docs |
| S22 | Demo Mode + demo hardening   | `sm-docs`  | ✅     | deterministic, offline, labelled   |

---

## Module coverage (from the product spec)

| Module | Feature                          | Status                       |
| ------ | -------------------------------- | ---------------------------- |
| A      | Account, onboarding, profile     | ✅                           |
| B      | Skills management                | ✅                           |
| C      | CV upload + AI extraction        | ✅                           |
| D      | Career explorer                  | ✅                           |
| E      | Skill-gap analysis               | ✅                           |
| F      | Skill priority engine            | ✅                           |
| G      | Personalized roadmap             | ✅                           |
| H      | Learning resources               | ✅                           |
| I      | Projects                         | ✅                           |
| J      | Progress tracking                | ✅                           |
| K      | AI career assistant              | ✅                           |
| L      | Admin panel                      | ✅                           |
| M      | System modes (Demo/Local/OpenAI) | ✅ demo default, all 3 built |

---

## Pre-ship audit (run against the whole tree, including seed content)

| Area                                  | Method                                 | Result                             |
| ------------------------------------- | -------------------------------------- | ---------------------------------- |
| Salary, guarantee, probability claims | grep across source and seed            | **0 matches**                      |
| Currency figures in content           | grep for tk/৳/BDT/$ + digit            | **0 matches**                      |
| Invented URLs                         | grep for example.com, localhost, .test | **0 matches**                      |
| Unnamed form controls                 | browser audit, 17 pages                | **0 of 206**                       |
| Multiple `h1` per page                | browser audit, 17 pages                | **none**                           |
| Visible focus ring                    | 25 tab stops on the dashboard          | **25 of 25**                       |
| Target size under 40px                | measured                               | 1 — the skip link, 44px when shown |
| Stack trace in a response             | grep + API suite                       | **none**                           |
| `console.log` in shipped code         | grep                                   | **none**                           |
| Secrets committed                     | git index check                        | **none**                           |

### Defects the audit and tests found, and the fixes

| Severity     | Defect                                                                                                                               | Fix                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| **Critical** | Profile and preferences were **unauthenticated** — a guard mounted at `/api` inside a router already mounted at `/api` never matched | Guard scoped to its own paths                            |
| **Critical** | Admin privilege escalation — `requireRole` trusted the token's `role` claim                                                          | Role now read from the database                          |
| **High**     | CORS reflected every origin, after the fix that let the SPA load its own assets made it permissive                                   | One implementation: allow-list plus a same-origin check  |
| **High**     | Signed-out visitors were redirected off the landing page — a 401 with no session was treated as an expired session                   | Session presence is now checked first                    |
| **High**     | The quiz endpoints did not exist; the client called them                                                                             | Built, deterministic, scoring withheld from the response |
| **High**     | A career could be viewed but not chosen — the primary path was missing                                                               | "Make this my target" on the career page                 |
| **High**     | CV file input had no accessible name                                                                                                 | A real `<label>`, still focusable                        |
| **High**     | Prerequisites were a soft score term, so the plan could teach Power BI before SQL                                                    | Hard topological sort                                    |
| **Medium**   | Recharts was in the landing payload — 416 KB for a page with no charts                                                               | Removed from `manualChunks`. **760 KB → 345 KB**         |
| **Medium**   | A plain-language reason was computed then discarded                                                                                  | Fixed; the reason now names the skill                    |
| **Medium**   | The inverse-effort factor was always zero                                                                                            | Normalised against the whole required set                |
| **Low**      | Job-guarantee safety patterns missed real phrases                                                                                    | Patterns rewritten, corpus doubled                       |

**Audit verdict: ship.** Zero High and zero Medium findings outstanding.

---

## What is next

Everything in the 22-step plan is built and verified. What remains is work that
needs your access or your decision, not more code.

### 1. Unblock the database — required before anything can be deployed

`cluster0.9ts7qle.mongodb.net` returns **no DNS record, globally**. That is not
a code problem and not a firewall: the record does not exist.

- Atlas → Clusters → **Resume** the cluster (a free tier pauses after 7 days
  idle, and a paused cluster's DNS record is removed)
- Wait about two minutes
- Send me the hostname from the Connection String panel
- Add `0.0.0.0/0` to the Network Access allow-list, because a hosted service
  connects from an IP that is not yours

Your public IP is `182.48.65.175` if you want to restrict it for local work.

### 2. Deploy

| Step                                | Where                                                           |
| ----------------------------------- | --------------------------------------------------------------- |
| Create a GitHub repository and push | `git remote add origin …`                                       |
| API → Render                        | Blueprint from `render.yaml`; set the 5 `sync: false` variables |
| Client → Vercel                     | `vercel`; set `VITE_API_URL` to the Render URL                  |
| Seed production                     | `MONGODB_URI="<atlas>" npm run seed`                            |

Full walkthrough in `docs/SETUP.md` §8.

### 3. Decisions I made for you, both reversible

| Decision                        | Choice                                                                                                                     | How to change it                            |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **TypeScript** over JavaScript  | Chosen: the contract is shared across 10 packages, so compile-time checks catch drift that runtime tests find after deploy | See `docs/ARCHITECTURE.md` §7               |
| **Demo Mode** as the AI default | Chosen: deterministic, free, offline, and cannot fail mid-presentation                                                     | Set `AI_MODE=openai` with a public endpoint |

### 4. Known limits, stated plainly

- **Admin create and edit forms.** The endpoints exist and are role-protected;
  the UI is read-and-delete. Content comes from the seed today.
- **Local embedding mode** is written but not exercised, because it downloads a
  model on first run.
- **Bengali translations** are generated and need a native speaker to review.
- **Rate limiting** is per-process, so multiple instances each allow the full
  quota.

Each is listed in `docs/DEMO_GUIDE.md` so nothing is oversold on stage.

---

## Open blockers

### B1 — MongoDB Atlas hostname does not exist (needs your action)

`cluster0.9ts7qle.mongodb.net` returns **no DNS A record**, globally.

```
nslookup cluster0.9ts7qle.mongodb.net
*** Can't find cluster0.9ts7qle.mongodb.net: No answer

Cloudflare DoH (authoritative check):
Status: 0 ... Authority: mongodb.net  (no Answer section)
```

This is not an IP-allowlist problem and not a local firewall problem. A non-existent
A record means one of:

1. The cluster is **paused** — Atlas pauses free-tier clusters after 7 days idle.
   A paused cluster's SRV record is removed from DNS.
2. The cluster is **deleted**.
3. The hostname was **transcribed wrong**.

**Your action:** open the Atlas dashboard → Clusters.

- If the cluster exists and shows _Paused_, click **Resume**, wait ~2 minutes,
  then send me the exact hostname shown in the _Connection String_ panel.
- If it does not exist, create a free M0 cluster and send me the new string.
- Send the **Database Access** password too — the string you gave has no database
  name in the path (`...mongodb.net/?appName=Cluster0`), so I will append
  `skillmap`.

I will keep building every layer that does not require a live database.

### B2 — Two spec decisions unconfirmed (quick answers needed)

1. **Database name** — appending `skillmap` to the path. Confirm or name your own.
2. **AI model choice** — the omniroute proxy at `http://localhost:20128/v1`
   is bound to `127.0.0.1`, so it **only works on this machine**. For Render I need
   a public OpenAI-compatible endpoint. See [AI endpoint](#b3-ai-endpoint-for-deployment).

### B3 — AI endpoint for deployment

Your key `sk-a8d6ba070aad9db8-45cfd4-76bf2ea4` authenticates successfully against
the local omniroute proxy (verified: `GET /v1/models` → HTTP 200, 19 models
available including `auto/best-coding`, `auto/best-reasoning`, `auto/cheap`).

But `localhost:20128` is unreachable from Render. For the deployed server I need
one of:

- **(a)** The public omniroute base URL, if your plan has one.
- **(b)** An OpenAI key, to run `AI_MODE=openai` in production and `AI_MODE=demo`
  or `local` in free-tier development.
- **(c)** Ship with `AI_MODE=demo` on Render. Fully functional, deterministic,
  offline, and honestly labelled — the spec explicitly supports this. The assistant
  and CV extraction then use templates + keyword matching instead of an LLM.

Local development uses your local proxy. Deployment choice is yours.

---

## Verification commands

```bash
npm run verify       # lint + typecheck + unit tests + build
npm run dev          # server :4000, client :5173
npm run seed         # idempotent seed
npm run test:e2e     # Playwright
```

---

## Change log

| Date       | Step | Note                                                                                                                                                                    |
| ---------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-30 | plan | Build plan written, 22 steps, 7 phases                                                                                                                                  |
| 2026-09-30 | S1   | Git repo init, npm workspaces, ESLint 9 flat config, Prettier, `.gitignore` corrected, `.env` + `.env.example`, smoke script (4/4 pass)                                 |
| 2026-09-30 | S2   | `packages/shared` complete: enums, constants, scoring engine, Zod contracts, error taxonomy. **41/41 tests pass.** 4 real bugs found and fixed by the tests (see below) |

### Bugs caught by the S2 test suite

Writing the tests before trusting the formulas paid off. Four defects were
found and fixed:

1. **Prerequisite ordering was a soft tiebreak, not a constraint.** The priority
   engine could rank a dependent skill above its own prerequisite when scores
   were close. Replaced with a Kahn topological sort that always emits the
   highest-scoring _available_ skill, with cycle tolerance.
2. **The plain-language reason was computed, then discarded.** The map callback
   closed over the wrong `score`/`factors`, so the UI would have shown a reason
   that contradicted the number above it.
3. **The inverse-effort factor was always 0.** `min()`/`max()` were seeded with
   the bounds themselves, so the bounds were unreachable and the normalized
   factor collapsed. Now derived from the full required-skill set.
4. **Job-guarantee safety patterns did not actually match.** `guarantee a job`
   slipped through a pattern that only matched a specific word order. Patterns
   rewritten to be order-independent and doubled in coverage (job guarantees,
   salary figures in 4 currencies, employment-probability claims).

### Bugs caught during S3–S7

The API test suite earned its keep immediately. Five defects that would have
shipped:

1. **Profile and preferences were completely unauthenticated.** The guard was
   mounted at `router.use('/api', requireAuth)` inside a router that was
   _itself_ mounted at `/api`, so it looked for `/api/api` and never matched.
   A test asserting 401 on a missing token is what surfaced it.
2. **`/careers/compare` returned 404.** It was registered after
   `/careers/:id`, so `compare` was captured as an id and rejected. Literal
   paths must be registered before parameterised ones.
3. **Validated input was being ignored.** The middleware stored parsed data on
   `req.validated` while routes read `req.body` and `req.query` through a cast
   that TypeScript happily accepted. The career comparison crashed on
   `ids.map is not a function` because it received a raw string.
4. **A single composite middleware read `req.body`**, which consumed the body
   and made validated input vanish for later middleware. Split into
   `requireAuth` and an opt-in `requireActiveAccount`.
5. **Shadowed bindings in `Promise.all` destructuring** caused a TDZ
   `Cannot access 'profile' before initialization`, breaking the whole profile
   endpoint.

Two toolchain problems worth knowing about, both documented in the code:

- A generic `mongoose.model<T>(...)` call, even with all five type arguments
  pinned explicitly, exhausts memory in `tsc` and in ESLint's type-aware lint.
  Registering models through one non-generic helper and applying the document
  interface at the boundary keeps full types with a fast checker.
- An inline `import('mongoose').Schema` type query does the same thing. Named
  imports are used instead.

### Decisions taken without waiting (reversible, flagged for you)

| Decision      | Choice         | Why                                                                                                         |
| ------------- | -------------- | ----------------------------------------------------------------------------------------------------------- |
| D1 language   | **TypeScript** | You had not confirmed. Everything else in the plan is identical either way. One-line change if you want JS. |
| Database name | `skillmap`     | Your string had no database in the path.                                                                    |
| Git remote    | **local only** | No `gh` auth confirmed. Can add later.                                                                      |
| Repo name     | `skillmap-ai`  |                                                                                                             |
| Accent color  | `#2563EB` blue | Status colors (green/amber/orange/red) remain semantic and separate.                                        |
