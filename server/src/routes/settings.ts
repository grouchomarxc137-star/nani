import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { prisma } from '../prisma.js';
import { isSaneAmount, MAX_LOG_ML } from '../lib/logging.js';
import { isValidTimeZone } from '../lib/time.js';
import { buildSummary, loadUser } from '../services/hydration.js';

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

const MIN_TARGET_ML = 500;
const MAX_TARGET_ML = 6000;

/**
 * The daily target is a user-chosen number with a sensible default. It is not
 * presented as medical advice. A recommendation engine can later fill this in
 * without changing the storage shape.
 */
settingsRouter.patch('/me', async (req, res) => {
  const { dailyTargetMl, timezone, smallIntakeMl, mediumIntakeMl, largeIntakeMl, name } =
    req.body ?? {};
  const data: Record<string, unknown> = {};

  if (dailyTargetMl !== undefined) {
    const value = Number(dailyTargetMl);
    if (!Number.isFinite(value) || value < MIN_TARGET_ML || value > MAX_TARGET_ML) {
      res.status(400).json({ error: `Daily target must be ${MIN_TARGET_ML}-${MAX_TARGET_ML} ml` });
      return;
    }
    data.dailyTargetMl = Math.round(value);
  }

  if (timezone !== undefined) {
    if (typeof timezone !== 'string' || !isValidTimeZone(timezone)) {
      res.status(400).json({ error: 'Unknown timezone' });
      return;
    }
    data.timezone = timezone;
  }

  for (const [field, value] of [
    ['smallIntakeMl', smallIntakeMl],
    ['mediumIntakeMl', mediumIntakeMl],
    ['largeIntakeMl', largeIntakeMl],
  ] as const) {
    if (value === undefined) continue;
    const parsed = Number(value);
    if (!isSaneAmount(parsed)) {
      res.status(400).json({ error: `Intake size must be between 1 and ${MAX_LOG_ML} ml` });
      return;
    }
    data[field] = Math.round(parsed);
  }

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0 || name.length > 40) {
      res.status(400).json({ error: 'Name must be 1-40 characters' });
      return;
    }
    data.name = name.trim();
  }

  await prisma.user.update({ where: { id: req.userId! }, data });
  const user = await loadUser(req.userId!);
  res.json({ me: await buildSummary(user!) });
});

settingsRouter.get('/bottles', async (req, res) => {
  const bottles = await prisma.bottle.findMany({
    where: { userId: req.userId!, archived: false },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ bottles });
});

settingsRouter.post('/bottles', async (req, res) => {
  const { name, capacityMl, makeActive } = req.body ?? {};
  const capacity = Number(capacityMl);

  if (typeof name !== 'string' || name.trim().length === 0 || name.length > 40) {
    res.status(400).json({ error: 'Bottle name must be 1-40 characters' });
    return;
  }
  // Any capacity is allowed: the presets are a convenience, not a constraint.
  if (!isSaneAmount(capacity)) {
    res.status(400).json({ error: `Capacity must be between 1 and ${MAX_LOG_ML} ml` });
    return;
  }

  const bottle = await prisma.bottle.create({
    data: {
      userId: req.userId!,
      name: name.trim(),
      capacityMl: Math.round(capacity),
      isActive: false,
    },
  });

  if (makeActive) await activateBottle(req.userId!, bottle.id);
  res.status(201).json({ bottle });
});

settingsRouter.patch('/bottles/:id', async (req, res) => {
  const bottle = await prisma.bottle.findUnique({ where: { id: String(req.params.id) } });
  if (!bottle || bottle.userId !== req.userId!) {
    res.status(404).json({ error: 'Bottle not found' });
    return;
  }

  const { name, capacityMl, isActive } = req.body ?? {};
  const data: Record<string, unknown> = {};

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Bottle name is required' });
      return;
    }
    data.name = name.trim();
  }
  if (capacityMl !== undefined) {
    const capacity = Number(capacityMl);
    if (!isSaneAmount(capacity)) {
      res.status(400).json({ error: 'Capacity out of range' });
      return;
    }
    // Past logs keep their snapshotted capacity, so this is safe.
    data.capacityMl = Math.round(capacity);
  }

  await prisma.bottle.update({ where: { id: bottle.id }, data });
  if (isActive === true) await activateBottle(req.userId!, bottle.id);

  const bottles = await prisma.bottle.findMany({
    where: { userId: req.userId!, archived: false },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ bottles });
});

/** Archived rather than deleted, so old logs keep pointing at a real bottle. */
settingsRouter.delete('/bottles/:id', async (req, res) => {
  const bottle = await prisma.bottle.findUnique({ where: { id: String(req.params.id) } });
  if (!bottle || bottle.userId !== req.userId!) {
    res.status(404).json({ error: 'Bottle not found' });
    return;
  }

  await prisma.bottle.update({
    where: { id: bottle.id },
    data: { archived: true, isActive: false },
  });

  const remaining = await prisma.bottle.findMany({
    where: { userId: req.userId!, archived: false },
    orderBy: { createdAt: 'asc' },
  });
  if (bottle.isActive && remaining[0]) await activateBottle(req.userId!, remaining[0].id);

  res.json({ ok: true });
});

settingsRouter.get('/notifications', async (req, res) => {
  const settings = await prisma.notificationSettings.findUnique({
    where: { userId: req.userId! },
  });
  res.json({ settings });
});

settingsRouter.patch('/notifications', async (req, res) => {
  const { enabled, intervalMinutes, wakeMinute, sleepMinute } = req.body ?? {};
  const data: Record<string, unknown> = {};

  if (enabled !== undefined) data.enabled = Boolean(enabled);

  if (intervalMinutes !== undefined) {
    const value = Number(intervalMinutes);
    if (!Number.isFinite(value) || value < 30 || value > 480) {
      res.status(400).json({ error: 'Reminder interval must be 30-480 minutes' });
      return;
    }
    data.intervalMinutes = Math.round(value);
  }

  for (const [field, value] of [
    ['wakeMinute', wakeMinute],
    ['sleepMinute', sleepMinute],
  ] as const) {
    if (value === undefined) continue;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1439) {
      res.status(400).json({ error: 'Quiet hours must be a valid time of day' });
      return;
    }
    data[field] = parsed;
  }

  const settings = await prisma.notificationSettings.upsert({
    where: { userId: req.userId! },
    create: { userId: req.userId!, ...data },
    update: data,
  });
  res.json({ settings });
});

async function activateBottle(userId: string, bottleId: string): Promise<void> {
  // Switching bottles never touches previously logged hydration.
  await prisma.$transaction([
    prisma.bottle.updateMany({ where: { userId }, data: { isActive: false } }),
    prisma.bottle.update({ where: { id: bottleId }, data: { isActive: true } }),
  ]);
}
