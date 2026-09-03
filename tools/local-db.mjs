/**
 * Local development Postgres via embedded-postgres (no Docker needed).
 * Starts a real PostgreSQL 17 instance on localhost:5432 with a `renovia` database.
 * Data is persisted under ./.localdb/data. Ctrl-C to stop.
 */
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';

const dataDir = new URL('../.localdb/data', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const fresh = !existsSync(dataDir);

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'postgres',
  password: 'postgres',
  port: 5432,
  persistent: true,
});

if (fresh) {
  console.log('[local-db] initialising cluster...');
  await pg.initialise();
}
console.log('[local-db] starting postgres on 5432...');
await pg.start();

if (fresh) {
  console.log('[local-db] creating database "renovia"...');
  try {
    await pg.createDatabase('renovia');
  } catch (err) {
    if (!String(err?.message ?? err).includes('already exists')) throw err;
  }
}

console.log('LOCALDB_READY');

const shutdown = async () => {
  console.log('\n[local-db] stopping...');
  try { await pg.stop(); } catch {}
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
setInterval(() => {}, 1 << 30);
