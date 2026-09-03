import { describe, expect, it } from 'vitest';
import {
  isValidTimeZone,
  labelToMinutes,
  localDateKey,
  localMinutes,
  minutesToLabel,
  startOfLocalDayUtc,
} from '../lib/time.js';

describe('local calendar day', () => {
  it('uses the user timezone, not the server timezone', () => {
    // 23:30 UTC is already the next day in Rome, still the same day in New York.
    const instant = new Date('2026-09-03T23:30:00Z');
    expect(localDateKey(instant, 'Europe/Rome')).toBe('2026-09-04');
    expect(localDateKey(instant, 'America/New_York')).toBe('2026-09-03');
    expect(localDateKey(instant, 'UTC')).toBe('2026-09-03');
  });

  it('puts the two users on different days when they are in different countries', () => {
    const instant = new Date('2026-09-03T22:15:00Z');
    expect(localDateKey(instant, 'Pacific/Auckland')).toBe('2026-09-04');
    expect(localDateKey(instant, 'America/Los_Angeles')).toBe('2026-09-03');
  });
});

describe('local time of day', () => {
  it('converts an instant to minutes since local midnight', () => {
    const instant = new Date('2026-09-03T12:00:00Z');
    expect(localMinutes(instant, 'UTC')).toBe(720);
    expect(localMinutes(instant, 'Europe/Rome')).toBe(840); // 14:00 CEST
  });

  it('reports midnight as zero, not 1440', () => {
    expect(localMinutes(new Date('2026-09-03T00:00:00Z'), 'UTC')).toBe(0);
  });

  it('respects daylight saving changes', () => {
    const winter = new Date('2026-01-15T12:00:00Z');
    const summer = new Date('2026-07-15T12:00:00Z');
    expect(localMinutes(winter, 'Europe/Rome')).toBe(780); // 13:00 CET
    expect(localMinutes(summer, 'Europe/Rome')).toBe(840); // 14:00 CEST
  });
});

describe('time labels', () => {
  it('round-trips HH:MM', () => {
    expect(minutesToLabel(435)).toBe('07:15');
    expect(minutesToLabel(1320)).toBe('22:00');
    expect(labelToMinutes('07:15')).toBe(435);
    expect(labelToMinutes(minutesToLabel(945))).toBe(945);
  });

  it('rejects nonsense', () => {
    expect(labelToMinutes('25:00')).toBeNull();
    expect(labelToMinutes('07:75')).toBeNull();
    expect(labelToMinutes('lunchtime')).toBeNull();
  });
});

describe('timezone validation', () => {
  it('accepts real zones and rejects invented ones', () => {
    expect(isValidTimeZone('Europe/Rome')).toBe(true);
    expect(isValidTimeZone('America/New_York')).toBe(true);
    expect(isValidTimeZone('Middle/Earth')).toBe(false);
  });
});

describe('start of local day', () => {
  it('lands on local midnight', () => {
    const instant = new Date('2026-09-03T15:00:00Z');
    const start = startOfLocalDayUtc(instant, 'Europe/Rome');
    expect(localMinutes(start, 'Europe/Rome')).toBe(0);
    expect(localDateKey(start, 'Europe/Rome')).toBe('2026-09-03');
  });
});
