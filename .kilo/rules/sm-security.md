# Rule: security

## Enforced, and tested

| Control                                       | Where                       |
| --------------------------------------------- | --------------------------- |
| bcrypt password hashing                       | `utils/tokens.ts`           |
| JWT access + rotating refresh, stored hashed  | `utils/tokens.ts`           |
| Role read from the database, not the token    | `middleware/auth.ts`        |
| Ownership in the query                        | route handlers              |
| Zod validation on every input                 | `middleware/validate.ts`    |
| `express-mongo-sanitize`                      | `app.ts`                    |
| Helmet headers, no `x-powered-by`             | `app.ts`                    |
| CORS allow-list, same-origin aware            | `app.ts`                    |
| Rate limits: login, upload, assistant, writes | `middleware/rateLimit.ts`   |
| Upload type and size allow-lists              | `routes/cv.routes.ts`       |
| Random storage names, private directory       | `services/uploadService.js` |
| Path traversal guard                          | `services/uploadService.js` |
| Audit log with key redaction                  | `services/auditService.ts`  |
| No stack trace in a response                  | `middleware/error.ts`       |
| Mass-assignment blocked by schema stripping   | `middleware/validate.ts`    |

Each of these has a test. If you remove a control, remove the test deliberately
and write down why.

## Secrets

`.env` is gitignored and CI fails if it is committed. JWT secrets must be 32+
characters and different from each other. In production, placeholder secrets
are refused at boot rather than at the first request.

## Tokens in logs

The logger redacts `password`, `token`, `accessToken`, `refreshToken`,
`authorization`, `cookie`, `secret`, `apiKey`, and the Mongo URI. Do not log a
user-submitted string, and do not defeat the redaction.

## Deletion is a security feature

Account deletion removes seventeen collections and the CV file. The file is
removed first, because a deleted record with a surviving file is a leak.
