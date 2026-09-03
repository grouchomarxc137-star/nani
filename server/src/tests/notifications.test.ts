import { describe, expect, it } from 'vitest';
import {
  buildReminderMessage,
  evaluateReminder,
  isQuietHours,
  toneFromPace,
  type ReminderInput,
} from '../lib/notifications.js';

const WAKE = 7 * 60;
const SLEEP = 22 * 60;
const NOW = new Date('2026-09-03T12:00:00Z');

function input(overrides: Partial<ReminderInput> = {}): ReminderInput {
  return {
    enabled: true,
    hasSubscriptions: true,
    nowMinutes: 12 * 60,
    wakeMinute: WAKE,
    sleepMinute: SLEEP,
    intervalMinutes: 120,
    lastSentAt: null,
    now: NOW,
    goalReached: false,
    paceDelta: -0.2,
    ...overrides,
  };
}

describe('quiet hours', () => {
  it('is quiet before waking and after bedtime', () => {
    expect(isQuietHours(3 * 60, WAKE, SLEEP)).toBe(true);
    expect(isQuietHours(23 * 60, WAKE, SLEEP)).toBe(true);
    expect(isQuietHours(6 * 60 + 59, WAKE, SLEEP)).toBe(true);
  });

  it('is not quiet during the day', () => {
    expect(isQuietHours(WAKE, WAKE, SLEEP)).toBe(false);
    expect(isQuietHours(14 * 60, WAKE, SLEEP)).toBe(false);
    expect(isQuietHours(SLEEP - 1, WAKE, SLEEP)).toBe(false);
  });

  it('treats bedtime itself as quiet', () => {
    expect(isQuietHours(SLEEP, WAKE, SLEEP)).toBe(true);
  });

  it('handles an overnight awake window', () => {
    const wake = 9 * 60;
    const sleep = 2 * 60;
    expect(isQuietHours(1 * 60, wake, sleep)).toBe(false);
    expect(isQuietHours(4 * 60, wake, sleep)).toBe(true);
    expect(isQuietHours(20 * 60, wake, sleep)).toBe(false);
  });
});

describe('reminder eligibility', () => {
  it('sends when behind, awake and past the interval', () => {
    const decision = evaluateReminder(input());
    expect(decision.send).toBe(true);
  });

  it('never sends during quiet hours', () => {
    const decision = evaluateReminder(input({ nowMinutes: 2 * 60 }));
    expect(decision).toEqual({ send: false, reason: 'quiet_hours' });
  });

  it('stops reminding once the goal is reached', () => {
    const decision = evaluateReminder(input({ goalReached: true }));
    expect(decision).toEqual({ send: false, reason: 'goal_reached' });
  });

  it('respects the goal even when badly behind on pace', () => {
    const decision = evaluateReminder(input({ goalReached: true, paceDelta: -0.9 }));
    expect(decision.send).toBe(false);
  });

  it('honours the disabled switch', () => {
    expect(evaluateReminder(input({ enabled: false }))).toEqual({
      send: false,
      reason: 'disabled',
    });
  });

  it('does nothing without a push subscription', () => {
    expect(evaluateReminder(input({ hasSubscriptions: false }))).toEqual({
      send: false,
      reason: 'no_subscriptions',
    });
  });

  it('does not send twice inside the interval', () => {
    const decision = evaluateReminder({
      ...input(),
      lastSentAt: new Date(NOW.getTime() - 30 * 60_000),
    });
    expect(decision).toEqual({ send: false, reason: 'too_soon' });
  });

  it('sends again once the interval has passed', () => {
    const decision = evaluateReminder({
      ...input(),
      lastSentAt: new Date(NOW.getTime() - 121 * 60_000),
    });
    expect(decision.send).toBe(true);
  });
});

describe('reminder tone', () => {
  it('escalates gently as the gap grows', () => {
    expect(toneFromPace(0.3)).toBe('ahead');
    expect(toneFromPace(0)).toBe('on_track');
    expect(toneFromPace(-0.2)).toBe('behind');
    expect(toneFromPace(-0.6)).toBe('well_behind');
  });

  it('picks the tone matching the pace when sending', () => {
    const decision = evaluateReminder(input({ paceDelta: -0.6 }));
    expect(decision).toMatchObject({ send: true, tone: 'well_behind' });
  });
});

describe('reminder copy', () => {
  it('includes a curated fact when one is supplied', () => {
    const message = buildReminderMessage('behind', {
      text: 'Water helps the body regulate temperature.',
    });
    expect(message.body).toContain('Water helps the body regulate temperature.');
  });

  it('works without a fact', () => {
    const message = buildReminderMessage('on_track', null);
    expect(message.title.length).toBeGreaterThan(0);
    expect(message.body.length).toBeGreaterThan(0);
  });

  it('stays gentle in the most-behind tone', () => {
    const message = buildReminderMessage('well_behind', null);
    const copy = `${message.title} ${message.body}`.toLowerCase();
    for (const word of ['must', 'failed', 'should have', 'behind schedule!']) {
      expect(copy).not.toContain(word);
    }
  });
});
