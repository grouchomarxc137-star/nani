import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { prisma } from '../prisma.js';
import { pushIsConfigured, sendToUser, vapidPublicKey } from '../services/push.js';

export const pushRouter = Router();

/** Only the *public* VAPID key is ever exposed. */
pushRouter.get('/key', (_req, res) => {
  res.json({ publicKey: vapidPublicKey(), configured: pushIsConfigured() });
});

pushRouter.use(requireAuth);

pushRouter.post('/subscribe', async (req, res) => {
  const { endpoint, keys } = req.body ?? {};
  if (typeof endpoint !== 'string' || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ error: 'Invalid push subscription' });
    return;
  }

  // Upsert on endpoint: re-subscribing on the same device replaces the old row,
  // and a device that changes hands moves to the new user.
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: req.userId!, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { userId: req.userId!, p256dh: keys.p256dh, auth: keys.auth },
  });

  await prisma.notificationSettings.upsert({
    where: { userId: req.userId! },
    create: { userId: req.userId!, enabled: true },
    update: { enabled: true },
  });

  res.status(201).json({ ok: true });
});

pushRouter.post('/unsubscribe', async (req, res) => {
  const { endpoint } = req.body ?? {};
  if (typeof endpoint === 'string') {
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.userId! } });
  } else {
    await prisma.pushSubscription.deleteMany({ where: { userId: req.userId! } });
  }
  res.json({ ok: true });
});

/** Used during setup to prove notifications actually reach the phone. */
pushRouter.post('/test', async (req, res) => {
  const report = await sendToUser(req.userId!, {
    title: 'Nani test 💧',
    body: 'Push notifications are working.',
    tag: 'nani-test',
    url: '/',
  });
  res.json({ report, configured: pushIsConfigured() });
});

/**
 * Runs the reminder decision for every user immediately. Handy while testing
 * on a phone, so we do not have to wait for the next scheduled sweep.
 */
pushRouter.post('/sweep', async (_req, res) => {
  const { runReminderSweep } = await import('../services/reminders.js');
  res.json({ entries: await runReminderSweep() });
});
