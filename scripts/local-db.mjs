/**
 * Local development database. Runs a real PostgreSQL instance from
 * node_modules, so nothing has to be installed on the machine.
 * Data lives in .localdb/ and persists between runs.
 *
 *   npm run db      # starts it, leave it running in a terminal
 *
 * Railway provides the real database in production; this is dev-only.
 */
import EmbeddedPostgres from 'embedded-postgres';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, '.localdb');
const port = Number(process.env.LOCAL_DB_PORT ?? 5433);

mkdirSync(dataDir, { recursive: true });

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'nani',
  password: 'nani',
  port,
  persistent: true,
});

let started = false;

async function main() {
  try {
    await pg.initialise();
  } catch {
    // Already initialised from a previous run.
  }
  await pg.start();
  started = true;
  try {
    await pg.createDatabase('nani');
  } catch {
    // Already exists.
  }
  console.log(`\n[db] postgresql://nani:nani@localhost:${port}/nani\n[db] ready — press Ctrl+C to stop\n`);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    if (started) await pg.stop().catch(() => undefined);
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('[db] failed to start', error);
  process.exit(1);
});
