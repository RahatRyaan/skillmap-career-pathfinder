# Demo guide

How to run a demo that cannot fail, and what to show in the order that
explains the product fastest.

---

## The rule

**Demo Mode is the default, and it is not a degraded mode.** It is
deterministic, offline, needs no API key, and produces the same result every
time. A live demo that depends on a third-party API is one rate-limit error away
from ending badly.

If someone asks "is this really AI?", the honest answer is on the AI Info page,
and it is more convincing than a demo would be.

---

## Before you present

### 1. Confirm the environment

```bash
curl -s http://localhost:4000/api/health
```

```json
{ "status": "ok", "database": "connected", "aiMode": "demo" }
```

`"database": "disconnected"` is the one thing that will break a demo. The
Atlas cluster may have paused — check the dashboard, resume it, wait two
minutes.

### 2. Seed

```bash
npm run seed
```

Idempotent. The demo student is:

```
demo@skillmap.ai  /  Demo1234
```

### 3. Build

```bash
npm run build
```

### 4. Rehearse the eight-minute path below, once, end to end

Rehearsal is the single highest-value thing you can do. A demo you have
already run cannot surprise you.

---

## The eight-minute demo

### 1. The promise (60 seconds)

Open the **landing page**. Read the tagline.

Point at the pipeline: skills → career → gap → priority → roadmap → progress →
re-plan.

> "It is not a chatbot. Each step does one job, and some steps are algorithms
> you can check."

### 2. What this will not do (45 seconds)

Scroll to the honesty section.

> "No salaries, because they vary. No job guarantees, because nobody can honestly
> give them. And the AI page tells you exactly which parts use a model — which
> is the opposite of most products that claim to use AI."

This is the differentiator. Spend the time.

### 3. The dashboard (90 seconds)

Sign in as the demo student.

Four KPI cards: alignment around 40%, five of thirteen skills owned, open
gaps, roadmap progress.

> "This number is alignment with a skill list. It is not a prediction about
> employment, and the disclaimer is right there."

**Next Best Action** — hover **Why?** and read the explanation aloud. This is
the single most convincing moment in the demo, because the number and its
justification are on screen together.

### 4. The skill gap (90 seconds)

**Skill Gap.** SQL is red, Statistics orange.

> "Critical means three levels away, or two on something the role says matters
> most. Every number expands into its own calculation using your own numbers."

Toggle a chart to its **table view** — accessibility that actually works.

### 5. The what-if simulator (60 seconds)

Drag SQL from 1 to 3. The projected alignment moves, and the list below shows
which skills would move up the plan.

> "It writes nothing. It is a calculator, not a prediction."

### 6. The roadmap (90 seconds)

Generate a roadmap if there is not one. Walk through the timeline.

Open **"Why this order?"** on the first item.

Switch between timeline, weekly checklist, and kanban.

> "Paced to six hours a week, which is what this student set. Prerequisites
> always come first, so nothing depends on something you have not learned yet."

### 7. Adaptivity (75 seconds)

Mark an item done. If a skill level can be raised, offer it.

Re-plan. The change log explains itself:

> "You completed SQL, so Statistics moved to Month 1. Nothing you finished was
> lost."

### 8. The assistant and the AI page (60 seconds)

Open the assistant. Ask **"What should I learn next?"**

Point at the source tag: **From your profile**.

Then ask **"How much does a Data Analyst earn?"**

> "I cannot give salary figures, because they vary by employer, location, and
> time, and any number I gave you would be misleading."

Then ask what a job guarantee gets you. The refusal is the feature.

Finish on `/ai-info`: three modes, what uses AI, what is arithmetic, and
**"No model was trained for this project."**

---

## Questions you will be asked

**"Is this actually AI or just if-statements?"**

> "Both, deliberately, and the app tells you which is which. AI reads your CV
> and phrases explanations. Every number — alignment, gap, priority order,
> roadmap pacing — is arithmetic implemented in a shared library that the
> server and the browser both call, so the score on screen and the score in
> your hand are the same number. No model was trained for this project."

