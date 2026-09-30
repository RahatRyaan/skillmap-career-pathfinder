---
description: Shape a work item before anyone starts
---

Turn a request into a card another agent can execute cold.

Produce:

- **Goal** — one sentence, in user terms
- **Acceptance criteria** — testable statements, each of which would fail if the
  work were wrong
- **File scope** — the exact files this card owns. If another card needs the
  same file, the card is wrong: split it.
- **Forbidden areas** — what this card must not touch
- **Merge gate** — the command that must pass
- **Risks** — what could go wrong, and the early signal

Rules:

1. A card that touches `packages/shared` changes every other package. Say so,
   and get the schema change sequenced first.
2. A card that needs two agents writing the same file is two cards, or a
   refactor first.
3. Acceptance criteria that cannot fail are not criteria.
4. If the card cannot be verified, say so before anyone starts.
