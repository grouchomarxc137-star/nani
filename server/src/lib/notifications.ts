// Deciding *whether* to send a reminder. Deliberately separate from delivery
// (see push.ts) so the rules can be tested without touching the network.

import type { BirdState } from './bird.js';

export type SkipReason =
  | 'disabled'
  | 'no_subscriptions'
  | 'quiet_hours'
  | 'goal_reached'
  | 'too_soon';

export type ReminderDecision =
  | { send: true; tone: ReminderTone }
  | { send: false; reason: SkipReason };

export type ReminderTone = 'ahead' | 'on_track' | 'behind' | 'well_behind';

/** Quiet hours are simply "outside the awake window". */
export function isQuietHours(
  nowMinutes: number,
  wakeMinute: number,
  sleepMinute: number,
): boolean {
  if (sleepMinute <= wakeMinute) {
    // Overnight awake window: quiet is the gap between sleep and wake.
    return nowMinutes >= sleepMinute && nowMinutes < wakeMinute;
  }
  return nowMinutes < wakeMinute || nowMinutes >= sleepMinute;
}

export function toneFromPace(delta: number): ReminderTone {
  if (delta >= 0.05) return 'ahead';
  if (delta >= -0.1) return 'on_track';
  if (delta >= -0.25) return 'behind';
  return 'well_behind';
}

export interface ReminderInput {
  enabled: boolean;
  hasSubscriptions: boolean;
  nowMinutes: number;
  wakeMinute: number;
  sleepMinute: number;
  intervalMinutes: number;
  /** Last reminder actually delivered, or null if none today. */
  lastSentAt: Date | null;
  now: Date;
  goalReached: boolean;
  paceDelta: number;
}

export function evaluateReminder(input: ReminderInput): ReminderDecision {
  if (!input.enabled) return { send: false, reason: 'disabled' };
  if (!input.hasSubscriptions) return { send: false, reason: 'no_subscriptions' };
  if (isQuietHours(input.nowMinutes, input.wakeMinute, input.sleepMinute)) {
    return { send: false, reason: 'quiet_hours' };
  }
  // Once the day's target is met we stop nagging entirely for the rest of it.
  if (input.goalReached) return { send: false, reason: 'goal_reached' };

  if (input.lastSentAt) {
    const elapsedMinutes = (input.now.getTime() - input.lastSentAt.getTime()) / 60_000;
    if (elapsedMinutes < input.intervalMinutes) return { send: false, reason: 'too_soon' };
  }

  return { send: true, tone: toneFromPace(input.paceDelta) };
}

// Message templates. Kept as data so wording can change without code changes.
const TITLES: Record<ReminderTone, string> = {
  ahead: 'Nicely ahead 💧',
  on_track: 'Right on track 💧',
  behind: 'Tiny water break? 💧',
  well_behind: 'Henna could use some water 👀💧',
};

const BODIES: Record<ReminderTone, string[]> = {
  ahead: ['You are comfortably ahead today. Keep it gentle.'],
  on_track: ['You are doing well. Keep it going ♡'],
  behind: ['A small glass would put you back on pace.'],
  well_behind: ['No rush at all. A glass whenever you can ♡'],
};

export interface ReminderMessage {
  title: string;
  body: string;
}

export interface FactLike {
  text: string;
}

/**
 * Builds the notification copy. A curated hydration fact is mixed in when one
 * is supplied; facts are never generated on the fly.
 */
export function buildReminderMessage(
  tone: ReminderTone,
  fact: FactLike | null,
  variantIndex = 0,
): ReminderMessage {
  const bodies = BODIES[tone];
  const body = bodies[variantIndex % bodies.length];
  return {
    title: TITLES[tone],
    body: fact ? `${body}\n${fact.text}` : body,
  };
}

const GOAL_TITLES: Record<'reached', string> = { reached: 'Daily hydration complete 💧' };

export function buildGoalReachedMessage(coins: number): ReminderMessage {
  return {
    title: GOAL_TITLES.reached,
    body: `Henna is happy. +${coins} coins ♡`,
  };
}

/** Bird states that a reminder may reference. Kept for future copy variants. */
export const REMINDER_BIRD_STATES: readonly BirdState[] = ['thirsty', 'sleepy'];
