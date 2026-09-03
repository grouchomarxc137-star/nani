// Coins exist to encourage reaching a healthy target — never to encourage
// drinking more than it. Overshooting the goal earns exactly nothing extra.

export const DAILY_GOAL_REWARD_COINS = 10;

export interface RewardInput {
  consumedMl: number;
  targetMl: number;
  /** True when a DailyReward row already exists for this user and local date. */
  alreadyAwardedToday: boolean;
  rewardAmount?: number;
}

export interface RewardDecision {
  award: boolean;
  amount: number;
  reason: 'goal_not_reached' | 'already_awarded' | 'award';
}

export function evaluateDailyReward(input: RewardInput): RewardDecision {
  const amount = input.rewardAmount ?? DAILY_GOAL_REWARD_COINS;

  if (input.targetMl <= 0 || input.consumedMl < input.targetMl) {
    return { award: false, amount: 0, reason: 'goal_not_reached' };
  }
  if (input.alreadyAwardedToday) {
    return { award: false, amount: 0, reason: 'already_awarded' };
  }
  // Note the flat amount: drinking 200% of the target still awards `amount`.
  return { award: true, amount, reason: 'award' };
}
