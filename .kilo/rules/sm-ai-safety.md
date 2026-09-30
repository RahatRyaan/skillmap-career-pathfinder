# Rule: AI safety

## Division of labour

| AI does                 | Arithmetic does          |
| ----------------------- | ------------------------ |
| Reading a CV            | The gap for a skill      |
| Normalising a name      | The alignment percentage |
| Judging similarity      | The gap label            |
| Analysing a job posting | The learning order       |
| Phrasing an answer      | Roadmap pacing           |

A provider is never asked for a number. If you find yourself adding a numeric
field to a model prompt, stop.

## Never allowed in any user-visible string

- Salary or income figures, in any currency or framing
- Job guarantees, or any phrasing implying one
- Employment or hiring probabilities
- Invented URLs, statistics, or resource claims
- Inference of age, gender, religion, caste, marital status, disability,
  nationality, or political affiliation

`PROHIBITED_AI_PHRASES` in `packages/shared/src/constants.ts` is the enforcement
list, and a test verifies each pattern against real offending phrases. **Adding
a phrase to the product means adding a pattern and a test.**

## Framing

Describe the student's recorded state: _"your profile shows…"_, _"based on the
skills you have recorded…"_. Never project an outcome.

## Fallback

When a real provider fails, fall back to demo mode **with a visible notice**.
A silently degraded answer is worse than an error, because the student cannot
tell a rule-based answer from a model-based one.

## When you add an AI feature

1. Add it to the `AIProvider` interface so all three modes must implement it.
2. Extend the mode contract test, so demo, local, and openai are held to the
   same shape.
3. If it produces a number, it does not belong in the model.
