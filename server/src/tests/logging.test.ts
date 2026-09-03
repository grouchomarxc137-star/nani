import { describe, expect, it } from 'vitest';
import { MAX_LOG_ML, resolveLogAmount, type LogContext } from '../lib/logging.js';
import { totalMl } from '../lib/hydration.js';

const context: LogContext = {
  activeBottle: { id: 'b1', name: 'Work Bottle', capacityMl: 1500 },
  smallIntakeMl: 200,
  mediumIntakeMl: 300,
  largeIntakeMl: 350,
};

describe('bottle refill', () => {
  it('logs the active bottle capacity with one tap', () => {
    const result = resolveLogAmount({ sourceType: 'bottle' }, context);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.log.amountMl).toBe(1500);
    expect(result.log.sourceType).toBe('bottle');
    expect(result.log.bottleId).toBe('b1');
    expect(result.log.label).toBe('Work Bottle');
  });

  it('snapshots the capacity so later bottle edits do not rewrite history', () => {
    const result = resolveLogAmount({ sourceType: 'bottle' }, context);
    if (!result.ok) throw new Error('expected success');
    expect(result.log.bottleCapacityMl).toBe(1500);
  });

  it('follows whichever bottle is currently active', () => {
    const big = resolveLogAmount(
      { sourceType: 'bottle' },
      { ...context, activeBottle: { id: 'b2', name: 'Big Bottle', capacityMl: 2000 } },
    );
    if (!big.ok) throw new Error('expected success');
    expect(big.log.amountMl).toBe(2000);
  });

  it('refuses when no bottle is active', () => {
    const result = resolveLogAmount({ sourceType: 'bottle' }, { ...context, activeBottle: null });
    expect(result.ok).toBe(false);
  });
});

describe('intake logging', () => {
  it('logs the configured small intake size', () => {
    const result = resolveLogAmount({ sourceType: 'small_intake' }, context);
    if (!result.ok) throw new Error('expected success');
    expect(result.log.amountMl).toBe(200);
  });

  it('logs the configured medium intake size', () => {
    const result = resolveLogAmount({ sourceType: 'medium_intake' }, context);
    if (!result.ok) throw new Error('expected success');
    expect(result.log.amountMl).toBe(300);
    expect(result.log.sourceType).toBe('medium_intake');
  });

  it('logs the configured large intake size', () => {
    const result = resolveLogAmount({ sourceType: 'large_intake' }, context);
    if (!result.ok) throw new Error('expected success');
    expect(result.log.amountMl).toBe(350);
  });

  it('keeps intake water separate from bottle progress', () => {
    const result = resolveLogAmount({ sourceType: 'small_intake' }, context);
    if (!result.ok) throw new Error('expected success');
    expect(result.log.bottleId).toBeNull();
    expect(result.log.bottleCapacityMl).toBeNull();
  });

  it('follows the user reconfiguring their intake sizes', () => {
    const result = resolveLogAmount(
      { sourceType: 'small_intake' },
      { ...context, smallIntakeMl: 250 },
    );
    if (!result.ok) throw new Error('expected success');
    expect(result.log.amountMl).toBe(250);
  });
});

describe('custom amounts', () => {
  it('accepts a sensible custom amount', () => {
    const result = resolveLogAmount({ sourceType: 'custom', amountMl: 125 }, context);
    if (!result.ok) throw new Error('expected success');
    expect(result.log.amountMl).toBe(125);
    expect(result.log.sourceType).toBe('custom');
  });

  it('rejects zero, negative and absurd amounts', () => {
    for (const amountMl of [0, -100, MAX_LOG_ML + 1, Number.NaN]) {
      expect(resolveLogAmount({ sourceType: 'custom', amountMl }, context).ok).toBe(false);
    }
  });
});

describe('a day of mixed logging', () => {
  it('adds every source into one daily total', () => {
    const requests = [
      { sourceType: 'small_intake' } as const,
      { sourceType: 'bottle' } as const,
      { sourceType: 'small_intake' } as const,
      { sourceType: 'custom', amountMl: 125 } as const,
    ];
    const logs = requests.map((request) => {
      const result = resolveLogAmount(request, context);
      if (!result.ok) throw new Error(result.error);
      return result.log;
    });
    expect(totalMl(logs)).toBe(200 + 1500 + 200 + 125);

    const afterUndo = logs.slice(0, -1);
    expect(totalMl(afterUndo)).toBe(1900);
  });
});
