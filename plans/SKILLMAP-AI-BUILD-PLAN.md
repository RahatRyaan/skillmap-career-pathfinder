# SkillMap AI — Industry-Grade Build Plan (Agent Team Edition)

> Prepared with the Kilo planner agent. This plan is the contract between you and the build.
> Nothing gets written to disk until you confirm.

---

## 0. Answers to your first question

**Yes.** Everything you asked for — agents, skills, workflows, rules — can be built and enforced from this chat, in this workspace, using Kilo's native config surface:

| Asset | Location | Loaded by Kilo automatically |
| --- | --- | --- |
| Agents | `.kilo/agent/*.md` | Yes — `mode: primary \| subagent` |
| Commands (workflows) | `.kilo/command/*.md` | Yes — invoked as `/name` |
| Skills | `.kilo/skills/<name>/SKILL.md` | Yes — model-invoked on demand |
| Rules | `AGENTS.md` + `.kilo/rules/*.md` via `kilo.json` `instructions` | Yes — always in context |
| Project config | `kilo.json` | Yes — permissions, agents, model routing |
| Parallel work | Agent Manager worktrees | Yes — one branch per card |
| Global library already present | 68 agents, 95 commands, 292 skills (`.agents/` + `~/.config/kilo/`) | Yes — inherited, not duplicated |

**What I found in your workspace right now:**

- `/home/rahat-akanda/sssss` is empty except a `.gitignore` and an `.agents/` library dump.
- **Not a git repo.** Must be initialized first or nothing can be branched, reviewed, or merged.
- **`.gitignore` currently excludes `.kilo/`, `kilo.json`, and `.agents/`.** For a competition repo this is wrong — your harness is part of the deliverable and judges should see it. This gets fixed in Step 1.
- Node `v24.21.0`, npm `11.19.0`, npm registry reachable. Toolchain is fine.
- No `AGENTS.md` yet. No project `kilo.json` yet.

---

## 1. Spec reconciliation (read this before approving)

Your answer to my earlier question was *"Next.js + TypeScript"*. Your written specification is **MERN with React + Vite and JavaScript**. These conflict. I am **not** silently overriding your spec.

I have planned the build so the decision is isolated to Step 2, and I recommend one option:

### Decision D1 — Language

