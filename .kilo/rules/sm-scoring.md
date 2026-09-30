# Rule: scoring

Scores are computed in `packages/shared/src/scoring.ts`, which is pure, has no
dependencies, and is called by both the server and the client. That is what
guarantees the number on screen equals the number in the student's hand.

## The formulas

```
Gap_i         = max(0, Required_i − Current_i)
Normalized_i  = min(Current_i / Required_i, 1)
Weight_i      = ImportanceValue_i × DependencyFactor_i      (High=3, Med=2, Low=1)
Alignment (%) = Σ(Weight_i × Normalized_i) / Σ(Weight_i) × 100
```

Labels: gap 0 → strong · gap 1 → developing · gap 2 → gap ·
gap ≥ 3 → critical · **gap ≥ 2 on a high-importance skill → critical**.

## Invariants

- **Prerequisites are a hard constraint.** The engine runs a topological sort
  that always emits the highest-scoring currently-available skill. A dependent
  skill is never ranked above its own prerequisite, whatever the scores say.
- **Cycles are tolerated.** A bad admin mapping produces a full plan in score
  order, not a short one.
- **Transferable credit is capped at 40% of the requirement** and only applies
  within a category, above a 0.75 similarity threshold. A related skill can
  help; it can never close a gap.
- **Inverse effort normalises against the whole required set**, not only the
  gapped skills. Effort is a property of the career, not of the student.
- **An empty career returns 0, not NaN.**
- **Every result carries its factors and a plain-language reason.** If a
  component cannot explain a number, the number is not finished.

## Adding a formula

1. Put it in `packages/shared/src/scoring.ts`.
2. Return the factors used, not just the result.
3. Add unit tests for the boundary cases, including degenerate input.
4. If a number is user-visible, write the sentence that explains it, and test
   that the sentence is non-empty.
