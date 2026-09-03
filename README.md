# 🏥 Renovia Hospital OS

> **AI-powered, multi-tenant Hospital Management System** — a cloud-ready operating
> system that connects every hospital department into one workflow.
>
> **Version:** 1.0 · **Product type:** SaaS (multi-tenant) · **© Rizomation AI**

This repository is a **monorepo** with three parts:

| Part | Path | Stack |
|---|---|---|
| **Backend API + worker** | [`src/`](src/) | Node 20 · TypeScript · Express 5 · Prisma 6 · PostgreSQL · Socket.IO |
| **AI platform** | [`src/ai/`](src/ai/) | 15 modules · OpenAI · RAG (Qdrant) · conversation memory |
| **Frontend** | [`frontend/`](frontend/) | React 18 · TypeScript · Vite · Tailwind · TanStack Query |

Deeper docs: [`backend.md`](backend.md) (API service) · [`frontend/README.md`](frontend/README.md) (SPA) ·
[`WORKFLOW.md`](WORKFLOW.md) (end-to-end walkthrough) · [`docs/production-engineering.md`](docs/production-engineering.md).

---

## What's in the box

- **~185 REST endpoints** across 25 domains (`/api/v1/**`) — auth & RBAC, hospitals,
  departments, patients (allergies / chronic / insurance / contacts / vitals / notes /
  timeline), doctors & availability, appointments & queue, consultations, prescriptions,
  EHR, laboratory, pharmacy & dispensing, billing (invoices / payments / refunds /
  insurance claims), staff / HR, inventory & procurement, notifications & templates,
  reports, files, audit logs.
- **16 AI endpoints** (`/api/v1/ai/**`) exposing the Rizocare AI modules — clinical chat,
  AI receptionist, discharge summary, prescription draft, lab interpretation & analysis,
  patient explainer, billing & pharmacy assistants, document extraction, smart search,
  operational analytics, knowledge base (RAG), voice transcription.
- **52 Prisma models** on PostgreSQL, applied via migrations.
- **A PostgreSQL-backed job worker** (`FOR UPDATE SKIP LOCKED`, bounded retry).
- **Socket.IO** realtime on the same HTTP server.
- **24 frontend screens** covering the full clinical + administrative workflow, plus an
  **AI Assistant** hub.
- **Zero-Docker local dev**: an embedded PostgreSQL runner (`tools/local-db.mjs`) and an
  in-process fallback for AI conversation memory, so the whole stack runs with just Node.

---

## Architecture

```
Browser (React SPA, :5173)
   │  same-origin  /api  →  Vite dev proxy
   ▼
Express API (:4000) ──────────────► PostgreSQL (:5432, Prisma)
   │  ├─ middlewares: helmet, CORS allow-list, rate-limit, pino, Zod validate,
   │  │               JWT authenticate → authorize(roles) → requireTenant
   │  ├─ controllers (thin)  →  services (business logic)  →  repositories (Prisma)
   │  ├─ /api/v1/ai/*  →  src/ai gateway (aiService)  →  OpenAI / Qdrant / memory
   │  └─ Socket.IO (realtime)
   ▼
Job worker (npm run worker) ──────► PostgreSQL (BackgroundJob queue)
```

**Layered backend** — controllers parse the request and shape the response; **services**
hold business logic; **repositories** own Prisma. **Multi-tenant**: the JWT is the *only*
source of `hospitalId`; client-supplied hospital IDs in the URL/body/query are ignored.
**RBAC roles**: `SUPER_ADMIN`, `HOSPITAL_ADMIN`, `DOCTOR`, `RECEPTIONIST`, `NURSE`,
`PHARMACIST`, `LABORATORY_TECHNICIAN`, `ACCOUNTANT`, `PATIENT`.

**Frontend request flow** — one axios client; per-request token attach; **single-flight
401 refresh** (concurrent 401s share one `/auth/refresh` and replay once); normalized
`ApiError` with field-level messages; centralized TanStack Query keys; URL-synced
list state; route-level code splitting.

---

## Quick start (local, no Docker)

**Prerequisites:** Node.js ≥ 20. That's it — PostgreSQL runs embedded.

### 1. Install

```bash
npm install                 # backend
cd frontend && npm install && cd ..
```

### 2. Configure

A root `.env` is used for the backend (see [`.env.example`](.env.example) for every
variable). For local dev the important ones are `DATABASE_URL` / `DIRECT_URL`
(point at `postgresql://postgres:postgres@localhost:5432/renovia`), two distinct
32-char `JWT_*` secrets, and `CORS_ORIGIN` including `http://localhost:5173`.
Add a real `OPENAI_API_KEY` only if you want the AI features to return live output.

### 3. Run — three terminals

```bash
# Terminal 1 — database (embedded PostgreSQL 17, persists in ./.localdb)
node tools/local-db.mjs           # wait for "LOCALDB_READY"

# Terminal 2 — API + realtime
npx prisma migrate deploy         # first run only — creates the schema
npm run dev                       # http://localhost:4000

# Terminal 3 — frontend
cd frontend && npm run dev        # http://localhost:5173
```

Optional **Terminal 4** — background jobs: `npm run worker`.

Open **http://localhost:5173**. If you have no data yet, register a hospital from the
sign-in screen (creates the tenant + its first `HOSPITAL_ADMIN`).

| URL | What |
|---|---|
| http://localhost:5173 | The web app |
| http://localhost:4000/api-docs | OpenAPI / Swagger UI |
| http://localhost:4000/health · `/ready` | Liveness · readiness (real DB check) |

> **Production / hosted PostgreSQL (Supabase):** skip `tools/local-db.mjs`, point
> `DATABASE_URL` at the Supabase transaction pooler (`:6543`) and `DIRECT_URL` at the
> session connection (`:5432`), then `npx prisma migrate deploy`. See
> [`docs/production-engineering.md`](docs/production-engineering.md).

