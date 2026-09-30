---
description: Prove the demo cannot fail
---

Run the pre-demo gate.

```bash
curl -s http://localhost:4000/api/health
npm run seed
npm run build
npm run smoke
```

Confirm:

1. `"status": "ok"` and `"database": "connected"`. If the database is
   disconnected, the Atlas cluster is paused — say so and stop.
2. `"aiMode": "demo"`. Anything else needs a deliberate decision before a demo.
3. Seeding is idempotent — run `npm run seed` twice and confirm no duplicates.
4. The build succeeds and the landing page bundle contains neither Recharts nor
   the flow graph.
5. `npm run verify` is green.
6. Sign in as `demo@skillmap.ai` / `Demo1234` and confirm the dashboard shows
   a non-zero alignment and a non-empty gap list.

Then print the eight-minute demo path from `docs/DEMO_GUIDE.md` and stop. Do
not rehearse it on the user's behalf.
