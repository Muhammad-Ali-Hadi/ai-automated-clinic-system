# Production engineering

Renovia is deployment-agnostic. It runs as a Node.js API (`npm start`) and a separate
Node.js worker (`npm run worker`), using only process environment for configuration. No
application code assumes a server OS, cloud provider, reverse proxy, process manager,
TLS termination, DNS, container runtime, or deployment mechanism.

## Startup requirements

Provide all required variables from `.env.example` through the selected environment's
secret/configuration system. Do not commit `.env`, and never place secrets in source,
logs, CI files, OpenAPI examples, or client code. Production startup requires unique JWT
secrets, explicit CORS origins, a PostgreSQL/Supabase `DATABASE_URL` and `DIRECT_URL`, and
a complete SMTP configuration. S3-compatible storage is optional but must be complete when
enabled.

`GET /health` reports process liveness without touching the database. `GET /ready` executes
`SELECT 1` through Prisma and returns HTTP 503 while PostgreSQL is unavailable. These endpoints
are provider-neutral and suitable for whatever monitoring system is chosen later.

## Security and operations

Helmet, an explicit CORS allow-list, request IDs, JSON size limits, compression, rate limiting,
Zod request validation, JWT/RBAC/tenant checks, structured Pino logging, and error middleware
are enabled in the application. Logs redact credentials, cookies, passwords, JWTs, refresh
tokens, reset tokens, and cloud/database credentials. API errors never expose stacks.

The worker claims PostgreSQL jobs atomically with `FOR UPDATE SKIP LOCKED`, uses bounded
exponential retry, and reclaims expired leases. Run one or more independent worker processes;
the database concurrency control prevents duplicate claims. Permanently exhausted jobs remain
`FAILED` with a non-sensitive failure reason for operational review.

Email notification delivery uses the real SMTP adapter. SMS, WhatsApp, and Push use explicit
provider interfaces with unavailable adapters until concrete integrations and credentials are
supplied. They fail and retry/terminal-fail through the normal PostgreSQL job lifecycle; no fake
provider or success response is used. External delivery is therefore a deployment/provider
verification step, not something claimed by the application in its current configuration.

## Database workflow

Develop schema changes in `prisma/schema.prisma`, create a Prisma migration, review it, and
commit both schema and migration. CI validates the schema and generates the client without
connecting to the real Supabase database. Check migration state against the intended database
separately with `npx prisma migrate status`; do not use a production connection for development
or destructive validation. Production migration execution is intentionally a later deployment
decision.

## Verification and CI

Use `npm ci`, `npm run prisma:validate`, `npm run prisma:generate`, `npm run typecheck`,
`npm test`, `npm run test:coverage`, and `npm run build` with safe non-production environment
values. The included CI workflow performs install, dependency audit, Prisma schema validation,
generation, typecheck, tests, and build. It neither deploys nor builds container images.

Deployment choices deliberately deferred: hosting/OS, proxy and TLS setup, DNS, process manager,
firewall and secret manager, database migration execution, monitoring vendor, autoscaling, and
zero-downtime strategy.
