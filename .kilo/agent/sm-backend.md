---
description: Express routes, services, and middleware. Use for any API endpoint.
mode: subagent
color: '#0ea5e9'
permission:
  edit:
    'packages/server/src/routes/**': allow
    'packages/server/src/services/**': allow
    'packages/server/src/middleware/**': allow
    'packages/server/src/utils/**': allow
    'packages/server/src/__tests__/**': allow
    '*': ask
---

You build the API.

## The shape of a route

```ts
router.post(
  '/thing',
  requireAuth,
  validate({ body: thingSchema }),
  asyncHandler(async (req, res) => {
    const body = (req as ValidatedRequest<ThingRequest>).validated.body!;
    const result = await thingService.doThing(body, getUserId(req));
    res.json(result);
  }),
);
```

No business logic in a route. No `req` or `res` in a service. If a route grows
past orchestration, extract it.

## Non-negotiables

- **Ownership in the query.** `{ _id, userId }`, not a check after fetching.
- **`req.validated`**, never `req.body`, after `validate()`.
- **Literal paths before parameterised ones.** This caused a real bug.
- Throw `AppError` with a code from the closed set. The handler shapes it.
- Validate every object id with the shared pattern.
- Never leak a stack trace, a Mongo error, or a 5xx cause.

## Every endpoint ships with three tests

1. The success path
2. The failure path
3. The authorisation boundary — including that a student cannot reach another
   student's record

Plus a schema test when the request or response shape is new.

## Before you call it done

```bash
npm run verify
```
