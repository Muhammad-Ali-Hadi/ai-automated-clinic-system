import { describe, expect, it } from 'vitest';

describe('Part 1 smoke checks', () => {
  it('loads validated configuration', async () => {
    process.env.DATABASE_URL ??= 'postgresql://postgres.project-ref:change-me@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true';
    process.env.JWT_ACCESS_SECRET ??= 'a'.repeat(32);
    process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);
    const { env } = await import('../config/env.js');
    expect(env.DATABASE_URL).toContain('postgresql://');
  }, 15000);
});
