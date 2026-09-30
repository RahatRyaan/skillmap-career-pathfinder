# Rule: testing

## Coverage at time of writing

| Suite                               | What it proves                                    |
| ----------------------------------- | ------------------------------------------------- |
| `packages/shared` — formula tests   | The scoring maths, including edge cases           |
| `packages/server` — content tests   | Counts, no invented URLs, no forbidden claims     |
| `packages/server` — API tests       | Routing, auth, validation, ownership, injection   |
| `packages/client` — component tests | The primitives                                    |
| `tests/e2e`                         | The real journey, against a real server and build |

## Rules

1. **Test first for anything touching a formula.** The formula tests found four
   real defects during the build, three of which would have shipped.
2. **Do not mock the database in an API test.** Use `mongodb-memory-server`.
   The bugs worth catching are index and shape bugs, and a mock hides both.
3. **A bug fix ships with a test that fails before it.**
4. **Assert the failure path and the authorisation boundary**, not just the
   happy path.
5. **A test that cannot fail is not a test.** If it passes when the feature is
   deleted, it is worthless.
6. **E2E waits for real state.** `isVisible()` before a lazy route renders is
   false, so guard with an explicit `expect`, not a conditional.

## Before you push

```bash
npm run verify
npm run test:e2e
```

Both must be green. An E2E run in 20 seconds is the goal; a run that takes four
minutes usually means a wait is missing.
