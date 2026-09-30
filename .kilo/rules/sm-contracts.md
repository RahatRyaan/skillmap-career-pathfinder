# Rule: contracts

Every request and response shape is a Zod schema in `packages/shared/src`.
Both the server and the client import it.

## Changing a contract

1. Change the schema in `packages/shared`.
2. Update the server handler to use the new shape.
3. Update the typed wrapper in `client/src/lib/endpoints.ts`.
4. Update any test that asserts the old shape.
5. Rebuild `shared` — `npm run build --workspace @skillmap/shared`.

**A schema change without a test is a breaking change.** Add the test in the
same commit.

## Rules

- Types are derived from schemas, never hand-written beside them.
- A field is added as optional first, or as `| null`, never as a required
  field. A required field breaks every stored record that predates it.
- Error codes are a closed set in `errors.ts`. A new code means a new entry in
  `ERROR_STATUS` and a client branch.
- Enum values are contractual. Renaming one is a migration.
- Discriminated unions where the shape genuinely varies, with a literal
  `mode`/`type` field, so a consumer must handle each case.

## Validation placement

Validate at the boundary, once. A Zod schema on the server is the enforcement
point; the client may mirror it for feedback, but the server is what counts.
