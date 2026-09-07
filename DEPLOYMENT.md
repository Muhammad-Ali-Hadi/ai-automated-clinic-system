# Deployment — Render (backend) + Vercel (frontend)

```
Browser ──► Vercel (static SPA)  ──HTTPS──►  Render Web Service (Express API)
                VITE_API_BASE_URL              │
                                               ├─► Render PostgreSQL
                                               └─► Render Worker (background jobs)
```

- **Frontend** → Vercel: builds `frontend/` with Vite, serves the static `dist/`.
- **Backend** → Render: `render.yaml` provisions a **PostgreSQL** DB, an **API web service**, and a **worker**.
- They talk over HTTPS; the API's CORS allow-list is set to the Vercel URL.

Everything below uses **free tiers**. Free Render web services **sleep after ~15 min idle** (first request then takes ~50 s), and free Render Postgres is **deleted after 30 days** — fine for a demo, upgrade for anything real.

---

## 0. Prerequisites

1. Code pushed to GitHub (`main` branch). This repo already is: `github.com/Muhammad-Ali-Hadi/ai-automated-clinic-system`.
2. Accounts: [Render](https://render.com) and [Vercel](https://vercel.com), both connected to your GitHub.
3. Commit the deploy config added for you:
   ```bash
   git add render.yaml frontend/vercel.json frontend/.env.example frontend/src/lib/apiClient.ts \
           frontend/src/vite-env.d.ts prisma/migrations/20260811000000_extended_auth_and_reconcile/migration.sql DEPLOYMENT.md
   git commit -m "chore: add Render + Vercel deploy config; make migration idempotent"
   git push origin main
   ```
   > The migration file was made idempotent so `prisma migrate deploy` works on a fresh database.
   > If your **local** `npx prisma migrate status` later warns that this migration was modified,
   > run once: `npx prisma migrate resolve --applied 20260811000000_extended_auth_and_reconcile`
   > (your local schema already matches — this only re-syncs the recorded checksum).

---

## Part A — Backend on Render

### A1. Create the Blueprint

1. Render Dashboard → **New +** → **Blueprint**.
2. Pick this GitHub repo. Render reads [`render.yaml`](render.yaml) and shows it will create:
   - `renovia-db` — PostgreSQL *(free)*
   - `renovia-api` — web service, `npm run build` then `npx prisma migrate deploy && npm start` *(free)*
   - `renovia-worker` — background worker *(paid — see below)*
   - `renovia-shared` — an env-var group both services share
3. **Background worker:** Render's free tier does **not** include workers. Either accept the
   paid `starter` instance ($7/mo) for `renovia-worker`, or delete that service block from
   `render.yaml` before applying — the app works without it, queued notifications/exports
   just aren't delivered.
4. Click **Apply**. The DB + `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` are generated automatically.

The **first deploy of `renovia-api` will fail to boot** until you finish A2 — that's expected.

### A2. Set the remaining env vars

Render Dashboard → **Env Groups** → **renovia-shared** → edit:

| Variable | Set to | Notes |
|---|---|---|
| `CORS_ORIGIN` | *(placeholder for now)* — your Vercel URL after Part B, e.g. `https://renovia.vercel.app` | Comma-separate for multiple origins. |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | credentials from a free relay (Brevo, Resend SMTP, Mailtrap) or a Gmail **App Password** | **Required while `NODE_ENV=production`.** Enables login email + password reset. |
| `OPENAI_API_KEY` | your OpenAI key | Optional. Blank ⇒ the AI Assistant returns a clear "not configured" error. |

**Don't want to set up email?** In the same group set `NODE_ENV` = `development`. The API then boots without SMTP (password-reset emails just won't send, and the global rate-limiter is disabled).

Save the group → Render redeploys `renovia-api` and `renovia-worker`.

### A3. Confirm it's up

- `renovia-api` → **Logs** should show `prisma migrate deploy` applying **9 migrations**, then `API listening`.
- Open `https://<your-api>.onrender.com/health` → `{"success":true,...,"status":"ok"}`.
- `https://<your-api>.onrender.com/ready` → `"database":"ok"`.
- `https://<your-api>.onrender.com/api-docs` → Swagger UI.

Copy the API URL (e.g. `https://renovia-api.onrender.com`) — you need it for Vercel.

---

## Part B — Frontend on Vercel

### B1. Import the project

1. Vercel Dashboard → **Add New… → Project** → import this GitHub repo.
2. **Root Directory:** `frontend` (click *Edit* and select it — important, the repo root is the backend).
3. Framework Preset: **Vite** (auto-detected). Build command `npm run build`, output `dist` — already in [`frontend/vercel.json`](frontend/vercel.json), leave defaults.

