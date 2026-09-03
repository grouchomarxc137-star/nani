import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { env } from './env.js';
import { authRouter } from './routes/auth.js';
import { hydrationRouter } from './routes/hydration.js';
import { settingsRouter } from './routes/settings.js';
import { storeRouter } from './routes/store.js';
import { pushRouter } from './routes/push.js';
import { startScheduler } from './scheduler.js';
import { disconnectPrisma, prisma } from './prisma.js';
import { pushIsConfigured } from './services/push.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));
if (env.corsOrigin) app.use(cors({ origin: env.corsOrigin.split(',') }));

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, push: pushIsConfigured() });
  } catch {
    res.status(503).json({ ok: false, error: 'Database unavailable' });
  }
});

app.use('/api/auth', authRouter);
app.use('/api', hydrationRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/store', storeRouter);
app.use('/api/push', pushRouter);

// Unknown API routes answer in JSON rather than falling through to Express's
// default HTML error page.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// In production the API also serves the built PWA, so Railway needs one
// service rather than two.
const webDist = path.resolve(here, '..', env.webDistPath);
app.use(
  express.static(webDist, {
    setHeaders(res, filePath) {
      // The service worker must never be cached, or phones keep a stale one.
      if (filePath.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache');
    },
  }),
);

// SPA fallback for client-side routes. Registered as middleware rather than a
// wildcard route to stay clear of Express 5 path parsing.
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/')) {
    next();
    return;
  }
  res.sendFile(path.join(webDist, 'index.html'), (error) => {
    if (error) res.status(404).json({ error: 'Not found' });
  });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[api] unhandled error', error);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Something went wrong' });
});

const server = app.listen(env.port, () => {
  console.log(`[nani] listening on :${env.port}`);
  if (!pushIsConfigured()) {
    console.warn('[nani] VAPID keys missing — push notifications are disabled. Run: npm run vapid');
  }
  startScheduler();
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => {
      disconnectPrisma().finally(() => process.exit(0));
    });
  });
}