**"What if I put a bad skill level in?"**

> "The plan follows your input. That is why the source of every rating is
> shown, and why CV-extracted skills are flagged for review. The tool is
> honest about what it knows and does not know."

**"How is this different from Coursera?"**

> "A course catalogue tells you what exists. This compares _your_ recorded
> skills against a specific role, ranks what to learn by five factors, and
> re-plans as you progress. It also shows the arithmetic, so you can disagree
> with it on evidence."

**"Where does the career data come from?"**

> "Curated, not scraped. Ten roles with core, required, and optional skills,
> each with a level, an importance, prerequisites, and an effort estimate.
> Admins add careers without a code change, which is the point of the admin
> panel."

**"Are the impact numbers real?"**

> "Every one is a database aggregate. There is no constant and no fallback that
> invents a value. Common-gap insights are suppressed below a group size so an
> individual's gaps cannot be identified from an admin page."

**"How do you handle low-end devices?"**

> "Low-data mode removes animations and swaps the graph for a list, with no
> information lost. Text scales to 150%. It works by keyboard and screen
> reader, and every chart has a table equivalent. This was designed for
> students on a phone with limited data."

**"Is the data secure?"**

> "Passwords are bcrypt-hashed, refresh tokens are rotated and stored hashed,
> admin routes re-read the role from the database rather than trusting the
> token, NoSQL injection is stripped, uploads are type- and size-validated and
> stored under random names outside any public folder, and rate limits are
> strict on login, upload, and the assistant. The test suite asserts each of
> these."

---

## Demo failure playbook

| What you see                | What happened                                   | Do this                                                                         |
| --------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------- |
| Health shows `disconnected` | Atlas cluster paused                            | Resume it, wait 2 minutes, retry                                                |
| Page loads, no data         | Server not seeded                               | `npm run seed`                                                                  |
| "Origin not allowed"        | Deployed client URL missing from `CORS_ORIGINS` | Add it, redeploy the API                                                        |
| First request takes ~30s    | Render free tier woke up                        | Say _"it's a free-tier cold start"_ and retry. It never happens twice in a row. |
| Everything is slow          | Client connected to a cold Atlas cluster        | Run `curl /api/health` first, before you present                                |
| Empty skill map             | Demo student has no skills                      | `npm run seed`                                                                  |
| Login fails                 | Seeded password changed                         | Check `ADMIN_PASSWORD`, or sign in as the admin                                 |

**Have this ready:** a screenshot of the dashboard. If the network dies
entirely, walk through the screenshots and keep talking. The story is the
product.

---

## Demonstrating the honest limits

This builds credibility rather than costing you anything.

> "There are no Bangla resources in the catalogue yet. The translation layer is
> ready and the interface is translated, but a native speaker needs to review
> it before we call it done."

> "The admin panel is read-and-delete right now. The endpoints for create and
> edit exist and are role-protected; the forms are the next increment. Content
> today comes from the seed."

> "Local embedding mode is written but not exercised in a demo, because it
> downloads a model on first run and we would rather not do that live."

Saying what is not finished is what makes what **is** finished believable.

---

## What to emphasise

1. **Explainability.** Every score has a "Why?". Open it.
2. **Adaptivity.** The re-plan and its change log. The roadmap is alive.
3. **Honesty.** The refusal, the disclaimer, the AI Info page, the computed
   impact numbers.
4. **Accessibility and low-data design.** Not retrofitted — a toggle that
   removes a graph without removing information.
5. **Built properly.** A shared contract package, typed end to end, 173
   automated tests including a full E2E journey, and zero type errors.

---

## The thirty-second version

> "SkillMap AI takes a student in Bangladesh, compares the skills they have
> against what a specific career actually requires, and gives them a ranked
> plan. Every score shows its working. When they finish something, the plan
> changes and explains why. AI reads their CV and phrases the answers; every
> number is arithmetic they can check. It will not quote a salary or promise a
> job, and the app says so on the front page."
