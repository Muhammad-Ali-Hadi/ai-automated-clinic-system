# Renovia Hospital OS — Backend

> **Scope:** This document covers the **backend only** (the Node.js API + worker).
> It is not the monorepo / whole-project README. If a frontend is added, give it its
> own README and keep a top-level project README for the aggregate repo.

Production-oriented, multi-tenant **modular monolith** for hospital operations.

- **Runtime:** Node.js 20+ + **TypeScript** + **Express 5**
- **Database:** **Supabase-hosted PostgreSQL** accessed through **Prisma 6**
- **Auth:** Application-issued **JWT** (access + hashed/rotated refresh tokens, sessions)
- **Validation:** **Zod** (request `body`/`query`/`params` validated before business logic)
- **Realtime:** **Socket.IO** (Engine.IO) on the same HTTP server as REST
- **Jobs:** dedicated **PostgreSQL-backed worker** using `FOR UPDATE SKIP LOCKED`
- **Object storage:** **S3-compatible** (AWS S3 / Supabase Storage S3 / MinIO / R2) via a
  dependency-free **AWS SigV4** pre-signer
- **Email:** SMTP (Nodemailer); environment-gated, with no token/log fallback
- **Docs:** OpenAPI / Swagger UI
- **Testing:** Vitest (unit, HTTP/runtime, security, worker, and storage tests)

Constraint: this service deliberately uses **no Redis, BullMQ, Mongo, Mongoose, Docker,
local PostgreSQL, Supabase Auth, Supabase Realtime, or Supabase Storage-as-API.** Tenant
context and sessions are the app's own; storage is S3; realtime is Socket.IO; jobs are Postgres.

---

## 1. Quick start

```bash
# 1) configuration
# Copy .env.example to .env if your local environment uses an env-file loader,
# then fill in real values. Never commit .env.

# 2) install + generate client
npm install
npm run prisma:generate

# 3) create / migrate the schema on Supabase
npm run prisma:migrate        # npx prisma migrate dev

# 4) run
npm run dev                   # API  -> http://localhost:4000  (tsx watch)
npm run worker                # background job worker (tsx)

# production
npm run build                 # prisma generate && tsc  -> dist/
npm start                     # node dist/server.js
```

Interactive API docs: **http://localhost:4000/api-docs**
Health: `GET /health` · Readiness (real DB): `GET /ready`

### npm scripts

| Script | Does |
|---|---|
| `dev` | `tsx watch src/server.ts` — API with reload |
| `build` | `prisma generate && tsc` |
| `start` | `node dist/server.js` |
| `worker` | `tsx src/jobs/worker.ts` |
| `test` | `vitest run` |
| `test:coverage` | `vitest run --coverage` |
| `typecheck` | TypeScript type-check without emitting files |
| `prisma:validate` | Validate the Prisma schema |
| `prisma:migrate` | `prisma migrate dev` |
| `prisma:generate` | `prisma generate` |

---

## 2. Configuration (`.env`)

`.env.example` documents every variable. `src/config/env.ts` reads process environment only,
**validates all values at boot with Zod**, and fails fast on invalid/missing values. Load local
values through your shell, IDE, or a Node env-file loader; application code never reads `.env`.

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase **transaction pooler** (pgbouncer), port `6543` |
| `DIRECT_URL` | ✅ (migrations) | Supabase **session/direct** connection, port `5432` |
| `JWT_ACCESS_SECRET` | ✅ | ≥ 32 chars |
| `JWT_REFRESH_SECRET` | ✅ | ≥ 32 chars, different from access |
| `JWT_ACCESS_EXPIRES_IN` | | default `15m` |
| `JWT_REFRESH_EXPIRES_IN` | | default `30d` |
| `PORT` | | default `4000` |
| `CORS_ORIGIN` | ✅ | Comma-separated browser allow-list |
| `NODE_ENV` | | `development` / `test` / `production` |
| `LOG_LEVEL` | | default `info` |
| `SMTP_HOST` `SMTP_PORT` `SMTP_SECURE` `SMTP_USER` `SMTP_PASS` `SMTP_FROM` | production required | SMTP credentials must be supplied together. Tokens are delivered by email and never logged. |
| `S3_BUCKET` `S3_REGION` `S3_ENDPOINT` `AWS_ACCESS_KEY_ID` `AWS_SECRET_ACCESS_KEY` | optional, all-or-none | Object storage. File upload/download returns 503 until configured; no placeholder URLs are issued. |
| `JOB_POLL_INTERVAL_MS` `JOB_LOCK_TIMEOUT_SECONDS` `JOB_MAX_BACKOFF_SECONDS` | | Portable worker polling, lease, and retry controls. |
| `TRUST_PROXY_HOPS` | | `0` by default; set only for a known trusted proxy topology. |

