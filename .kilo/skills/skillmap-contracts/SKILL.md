---
name: skillmap-contracts
description: How to change an API contract or add an endpoint in SkillMap AI without breaking a parallel agent. Load before editing anything in packages/shared/src or adding a route.
---

# Contracts

Every request and response shape is a Zod schema in `packages/shared/src`. Both
the server and the client import it. That shared, compiled contract is what
makes parallel work safe: a changed shape is a build error in both packages at
the moment of change, not a runtime 400 after deploy.

## Changing a shape

1. Change the schema in `packages/shared/src`.
2. Update the server handler.
3. Update the typed wrapper in `packages/client/src/lib/endpoints.ts`.
4. Update tests asserting the old shape.
5. **Rebuild shared**: `npm run build --workspace @skillmap/shared`.

A schema change without a test is a breaking change. Add the test in the same
commit.

## Adding an endpoint

```ts
// 1. Schema in packages/shared/src/schemas.ts
export const thingRequestSchema = z.object({ name: z.string().trim().min(1).max(120) });
export type ThingRequest = z.infer<typeof thingRequestSchema>;

// 2. Wrapper in the client
thing: { create: (body: ThingRequest) => api.post<Thing>('/thing', body) },

// 3. Route — literal before parameterised
router.post(
  '/thing',
  requireAuth,
  validate({ body: thingRequestSchema }),
  asyncHandler(async (req, res) => {
    const body = (req as ValidatedRequest<ThingRequest>).validated.body!;
    res.status(201).json(await thingService.create(body, getUserId(req)));
  }),
);

// 4. Three tests: success, failure, authorisation boundary
```

## Compatibility rules

- **A new field is optional or `| null`.** A required field breaks every stored
  record that predates it.
- **Error codes are a closed set** in `errors.ts`. A new code needs an
  `ERROR_STATUS` entry and a client branch.
- **Enum values are contractual.** Renaming one is a migration.
- **Discriminated unions** where the shape genuinely varies, with a literal
  discriminator, so a consumer must handle each case.

## Traps

- **`req.validated`, not `req.body`.** Express makes `req.query` a getter, and
  replacing either discards what the client sent.
- **Route order.** `/careers/compare` before `/careers/:id`. This caused a real
  bug during the build.
- **The server is the enforcement point.** Client-side validation is for
  feedback, not for safety.
- **Rebuild shared after editing it.** The client resolves types from the built
  output.

## Verify

```bash
npm run build --workspace @skillmap/shared
npm run verify
```
