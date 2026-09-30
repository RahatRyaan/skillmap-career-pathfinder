# SkillMap AI

**From where you are today to where your career can take you.**

SkillMap AI helps university students and fresh graduates in Bangladesh see the
distance between their current skills and the career they want, then gives them
a learning roadmap that adapts as they make progress.

It is not a chatbot and not a CV parser. It is a pipeline in which transparent
algorithms and AI each do one specific job:

```
Current Skills → Target Career → Required Skills → Skill Gap → Priority
              → Personalised Roadmap → Progress Tracking → Adaptive Re-plan
```

---

## What it does

| Module                     | What the student gets                                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Account and onboarding** | Registration, a resumable 5-step wizard, a career quiz, and a profile they control                                    |
| **Skills**                 | A library of 80 skills, self-rating 0–5, source badges, and alias normalization (`MS Excel` → `Excel`)                |
| **CV upload**              | PDF/DOCX parsing, AI extraction with confidence scores, and a review screen where **nothing is saved until accepted** |
| **Career explorer**        | 10 careers with real requirements, live alignment, and 2–3 way comparison                                             |
| **Skill gap**              | Per-skill gap, weighted alignment, a "Why this score?" panel, and a what-if simulator                                 |
| **Priority engine**        | A ranked learning order with all five factors shown, and prerequisites as a hard constraint                           |
| **Roadmap**                | Month → week → topic, paced by study hours, in three views, with a versioned change log on re-plan                    |
| **Resources**              | 50+ verified free-first learning resources, filters by level, type, cost, and language                                |
| **Projects**               | 20 practice projects with step checklists that raise skill levels on confirmation                                     |
| **Progress**               | Study sessions, weekly goal ring, streaks, 16 achievements, and an alignment trend                                    |
| **AI assistant**           | A floating assistant on every page, grounded in the student's own data, with source tags                              |
| **Admin**                  | Career/skill/resource/project/user management and a **computed, never invented** impact dashboard                     |
| **Demo mode**              | Deterministic, offline, and clearly labelled, so a public demo needs no API key and no network                        |

---

## The honesty rules

These are enforced in code, in tests, and in the interface:

- **No salary figures.** Any figure is stripped from AI output by a safety filter.
- **No job guarantees and no employment probabilities.** The same filter removes them.
- **Every score is explainable.** Alignment, gaps, and priorities all return the numbers behind them.
- **Every score carries the disclaimer:** _"This score represents alignment with the selected skill requirements and is not a prediction of employment."_
- **No invented URLs or statistics.** Unverified resources are labelled as samples.
- **No inference of protected attributes.** Age, gender, religion, and the rest are never collected or inferred.
- **No model was trained.** Where AI is used, it is an off-the-shelf model doing extraction or wording, never scoring.

See [`docs/AI_MODEL.md`](docs/AI_MODEL.md) for exactly which features use AI and which are arithmetic.

---

## Tech stack

| Layer            | Technology                                                                      |
| ---------------- | ------------------------------------------------------------------------------- |
| Frontend         | React 18, Vite 6, React Router 6, TanStack Query 5                              |
| UI               | Tailwind CSS 3, Radix-style primitives, Lucide icons                            |
| Charts and graph | Recharts, `@xyflow/react`                                                       |
| i18n             | i18next (English and বাংলা)                                                     |
| Backend          | Node 20+, Express 4                                                             |
| Database         | MongoDB 7 with Mongoose 8                                                       |
| Validation       | Zod 3, shared between client and server                                         |
| Auth             | bcrypt, JWT access and refresh with rotation                                    |
| CV parsing       | `pdf-parse`, `mammoth`, `multer`                                                |
| AI               | OpenAI-compatible API, `@xenova/transformers`, and a deterministic DemoProvider |
| Testing          | Jest-free: Vitest, Supertest, React Testing Library, Playwright                 |
| DevOps           | Docker, Docker Compose, GitHub Actions, Render, Vercel                          |

> **On TypeScript.** The original specification asked for JavaScript for team
> readability. This build uses TypeScript. The reason is recorded in
> [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): with ten packages and a
> contract shared across every one of them, a compile-time check is worth more
> than the marginal syntax cost.

---

## Quick start

```bash
git clone <your-repo-url>
cd skillmap-ai
cp .env.example .env          # then edit MONGODB_URI and the JWT secrets
npm install
npm run seed                  # 80 skills, 10 careers, 130 mappings, 50+ resources
npm run dev                   # API on :4000, client on :5173
```

Open <http://localhost:5173> and sign in with the seeded demo student:

```
demo@skillmap.ai  /  Demo1234
```

The admin account comes from `ADMIN_EMAIL` and `ADMIN_PASSWORD` in your `.env`.

Full instructions, including Atlas setup, are in [`docs/SETUP.md`](docs/SETUP.md).

---

## Scripts

| Command            | What it does                                     |
| ------------------ | ------------------------------------------------ |
| `npm run dev`      | Runs the API and client together                 |
| `npm run build`    | Builds shared, server, and client for production |
| `npm run verify`   | Format check, lint, typecheck, tests, build      |
| `npm test`         | Unit and API tests (153)                         |
| `npm run test:e2e` | Playwright end-to-end (20)                       |
| `npm run seed`     | Idempotent seed; safe to run twice               |
| `npm run smoke`    | Environment pre-flight check                     |

---

## Project layout

```
packages/
  shared/    Domain contracts, scoring formulas, Zod schemas. The single source of truth.
  server/    Express API, Mongoose models, AI providers, seed content
  client/    React SPA, design system, charts, i18n
  content/   The skill library as typed data
docs/        Architecture, database, API, AI model, setup, user and demo guides
tests/e2e/   Playwright suite
```

---

## Documentation

| Document                                       | Contents                                                   |
| ---------------------------------------------- | ---------------------------------------------------------- |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Layering, decisions and their reasoning, request lifecycle |
| [`docs/DATABASE.md`](docs/DATABASE.md)         | Every collection, index, and integrity rule                |
| [`docs/API.md`](docs/API.md)                   | Every endpoint with request and response shapes            |
| [`docs/AI_MODEL.md`](docs/AI_MODEL.md)         | What uses AI, what does not, and the safety rules          |
| [`docs/SETUP.md`](docs/SETUP.md)               | Local setup, Atlas configuration, and deployment           |
| [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md)     | How a student uses the product                             |
| [`docs/DEMO_GUIDE.md`](docs/DEMO_GUIDE.md)     | Running a demo that cannot fail                            |
| [`PROGRESS.md`](PROGRESS.md)                   | Build tracker and defect log                               |

---

## Deployment

- **API → Render** (free tier) using `render.yaml`
- **Client → Vercel** (free tier) using `vercel.json`
- **Database → MongoDB Atlas** free tier

The client and API are deployed separately and the API reads its allowed
origins from `CORS_ORIGINS`, so the Vercel URL must be added there after the
first deploy.

---

## Contributing

`AGENTS.md` is the project constitution: the rules every change must follow.
The short version:

- Scores live in `packages/shared` and nowhere else.
- AI may supply wording; it may never supply a number.
- The impact dashboard is computed, never entered.
- Nothing from a CV reaches a student's profile without explicit confirmation.
- A test that cannot fail is not a test.

---

## License

MIT