> **Security:** never commit `.env`. It is git-ignored. `.env.example` ships with
> placeholders only — no real credentials.

---

## 3. Architecture

Clean, layered architecture (SOLID / DRY / KISS). **Controllers stay thin** — they parse,
call a service, and shape the HTTP response. **Services** hold business logic,
**repositories** own Prisma persistence.

```
src/
├── app.ts                # Express app: helmet, cors, compression, rate-limit, pino, swagger
├── server.ts             # HTTP server + Socket.IO, graceful shutdown
├── config/env.ts         # Zod-validated environment
├── lib/                  # prisma client, pino logger, S3 SigV4 pre-signer
├── middlewares/          # auth (JWT/RBAC), validate (Zod), error-handler
├── routes/               # route definitions + per-route Zod schemas
├── controllers/          # thin HTTP handlers (req/res only)
├── services/             # business logic (auth, patient, billing, …)
├── repositories/         # Prisma data-access
├── jobs/worker.ts        # PostgreSQL-backed job worker (FOR UPDATE SKIP LOCKED)
├── docs/openapi.ts       # OpenAPI definition -> /api-docs
├── utils/                # AppError, api-response, crypto helpers
└── tests/                # Vitest suites (see §9)
```

### Multi-tenant model
- The **authenticated JWT** is the *sole* source of tenant (`hospitalId`). Client-supplied
  hospital IDs in **URL, body, or query can never override** it — they are stripped/ignored.
- Every tenant-scoped query filters on the JWT's `hospitalId`; composite indexes reinforce it.
- `SUPER_ADMIN` is **not** granted tenant resources by default — cross-tenant actions are
  explicit, audited system features (see `requireTenant`).

### RBAC
Roles: `SUPER_ADMIN`, `HOSPITAL_ADMIN`, `DOCTOR`, `RECEPTIONIST`, `NURSE`, `PHARMACIST`,
`LABORATORY_TECHNICIAN`, `ACCOUNTANT`, `PATIENT`.
Enforced at the API layer via `authenticate` → `authorize(...roles)` → `requireTenant`.
Insufficient role → **403**; unauthenticated → **401**; cross-tenant → **404/403**.

---

## 4. Authentication & sessions

- `POST /api/v1/auth/register` — register a hospital (creates hospital + `HOSPITAL_ADMIN`).
- `POST /api/v1/auth/login` — email + password → `{ accessToken, refreshToken }`.
- `POST /api/v1/auth/refresh` — rotates the refresh token; **reuse of a rotated token is rejected** (theft detection).
- `POST /api/v1/auth/logout`, `POST /api/v1/auth/logout-all` — revoke one / all sessions.
- `GET /api/v1/auth/profile`, `PATCH …/profile`, `POST …/change-password`.
- Forgot/reset password + email-verification token flows.
- `GET /api/v1/auth/sessions`, `GET /api/v1/auth/login-history` (login audit records).
- Admin user & role management: `POST/GET /api/v1/auth/users`, `PATCH …/users/:userId/role`.

Refresh tokens are **stored hashed**; passwords are **bcrypt**-hashed; neither is ever logged.

Email notifications use the SMTP adapter. SMS, WhatsApp, and Push notifications are persisted
and queued but are not falsely marked delivered until real provider adapters and credentials are
configured; unsupported channels fail through the worker retry/failed-job lifecycle.

---

## 5. API surface (module map)

Base path: `/api/v1`. Protected business endpoints are JWT-authenticated and tenant-scoped
unless noted. Registration, login, refresh, password-recovery, and email-verification endpoints
are public; `/health`, `/ready`, and `/api-docs` are operational/documentation endpoints.

| Domain | Route group |
|---|---|
| Auth / users / roles | `/auth` |
| Hospitals / settings / branches | `/hospitals` |
| Departments | `/departments` |
| Patients (profile, allergies, chronic, contacts, insurance, notes, merge, archive) | `/patients` |
| Doctors | `/doctors` |
| Appointments / queue / schedule | `/appointments` |
| Consultations / prescriptions / follow-ups | `/consultations`, `/prescriptions` |
| EHR (medical records, clinical notes, diagnoses) | `/medical-records` |
| Laboratory (tests, samples, results, approval) | `/lab-tests` |
| Pharmacy (medicines, stock, batches, dispensing) | `/medicines` |
| Billing (invoices, payments, insurance) | `/invoices`, `/insurance-claims` |
| Staff / HR (employees, attendance, leave, shifts, payroll) | `/employees`, `/shifts`, `/payroll-integrations` |
| Inventory & procurement | `/inventory`, `/suppliers` |
| Notifications (email/SMS/WhatsApp/push + templates) | `/notifications`, `/notification-templates` |
| Reports / dashboards / exports | `/reports` |
| Files (upload, signed URL, download) | `/files` |
| Audit logs | `/audit-logs` |

