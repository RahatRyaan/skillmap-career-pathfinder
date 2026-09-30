---
name: skillmap-demo
description: SkillMap AI Demo Mode behaviour and the AI labelling rules. Load before changing any AI provider, the demo banner, or a fallback path.
---

# Demo Mode

## The invariants

1. **Deterministic.** Same input, same output. No randomness, no clock branching,
   no network.
2. **Offline.** Nothing leaves the machine. No API key.
3. **Honest.** Every response says it came from rules, not a trained model.
4. **Complete.** It implements the whole `AIProvider` interface, so a demo
   exercises the same code path as production.

Demo Mode is the shipping default and what the competition runs in. It is not a
stub and not a mock for tests.

## The banner

A permanent, non-dismissible banner appears on every page while the mode is not
`openai`. It exists to prevent a misimpression, which means it cannot be
dismissed.

## Labelling rules

| Situation                                | What the user must see                                   |
| ---------------------------------------- | -------------------------------------------------------- |
| Demo mode is active                      | The persistent banner, plus `notice` on each AI response |
| Demo mode fell back from a real provider | A notice naming the failure and the fallback             |
| A skill came from a CV                   | The `ai_extracted` source badge, with "review needed"    |
| A score is shown                         | The disclaimer, every time                               |

**A silent fallback is worse than an error.** The user cannot tell a rule-based
answer from a model-based one, and that difference is the whole point of the
product's honesty claim.

## The three modes

| Mode     | Extraction                 | Similarity       | Assistant |
| -------- | -------------------------- | ---------------- | --------- |
| `demo`   | Keyword and alias matching | Token overlap    | Templates |
| `local`  | Keyword and alias matching | Local embeddings | Templates |
| `openai` | LLM with a JSON schema     | API embeddings   | LLM       |

All three satisfy the same interface, and the mode contract test holds them to
the same shape. A change that breaks demo mode cannot ship.

## Choosing a mode

- **A public demo or deployment:** `demo`. Free, offline, deterministic, and
  it cannot fail mid-presentation.
- **Local development against a gateway on your machine:** `openai` with a
  `localhost` base URL. Note that `localhost` is unreachable from a host.
- **Production with a real public endpoint:** `openai` plus `AI_BUDGET_USD`.

`AI_MODE=openai` with no API key fails at boot, not at the first request.
