# Setup

From an empty machine to a running application, then to a public deployment.

---

## 1. Requirements

| Tool    | Version                         | Check     |
| ------- | ------------------------------- | --------- |
| Node.js | 20.11 or newer (22 recommended) | `node -v` |
| npm     | 10 or newer                     | `npm -v`  |
| MongoDB | Atlas free tier, or a local 7.x | —         |

Nothing else. Docker is optional.

---

## 2. Install

```bash
git clone <your-repo-url>
cd skillmap-ai
npm install
npm install-scripts approve esbuild
```

The second command is required. esbuild ships a postinstall script that npm
blocks by default, and **without it Vite and Vitest cannot run**. This is the
single most common setup failure in this project.

---

## 3. Configure

```bash
cp .env.example .env
```

`.env` is gitignored, and CI fails if it is ever committed. `.env.example` is
the documented template and contains no real values.

### 3.1 The required values

| Variable             | How to get it                                                              |
| -------------------- | -------------------------------------------------------------------------- |
| `MONGODB_URI`        | Your Atlas connection string, or `mongodb://127.0.0.1:27017/skillmap`      |
| `JWT_ACCESS_SECRET`  | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | The same command, **a different run**                                      |
| `ADMIN_PASSWORD`     | Something only you know                                                    |

The two JWT secrets must be different. The server refuses to start if they
match, and in production it also refuses placeholder values.

### 3.2 MongoDB Atlas

1. **Create a free M0 cluster.**
2. **Database Access → Add a user.** Note the password.
3. **Network Access → Add your IP.** Get it from <https://api.ipify.org>.

> **The most common setup failure:** the IP allowlist. If this machine's IP is
> not in the list, every database call fails with a network error that looks
> like a bad password. For a competition, adding `0.0.0.0/0` is acceptable and
> can be tightened afterwards.

4. **Copy the connection string** and add the database name to the path:

```
mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/skillmap?retryWrites=true&w=majority
```

> **A free cluster pauses after 7 days idle**, and a paused cluster's DNS
> record is removed. If `nslookup <your-cluster-host>` returns nothing, the
> cluster is paused or deleted — resume it in the dashboard and wait about two
> minutes. Nothing in your code is wrong.

Verify before going further:

```bash
node -e "
const net = require('net');
const s = net.connect(27017, 'cluster0.xxxxx.mongodb.net');
s.setTimeout(8000);
s.on('connect', () => { console.log('reachable'); process.exit(0); });
s.on('timeout', () => { console.log('BLOCKED — check the IP allowlist'); process.exit(1); });
s.on('error', e => { console.log('error', e.code); process.exit(1); });
"
```

### 3.3 AI mode

Leave `AI_MODE=demo` unless you have a public endpoint. Demo mode needs no key,
costs nothing, works offline, and is what a public deployment should use.

For local development against a gateway on your own machine:

```bash
AI_MODE=openai
OPENAI_BASE_URL=http://localhost:20128/v1
OPENAI_API_KEY=your-key
OPENAI_MODEL_EXTRACTION=<a capable model>
OPENAI_MODEL_CHAT=<a cheap model>
```

`localhost` endpoints are unreachable from a hosted server. For a deployed
instance you need a public endpoint, or demo mode.

---

## 4. Seed

```bash
npm run seed
```

Idempotent — run it twice and nothing is duplicated.

Creates 80 skills, 10 careers, 130 career-skill mappings, 50+ learning
resources, 20 projects, 10 quiz questions, 16 achievements, the admin account,
and the demo student.

```
demo@skillmap.ai  /  Demo1234
```

The admin account uses `ADMIN_EMAIL` and `ADMIN_PASSWORD` from your `.env`.

| Flag          | Effect                                                                  |
| ------------- | ----------------------------------------------------------------------- |
| `--fresh`     | Drops the content collections first. Refuses to run against production. |
| `--demo-only` | Only refreshes the demo student.                                        |

---

## 5. Run

```bash
npm run dev
```

| Service | URL                                |
| ------- | ---------------------------------- |
| Client  | <http://localhost:5173>            |
| API     | <http://localhost:4000/api>        |
| Health  | <http://localhost:4000/api/health> |

Vite proxies `/api` to the server, so the browser sees one origin and the CORS
allow-list stays honest.

---

## 6. Verify