### B2. Environment variable

Add one:

| Key | Value |
|---|---|
| `VITE_API_BASE_URL` | your Render API origin — **no trailing slash, no `/api/v1`** — e.g. `https://renovia-api.onrender.com` |

### B3. Deploy

Click **Deploy**. When it finishes, copy the production URL, e.g. `https://renovia.vercel.app`.

`vercel.json` rewrites all paths to `index.html`, so client-side routes like `/patients/123` work on refresh.

---

## Part C — Connect them

1. Back in Render → **Env Groups → renovia-shared** → set `CORS_ORIGIN` = your Vercel URL from B3.
   (Add the `*.vercel.app` preview URL too if you want previews to work: comma-separated.)
2. Save → `renovia-api` redeploys.

---

## Part D — Verify end to end

1. Open your Vercel URL. The login screen loads.
2. Click **Register a hospital** → fill it in → you're signed in as `HOSPITAL_ADMIN`.
   *(Or hit the API directly: `POST https://<api>/api/v1/auth/register` with `{hospitalName,email,password,firstName,lastName}`.)*
3. Create a Department → a `DOCTOR` user (Users & Roles) → a Doctor profile → register a Patient → book an Appointment. The full workflow in [`WORKFLOW.md`](WORKFLOW.md) now runs against the deployed stack.
4. AI Assistant tab: works if `OPENAI_API_KEY` is set; otherwise shows the "add a key" banner.

---

## Environment variable reference

**Render — `renovia-shared` group** (+ `DATABASE_URL`/`DIRECT_URL` injected per-service from the DB)

| Variable | Source | Purpose |
|---|---|---|
| `NODE_ENV` | `production` (blueprint) | `development` disables the global rate-limiter and the SMTP requirement |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | auto-generated | must differ; ≥ 32 chars |
| `CORS_ORIGIN` | **you set** | Vercel URL(s), comma-separated |
| `TRUST_PROXY_HOPS` | `1` | Render terminates TLS at its edge |
| `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS` | `2000` / `900000` | global limiter (skipped when `NODE_ENV=development`) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | **you set** (host/user/pass) | required with `NODE_ENV=production` |
| `OPENAI_API_KEY` | **you set** (optional) | AI Assistant |
| `OPENAI_*_MODEL`, `QDRANT_URL`, `REDIS_URL` | blueprint defaults | AI tuning; RAG needs a real Qdrant, memory falls back to in-process without Redis |

**Vercel**

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | Render API origin, no trailing slash, no `/api/v1` |

---

## Redeploys & updates

- **Push to `main`** → Render and Vercel auto-deploy (`autoDeploy: true`).
- New Prisma migration? Add it under `prisma/migrations/`, push — `renovia-api`'s start command runs `prisma migrate deploy` on every boot.
- Changing `VITE_API_BASE_URL` requires a **Vercel redeploy** (it's baked in at build time).

---

## Optional extras

- **AI knowledge base (RAG):** create a free [Qdrant Cloud](https://cloud.qdrant.io) cluster, set `QDRANT_URL` (and `QDRANT_API_KEY`) in the Render group. Without it, only the RAG tab is unavailable; the other AI tools need just `OPENAI_API_KEY`.
- **Shared conversation memory:** add a Render Redis (Key Value) instance and point `REDIS_URL` at it. Optional — the API uses an in-process store otherwise.
- **Custom domains:** add them in Vercel (frontend) and Render (API), then update `CORS_ORIGIN` and `VITE_API_BASE_URL` accordingly.
- **Object storage (file uploads):** set `S3_BUCKET` / `S3_REGION` / `S3_ENDPOINT` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (all-or-none) to an S3-compatible bucket (AWS S3, Cloudflare R2, Supabase Storage). Until then the `/files` endpoints return `503`.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| API deploy: `SMTP configuration is required in production` | Set `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`, or set `NODE_ENV=development`. |
| API deploy: migration error on `20260811000000` | You're on an old commit — pull `main` (the migration is now idempotent). |
| Frontend loads but every request fails / CORS error | `VITE_API_BASE_URL` wrong (has `/api/v1` or a trailing slash), or Render `CORS_ORIGIN` ≠ your exact Vercel origin. Fix and redeploy the affected side. |
| `401` immediately after login, or login loops | Clock skew or `JWT_*` secrets changed between deploys — clear site data and retry; don't rotate JWT secrets on a live deploy. |
| First request after idle hangs ~50 s | Free Render web service cold start. Upgrade the plan or ping `/health` on a schedule. |
| Background notifications/exports never process | `renovia-worker` not running — check its Render logs. |
| `/ready` returns 503 | DB unreachable — check `renovia-db` status and that `DATABASE_URL` is wired from the database. |
