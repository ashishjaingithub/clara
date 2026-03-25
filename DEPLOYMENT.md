# Clara — Deployment Guide

---

## Prerequisites

- **Node.js 20+** (check with `node --version`)
- **npm** (bundled with Node)
- A **Railway** account at [railway.app](https://railway.app) — or Fly.io (see note below)
- A running **Hunter backend** accessible from the deployment environment
- A **Groq API key** (free at [console.groq.com](https://console.groq.com))
- A **LangSmith API key** (required in production; free at [smith.langchain.com](https://smith.langchain.com))

**Deployment target constraint:** Clara uses SQLite with `better-sqlite3` (a synchronous,
in-process driver). It requires a **single-process host with a persistent filesystem volume**.

- **Railway single dyno with persistent volume** — recommended
- **Fly.io single machine with persistent volume** — supported
- **Vercel** — not supported (serverless functions cannot hold SQLite between invocations)
- **Heroku** — not supported (ephemeral filesystem)
- **Any multi-instance or multi-process environment** — not supported in v1

---

## Environment Variables

Set all of the following in your Railway (or Fly.io) environment before deploying.
Never commit real values to git — the `.env.example` file uses placeholder strings.

| Variable | Required in Prod | Default | Description |
|----------|:----------------:|---------|-------------|
| `GROQ_API_KEY` | Yes | — | Groq LLM inference. Free at console.groq.com |
| `CLARA_OPERATOR_API_KEY` | Yes | — | Protects `POST /api/demo`, `GET /api/leads`, `POST /api/admin/cleanup`. Generate: `openssl rand -base64 32` |
| `LANGSMITH_API_KEY` | Yes | — | LLM observability. App exits with code 1 if missing in production. |
| `LANGSMITH_TRACING` | Yes (`"true"`) | `false` | Must be the exact string `"true"`. Enables LangSmith trace emission. |
| `HUNTER_API_URL` | Yes | `http://localhost:3001` | Base URL of the Hunter backend. Clara falls back to generic mode if unreachable — but a correct URL is expected in production. |
| `HUNTER_API_KEY` | If Hunter auth enabled | — | Bearer token for Hunter API. Omit if Hunter has no auth. |
| `DATABASE_PATH` | Recommended | `./clara.db` | Set to `/data/clara-production.db` on Railway to use the persistent volume. |
| `NEXT_PUBLIC_BASE_URL` | Yes | — | Full deployment URL, e.g. `https://clara-app.railway.app`. Required for CORS and absolute URL construction. App exits with code 1 if missing in production. |
| `PORT` | No | `3002` | HTTP port. Railway injects its own `PORT` — this default is for local dev only. |
| `NODE_ENV` | Yes (`"production"`) | `development` | Activates startup enforcement checks. |
| `GROQ_MODEL` | No | `llama-3.1-8b-instant` | Override the Groq model. Any Groq-compatible model name is accepted. |
| `LANGSMITH_PROJECT` | No | `clara-production` | Override the LangSmith project name. Defaults to `clara-${NODE_ENV}`. |

**Startup enforcement:** In production (`NODE_ENV=production`), the app calls `checkProductionEnv()`
at startup. If any of `GROQ_API_KEY`, `LANGSMITH_API_KEY`, `CLARA_OPERATOR_API_KEY`, or
`NEXT_PUBLIC_BASE_URL` are missing, or if `LANGSMITH_TRACING !== "true"`, the process exits
with code 1. The deploy will fail visibly rather than silently degrading.

---

## Railway Deployment

### Step 1 — Create a Railway project

1. Log in to [railway.app](https://railway.app)
2. Create a new project: **New Project → Deploy from GitHub repo**
3. Select your Clara repository

### Step 2 — Add a persistent volume

SQLite must survive restarts. Without a volume, the database is wiped on each deploy.

1. In your Railway service, go to **Settings → Volumes**
2. Add a volume mounted at `/data`
3. Set `DATABASE_PATH=/data/clara-production.db` in your environment variables

### Step 3 — Set environment variables

In Railway: **Service → Variables → Raw Editor**, paste and fill in:

```
GROQ_API_KEY=<your_groq_key>
CLARA_OPERATOR_API_KEY=<openssl rand -base64 32 output>
LANGSMITH_API_KEY=<your_langsmith_key>
LANGSMITH_TRACING=true
HUNTER_API_URL=https://<your-hunter-backend-url>
DATABASE_PATH=/data/clara-production.db
NEXT_PUBLIC_BASE_URL=https://<your-railway-service-url>
NODE_ENV=production
```

### Step 4 — Configure build and start commands

Railway auto-detects Next.js. Confirm in **Service → Settings → Deploy**:

| Setting | Value |
|---------|-------|
| Build command | `npm run build` |
| Start command | `npm run start` |

Railway will run `npm install` automatically before build.

### Step 5 — Run the database migration

The first deploy must run migrations before the app can serve requests.

In Railway: **Service → Settings → Deploy → Pre-deploy command**:
```
npm run db:migrate
```

Or run it manually via Railway CLI after the first deploy:
```bash
railway run npm run db:migrate
```

### Step 6 — Deploy

Push to your connected GitHub branch (or trigger a manual deploy in the Railway UI).
Watch the build logs — the app will log `[Clara] Production environment validated` on
a successful startup.

### Step 7 — Verify

```bash
# Health check — should return HTTP 200
curl -s -o /dev/null -w "%{http_code}" https://<your-url>/

# Create a test session
curl -s -X POST https://<your-url>/api/demo \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <CLARA_OPERATOR_API_KEY>" \
  -d '{"hubspot_company_id": "test-verify-001"}'

# Expected: 201 { "sessionId": "...", "uuid": "..." }
```

---

## Staging Environment

Before sending a real prospect their first demo link, a staging environment is required.
This lets you test against the production Hunter API without risking the live database.

In Railway, create a second environment on the same service:

1. **Service → Environments → Add Environment** → name it `staging`
2. Set `DATABASE_PATH=/data/clara-staging.db` (use the same volume, different file)
3. Set `NEXT_PUBLIC_BASE_URL=https://clara-staging.railway.app`
4. Keep all other variables identical to production

Staging cost: approximately $5/month (same dyno size).

---

## Session Cleanup (Cron)

Sessions older than 30 days are soft-deleted by `POST /api/admin/cleanup`. Schedule this
as a daily job using Railway's built-in cron or a GitHub Actions workflow:

**Railway cron** (in Service settings):
```
0 2 * * *    curl -s -X POST https://<your-url>/api/admin/cleanup \
               -H "Authorization: Bearer <CLARA_OPERATOR_API_KEY>"
```

**GitHub Actions** (`.github/workflows/clara-cleanup.yml`):
```yaml
on:
  schedule:
    - cron: '0 2 * * *'
jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -s -X POST ${{ secrets.CLARA_PRODUCTION_URL }}/api/admin/cleanup \
            -H "Authorization: Bearer ${{ secrets.CLARA_OPERATOR_API_KEY }}"
```

---

## Database Backup

Railway persistent volumes are not automatically backed up. For v1 (demo tool with < 50
sessions), a daily SQLite dump to a safe location is sufficient:

```bash
# Run via Railway cron or a separate scheduled job
sqlite3 /data/clara-production.db .dump > backup-$(date +%Y%m%d).sql
# Pipe to S3, GitHub Gist, or any persistent store
```

Recovery: restore the dump to a new volume and restart the service. Target RTO: < 2 hours.
This strategy must be upgraded before v2 live customer deployment.

---

## Fly.io (Alternative)

If you prefer Fly.io, the same constraints apply: single machine, persistent volume mounted
at `/data`. The `fly.toml` configuration:

```toml
[build]
  [build.args]
    NODE_VERSION = "20"

[[services]]
  internal_port = 3002

[mounts]
  source = "clara_data"
  destination = "/data"
```

Set environment variables with `fly secrets set GROQ_API_KEY=...` before the first deploy.

---

## Known Constraints (v1)

| Constraint | Impact | Migration path |
|------------|--------|----------------|
| SQLite single-process | Cannot run multiple instances; no horizontal scaling | Migrate to Postgres before v2 (see ADR-001 in `.spec/architecture.md`) |
| In-memory rate limiting | Rate limit state resets on restart; not shared across instances | Replace with Redis-backed rate limiter in v2 (ADR-005) |
| No automated production deploy | Production deploys are manual (operator approves after reviewing staging) | Add CI auto-deploy gate before v2 |
| No Sentry / error alerting | 5xx errors visible in Railway logs only | Add Sentry before v2 Extract-phase promotion |
| SQLite not backed up by default | Data loss on volume failure | Set up daily dump job before first real prospect session |

---

*Clara DEPLOYMENT.md v1.0 — 2026-03-24*
