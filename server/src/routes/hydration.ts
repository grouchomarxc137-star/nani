import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { prisma } from '../prisma.js';
import { isSaneAmount } from '../lib/logging.js';
import { recommendedIntakeMl } from '../lib/hydration.js';
import { localDateKey } from '../lib/time.js';
import {
  buildSummary,
  deleteLog,
  loadAllUsers,
  loadUser,
  logWater,
  toLogDto,
  todaysLogs,
  updateLog,
} from '../services/hydration.js';

export const hydrationRouter = Router();

// Auth is applied per route rather than with a blanket `router.use`: this
// router is mounted at /api, so a blanket guard would also intercept every
// other /api/* route mounted after it, including public ones.

/**
 * The home screen in one request: me plus my partner, side by side.
 * The frontend polls this, so it stays cheap and self-contained.
 */
hydrationRouter.get('/summary', requireAuth, async (req, res) => {
  const users = await loadAllUsers();
  const summaries = await Promise.all(users.map((user) => buildSummary(user)));
  const me = summaries.find((summary) => summary.id === req.userId);
  const partner = summaries.find((summary) => summary.id !== req.userId) ?? null;

  if (!me) {
    res.status(401).json({ error: 'Not signed in' });
    return;
  }
  res.json({ me, partner, serverTime: new Date().toISOString() });
});

hydrationRouter.post('/logs', requireAuth, async (req, res) => {
  const { sourceType, amountMl, clientId } = req.body ?? {};

  if (sourceType === 'custom' && !isSaneAmount(Number(amountMl))) {
    res.status(400).json({ error: 'Enter an amount between 1 and 5000 ml' });
    return;
  }
  if (
    !['bottle', 'small_intake', 'medium_intake', 'large_intake', 'custom'].includes(sourceType)
  ) {
    res.status(400).json({ error: 'Unknown source type' });
    return;
  }

  const request =
    sourceType === 'custom'
      ? ({ sourceType: 'custom', amountMl: Number(amountMl) } as const)
      : ({ sourceType } as const);

  const outcome = await logWater(req.userId!, request);
  if (!outcome.ok) {
    res.status(400).json({ error: outcome.error });
    return;
  }


  res.status(201).json({ ...outcome.result, clientId: clientId ?? null });
});

/** Correct the amount on an existing entry. Source type stays as first logged. */
hydrationRouter.patch('/logs/:id', requireAuth, async (req, res) => {
  const amountMl = Number(req.body?.amountMl);
  if (!isSaneAmount(amountMl)) {
    res.status(400).json({ error: 'Enter an amount between 1 and 5000 ml' });
    return;
  }

  const outcome = await updateLog(req.userId!, String(req.params.id), amountMl);
  if (!outcome.ok) {
    res.status(outcome.error === 'Entry not found' ? 404 : 400).json({ error: outcome.error });
    return;
  }
  res.json({ summary: outcome.summary, log: outcome.log });
});

hydrationRouter.delete('/logs/:id', requireAuth, async (req, res) => {
  const outcome = await deleteLog(req.userId!, String(req.params.id));
  if (!outcome.ok) {
    res.status(404).json({ error: outcome.error });
    return;
  }
  res.json({ summary: outcome.summary });
});

/** Today's entries, newest first. */
hydrationRouter.get('/logs/today', requireAuth, async (req, res) => {
  const user = await loadUser(req.userId!);
  if (!user) {
    res.status(401).json({ error: 'Not signed in' });
    return;
  }
  const logs = await todaysLogs(user);
  res.json({ logs: logs.reverse().map(toLogDto) });
});

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Days grouped by the user's own local date. Two ways to ask:
 *  - `?days=N` — a rolling window of the last N days (default 14, max 60).
 *  - `?from=YYYY-MM-DD&to=YYYY-MM-DD` — an explicit inclusive range, used by
 *    the calendar month view, which needs to page arbitrarily far back.
 */
hydrationRouter.get('/logs/history', requireAuth, async (req, res) => {
  const user = await loadUser(req.userId!);
  if (!user) {
    res.status(401).json({ error: 'Not signed in' });
    return;
  }

  const from = typeof req.query.from === 'string' ? req.query.from : null;
  const to = typeof req.query.to === 'string' ? req.query.to : null;
  const useRange = from !== null || to !== null;
  if (useRange && (!DATE_KEY.test(from ?? '') || !DATE_KEY.test(to ?? ''))) {
    res.status(400).json({ error: 'from and to must be YYYY-MM-DD' });
    return;
  }

  const where = useRange
    ? { userId: user.id, localDate: { gte: from!, lte: to! } }
    : (() => {
        const days = Math.min(60, Math.max(1, Number(req.query.days ?? 14)));
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        return { userId: user.id, loggedAt: { gte: since } };
      })();

  const logs = await prisma.hydrationLog.findMany({
    where,
    orderBy: { loggedAt: 'desc' },
  });

  const byDate = new Map<string, { date: string; totalMl: number; entries: number }>();
  for (const log of logs) {
    const bucket = byDate.get(log.localDate) ?? { date: log.localDate, totalMl: 0, entries: 0 };
    bucket.totalMl += log.amountMl;
    bucket.entries += 1;
    byDate.set(log.localDate, bucket);
  }

  const today = localDateKey(new Date(), user.timezone);
  res.json({
    today,
    dailyTargetMl: user.dailyTargetMl,
    // Colours the mood chart: how a finished day compares to the general
    // adult fluid guideline for this person (men vs women), not their goal.
    recommendedMl: recommendedIntakeMl(user.key, user.dailyTargetMl),
    days: [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date)),
    logs: logs.map(toLogDto),
  });
});