```bash
npm run smoke        # environment pre-flight
npm run verify       # format, lint, typecheck, test, build
npm run test:e2e     # 20 Playwright tests, needs a build first
```

`npm run smoke` checks that `.env` exists, the secrets are set, `.env` is
gitignored, and Node is new enough. Run it first when something looks wrong.

---

## 7. Common problems

| Symptom                                   | Cause                                      | Fix                                                |
| ----------------------------------------- | ------------------------------------------ | -------------------------------------------------- |
| `esbuild` binary errors on `npm run dev`  | postinstall script was blocked             | `npm install-scripts approve esbuild`              |
| `MongooseServerSelectionError`            | IP not in the Atlas allowlist              | Add your IP from ipify.org                         |
| Cluster resolves but connections time out | Cluster is paused                          | Resume it in the dashboard, wait 2 minutes         |
| `ECONNREFUSED localhost:27017`            | No local MongoDB                           | Start one, or use Atlas                            |
| `Disk quota exceeded` in tests            | The in-memory Mongo data dir filled `/tmp` | `rm -rf /tmp/skillmap-mongo-data /tmp/mongo-mem-*` |
| "Origin not allowed" in the console       | Vercel URL missing from `CORS_ORIGINS`     | Add the deployed URL, without a trailing slash     |
| `No module was trained` expected          | You're in demo mode                        | Working as intended                                |
| Port 4010 in use during E2E               | A stale test server                        | `pkill -f e2eServer`                               |
| Login works, then every page 401s         | The clock moved and the token expired      | Sign in again; the client refreshes automatically  |

---

## 8. Deployment

Client and API deploy separately, because that is what the two platforms are
each good at.

### 8.1 Database — Atlas

Free M0, and the **IP allowlist must include `0.0.0.0/0`**, because a hosted
service connects from an IP that is not yours. Restrict later if you need to.

Copy the SRV string into the Render dashboard as `MONGODB_URI` and set
`DB_MODE=atlas`.

### 8.2 API — Render

[`render.yaml`](render.yaml) is a blueprint. In the dashboard:

1. **New → Blueprint** and point it at the repository.
2. Render reads the file and creates the service.
3. Set the six `sync: false` variables: `MONGODB_URI`,
   `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_PASSWORD`, `CORS_ORIGINS`.

After the first deploy, `CORS_ORIGINS` must contain your Vercel URL. Until it
does, the browser blocks every API call.

Seed the production database once, from your machine:

```bash
MONGODB_URI="<the Atlas string>" npm run seed
```

> **Free tier caveat.** Render's free tier sleeps after inactivity, so the
> first request after a quiet period takes about 30 seconds. A
> `healthCheckPath` is configured, and a cold start is not a crash — worth
> knowing before a live demo.

### 8.3 Client — Vercel

```bash
npm i -g vercel
vercel
```

Set `VITE_API_URL=https://<your-render-service>.onrender.com/api` in the
Vercel dashboard. It is a build-time variable, so redeploy after changing it.

[`vercel.json`](vercel.json) handles SPA rewrites and immutable caching for
hashed assets.

### 8.4 After both are up

1. Put the Render URL in `CORS_ORIGINS` and redeploy the API.
2. Put the Vercel URL in `CORS_ORIGINS` — it already is — and redeploy.
3. Open `/api/health` on the API and confirm `"database": "connected"`.
4. Open `/ai-info` on the client and confirm the mode is what you expect.
5. Seed the production database if you have not.

### 8.5 Local Docker stack

```bash
docker compose up --build
```

Brings up MongoDB, the API on `:4000`, and the client on `:5173`, with
persistent volumes for the database and uploads. A manual path also works:
`npm install`, start any MongoDB, `npm run seed`, `npm run dev`.

---

## 9. Production checklist

- [ ] `MONGODB_URI` points at production, not a local database
- [ ] Both JWT secrets are 32+ random characters and different
- [ ] `ADMIN_PASSWORD` is not the placeholder — the server refuses to boot if it is
- [ ] `CORS_ORIGINS` contains the deployed client URL and nothing else
- [ ] `AI_MODE` is deliberate, and if it is `openai`, the endpoint is public
- [ ] `AI_BUDGET_USD` is set if `AI_MODE=openai`
- [ ] Database seeded
- [ ] `/api/health` returns `200`
- [ ] `.env` is not in git — CI fails if it is
- [ ] The demo student password is changed, or the account is deleted
