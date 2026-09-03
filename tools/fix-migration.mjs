/**
 * Recovery for the partially-failed migration 20260811000000_extended_auth_and_reconcile.
 * It re-adds FK constraints that 20260810030000 already created (unguarded ADD CONSTRAINT).
 * We replay its statements idempotently, ignoring "already exists" errors, then the caller
 * marks it resolved with `prisma migrate resolve --applied`.
 */
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const sql = readFileSync(
  new URL('../prisma/migrations/20260811000000_extended_auth_and_reconcile/migration.sql', import.meta.url),
  'utf8',
);

// naive splitter is fine: this migration has no dollar-quoted bodies
const statements = sql
  .split(/;\s*$/m)
  .map((s) => s.replace(/--.*$/gm, '').trim())
  .filter(Boolean);

const IGNORABLE = new Set(['42710', '42P07', '42701', '42P16', '42P16']);

const prisma = new PrismaClient();
let applied = 0;
let skipped = 0;
for (const stmt of statements) {
  try {
    await prisma.$executeRawUnsafe(stmt);
    applied++;
  } catch (err) {
    const code = err?.meta?.code ?? err?.code ?? '';
    const msg = String(err?.message ?? err);
    if (IGNORABLE.has(code) || /already exists/i.test(msg)) {
      skipped++;
      continue;
    }
    console.error('FAILED statement:\n', stmt, '\n', msg);
    await prisma.$disconnect();
    process.exit(1);
  }
}
console.log(`MIGRATION_PATCHED applied=${applied} skipped=${skipped}`);
await prisma.$disconnect();
