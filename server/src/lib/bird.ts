// The bird's mood is a function of pace, not of raw goal percentage: 50% at
// noon is on track, 50% at 21:00 is behind. Tone stays warm at every level —
// the bird is never sick, never dying, never guilt-inducing.

import { expectedProgressRatio, isGoalReached, paceDelta, progressRatio } from './hydration.js';

export const BIRD_STATES = ['celebrating', 'happy', 'steady', 'thirsty', 'sleepy'] as const;
export type BirdState = (typeof BIRD_STATES)[number];

export interface BirdMood {
  state: BirdState;
  /** Placeholder art. Swap for real illustrations without touching this logic. */
  face: string;
  label: string;
  message: string;
}

const MOODS: Record<BirdState, Omit<BirdMood, 'state'>> = {
  celebrating: {
    face: '🐦✨',
    label: 'Energetic',
    message: 'Goal complete. Look how happy this bird is.',
  },
  happy: {
    face: '🐦',
    label: 'Happy',
    message: 'Right on track today. Keep it going.',
  },
  steady: {
    face: '🐤',
    label: 'Doing fine',
    message: 'Going well. A sip whenever you fancy one.',
  },
  thirsty: {
    face: '🐤💧',
    label: 'A bit thirsty',
    message: 'A little behind. A small glass would be lovely.',
  },
  sleepy: {
    face: '🐣',
    label: 'Low energy',
    message: 'Quite behind today. No rush, just a glass when you can.',
  },
};

/**
 * Thresholds are pace differences, not goal percentages.
 * Kept as one small table so tuning the feel is a one-line change.
 */
const THRESHOLDS: ReadonlyArray<{ minDelta: number; state: BirdState }> = [
  { minDelta: -0.05, state: 'happy' },
  { minDelta: -0.15, state: 'steady' },
  { minDelta: -0.3, state: 'thirsty' },
];

export function birdStateFromPace(delta: number, goalReached: boolean): BirdState {
  if (goalReached) return 'celebrating';
  for (const tier of THRESHOLDS) {
    if (delta >= tier.minDelta) return tier.state;
  }
  return 'sleepy';
}

export function describeBird(state: BirdState): BirdMood {
  return { state, ...MOODS[state] };
}

export interface BirdInput {
  consumedMl: number;
  targetMl: number;
  nowMinutes: number;
  wakeMinute: number;
  sleepMinute: number;
}

/** One call that turns today's numbers into everything the UI needs to draw. */
export function evaluateBird(input: BirdInput): BirdMood & {
  actualRatio: number;
  expectedRatio: number;
  delta: number;
} {
  const actualRatio = progressRatio(input.consumedMl, input.targetMl);
  const expectedRatio = expectedProgressRatio(
    input.nowMinutes,
    input.wakeMinute,
    input.sleepMinute,
  );
  const delta = paceDelta(actualRatio, expectedRatio);
  const state = birdStateFromPace(delta, isGoalReached(input.consumedMl, input.targetMl));
  return { ...describeBird(state), actualRatio, expectedRatio, delta };
}
