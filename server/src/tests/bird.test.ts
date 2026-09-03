import { describe, expect, it } from 'vitest';
import { BIRD_STATES, birdStateFromPace, describeBird, evaluateBird } from '../lib/bird.js';

const WAKE = 7 * 60;
const SLEEP = 22 * 60;

describe('bird state from pace', () => {
  it('celebrates once the goal is reached, whatever the pace', () => {
    expect(birdStateFromPace(-0.9, true)).toBe('celebrating');
    expect(birdStateFromPace(0.5, true)).toBe('celebrating');
  });

  it('is happy when on or ahead of pace', () => {
    expect(birdStateFromPace(0.2, false)).toBe('happy');
    expect(birdStateFromPace(0, false)).toBe('happy');
    expect(birdStateFromPace(-0.05, false)).toBe('happy');
  });

  it('steps down gently as the gap grows', () => {
    expect(birdStateFromPace(-0.1, false)).toBe('steady');
    expect(birdStateFromPace(-0.2, false)).toBe('thirsty');
    expect(birdStateFromPace(-0.5, false)).toBe('sleepy');
  });

  it('never reaches a state that reads as ill', () => {
    for (const state of BIRD_STATES) {
      const mood = describeBird(state);
      const copy = `${mood.label} ${mood.message}`.toLowerCase();
      for (const word of ['sick', 'ill', 'dying', 'dead', 'fail', 'bad']) {
        expect(copy).not.toContain(word);
      }
    }
  });
});

describe('bird is time-aware, not just percentage-aware', () => {
  const base = { targetMl: 2500, wakeMinute: WAKE, sleepMinute: SLEEP };

  it('treats 50% at noon as on track', () => {
    const mood = evaluateBird({ ...base, consumedMl: 1250, nowMinutes: 12 * 60 });
    expect(mood.state).toBe('happy');
  });

  it('treats the same 50% at 20:00 as behind', () => {
    const mood = evaluateBird({ ...base, consumedMl: 1250, nowMinutes: 20 * 60 });
    expect(mood.state).toBe('sleepy');
  });

  it('treats 20% in the evening as significantly behind', () => {
    const mood = evaluateBird({ ...base, consumedMl: 500, nowMinutes: 20 * 60 });
    expect(mood.state).toBe('sleepy');
  });

  it('does not shame an empty early morning', () => {
    const mood = evaluateBird({ ...base, consumedMl: 0, nowMinutes: 7 * 60 });
    expect(mood.state).toBe('happy');
  });

  it('celebrates a completed goal', () => {
    const mood = evaluateBird({ ...base, consumedMl: 2500, nowMinutes: 15 * 60 });
    expect(mood.state).toBe('celebrating');
    expect(mood.actualRatio).toBe(1);
  });

  it('improves immediately when water is logged', () => {
    const before = evaluateBird({ ...base, consumedMl: 400, nowMinutes: 17 * 60 });
    const after = evaluateBird({ ...base, consumedMl: 1600, nowMinutes: 17 * 60 });
    expect(BIRD_STATES.indexOf(after.state)).toBeLessThan(BIRD_STATES.indexOf(before.state));
  });
});