Full request/response detail lives in the live **Swagger UI at `/api-docs`**
(`src/docs/openapi.ts`).

---

## 6. Realtime — Socket.IO

Socket.IO shares the HTTP server and does **not** interfere with REST.
On connection the server emits a `connected` event. Handshake (Engine.IO polling):

```
GET /socket.io/?EIO=4&transport=polling   →  0{"sid":"…","upgrades":["websocket"],…}
```

---

## 7. Background jobs (PostgreSQL)

`BackgroundJob` rows persist scheduled work. The worker (`npm run worker`) polls and claims
the next pending job with a single atomic `UPDATE … FROM (SELECT … FOR UPDATE SKIP LOCKED)`,
so **concurrent workers never process the same job**. Handlers dispatch by `type`,
then mark the job `COMPLETED`, or `FAILED` with a `failureReason`. Payloads stay small;
files are referenced from S3 rather than embedded.

---

## 8. Files / object storage (S3)

`file.service` stages an upload (validates MIME type + 20 MB cap, persists a `FileObject`),
then returns a **genuinely-signed** URL from `src/lib/s3.ts` — a dependency-free **AWS
Signature Version 4** pre-signer that works with AWS S3, Supabase Storage (S3 mode), MinIO
and Cloudflare R2. Downloads use signed `GET` URLs. Without complete S3 credentials, file
upload/download endpoints fail safely with HTTP 503 and never return a synthetic URL.

---

## 9. Testing

```bash
npm test            # vitest run
npm run test:coverage
npm run typecheck
npm run build
```

The `src/tests/` suite covers authentication lifecycle, RBAC, tenant isolation,
validation/error shapes, OpenAPI completeness, HTTP runtime behavior, S3 signing,
PostgreSQL worker behavior, and module workflows. Test files currently include:
`app-runtime`, `appointment`, `billing`, `discharge-summary`, `doctor`, `ehr`, `employee`,
`file`, `hospital`, `insurance`, `laboratory`, `notification-template`, `notification`,
`openapi-completeness`, `patient`, `pharmacy`, `report`, `s3`, `security-hardening`,
`shift`, `smoke`, and `worker-core`.

Test counts can change as the suite evolves; run `npm test` for the current result and
`npm run test:coverage` for the current coverage report.

---

## 10. Security checklist

- Helmet security headers, strict CORS allow-list, gzip compression
- Global rate limiting (`express-rate-limit`)
- 1 MB JSON body limit
- Zod validation before business logic; standard error shape
  `{ success, message, errors[], statusCode }`
- No internal stack traces in API responses
- Structured pino logs with redaction; **passwords and tokens are never logged**
- Safe Prisma parameterisation (no raw string concatenation of input)
- Tenant isolation enforced in application code on every tenant-scoped query

> If PostgreSQL **Row-Level Security** is enabled in a deployment, set a transaction-local
> tenant setting for every Prisma transaction and create matching policies. RLS must
> complement, never replace, application-level authorization.

---

## 11. Database

- All persistence is **Supabase PostgreSQL via Prisma**; connection values come from env only.
- Schema lives in `prisma/schema.prisma`; changes are applied with **Prisma migrations**
  (`npm run prisma:migrate`). `npx prisma migrate status` should report *"Database schema is up to date."*
- **Do not** hand-edit Prisma-managed tables via the Supabase Table Editor — use migrations.
- Soft delete, `createdAt`/`updatedAt`, and `createdBy`/`updatedBy` audit fields are used
  where applicable; transactions wrap multi-record writes.

---

## 12. Repository notes

- Commit `.env.example`, but never commit `.env` or other files containing credentials.
- Build output, coverage, dependencies, logs, and local audit output are excluded by
  `.gitignore`.
- Run `npm run prisma:validate`, `npm run typecheck`, `npm run build`, and `npm test`
  before opening a pull request.
- This repository currently contains the backend service. Frontend or deployment-specific
  documentation should be added alongside the relevant application or deployment files.
