/** Local review only. Always overrides the DB, auth and push environment. */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const database = path.join(tmpdir(), `nani-henna-preview-${process.getuid?.() ?? 'local'}.db`);
const fresh = !existsSync(database);
const port = Number(process.env.PREVIEW_PORT ?? 3000);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PREVIEW_PORT must be between 1024 and 65535.');
const env = { ...process.env, NODE_ENV: 'production', DATABASE_URL: `file:${database}`, APP_PASSWORD: '246810', SESSION_SECRET: randomBytes(32).toString('hex'), SCHEDULER_ENABLED: 'false', VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '', PORT: String(port), WEB_DIST_PATH: '../web/dist' };
function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`Preview command stopped (${signal ?? code}).`)));
  });
}
await run('npm', ['run', 'build']);
await run('npm', ['run', 'prisma:deploy']);
if (fresh) await run(process.execPath, ['--import', 'tsx', 'server/prisma/seed.ts']);
console.log(`\nLocal preview: http://localhost:${port}\nDemo PIN: 246810\nSeparate demo database: ${database}\nReminders and push are disabled. Press Ctrl+C to stop.\n`);
await run(process.execPath, ['server/dist/index.js']);
