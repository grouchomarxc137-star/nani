import { describe, expect, it } from 'vitest';
import { DAILY_GOAL_REWARD_COINS, evaluateDailyReward } from '../lib/rewards.js';

describe('daily goal reward', () => {
  it('awards coins the first time the goal is reached', () => {
    const decision = evaluateDailyReward({
      consumedMl: 2500,
      targetMl: 2500,
      alreadyAwardedToday: false,
    });
    expect(decision).toEqual({ award: true, amount: DAILY_GOAL_REWARD_COINS, reason: 'award' });
  });

  it('never awards twice on the same day', () => {
    const decision = evaluateDailyReward({
      consumedMl: 4000,
      targetMl: 2500,
      alreadyAwardedToday: true,
    });
    expect(decision.award).toBe(false);
    expect(decision.amount).toBe(0);
    expect(decision.reason).toBe('already_awarded');
  });

  it('does not pay more for drinking far beyond the target', () => {
    const exact = evaluateDailyReward({
      consumedMl: 2500,
      targetMl: 2500,
      alreadyAwardedToday: false,
    });
    const excessive = evaluateDailyReward({
      consumedMl: 9000,
      targetMl: 2500,
      alreadyAwardedToday: false,
    });
    expect(excessive.amount).toBe(exact.amount);
  });

  it('awards nothing below the target', () => {
    const decision = evaluateDailyReward({
      consumedMl: 2499,
      targetMl: 2500,
      alreadyAwardedToday: false,
    });
    expect(decision.award).toBe(false);
    expect(decision.reason).toBe('goal_not_reached');
  });

  it('is inert when the target is not set', () => {
    expect(
      evaluateDailyReward({ consumedMl: 1000, targetMl: 0, alreadyAwardedToday: false }).award,
    ).toBe(false);
  });

  it('repeated evaluation after an award stays at zero', () => {
    // Mirrors deleting then re-adding logs: coins already given are not re-paid.
    let awarded = false;
    let balance = 0;
    for (const consumed of [2500, 2600, 3000, 2400, 2700]) {
      const decision = evaluateDailyReward({
        consumedMl: consumed,
        targetMl: 2500,
        alreadyAwardedToday: awarded,
      });
      if (decision.award) {
        awarded = true;
        balance += decision.amount;
      }
    }
    expect(balance).toBe(DAILY_GOAL_REWARD_COINS);
  });
});
