# AI model

What this product uses a model for, what it does with arithmetic instead, and
the rules that keep it honest.

---

## The short version

**No model was trained for this project.** Nothing was fine-tuned, and no
custom machine learning model was built. Where a model appears it is a
general-purpose model, used off the shelf, for one of two jobs: reading text,
or phrasing an explanation.

Everything a student sees as a _number_ is arithmetic.

---

## Where AI is used

| Feature                      | What the model does                                                                                                      | Mode                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| **CV extraction**            | Reads the document and lists the skills, projects, certifications, and education it mentions, with a confidence per item | openai, local (keyword), demo (keyword)                       |
| **Skill normalization**      | Maps "MS Excel" to `Excel`, "Postgres" to `PostgreSQL`, so one skill does not become two                                 | all three — alias table first, embeddings second              |
| **Skill similarity**         | Decides whether two differently-named skills are related closely enough to grant partial credit                          | openai (embeddings), local (embeddings), demo (token overlap) |
| **Job-description analysis** | Lists the skills a posting asks for, so they can be compared with the student's own                                      | openai, demo (keyword)                                        |
| **Assistant wording**        | Chooses how to phrase an explanation                                                                                     | openai, demo (templates)                                      |

In every case the model is _reading or writing_. It is never asked to produce a
score, a gap, a rank, or a recommendation order. A test asserts the model is
never prompted for a number, and the prompt templates contain no field for one.

---

## Where it is arithmetic

| Value                  | How it is computed                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------- |
| **Gap for a skill**    | `max(0, required − current)`. A subtraction.                                          |
| **Career alignment %** | `Σ(weight × normalized) ÷ Σ(weight) × 100`, where high-importance skills count triple |
| **Gap label**          | Strong / Developing / Gap / Critical, decided by the gap size and the importance      |
| **Learning order**     | Five weighted factors, then a **hard** rule that prerequisites always come first      |
| **Roadmap pacing**     | The student's weekly study hours decide how much fits in a month                      |
| **Impact metrics**     | Database aggregates. No model is involved.                                            |
| **Achievements**       | Rule data evaluated against real counts                                               |

These live in `packages/shared/src/scoring.ts`, are pure, have no
dependencies, and are called by the same code on the server and on the client.
A student checking the arithmetic by hand will get the same number the app
shows.

---

## The three modes

Selected with `AI_MODE=openai | local | demo`.

### `demo` (default)

Deterministic rules and templates. No model is called, nothing leaves the
machine, and the same input always produces the same output.

This is not a stub. It is a first-class implementation, because the
competition demo runs in it: a demo must not fail because a third-party API is
down, rate-limited, or out of credit.

### `local`

A small sentence-embedding model runs on the machine for skill similarity. No
API key, no per-request cost, and no data leaves the device. Freeform assistant
answers still use templates, because a small local model is not much better at
phrasing than a well-written one.

### `openai`

An external language model, through any OpenAI-compatible endpoint. Every call
is logged with its mode, model, token count, and estimated cost.

**Configured by** `OPENAI_BASE_URL` and `OPENAI_API_KEY`, so it works with
OpenAI, OpenRouter, Groq, a local Ollama, or any other compatible gateway.

---

## Cost control

Five mechanisms, in order of effect:

1. **No call in demo mode.** The default costs nothing.
2. **Response cache by input hash.** Keyed on `(kind, mode, sha256(input))`. The
   same CV uploaded twice extracts once.
3. **Request coalescing.** Ten concurrent identical requests share one call, not
   ten.
4. **Model choice.** Extraction uses a capable model; assistant wording uses a
   cheaper one. The numbers are separated precisely so the cheap path takes the
   high-volume work.
5. **A hard ceiling.** `AI_BUDGET_USD` caps spend per process. When reached,
   the assistant falls back to demo mode **with a visible notice** rather than
   failing.

Embeddings are cached on the skill document, so a skill is embedded once ever,
not once per request.

---

## Safety rules

### What is stripped

`PROHIBITED_AI_PHRASES` is a list of patterns matched against every outbound
string, and a test verifies each one against a corpus of real offending
phrases:

- **Job guarantees** — "guarantee you a job", "you will definitely get", "will be
  hired", "certain to be employed"
- **Salary and income claims** — any amount in taka, ৳, BDT, USD, or dollars,
  in any framing
- **Employment probabilities** — "hiring probability", "chance of being hired",
  "80% likelihood"

A match is replaced with a neutral phrase and the answer is returned with a
notice explaining that part of it was removed. The student sees that something
was withheld rather than being quietly handed a softened claim.

### What is required

When the assistant discusses alignment, the required framing is _"your profile
shows…"_ — describing the student's recorded state — never _"you will get…"_.
`SAFE_FRAMING_PHRASES` lists the approved forms and a test asserts honest
wording is not caught by the filters.

### What is refused

Out-of-scope requests get a polite redirect to skills, careers, and learning.
A request for a salary gets:

> I cannot give salary figures, because they vary by employer, location, and
> time, and any number I gave you could be misleading.

A request for a job guarantee gets:

> No one can honestly promise a job outcome, and I will not pretend otherwise.

Both are covered by the E2E suite, not just unit tests.

### What is never inferred

`PROHIBITED_INFERENCE_FIELDS` lists age, gender, religion, caste, marital
status, disability, nationality, and political affiliation. These are never
collected, never inferred from a CV or a name, and never reach a
recommendation. The CV extraction prompt states this constraint explicitly.

---

## Failure behaviour

When a real provider fails, `AIService` falls back to demo mode and returns a
notice that the user sees:

> The AI service did not respond, so SkillMap answered using Demo Mode instead.

**The fallback is never silent.** A silently degraded answer is worse than an
error, because the student cannot tell the difference between a rule-based
answer and a model-based one — and that difference is the whole point.

Failures are logged to `aiinteractions` with `success: false`, so the admin
dashboard can show how often it happens.

---

## Grounding

The assistant never receives the raw database. The server assembles a context
object from the student's real records:

```
studentName, targetCareerName, alignmentPercent,
topGaps[], topPriorities[], ownedSkills[], weeklyStudyHours, pageContext
```

Every value is a recorded fact. The model cannot see a skill the student has
not entered, and it cannot see a target career they have not chosen. This is
what makes "From your profile" an accurate label rather than a claim.

Source tags are generated from the _context the model was given_, not from
self-report:

| Tag                    | Emitted when                                                         |
| ---------------------- | -------------------------------------------------------------------- |
| `From your profile`    | The answer cites the student's recorded levels, gaps, or study hours |
| `From career database` | The answer cites a career's requirements or importance               |
| `AI suggestion`        | A general recommendation with no specific data behind it             |

---

## Configuration

```bash
AI_MODE=demo                    # default, and what a public deploy should use
AI_MODE=local                   # free on-device embeddings
AI_MODE=openai                  # real LLM

OPENAI_BASE_URL=                # blank = official OpenAI
OPENAI_API_KEY=
OPENAI_MODEL_EXTRACTION=        # capable model, low volume
OPENAI_MODEL_CHAT=              # cheaper model, high volume
AI_BUDGET_USD=0                 # 0 disables the ceiling
```

`AI_MODE=openai` with no API key fails at boot with a clear message, rather
than at the first request.

---

## The claim we make

> SkillMap AI uses AI to read documents and phrase explanations. Every number
> it shows you is arithmetic you can check, and every number is labelled as
> alignment with a skill list rather than a prediction about a job.

That claim is enforced by tests in three places: the pattern list, the provider
contract, and the E2E journey.
