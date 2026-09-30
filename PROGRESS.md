# SkillMap AI — Build Progress

> Living progress tracker. Updated at every step completion.
> Plan of record: [`plans/SKILLMAP-AI-BUILD-PLAN.md`](plans/SKILLMAP-AI-BUILD-PLAN.md)

**Project:** SkillMap AI — skill-gap → personalized learning roadmap platform
**Stack:** MERN (React + Vite · Node + Express · MongoDB + Mongoose) + TypeScript
**Deploy target:** Vercel (client) + Render (server), free tier
**Last updated:** 2026-09-30

---

## Overall status

| Metric          | Value                                   |
| --------------- | --------------------------------------- |
| Steps complete  | 1.5 / 22 (S1 + S2 done)                 |
| Current phase   | Phase 0 → Phase 1 transition            |
| Blocking issues | 3 (see [Open Blockers](#open-blockers)) |
| Backend tests   | not started                             |
| Frontend routes | 0 / 33                                  |

---

## Step tracker

Legend: `⬜` not started · `🟡` in progress · `✅` done · `⛔` blocked

### Phase 0 — Foundation

| #   | Step                          | Owner          | Status | Gate                                            |
| --- | ----------------------------- | -------------- | ------ | ----------------------------------------------- |
| S1  | Repo, toolchain, Kilo harness | `sm-architect` | 🟡     | verify green on empty app                       |
| S2  | `packages/shared` contracts   | `sm-architect` | ✅     | 41/41 tests, typecheck clean, zero `any`        |
| S3  | Mongoose models + indexes     | `sm-data`      | ⬜     | index audit doc, unique indexes proven          |
| S4  | Content seed (10/50/30/20)    | `sm-content`   | ⬜     | seed idempotent, URLs verified or marked sample |

### Phase 1 — Backend

| #   | Step                                    | Owner                | Status | Gate                              |
| --- | --------------------------------------- | -------------------- | ------ | --------------------------------- |
| S5  | Platform layer (config, errors, guards) | `sm-backend`         | ⬜     | supertest suite green             |
| S6  | Auth + profile                          | `sm-backend`         | ⬜     | auth + security tests green       |
| S7  | Skills + careers APIs                   | `sm-backend`         | ⬜     | API tests green                   |
| S8  | CV upload + review pipeline             | `sm-backend`+`sm-ai` | ⬜     | nothing-saved-before-confirm test |
| S9  | Deterministic scoring engine            | `sm-engine`          | ⬜     | formula unit tests ≥95% coverage  |
| S10 | Roadmap generator                       | `sm-engine`          | ⬜     | re-plan change-log test           |
| S11 | AIService (openai/local/demo)           | `sm-ai`              | ⬜     | same contract test in all 3 modes |
| S12 | Progress + dashboard aggregation        | `sm-backend`         | ⬜     | snapshot/trend tests              |
| S13 | Impact metrics + admin APIs             | `sm-backend`         | ⬜     | "no invented number" test         |

### Phase 2 — Frontend

| #   | Step                                    | Owner                 | Status | Gate                           |
| --- | --------------------------------------- | --------------------- | ------ | ------------------------------ |
| S14 | Shell, design system, auth, routing     | `sm-ui`               | ⬜     | build clean, shell a11y AA     |
| S15 | Onboarding, skills, CV, profile         | `sm-frontend`         | ⬜     | RTL tests per flow             |
| S16 | Dashboard, career, gap, skill map       | `sm-ui`               | ⬜     | table fallback for every chart |
| S17 | Roadmap, resources, progress, assistant | `sm-frontend`+`sm-ui` | ⬜     | RTL + a11y                     |
| S18 | Admin panel + impact dashboard          | `sm-frontend`         | ⬜     | role-guarded E2E               |

### Phase 3 — Hardening & ship

| #   | Step                         | Owner      | Status | Gate                     |
| --- | ---------------------------- | ---------- | ------ | ------------------------ |
| S19 | Full test suite              | `sm-qa`    | ⬜     | all suites green         |
| S20 | Security + a11y + perf audit | `sm-audit` | ⬜     | zero High findings       |
| S21 | Docker, CI, 8 docs           | `sm-docs`  | ⬜     | docs match real code     |
| S22 | Demo Mode + pitch hardening  | `sm-docs`  | ⬜     | offline demo gate passes |

---

## Module coverage (from the product spec)

| Module | Feature                          | Status     |
| ------ | -------------------------------- | ---------- |
| A      | Account, onboarding, profile     | ⬜         |
| B      | Skills management                | ⬜         |
| C      | CV upload + AI extraction        | ⬜         |
| D      | Career explorer                  | ⬜         |
| E      | Skill-gap analysis               | ⬜         |
| F      | Skill priority engine            | ⬜         |
| G      | Personalized roadmap             | ⬜         |
| H      | Learning resources               | ⬜         |
| I      | Projects                         | ⬜         |
| J      | Progress tracking                | ⬜         |
| K      | AI career assistant              | ⬜         |
| L      | Admin panel                      | ⬜         |
| M      | System modes (Demo/Local/OpenAI) | 🟡 planned |

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

### Decisions taken without waiting (reversible, flagged for you)

| Decision      | Choice         | Why                                                                                                         |
| ------------- | -------------- | ----------------------------------------------------------------------------------------------------------- |
| D1 language   | **TypeScript** | You had not confirmed. Everything else in the plan is identical either way. One-line change if you want JS. |
| Database name | `skillmap`     | Your string had no database in the path.                                                                    |
| Git remote    | **local only** | No `gh` auth confirmed. Can add later.                                                                      |
| Repo name     | `skillmap-ai`  |                                                                                                             |
| Accent color  | `#2563EB` blue | Status colors (green/amber/orange/red) remain semantic and separate.                                        |
