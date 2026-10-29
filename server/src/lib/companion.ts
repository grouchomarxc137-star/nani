import type { BirdState } from './bird.js';

/** Personal wording is presentation only. Hydration and reminder rules are unchanged. */
export function companionMessage(state: BirdState, userKey: string, fallback: string): string {
  if (userKey !== 'principessa') return fallback;
  if (state === 'celebrating') return "That's my Princess💛";
  if (state === 'thirsty' || state === 'sleepy') return 'You should drink more my love';
  return 'You should drink my love, I only have one of you💛';
}
