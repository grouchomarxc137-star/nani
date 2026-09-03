// Runs periodically and asks, per user: should a reminder go out right now?
// Sized for two people, not for thousands.

import { prisma } from '../prisma.js';
import { evaluateBird } from '../lib/bird.js';
import { totalMl } from '../lib/hydration.js';
import {
  buildGoalReachedMessage,
  buildReminderMessage,
  evaluateReminder,
  type ReminderDecision,
} from '../lib/notifications.js';
import { localDateKey, localMinutes } from '../lib/time.js';
import { loadAllUsers, wakeSleep } from './hydration.js';
import { sendToUser } from './push.js';

export interface ReminderRunEntry {
  user: string;
  decision: ReminderDecision;
  delivered?: number;
}

/** One scheduler tick. Returns what it decided, which makes it easy to test by hand. */
export async function runReminderSweep(now = new Date()): Promise<ReminderRunEntry[]> {
  const users = await loadAllUsers();
  const entries: ReminderRunEntry[] = [];

  for (const user of users) {
    const settings = user.notificationSettings;
    const localDate = localDateKey(now, user.timezone);
    const nowMinutes = localMinutes(now, user.timezone);
    const { wake, sleep } = wakeSleep(user);

    const logs = await prisma.hydrationLog.findMany({
      where: { userId: user.id, localDate },
      select: { amountMl: true },
    });
    const consumedMl = totalMl(logs);

    const mood = evaluateBird({
      consumedMl,
      targetMl: user.dailyTargetMl,
      nowMinutes,
      wakeMinute: wake,
      sleepMinute: sleep,
    });

    const subscriptionCount = await prisma.pushSubscription.count({ where: { userId: user.id } });

    const decision = evaluateReminder({
      enabled: settings?.enabled ?? false,
      hasSubscriptions: subscriptionCount > 0,
      nowMinutes,
      wakeMinute: wake,
      sleepMinute: sleep,
      intervalMinutes: settings?.intervalMinutes ?? 120,
      lastSentAt: settings?.lastSentAt ?? null,
      now,
      goalReached: consumedMl >= user.dailyTargetMl,
      paceDelta: mood.delta,
    });

    if (!decision.send) {
      entries.push({ user: user.key, decision });
      continue;
    }

    const fact = await nextFact(settings?.lastFactIndex ?? 0);
    const message = buildReminderMessage(decision.tone, fact);
    const report = await sendToUser(user.id, {
      ...message,
      tag: 'nani-reminder',
      url: '/',
    });

    await prisma.notificationSettings.update({
      where: { userId: user.id },
      data: {
        lastSentAt: now,
        lastFactIndex: (settings?.lastFactIndex ?? 0) + 1,
      },
    });

    entries.push({ user: user.key, decision, delivered: report.sent });
  }

  return entries;
}

/** Facts are curated rows, walked in order — never generated on the fly. */
async function nextFact(index: number): Promise<{ text: string } | null> {
  const facts = await prisma.hydrationFact.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
    select: { text: true },
  });
  if (facts.length === 0) return null;
  return facts[index % facts.length];
}

export async function notifyGoalReached(userId: string, coins: number): Promise<void> {
  const message = buildGoalReachedMessage(coins);
  await sendToUser(userId, { ...message, tag: 'nani-goal', url: '/' });
}
