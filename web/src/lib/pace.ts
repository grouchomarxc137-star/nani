import { useEffect, useState } from 'react';
import { LOCALE } from './format.js';

/**
 * A clock that re-renders its callers on an interval so time-of-day UI (the
 * "expected by now" pace line, the "now HH:MM" marker) keeps advancing while
 * the user just sits on a tab, without waiting for the next data poll.
 */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, intervalMs);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [intervalMs]);
  return now;
}

/** Minutes since local midnight in the given IANA timezone. NaN if unknown. */
export function minutesInZone(timezone: string, at: Date = new Date()): number {
  try {
    const parts = new Intl.DateTimeFormat(LOCALE, {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(at);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 'x');
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 'x');
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return Number.NaN;
    return ((hour % 24) * 60 + minute) % 1440;
  } catch {
    return Number.NaN;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Fraction of the awake window elapsed at `nowMinutes`, i.e. where an evenly
 * paced drinker "should" be. Mirrors the server's expectedProgressRatio,
 * including the case where bedtime is past midnight.
 */
export function expectedRatioAt(
  nowMinutes: number,
  wakeMinute: number,
  sleepMinute: number,
): number {
  if (sleepMinute <= wakeMinute) {
    const span = 1440 - wakeMinute + sleepMinute;
    if (span <= 0) return 0;
    const elapsed = (nowMinutes - wakeMinute + 1440) % 1440;
    if (elapsed > span) return 1;
    return clamp(elapsed / span, 0, 1);
  }
  if (nowMinutes <= wakeMinute) return 0;
  if (nowMinutes >= sleepMinute) return 1;
  return clamp((nowMinutes - wakeMinute) / (sleepMinute - wakeMinute), 0, 1);
}

interface PaceLike {
  timezone: string;
  wakeMinute: number;
  sleepMinute: number;
  expectedPercent: number;
  localTime: string;
}

/**
 * The live "expected by now" reading for a summary: recomputed from the wall
 * clock when we can place the user's timezone, otherwise the value the server
 * sent with the last poll.
 */
export function livePace(
  summary: PaceLike,
  now: Date,
): { ratio: number; percent: number; clock: string } {
  const nowMinutes = minutesInZone(summary.timezone, now);
  if (Number.isNaN(nowMinutes)) {
    return {
      ratio: clamp(summary.expectedPercent / 100, 0, 1),
      percent: summary.expectedPercent,
      clock: summary.localTime,
    };
  }
  const ratio = expectedRatioAt(nowMinutes, summary.wakeMinute, summary.sleepMinute);
  const hh = String(Math.floor(nowMinutes / 60)).padStart(2, '0');
  const mm = String(nowMinutes % 60).padStart(2, '0');
  return { ratio, percent: Math.round(ratio * 100), clock: `${hh}:${mm}` };
}
