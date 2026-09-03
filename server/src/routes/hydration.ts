import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { prisma } from '../prisma.js';
import { isSaneAmount } from '../lib/logging.js';
import { localDateKey } from '../lib/time.js';
import {
  buildSummary,
  deleteLog,
  loadAllUsers,
  loadUser,
  logWater,
  toLogDto,
  todaysLogs,
} from '../services/hydration.js';
import { notifyGoalReached } from '../services/reminders.js';

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
  if (!['bottle', 'small_glass', 'large_glass', 'custom'].includes(sourceType)) {
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

  if (outcome.result.coinsAwarded > 0) {
    // Fire and forget: a push failure must never fail the log itself.
    notifyGoalReached(req.userId!, outcome.result.coinsAwarded).catch((error) =>
      console.error('[push] goal notification failed', error),
    );
  }

  res.status(201).json({ ...outcome.result, clientId: clientId ?? null });
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

/** Recent days, grouped by the user's own local date. */
hydrationRouter.get('/logs/history', requireAuth, async (req, res) => {
  const days = Math.min(60, Math.max(1, Number(req.query.days ?? 14)));
  const user = await loadUser(req.userId!);
  if (!user) {
    res.status(401).json({ error: 'Not signed in' });
    return;
  }

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const logs = await prisma.hydrationLog.findMany({
    where: { userId: user.id, loggedAt: { gte: since } },
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
    days: [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date)),
    logs: logs.map(toLogDto),
  });
});