---

## Project structure

```
.
├── src/                      # Backend API + worker
│   ├── app.ts server.ts      # Express app, HTTP + Socket.IO, graceful shutdown
│   ├── config/env.ts         # Zod-validated environment
│   ├── routes/               # route defs + per-route Zod schemas  (incl. ai.routes.ts)
│   ├── controllers/          # thin HTTP handlers                  (incl. ai.controller.ts)
│   ├── services/ repositories/
│   ├── middlewares/          # auth (JWT/RBAC/tenant), validate, error-handler
│   ├── jobs/worker.ts        # PostgreSQL job worker
│   ├── docs/openapi.ts       # OpenAPI definition → /api-docs
│   └── ai/                   # AI platform
│       ├── index.ts          # barrel — import AI only through `aiService`
│       ├── services/         # chat, embedding, speech, openai-client
│       ├── modules/          # 15 specialized modules (receptionist, doctor, …)
│       ├── rag/ vector/      # RAG pipeline + Qdrant client
│       ├── memory/           # conversation manager + Redis client (in-process fallback)
│       ├── guardrails/ evaluations/ prompts/ config/ analytics/
├── frontend/                 # React + Vite SPA
│   └── src/
│       ├── lib/              # apiClient (token + single-flight refresh), queryClient, format
│       ├── api/              # query keys, mutations, lookups, ai.ts
│       ├── features/auth/    # AuthProvider, RequireAuth, jwt
│       ├── components/       # ui kit + layout (sidebar, topbar)
│       └── pages/            # 24 screens  (+ pages/ai/ AI Assistant panels)
├── prisma/
│   ├── schema.prisma         # 52 models
│   └── migrations/           # 9 migrations
├── tools/
│   ├── local-db.mjs          # embedded PostgreSQL for local dev (no Docker)
│   └── fix-migration.mjs     # one-off recovery helper for a partial migration
├── docs/production-engineering.md
├── backend.md  ·  WORKFLOW.md
└── Dockerfile.ai · docker-compose.ai.yml · k8s/   # AI service container assets
```

---

## Scripts

**Backend (repo root)**

| Script | Does |
|---|---|
| `npm run dev` | API with reload (`tsx watch src/server.ts`) |
| `npm run worker` | Background job worker |
| `npm run build` | `prisma generate && tsc` → `dist/` |
| `npm start` | `node dist/server.js` |
| `npm test` · `npm run test:coverage` | Vitest suites |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run prisma:migrate` · `prisma:generate` · `prisma:validate` | Prisma |

**Frontend (`frontend/`)**

| Script | Does |
|---|---|
| `npm run dev` | Vite dev server (`:5173`, proxies `/api` → `:4000`) |
| `npm run build` | `tsc && vite build` → `frontend/dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |

---

## Technology stack (as built)

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite 5, Tailwind CSS 3, TanStack Query 5, React Router 6, Recharts, axios |
| Backend | Node.js 20+, TypeScript, Express 5, Zod, Socket.IO, pino, helmet, JWT (jsonwebtoken), bcryptjs |
| Database | PostgreSQL via **Prisma 6** (Supabase-compatible; embedded Postgres for local dev) |
| Jobs | PostgreSQL-backed worker (`FOR UPDATE SKIP LOCKED`) |
| AI | OpenAI (`gpt-4.1-mini`, `text-embedding-3-small`, `whisper-1`), Qdrant (vector store), Redis *or* in-process conversation memory |
| Storage | S3-compatible object storage via a dependency-free AWS SigV4 pre-signer |
| Email | SMTP (Nodemailer), environment-gated |
| Docs | OpenAPI / Swagger UI |
| Tests | Vitest (unit, HTTP/runtime, security, worker, storage) |

> **Note:** the earlier product brief mentioned MongoDB / Groq / Socket-only stacks; the
> implemented system uses **PostgreSQL + Prisma** and **OpenAI**. This section reflects the
> code in the repo.

---

## AI features

The `src/ai/` platform is reachable at `/api/v1/ai/**` and surfaced in the frontend under
**AI Assistant**. It requires a real `OPENAI_API_KEY` in the backend `.env` (restart the
API after adding it — a `.env` change alone does not hot-reload). Conversation memory uses
Redis if `REDIS_URL` is reachable, otherwise an in-process store. The knowledge base (RAG)
additionally needs Qdrant on `QDRANT_URL`.

| Group | Capabilities |
|---|---|
| Conversational | Clinical assistant (multi-turn memory), AI receptionist, knowledge base (RAG ingest + query), smart search, voice transcription (Whisper) |
| Doctor | Discharge summary, prescription draft, lab interpretation, lab report analysis |
| Patient | Plain-language explainer for reports & prescriptions |
| Operations | Billing assistant, pharmacy assistant, document extraction, operational analytics |

`GET /api/v1/ai/status` reports which providers are configured.

---

## Security

Helmet headers · strict CORS allow-list · global rate limiting · 1 MB JSON body limit
(25 MB only on `/ai/transcribe`) · Zod validation before business logic · JWT + RBAC +
tenant isolation on every tenant-scoped query · hashed & rotated refresh tokens with
reuse detection · bcrypt passwords · structured pino logs with credential/token redaction ·
no stack traces in API responses · audit log of every mutation.

---

## Roadmap

Mobile apps · telemedicine · AI voice receptionist · wearable integration · insurance
integration · HL7 / FHIR APIs · PACS & DICOM · multi-hospital management · white-label ·
advanced predictive analytics.

---

## © Rizomation AI

Building intelligent healthcare solutions powered by Artificial Intelligence.
