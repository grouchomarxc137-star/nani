// Database-facing hydration service. All arithmetic lives in ../lib; this file
// only loads rows, calls those pure functions and writes results back.

import type { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../prisma.js';
import { evaluateBird } from '../lib/bird.js';
import {
  clampPercentForDisplay,
  expectedProgressRatio,
  isGoalReached,
  progressPercent,
  remainingMl,
  totalMl,
} from '../lib/hydration.js';
import { resolveLogAmount, type LogRequest } from '../lib/logging.js';
import { evaluateDailyReward, DAILY_GOAL_REWARD_COINS } from '../lib/rewards.js';
import { localDateKey, localMinutes, minutesToLabel } from '../lib/time.js';

const DEFAULT_WAKE_MINUTE = 420;
const DEFAULT_SLEEP_MINUTE = 1320;

const userInclude = {
  notificationSettings: true,
  activeBird: true,
  bottles: { where: { archived: false }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.UserInclude;

type UserWithRelations = Prisma.UserGetPayload<{ include: typeof userInclude }>;

export interface LogEntryDto {
  id: string;
  amountMl: number;
  sourceType: string;
  label: string | null;
  bottleId: string | null;
  loggedAt: string;
  localDate: string;
}

export interface UserSummaryDto {
  id: string;
  key: string;
  name: string;
  timezone: string;
  localDate: string;
  localTime: string;

  dailyTargetMl: number;
  consumedMl: number;
  remainingMl: number;
  percent: number;
  percentDisplay: number;
  expectedPercent: number;
  goalReached: boolean;

  // Bottle progress is reported separately from daily progress on purpose:
  // water drunk from a glass must never look like bottle progress.
  bottleMl: number;
  glassMl: number;
  customMl: number;
  bottlesFinishedToday: number;

  coinBalance: number;
  smallGlassMl: number;
  largeGlassMl: number;
  activeBottle: { id: string; name: string; capacityMl: number } | null;
  bird: {
    id: string;
    name: string;
    emoji: string;
    state: string;
    face: string;
    label: string;
    message: string;
  };
}

export function wakeSleep(user: UserWithRelations): { wake: number; sleep: number } {
  return {
    wake: user.notificationSettings?.wakeMinute ?? DEFAULT_WAKE_MINUTE,
    sleep: user.notificationSettings?.sleepMinute ?? DEFAULT_SLEEP_MINUTE,
  };
}

export async function loadUser(userId: string): Promise<UserWithRelations | null> {
  return prisma.user.findUnique({ where: { id: userId }, include: userInclude });
}

export async function loadAllUsers(): Promise<UserWithRelations[]> {
  return prisma.user.findMany({ include: userInclude, orderBy: { createdAt: 'asc' } });
}

export async function todaysLogs(user: UserWithRelations, now = new Date()) {
  const localDate = localDateKey(now, user.timezone);
  return prisma.hydrationLog.findMany({
    where: { userId: user.id, localDate },
    orderBy: { loggedAt: 'asc' },
  });
}

export async function buildSummary(
  user: UserWithRelations,
  now = new Date(),
): Promise<UserSummaryDto> {
  const logs = await todaysLogs(user, now);
  return summarise(user, logs, now);
}

/** Pure-ish assembly step: given the day's rows, produce the view model. */
export function summarise(
  user: UserWithRelations,
  logs: readonly { amountMl: number; sourceType: string }[],
  now = new Date(),
): UserSummaryDto {
  const consumedMl = totalMl(logs);
  const target = user.dailyTargetMl;
  const { wake, sleep } = wakeSleep(user);
  const nowMinutes = localMinutes(now, user.timezone);

  const mood = evaluateBird({
    consumedMl,
    targetMl: target,
    nowMinutes,
    wakeMinute: wake,
    sleepMinute: sleep,
  });

  const bySource = (type: string) =>
    totalMl(logs.filter((log) => log.sourceType === type));

  const activeBottle = user.bottles.find((bottle) => bottle.isActive) ?? null;

  return {
    id: user.id,
    key: user.key,
    name: user.name,
    timezone: user.timezone,
    localDate: localDateKey(now, user.timezone),
    localTime: minutesToLabel(nowMinutes),

    dailyTargetMl: target,
    consumedMl,
    remainingMl: remainingMl(consumedMl, target),
    percent: progressPercent(consumedMl, target),
    percentDisplay: clampPercentForDisplay(progressPercent(consumedMl, target)),
    expectedPercent: Math.round(expectedProgressRatio(nowMinutes, wake, sleep) * 100),
    goalReached: isGoalReached(consumedMl, target),

    bottleMl: bySource('bottle'),
    glassMl: bySource('small_glass') + bySource('large_glass'),
    customMl: bySource('custom'),
    bottlesFinishedToday: logs.filter((log) => log.sourceType === 'bottle').length,

    coinBalance: user.coinBalance,
    smallGlassMl: user.smallGlassMl,
    largeGlassMl: user.largeGlassMl,
    activeBottle: activeBottle
      ? { id: activeBottle.id, name: activeBottle.name, capacityMl: activeBottle.capacityMl }
      : null,
    bird: {
      id: user.activeBird?.id ?? 'henna',
      name: user.activeBird?.name ?? 'Henna',
      emoji: user.activeBird?.emoji ?? '🐦',
      state: mood.state,
      face: mood.face,
      label: mood.label,
      message: mood.message,
    },
  };
}

export interface LogResult {
  summary: UserSummaryDto;
  logId: string;
  coinsAwarded: number;
}

export async function logWater(
  userId: string,
  request: LogRequest,
  now = new Date(),
): Promise<{ ok: true; result: LogResult } | { ok: false; error: string }> {
  const user = await loadUser(userId);
  if (!user) return { ok: false, error: 'User not found' };

  const activeBottle = user.bottles.find((bottle) => bottle.isActive) ?? null;
  const resolved = resolveLogAmount(request, {
    activeBottle: activeBottle
      ? { id: activeBottle.id, name: activeBottle.name, capacityMl: activeBottle.capacityMl }
      : null,
    smallGlassMl: user.smallGlassMl,
    largeGlassMl: user.largeGlassMl,
  });
  if (!resolved.ok) return { ok: false, error: resolved.error };

  const localDate = localDateKey(now, user.timezone);
  const created = await prisma.hydrationLog.create({
    data: {
      userId: user.id,
      amountMl: resolved.log.amountMl,
      sourceType: resolved.log.sourceType,
      bottleId: resolved.log.bottleId,
      bottleCapacityMl: resolved.log.bottleCapacityMl,
      label: resolved.log.label,
      loggedAt: now,
      localDate,
    },
  });

  const coinsAwarded = await grantDailyRewardIfEarned(user.id, localDate, now);
  const refreshed = (await loadUser(userId)) ?? user;

  return {
    ok: true,
    result: {
      summary: await buildSummary(refreshed, now),
      logId: created.id,
      coinsAwarded,
    },
  };
}

export async function deleteLog(
  userId: string,
  logId: string,
  now = new Date(),
): Promise<{ ok: true; summary: UserSummaryDto } | { ok: false; error: string }> {
  const log = await prisma.hydrationLog.findUnique({ where: { id: logId } });
  if (!log || log.userId !== userId) return { ok: false, error: 'Entry not found' };

  await prisma.hydrationLog.delete({ where: { id: logId } });

  // Coins already earned today are deliberately kept: the goal genuinely was
  // reached at the time, and taking coins back would feel punitive.
  const user = await loadUser(userId);
  if (!user) return { ok: false, error: 'User not found' };
  return { ok: true, summary: await buildSummary(user, now) };
}

/**
 * Awards the daily goal reward at most once per user per local day.
 * The unique constraint on (userId, date) is the real guarantee; the check
 * below just avoids a pointless write.
 */
export async function grantDailyRewardIfEarned(
  userId: string,
  localDate: string,
  now = new Date(),
): Promise<number> {
  const user = await loadUser(userId);
  if (!user) return 0;

  const logs = await prisma.hydrationLog.findMany({
    where: { userId, localDate },
    select: { amountMl: true },
  });

  const existing = await prisma.dailyReward.findUnique({
    where: { userId_date: { userId, date: localDate } },
  });

  const decision = evaluateDailyReward({
    consumedMl: totalMl(logs),
    targetMl: user.dailyTargetMl,
    alreadyAwardedToday: Boolean(existing),
    rewardAmount: DAILY_GOAL_REWARD_COINS,
  });

  if (!decision.award) return 0;

  try {
    await prisma.$transaction([
      prisma.dailyReward.create({
        data: { userId, date: localDate, rewardAmount: decision.amount, awardedAt: now },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { coinBalance: { increment: decision.amount } },
      }),
    ]);
    return decision.amount;
  } catch (error) {
    // A concurrent request won the race and already created the row.
    if (isUniqueViolation(error)) return 0;
    throw error;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

export function toLogDto(log: {
  id: string;
  amountMl: number;
  sourceType: string;
  label: string | null;
  bottleId: string | null;
  loggedAt: Date;
  localDate: string;
}): LogEntryDto {
  return {
    id: log.id,
    amountMl: log.amountMl,
    sourceType: log.sourceType,
    label: log.label,
    bottleId: log.bottleId,
    loggedAt: log.loggedAt.toISOString(),
    localDate: log.localDate,
  };
}