| Option | Pros | Cons |
| --- | --- | --- |
| **A. TypeScript (recommended)** | Shared Zod contracts become compile-checked end-to-end; the AI-assisted build catches wrong payload shapes at build time instead of at demo time; industry standard for judges; `.kilo/agent/typescript-reviewer.md` and `react-reviewer.md` apply out of the box | Slightly more ceremony; a small learning curve for a student team |
| B. JavaScript + JSDoc (your spec's literal wording) | Maximum readability; matches "readable for student teams" rationale | Contract drift is caught only at runtime; reviewer coverage is weaker; a real risk for a 20-step parallel build |

**Recommendation: Option A.** The stated rationale ("readable for student teams") is a 2024 concern; in 2026 a competition jury reads TypeScript as competence, and — decisively — with ~10 agents working in parallel from a shared contract, a compile-time contract check is the single highest-leverage safety net in the whole project. Every other decision in this plan is identical between A and B.

`ARCHITECTURE.md` will record this as a documented ADR either way, as your spec requires.

### Decision D2 — Everything else follows your spec

React + Vite · React Router · TanStack Query · Tailwind + Radix/shadcn · Recharts + React Flow · i18next (EN/বাংলা) · Node + Express · MongoDB + Mongoose · Zod · bcrypt + JWT · pdf-parse + mammoth + multer · OpenAI + `@xenova/transformers` + DemoProvider · helmet / cors / express-rate-limit / express-mongo-sanitize · migrate-mongo · Jest + Supertest + Vitest + RTL + Playwright · Docker Compose.

Two roles only: **student** and **admin**. Confirmed as you stated.

---

## 2. Repository shape

```
skillmap-ai/
├── AGENTS.md                     # constitution — always in context
├── kilo.json                     # permissions, model routing, skills paths
├── package.json                  # npm workspaces root
├── .kilo/
│   ├── agent/                    # 11 SkillMap-specific agents
│   ├── command/                  # 10 /sm-* workflow commands
│   ├── skills/                   # 3 project skills
│   ├── rules/                    # 10 project rule files
│   ├── setup-script.sh           # per-worktree env bootstrap
│   └── run-script.sh             # per-worktree dev servers
├── packages/
│   ├── shared/                   # Zod contracts, enums, scoring constants, i18n keys
│   ├── server/                   # Express API
│   ├── client/                   # React SPA
│   └── content/                  # seed content as typed data modules
├── docs/                         # README, ARCHITECTURE, DATABASE, API, AI_MODEL, SETUP, USER_GUIDE, DEMO_GUIDE
├── plans/                        # this plan + board state
├── tests/e2e/                    # Playwright
└── .github/workflows/            # CI
```

**Why `packages/shared`:** it is the single source of truth for every request/response shape, the 0–5 level scale, the importance enum, and the disclaimer string. Backend and frontend both import it. This is the single highest-value structural decision in the project — it is what makes 10 parallel agents safe.

---

## 3. The agent team

### 3.1 Custom agents (`.kilo/agent/`)

| Agent | Mode | Owns | Never touches |
| --- | --- | --- | --- |
| `sm-architect` | primary | Contracts, ADRs, layer boundaries, board shaping, integration | Feature code |
| `sm-backend` | subagent | `server/src/{routes,controllers,middleware}` | Scoring math, React |
| `sm-data` | subagent | `server/src/{models,repositories,seed}` | Routes, UI |
| `sm-engine` | subagent | `server/src/services/engine/*` — gap, alignment, priority, similarity credit | I/O, Express, Mongo |
| `sm-ai` | subagent | `server/src/ai/*` — providers, cache, extraction, assistant | Gap formulas (consumes them) |
| `sm-content` | subagent | `packages/content/*` — 10 careers, 50+ skills, 30+ resources, 20+ projects, quiz, demo student | Code |
| `sm-frontend` | subagent | `client/src/{pages,features,lib}` | Server, Mongoose |
| `sm-ui` | subagent | `client/src/{components,design-system,i18n}`, a11y, charts | API calls, server |
| `sm-qa` | subagent | `tests/**`, test harnesses, fixtures, MSW mocks | Feature source |
| `sm-audit` | subagent | Security + a11y + perf gate report; **may block merges** | — |
| `sm-docs` | subagent | `docs/**`, `README.md`, ADRs | Code |

### 3.2 Inherited global agents (already installed, used as-is)

`code-reviewer` · `typescript-reviewer` · `react-reviewer` · `react-build-resolver` · `database-reviewer` · `security-reviewer` · `silent-failure-hunter` · `a11y-architect` · `e2e-runner` · `performance-optimizer` · `comment-analyzer` · `type-design-analyzer` · `planner`

`sm-audit` is a **gate**, not a reviewer: no card moves to *Review* until it passes.

### 3.3 Commands (`.kilo/command/`)

| Command | Purpose |
| --- | --- |
| `/sm-board` | Print the work-item board (state, owner, branch, gate status) |
| `/sm-card` | Shape a new work item: acceptance criteria, file scope, merge gate |
| `/sm-build` | Execute one card through the full gated pipeline (TDD → review → audit) |
| `/sm-lane` | Run a whole parallel lane of independent cards in worktrees |
| `/sm-verify` | Full verification gate: lint, typecheck, unit, API, build |
| `/sm-review` | Adversarial code review against the anti-pattern catalog |
| `/sm-seed` | Regenerate seed content idempotently |
| `/sm-demo` | Demo Mode smoke test — proves offline, deterministic, labelled |
| `/sm-impact` | Audit every Impact Dashboard number back to a real DB count |
| `/sm-ship` | Phase gate: verify + audit + docs + demo, then emit release notes |

### 3.4 Project skills (`.kilo/skills/`)

- `skillmap-domain` — the scoring formulas, labels, and disclaimer as an executable contract. Any agent touching a number must load this first.
- `skillmap-api-contract` — how to add or change an endpoint without breaking a parallel agent.
- `skillmap-demo-mode` — the Demo Mode invariants and the AI-labeling rules.

### 3.5 Project rules (`.kilo/rules/` + `AGENTS.md`)

`sm-architecture` · `sm-language` · `sm-api` · `sm-data-modeling` · `sm-scoring` · `sm-ai-safety` · `sm-frontend` · `sm-testing` · `sm-security` · `sm-demo`

`AGENTS.md` is the short constitution: the pipeline chain, the hard "never" list, and the merge gate. It stays under ~150 lines so it is cheap in every context window.

---

## 4. The board — 20 work items across 7 phases

State machine: `Backlog → Ready → Running → Review → Merged`, with `Blocked` as an escape.

Each card below is a worktree branch. The plan is written so **Phases 0–1 are strictly serial** (contracts must exist before anything else is safe) and **Phase 2 onward fans out hard**.

---

### Phase 0 — Foundation (serial, must be green before anything else)

#### S1 · Repo, toolchain, and the Kilo harness
- **Owner:** `sm-architect` · **Gate:** `npm run verify` green on an empty app; harness files load in Kilo
- Initialize git (`main`), set up npm workspaces (`shared`, `server`, `client`, `content`)
- ESLint (flat config) + Prettier + `lint-staged` + husky + `commitlint`
- Strict typecheck / lint / test / build scripts at the root
- **Rewrite `.gitignore`**: stop ignoring `.kilo/`, `kilo.json`, `.agents/`. Keep ignoring `node_modules/`, `.env`, `dist/`, `uploads/`, `.kilo/worktrees/`, `.kilo/agent-manager.json`
- Create `.kilo/` tree: 11 agents, 10 commands, 3 skills, 10 rules, `AGENTS.md`, `kilo.json`
- Create `.kilo/setup-script.sh` (installs workspaces, writes per-worktree `.env` from `.env.example` with a derived worktree DB name) and `.kilo/run-script.sh` (starts server + client on worktree-derived ports)
- `git init` + first commit: `chore: harness foundation`
- **Risk:** low. **Depends on:** your Mongo string (for `.env`) and D1.

#### S2 · `packages/shared` — the contract keystone
- **Owner:** `sm-architect` + `typescript-reviewer` · **Gate:** contract tests pass; no `any`; exhaustive enum types
- Zod schemas for every request/response in your §11 API overview
- Enums: `SkillLevel 0–5`, `Importance (high=3 | med=2 | low=1)`, `SkillSource`, `GapLabel`, `AIMode`, `UserRole`, `RoadmapItemStatus`
- Scoring constants: the exact disclaimer string, thresholds, similarity cutoff `0.75`
- Shared error taxonomy: `{ error: { code, message, details? } }` with a closed set of codes
- Typed API result helpers used by TanStack Query on the client
- **This is the highest-leverage step in the plan.** Nothing merges after this without importing from here.
- **Risk:** medium — under-specifying here costs rework in 15 later steps.

#### S3 · Data layer
- **Owner:** `sm-data` + `database-reviewer` · **Gate:** index audit doc; unique compound indexes proven by tests
- All Mongoose schemas from your §10: identity, skills, careers, CV, learning, AI/analysis, engagement, system
- Enforced compound unique indexes: `(userId, skillId)`, `(careerId, skillId)`, plus unique `email`, career `slug`, skill `slug`, alias
- Text indexes for search; `migrate-mongo` scripts
- Reference-integrity helper (Mongo has no FKs) + a service-layer existence check utility
- **Risk:** medium. **Depends on:** S2.

#### S4 · Content seed
- **Owner:** `sm-content` · **Gate:** `npm run seed` idempotent (run twice, no duplicates); every resource URL verified or explicitly marked `isSample`
- 10 careers, 50+ skills + aliases, career-skill mappings with `requiredLevel`/`importance`/`isCore`/`prerequisites`/`effortHours`
- 30+ resources, 20+ projects, quiz questions, achievements, sample CVs, sample job descriptions
- Demo student targeting Data Analyst: `Python 3, Excel 3, SQL 1, Statistics 2, Communication 3` so the gap engine visibly fires
- **Risk:** medium — content volume is large; run this **in parallel with S5–S6** on its own branch.

---

### Phase 1 — Backend core (fan out — 4 independent lanes after S3/S4)

#### Lane A — Platform & identity
- **S5 · Platform layer** (`sm-backend`): config, Atlas connect w/ retry, structured logger, central error handler that never leaks stack traces, Zod validation middleware, role guard, rate limiters (strict on login/upload/assistant), upload allow-list + 5 MB cap + randomized private filenames, `/api/health`, `/api/system/ai-mode`. Gate: supertest suite + `helmet`/CORS allow-list verified.
- **S6 · Auth + profile** (`sm-backend`): register, login, refresh rotation, logout, session expiry; `studentProfile` + `userPreferences`; full account deletion incl. CV + files. Gate: auth API tests + security tests (invalid token, expired token, role escalation attempt).

#### Lane B — Catalog & CV
- **S7 · Skills + careers APIs** (`sm-backend`): catalog, search/filter, user-skills CRUD with source badges, normalization guard, career list/detail/compare. Gate: API tests.
- **S8 · CV pipeline** (`sm-backend` + `sm-ai`): upload, parse (pdf-parse/mammoth), extract → structured JSON with confidence, side-by-side review screen contract, accept/edit/reject persistence, low-confidence flags, delete, demo sample CVs. Gate: upload/security tests + a "nothing saved before confirm" test.

#### Lane C — The engine (strongest model on this step)
- **S9 · Deterministic engine** (`sm-engine`): `gapService`, `alignmentService`, `priorityService`, similarity credit (capped, category-gated). **Pure functions, zero I/O, zero Express, zero Mongo.** Every score returns its factors. Gate: exhaustive unit tests on the formulas, including the exact §4 edge cases and the `0.75` similarity threshold behaviour. Labels: Strong / Developing / Gap / Critical.
- **S10 · Roadmap generator** (`sm-engine`): month → week → topic from real gaps, paced by weekly study hours, prerequisite ordering, resources attached free-first, three views' data shape, "why this order" payload, **versioned re-plan with change log**. Gate: unit tests including "you completed SQL, so Statistics moved to Month 1".

#### Lane D — AI
- **S11 · AIService** (`sm-ai`): provider interface; `OpenAIProvider` / `LocalProvider` (@xenova/transformers embeddings) / `DemoProvider` (deterministic); `AI_MODE` switch; CV extractor, skill normalizer, cosine similarity, JD analyzer, grounded assistant with source tags and safe-response rules; **caching by input hash + cached embeddings**; automatic fallback with a visible notice; every `aiInteractions` record stores which mode produced the result. Gate: the same test suite passes in all three modes with identical shape.

#### Lane E — Aggregation & admin
- **S12 · Progress + dashboards** (`sm-backend`): progress updates, level updates, roadmap %, study sessions, weekly goal ring, streak, badges, alignment snapshots + trend, encouraging non-shaming copy. Gate: snapshot/trend tests.
- **S13 · Impact + admin APIs** (`sm-backend`): **every** impact number computed from real counts — a unit test asserts each metric is a DB aggregate, never a constant. Admin CRUD for careers, skills, mappings, resources, projects, users, job descriptions. Gate: "no invented number" test + role-protection tests.

---

### Phase 2 — Frontend (starts here, builds against the contract with MSW mocks — no backend wait)

#### S14 · Shell, design system, auth, routing
- **Owner:** `sm-ui` + `sm-frontend` · **Gate:** `npm run build` clean, a11y AA on shell
- Vite + React Router + TanStack Query + MSW mock server from `packages/shared`; Tailwind 8px grid, one accent color, Noto Sans / Noto Sans Bengali
- Sidebar desktop / bottom nav mobile; **empty · loading (skeleton) · error+retry · demo banner** on every route
- Public pages: Landing, Login, Register, Privacy Notice, **AI Info**; auth guards; role guard
- i18next EN/বাংলा; light/dark; adjustable font size; **low-data mode** (kills heavy animation + graph)
- Color never the only signal — icon + label always

#### S15 · Student core flows
- **Owner:** `sm-frontend` · **Gate:** RTL tests per flow
- Onboarding wizard with progress bar (skippable + resumable), Career Quiz, self-assessment cards
- My Skills (inline level edit, category filter, search), CV Upload + Review (two-pane, accept/edit/reject, low-confidence flags)
- Profile, Settings, full account deletion

#### S16 · Analysis surfaces
- **Owner:** `sm-ui` · **Gate:** table fallback for every chart
- Dashboard per your §5 (KPI cards, Next Best Action with Why?, skill bars, radar, mini-timeline, goal ring, streak, trend, activity feed, AI change notice, achievements strip)
- Career Explorer, Career Details, Multi-career Compare (2–3)
- Skill Gap with "Explain this score", **What-If Simulator** sliders, **Skill Map** React Flow graph (green/amber/red, click for detail + resources)

#### S17 · Learning + assistant
- **Owner:** `sm-frontend` + `sm-ui` · **Gate:** RTL + a11y
- Roadmap: Timeline / Weekly checklist / Kanban, "Why this order?" on every item, version switcher + **change log**, AI change notice
- Resources (free first), Projects (checklists), Progress & Achievements
- **Floating AI Assistant on every page** with the 4 prompt chips, grounded answers, and the three source tags

#### S18 · Admin panel
- **Owner:** `sm-frontend` · **Gate:** role-guarded E2E
- Admin Dashboard, Careers, Skills, Career-Skill Mapping, Resources, Projects, Job Descriptions, Users, **Impact Dashboard** with a visible "computed from live data" marker

---

### Phase 3 — Hardening, verification, ship

#### S19 · Test completion
- **Owner:** `sm-qa` + `e2e-runner` · **Gate:** all suites green
- Unit: gap, alignment, normalization, similarity threshold, priority order, roadmap generation
- API: auth, profile, CV, careers, roadmap, progress
- Security: invalid tokens, unauthorized + admin-route access, invalid/oversized files, malformed input, **NoSQL injection attempts**
- Frontend: Vitest + RTL on key flows
- E2E Playwright: register → add skills → upload CV → select career → gap → roadmap → progress → **adapted roadmap**

#### S20 · Audit gate
- **Owner:** `sm-audit` + `security-reviewer` + `a11y-architect` + `performance-optimizer` · **Gate:** zero High findings
- OWASP pass, NoSQL-injection pass, rate-limit pass, secret scan, CORS, helmet
- WCAG 2.2 AA: contrast, keyboard, focus, ARIA, chart table fallbacks, font size
- Perf: route-level code splitting so the React Flow graph and Recharts load lazily
- Silent-failure hunt: every swallowed error surfaced

#### S21 · Docker, CI, docs
- `docker-compose.yml`: client, server, mongo w/ named volume; healthchecks; `.env.example` complete
- GitHub Actions: lint → typecheck → test → build → Playwright
- The 8-document set from your §17, written from real code, no invented claims

#### S22 · Demo + pitch hardening
- `/sm-demo` proves: works offline, deterministic responses, permanent Demo banner, visible fallback notice, AI Info page accurate
- `/sm-impact` proves every impact number traces to a real count
- Pitch deck, 3-minute demo script, Q&A prep built on what actually shipped

---

## 5. Dependency graph

```
S1 harness
 └─► S2 contracts  ◄── THE keystone; everything imports from here
      ├─► S3 models ──► S5 platform ──► S6 auth
      │                  ├─► S7 skills+careers
      │                  ├─► S8 CV ──────────► (needs S11)
      │                  ├─► S12 progress/dashboards
      │                  └─► S13 impact+admin
      ├─► S4 content  (parallel from S3)
      ├─► S9 engine ──► S10 roadmap
      └─► S11 AI (needs S3 + S9 contracts; unblocks S8)

S2 ──► S14 shell+auth+design  (MSW mocks — NO backend dependency)
        ├─► S15 student flows
        ├─► S16 analysis (charts, graph)
        ├─► S17 learning+assistant
        └─► S18 admin

S15+S16+S17+S18 + S6..S13 ──► S19 tests ──► S20 audit ──► S21 docker/CI/docs ──► S22 demo/pitch
```

**Peak parallelism:** S3→S4, S5, S14 all run simultaneously. Then lanes A–E fan out to 5 concurrent cards, and the 4 frontend cards run in parallel with all of them.

**The critical path** is `S1 → S2 → S3 → S5 → S7 → S12 → S19 → S20 → S21 → S22`. Under-scoping S2 shortens everything.

---

## 6. Working method (how the team actually behaves)

1. **No card starts before its merge gate on the previous card is green.** Contracts, then models, then routes.
2. **One owner per card, one worktree per card, no overlapping file writes.** If two cards need the same file, that is a design bug — split the card.
3. **TDD is mandatory for `sm-engine`, `sm-data`, and all API work.** Tests first. The scoring math and the "no invented number" guarantee are the two things a competition jury will probe.
4. **Every card ships a handoff artifact** — changed files, test evidence, gate result, known gaps. Not just a green checkmark.
5. **`sm-audit` can block any merge.** High-severity security or a11y finding = card stays in `Review`.
6. **The advisor rules:** no salary figures, no employment-probability claims, no fabricated URLs or statistics, no sensitive-attribute inference. These are enforced as a rule file *and* as a test that greps responses.
7. **The disclaimer ships with every score:** *"This score represents alignment with the selected skill requirements and is not a prediction of employment."*

---

## 7. Quality bar (what "industry-level" means here, concretely)

- [ ] `tsc --noEmit` clean under `strict`, zero `any` in `packages/shared`
- [ ] ESLint clean; no `console.log` in shipped code (structured logger only)
- [ ] Unit coverage on engine ≥ 95%, overall ≥ 80%
- [ ] Every impact number is a DB aggregate, proven by test
- [ ] All three `AI_MODE` values pass the same contract test
- [ ] No stack trace ever reaches a client response
- [ ] No secret in the repo; `.env.example` complete
- [ ] WCAG 2.2 AA verified by audit, with chart table fallbacks
- [ ] Every page has empty / loading / error states
- [ ] Demo Mode fully offline and deterministic
- [ ] All 8 documents written from real code
- [ ] `git log` reads as a professional history with conventional commits

---

## 8. Risks I already see, and what I'm doing about them

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Contracts under-specified → 15 steps of rework | **High** | S2 is a hard gate with its own review; `skillmap-api-contract` skill for every later change |
| Parallel agents drift apart | **High** | One worktree per card, no shared files, `sm-audit` blocks, contract import enforced in review |
| AI mode behavior diverges across `openai`/`local`/`demo` | High | One parameterized contract test run in all three modes |
| Local embeddings model is huge / slow in Docker | High | Lazy-load; cache embeddings; make Local mode optional in the image; Demo mode is the default |
| Atlas free tier 512 MB + network latency | Medium | Index audit, projection-only queries, `alignmentSnapshots` TTL, optional local Mongo for dev |
| Content authoring volume (10/50/30/20) is a time sink | Medium | Runs as its own parallel lane; typed content modules so it reviews like code |
| React Flow + Recharts bloat the bundle | Medium | Route-level lazy loading; low-data mode swaps graph for a list |
| Scope creep into [Future] items | Medium | Tag discipline enforced in review; Future items are a separate backlog |
| `sm-ai` writes numbers | **High** | Engine owns all scoring; AI only supplies wording; test greps AI output for numeric claims |
| Demo-day network failure | Medium | `/sm-demo` offline gate; everything demo-critical works in Demo Mode |

---

## 9. What I need from you before I build

Reply to this list. I will not start until items 1–4 are answered.

### Blocking — I cannot start without these

1. **MongoDB Atlas connection string.** Format: `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/skillmap?retryWrites=true&w=majority&appName=<appname>`. I will put it in `.env` (gitignored) and put placeholders in `.env.example`. Also confirm: which cluster/database name, and is the **IP allowlist** set to allow this machine (`0.0.0.0/0` for a competition, or your current IP)? I can read your current public IP for you.

2. **D1: TypeScript or JavaScript?** My recommendation is TypeScript. Confirm or override.

3. **Git.** Do you want me to `git init` locally only, or also create a **GitHub repository** and push (needed for GitHub Actions CI in S21)? If GitHub: repo name, and is `gh` already authenticated on this machine?

4. **Repo name + branding.** Confirm `skillmap-ai` as the repo/package name, or give me yours. One accent color (I'll default to a trustworthy blue `#2563EB` if you have no preference), and confirm the product name spelling: **SkillMap AI**.

### Needed before the matching phase (not blocking Phase 0)

5. **OpenAI API key?** Optional — Demo Mode is fully functional without it. If you give one, tell me the **spend ceiling** and I'll add a hard token budget + caching. Which model do you want? (I'd default to a mid-tier model for extraction, small model for assistant wording.)
6. **Resource URLs.** 30+ learning resources need **verified public URLs**. I can research and verify them, or you can supply a list you trust. Anything I cannot verify gets clearly marked as a sample — per your spec.
7. **Bengali (বাংলা) translations.** I can generate them, but a native speaker must review before you demo. Who reviews?
8. **Admin seed credentials.** Email + password for the admin account.
9. **Team details** for the pitch and Impact narrative: how many members, and what roles?
10. **Deadline / demo date.** This changes how aggressively I parallelize and whether I cut any [MVP] item to protect the demo.

### Nice to have

11. Existing logo, brand colors, or pitch-deck template?
12. Any reference products or judges' stated criteria you want me to design against?
13. Should `.agents/` (the 292-skill library dump) be committed to the repo, or gitignored and documented as "installed via ECC"?

---

## 10. What happens after you confirm

1. I write the harness — 11 agents, 10 commands, 3 skills, 10 rules, `AGENTS.md`, `kilo.json`, worktree scripts, git init, corrected `.gitignore`.
2. I run **S1 → S2** and show you the green gate.
3. S3/S4/S5/S14 fan out in parallel worktrees.
4. I report per-phase: files changed, test evidence, gate status, and open risks.
5. You approve each phase gate. I never merge a phase you haven't seen.

**Nothing in this plan is written to disk yet.** The only file created so far is this plan.
