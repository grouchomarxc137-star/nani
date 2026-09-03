import { describe, expect, it } from 'vitest';
import {
  expectedProgressRatio,
  isGoalReached,
  paceDelta,
  progressPercent,
  progressRatio,
  remainingMl,
  totalMl,
} from '../lib/hydration.js';

const WAKE = 7 * 60; // 07:00
const SLEEP = 22 * 60; // 22:00

describe('daily totals', () => {
  it('sums every source together', () => {
    expect(
      totalMl([{ amountMl: 200 }, { amountMl: 1000 }, { amountMl: 350 }, { amountMl: 125 }]),
    ).toBe(1675);
  });

  it('is zero with no logs', () => {
    expect(totalMl([])).toBe(0);
  });

  it('recalculates correctly once an entry is removed', () => {
    const logs = [{ amountMl: 200 }, { amountMl: 1500 }, { amountMl: 350 }];
    const afterDelete = logs.filter((_, index) => index !== 1);
    expect(totalMl(logs)).toBe(2050);
    expect(totalMl(afterDelete)).toBe(550);
    expect(progressPercent(totalMl(afterDelete), 2500)).toBe(22);
  });
});

describe('progress', () => {
  it('computes percentage of the target', () => {
    expect(progressPercent(1400, 2500)).toBe(56);
    expect(progressPercent(1200, 2000)).toBe(60);
  });

  it('reports over 100% rather than clamping', () => {
    expect(progressPercent(3000, 2000)).toBe(150);
    expect(progressRatio(3000, 2000)).toBe(1.5);
  });

  it('never divides by a zero target', () => {
    expect(progressRatio(500, 0)).toBe(0);
    expect(isGoalReached(500, 0)).toBe(false);
  });

  it('treats exactly hitting the target as reached', () => {
    expect(isGoalReached(2500, 2500)).toBe(true);
    expect(isGoalReached(2499, 2500)).toBe(false);
  });

  it('reports how much is left, never negative', () => {
    expect(remainingMl(1500, 2500)).toBe(1000);
    expect(remainingMl(3000, 2500)).toBe(0);
  });
});

describe('expected progress by time of day', () => {
  it('expects nothing before waking hours', () => {
    expect(expectedProgressRatio(5 * 60, WAKE, SLEEP)).toBe(0);
    expect(expectedProgressRatio(WAKE, WAKE, SLEEP)).toBe(0);
  });

  it('expects roughly half the target around the middle of the day', () => {
    const midday = (WAKE + SLEEP) / 2; // 14:30
    expect(expectedProgressRatio(midday, WAKE, SLEEP)).toBeCloseTo(0.5, 5);
  });

  it('expects the full target by bedtime and after', () => {
    expect(expectedProgressRatio(SLEEP, WAKE, SLEEP)).toBe(1);
    expect(expectedProgressRatio(23 * 60, WAKE, SLEEP)).toBe(1);
  });

  it('rises monotonically through the day', () => {
    const morning = expectedProgressRatio(9 * 60, WAKE, SLEEP);
    const noon = expectedProgressRatio(12 * 60, WAKE, SLEEP);
    const evening = expectedProgressRatio(20 * 60, WAKE, SLEEP);
    expect(morning).toBeLessThan(noon);
    expect(noon).toBeLessThan(evening);
    expect(evening).toBeLessThan(1);
  });

  it('handles an overnight awake window', () => {
    const wake = 9 * 60; // 09:00
    const sleep = 2 * 60; // 02:00 next day
    expect(expectedProgressRatio(9 * 60, wake, sleep)).toBe(0);
    expect(expectedProgressRatio(18 * 60, wake, sleep)).toBeCloseTo(9 / 17, 5);
    expect(expectedProgressRatio(1 * 60, wake, sleep)).toBeCloseTo(16 / 17, 5);
    expect(expectedProgressRatio(5 * 60, wake, sleep)).toBe(1);
  });
});

describe('pace', () => {
  it('is positive when ahead and negative when behind', () => {
    // 50% of the goal at noon is fine; the same 50% at 20:00 is not.
    const noon = paceDelta(0.5, expectedProgressRatio(12 * 60, WAKE, SLEEP));
    const evening = paceDelta(0.5, expectedProgressRatio(20 * 60, WAKE, SLEEP));
    expect(noon).toBeGreaterThan(0);
    expect(evening).toBeLessThan(-0.3);
  });
});
