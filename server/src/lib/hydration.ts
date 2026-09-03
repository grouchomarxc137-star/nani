// Pure hydration maths. No database, no dates-as-strings, no side effects, so
// every rule here is directly testable and safe to change later.

export interface AmountEntry {
  amountMl: number;
}

/** Total intake from every source: bottles, glasses and custom amounts alike. */
export function totalMl(entries: readonly AmountEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.amountMl, 0);
}

/**
 * Share of the daily target reached. Not clamped at the top: callers that want
 * a progress bar clamp it themselves, callers that want "how far over" do not.
 */
export function progressRatio(consumedMl: number, targetMl: number): number {
  if (targetMl <= 0) return 0;
  return consumedMl / targetMl;
}

export function progressPercent(consumedMl: number, targetMl: number): number {
  return Math.round(progressRatio(consumedMl, targetMl) * 100);
}

export function remainingMl(consumedMl: number, targetMl: number): number {
  return Math.max(0, targetMl - consumedMl);
}

export function isGoalReached(consumedMl: number, targetMl: number): boolean {
  return targetMl > 0 && consumedMl >= targetMl;
}

/**
 * A general daily fluid guideline for adults, keyed by the two account handles.
 * Roughly the "from drinks" portion of U.S. National Academies figures
 * (~3.7 L / 2.7 L total water per day for men / women, about four fifths of it
 * from what you actually drink). Used only to colour the History mood chart —
 * the per-user `dailyTargetMl` still drives the home-screen goal and the bird.
 */
export const RECOMMENDED_INTAKE_ML: Record<string, number> = {
  principe: 3000, // adult man
  principessa: 2100, // adult woman
};

export function recommendedIntakeMl(userKey: string, fallbackMl: number): number {
  return RECOMMENDED_INTAKE_ML[userKey] ?? fallbackMl;
}

/**
 * How much of the day's target a person would have drunk by now if they spread
 * it evenly across their waking hours. Deliberately linear and simple; this is
 * the single function to replace if we want a smarter curve later.
 *
 * Before waking up the expectation is 0, after bedtime it is 1.
 */
export function expectedProgressRatio(
  nowMinutes: number,
  wakeMinute: number,
  sleepMinute: number,
): number {
  // Overnight awake window (e.g. wake 09:00, sleep 02:00).
  if (sleepMinute <= wakeMinute) {
    const span = 1440 - wakeMinute + sleepMinute;
    if (span <= 0) return 0;
    const elapsed = (nowMinutes - wakeMinute + 1440) % 1440;
    // Outside the window means the night is over: the day's expectation is full.
    if (elapsed > span) return 1;
    return clamp01(elapsed / span);
  }

  if (nowMinutes <= wakeMinute) return 0;
  if (nowMinutes >= sleepMinute) return 1;
  return clamp01((nowMinutes - wakeMinute) / (sleepMinute - wakeMinute));
}

/**
 * Positive means ahead of the pace for this time of day, negative means behind.
 * This is what drives the bird's mood, rather than raw percentage of goal.
 */
export function paceDelta(actualRatio: number, expectedRatio: number): number {
  return actualRatio - expectedRatio;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function clampPercentForDisplay(percent: number): number {
  return Math.min(100, Math.max(0, percent));
}
