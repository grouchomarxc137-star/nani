// Turning a one-tap action into a hydration log entry.
// The whole point is that the user never types millilitres: the amount comes
// from their active bottle or their configured intake sizes.

import type { SourceType } from './types.js';

export const MIN_LOG_ML = 1;
/** Guards against a mistyped custom amount, not against drinking a lot. */
export const MAX_LOG_ML = 5000;

export interface BottleLike {
  id: string;
  name: string;
  capacityMl: number;
}

export interface LogContext {
  activeBottle: BottleLike | null;
  smallIntakeMl: number;
  mediumIntakeMl: number;
  largeIntakeMl: number;
}

export type LogRequest =
  | { sourceType: 'bottle' }
  | { sourceType: 'small_intake' }
  | { sourceType: 'medium_intake' }
  | { sourceType: 'large_intake' }
  | { sourceType: 'custom'; amountMl: number };

export interface ResolvedLog {
  amountMl: number;
  sourceType: SourceType;
  bottleId: string | null;
  bottleCapacityMl: number | null;
  label: string;
}

export type ResolveResult =
  | { ok: true; log: ResolvedLog }
  | { ok: false; error: string };

/** Finishing a bottle logs exactly the active bottle's capacity. */
export function resolveLogAmount(request: LogRequest, context: LogContext): ResolveResult {
  switch (request.sourceType) {
    case 'bottle': {
      if (!context.activeBottle) {
        return { ok: false, error: 'No active bottle selected' };
      }
      const bottle = context.activeBottle;
      if (!isSaneAmount(bottle.capacityMl)) {
        return { ok: false, error: 'Active bottle capacity is out of range' };
      }
      return {
        ok: true,
        log: {
          amountMl: bottle.capacityMl,
          sourceType: 'bottle',
          bottleId: bottle.id,
          bottleCapacityMl: bottle.capacityMl,
          label: bottle.name,
        },
      };
    }
    case 'small_intake':
      return intake(context.smallIntakeMl, 'small_intake', 'Small intake');
    case 'medium_intake':
      return intake(context.mediumIntakeMl, 'medium_intake', 'Medium intake');
    case 'large_intake':
      return intake(context.largeIntakeMl, 'large_intake', 'Large intake');
    case 'custom': {
      if (!isSaneAmount(request.amountMl)) {
        return { ok: false, error: `Amount must be between ${MIN_LOG_ML} and ${MAX_LOG_ML} ml` };
      }
      return {
        ok: true,
        log: {
          amountMl: Math.round(request.amountMl),
          sourceType: 'custom',
          bottleId: null,
          bottleCapacityMl: null,
          label: 'Custom',
        },
      };
    }
    default:
      return { ok: false, error: 'Unknown source type' };
  }
}

function intake(amountMl: number, sourceType: SourceType, label: string): ResolveResult {
  if (!isSaneAmount(amountMl)) {
    return { ok: false, error: `${label} size is out of range` };
  }
  // An intake never references a bottle: water from a glass or mug must not
  // look like bottle progress.
  return {
    ok: true,
    log: {
      amountMl: Math.round(amountMl),
      sourceType,
      bottleId: null,
      bottleCapacityMl: null,
      label,
    },
  };
}

export function isSaneAmount(amountMl: number): boolean {
  return Number.isFinite(amountMl) && amountMl >= MIN_LOG_ML && amountMl <= MAX_LOG_ML;
}
