import { describe, expect, it } from 'vitest';
import { companionMessage } from '../lib/companion.js';
import { buildReminderMessage, evaluateReminder } from '../lib/notifications.js';
import { displayName, greeting, loggedMessage } from '../../../web/src/lib/companion.js';

describe('approved companion voice', () => {
  const amira = { key: 'principessa', name: 'Principessa' };
  it('uses the recipient timezone for the morning and evening greetings', () => {
    expect(greeting(amira, 'Europe/Rome', new Date('2026-10-29T08:00:00Z'))).toBe('Buongiorno Amira💛');
    expect(greeting(amira, 'Europe/Rome', new Date('2026-10-29T19:00:00Z'))).toBe('Ciao Principessa');
    expect(greeting(amira, 'America/Los_Angeles', new Date('2026-10-29T13:00:00Z'))).toBe('Buongiorno Amira💛');
  });
  it('keeps the personal identity in display copy, without changing accounts', () => {
    expect(displayName(amira)).toBe('Amira');
    expect(amira.name).toBe('Principessa');
    expect(displayName({ key: 'principe', name: 'Principe' })).toBe('Principe');
    expect(loggedMessage('principe', true)).not.toContain('Princess');
  });
  it('keeps the approved success and goal messages', () => {
    expect(loggedMessage('principessa', false)).toBe('Look at her😍');
    expect(loggedMessage('principessa', true)).toBe("That's my Princess💛");
    expect(companionMessage('celebrating', 'principessa', '')).toBe("That's my Princess💛");
  });
  it('uses the stronger wording for behind states, and preserves other users’ copy', () => {
    expect(companionMessage('sleepy', 'principessa', '')).toBe('You should drink more my love');
    expect(companionMessage('thirsty', 'principessa', '')).toBe('You should drink more my love');
    expect(companionMessage('happy', 'principe', 'fallback')).toBe('fallback');
    expect(buildReminderMessage('on_track', null, 0, 'principessa').body).toBe('You should drink my love, I only have one of you💛');
    expect(buildReminderMessage('well_behind', null, 0, 'principessa').body).toBe('You should drink more my love');
    expect(buildReminderMessage('well_behind', null, 0, 'principe').body).not.toContain('my love');
  });
  it('still suppresses reminders at the goal, regardless of personalized wording', () => {
    expect(evaluateReminder({ enabled: true, hasSubscriptions: true, nowMinutes: 1000, wakeMinute: 480, sleepMinute: 1350, intervalMinutes: 120, lastSentAt: null, now: new Date(), goalReached: true, paceDelta: -1 })).toEqual({ send: false, reason: 'goal_reached' });
  });
});
