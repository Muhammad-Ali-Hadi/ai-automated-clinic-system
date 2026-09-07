// Spin up a throwaway embedded Postgres DB and run `prisma migrate deploy` fresh.
import EmbeddedPostgres from 'embedded-postgres';
import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';

const dataDir = new URL('./.deploytest-db', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
if (existsSync(dataDir)) rmSync(dataDir, { recursive: true, force: true });

const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: 5599, persistent: false });
await pg.initialise();
await pg.start();
await pg.createDatabase('freshtest');
console.log('[test] fresh DB up on 5599');

const url = 'postgresql://postgres:postgres@localhost:5599/freshtest';
try {
  const out = execSync('npx prisma migrate deploy', {
    cwd: new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    stdio: 'pipe',
  }).toString();
  console.log(out);
  console.log('RESULT: migrate deploy SUCCEEDED on a fresh database ✅');
} catch (e) {
  console.log(e.stdout?.toString() ?? '');
  console.log(e.stderr?.toString() ?? '');
  console.log('RESULT: migrate deploy FAILED ❌');
  process.exitCode = 1;
} finally {
  await pg.stop();
  rmSync(dataDir, { recursive: true, force: true });
}
