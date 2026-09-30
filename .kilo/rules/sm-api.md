# Rule: API

## Layering

```
route        HTTP shape only: parse, authorise, delegate, respond
service      business logic, orchestration, persistence
model        schema and indexes
```

A route may not contain business logic. A service may not touch `req` or `res`.
There is no separate controller layer: a controller that only forwards is a file
to navigate without behaviour.

## Validated data lives on `req.validated`

```ts
const body = (req as ValidatedRequest<RegisterRequest>).validated.body!;
```

Never read `req.body` after `validate()`. Express makes `req.query` a getter,
and replacing either discards what the client actually sent — which is how a
validated array silently became a raw string.

## Authorisation

- `requireAuth` verifies the token. `requireRole` reads the role **from the
  database**, never from the token's claim.
- Ownership is checked in the query: `{ _id, userId }`, not a check after the
  fetch.
- Object ids are validated with the shared pattern before use.

## Errors

Throw `AppError` with a code from the closed set. The central handler shapes
the response, logs with a `requestId`, and in production never reveals a 5xx
cause.

## Route order

**Literal paths before parameterised ones.** `/careers/compare` registered
after `/careers/:id` captures `compare` as an id. This happened once; the test
that caught it is permanent.

## Uploads

Type allow-list, size cap, and a stored name from `crypto.randomBytes` with an
extension derived from the MIME type. Never from the uploaded filename. Stored
outside any public directory.
