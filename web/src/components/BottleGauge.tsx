import { formatMl } from '../lib/format.js';
import { expectedRatioAt, livePace, useNow } from '../lib/pace.js';
import type { UserSummary } from '../lib/types.js';

/**
 * A water-bottle drawing of today's progress, inspired by the motivational
 * bottles that print an hourly schedule up the side.
 *
 *  - The bottle's size grows with the capacity of the active bottle, so a
 *    2 L bottle looks bigger than a 750 ml one.
 *  - The vertical axis runs from 0 at the base to the daily target at the neck.
 *  - Millilitre ticks sit on the left; clock times on the right mark where the
 *    water line "should" be by that hour if the day is spread evenly across
 *    the awake window (the same pace the bird judges you against). Triggering a re depoloy
 */

const CLOCK_MAX_LABELS = 6;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clockLabel(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const suffix = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mins = m % 60;
  return mins === 0 ? `${h12}${suffix}` : `${h12}:${String(mins).padStart(2, '0')}${suffix}`;
}

interface ClockMark {
  minutes: number;
  ratio: number;
}

/** Hourly marks across the awake window, thinned to a readable few. */
function clockMarks(wakeMinute: number, sleepMinute: number): ClockMark[] {
  const start = Math.ceil(wakeMinute / 60) * 60;
  const marks: ClockMark[] = [];
  for (let i = 0; i < 25; i += 1) {
    const minutes = start + i * 60;
    const wrapped = minutes % 1440;
    const ratio = expectedRatioAt(wrapped, wakeMinute, sleepMinute);
    if (ratio <= 0.02 || ratio >= 0.999) {
      if (ratio >= 0.999) break;
      continue;
    }
    marks.push({ minutes: wrapped, ratio });
  }
  // Always finish on the target-by-bedtime mark.
  marks.push({ minutes: sleepMinute % 1440, ratio: 1 });

  if (marks.length <= CLOCK_MAX_LABELS) return marks;
  const stride = Math.ceil(marks.length / CLOCK_MAX_LABELS);
  return marks.filter((_, index) => index % stride === 0 || index === marks.length - 1);
}

export function BottleGauge({ summary }: { summary: UserSummary }) {
  // A ticking clock so the "now" line keeps sliding while the tab sits open,
  // rather than only jumping on the next /summary poll.
  const pace = livePace(summary, useNow());
  const target = Math.max(1, summary.dailyTargetMl);
  const capacity = summary.activeBottle?.capacityMl ?? 1000;

  // Size grows with capacity, clamped so the extremes stay sensible.
  const sizeT = clamp((capacity - 500) / (2000 - 500), 0, 1);
  const bodyH = Math.round(238 + sizeT * 150);
  const bodyW = Math.round(112 + sizeT * 36);
  const neckH = 34;
  const capH = 16;
  const topPad = capH + neckH;
  const viewW = 304;
  const viewH = topPad + bodyH + 16;

  const bodyX = 42;
  const bodyY = topPad;
  const wall = 5;
  const innerX = bodyX + wall;
  const innerW = bodyW - wall * 2;
  const innerTop = bodyY + 12;
  const innerBottom = bodyY + bodyH - 12;
  const innerH = innerBottom - innerTop;

  const fillRatio = clamp(summary.percentDisplay / 100, 0, 1);
  const fillH = innerH * fillRatio;
  const fillY = innerBottom - fillH;

  const expectedRatio = clamp(pace.ratio, 0, 1);
  const expectedY = innerBottom - innerH * expectedRatio;

  const yFor = (ratio: number) => innerBottom - innerH * clamp(ratio, 0, 1);

  // Millilitre ticks: minor every 250 ml, labelled every 500 ml.
  const minorStep = target <= 1200 ? 200 : 250;
  const mlTicks: { ml: number; major: boolean }[] = [];
  for (let ml = minorStep; ml < target; ml += minorStep) {
    mlTicks.push({ ml, major: ml % 500 === 0 });
  }

  const marks = clockMarks(summary.wakeMinute, summary.sleepMinute);
  const neckX = bodyX + (bodyW - bodyW * 0.42) / 2;
  const neckW = bodyW * 0.42;

  return (
    <div className="bottle-gauge">
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        role="img"
        aria-label={`${formatMl(summary.consumedMl)} of ${formatMl(target)} today, about ${summary.percent}% of the daily goal`}
      >
        <defs>
          <linearGradient id="nani-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6cc4d6" />
            <stop offset="100%" stopColor="#1f6b80" />
          </linearGradient>
          <clipPath id="nani-bottle-inner">
            <rect
              x={innerX}
              y={innerTop}
              width={innerW}
              height={innerH}
              rx={Math.min(16, innerW / 2)}
            />
          </clipPath>
        </defs>

        {/* cap + neck */}
        <rect
          x={neckX + 6}
          y={0}
          width={neckW - 12}
          height={capH + 6}
          rx={4}
          className="bottle-cap"
        />
        <path
          d={`M ${neckX} ${capH + neckH}
              L ${neckX} ${capH + 8}
              q 0 -8 8 -8
              L ${neckX + neckW - 8} ${capH}
              q 8 0 8 8
              L ${neckX + neckW} ${capH + neckH} Z`}
          className="bottle-neck"
        />

        {/* body */}
        <rect
          x={bodyX}
          y={bodyY}
          width={bodyW}
          height={bodyH}
          rx={22}
          className="bottle-body"
        />

        {/* water */}
        <g clipPath="url(#nani-bottle-inner)">
          <rect x={innerX} y={fillY} width={innerW} height={fillH + 4} fill="url(#nani-water)" />
          <rect x={innerX} y={fillY} width={innerW} height={3} className="bottle-water-surface" />

          {/* ml ticks, drawn inside so they read like moulded lines */}
          {mlTicks.map((tick) => {
            const y = yFor(tick.ml / target);
            return (
              <line
                key={tick.ml}
                x1={innerX}
                x2={innerX + (tick.major ? innerW : innerW * 0.4)}
                y1={y}
                y2={y}
                className={tick.major ? 'bottle-tick major' : 'bottle-tick'}
              />
            );
          })}
        </g>

        {/* expected-by-now line */}
        <line
          x1={bodyX - 3}
          x2={bodyX + bodyW + 3}
          y1={expectedY}
          y2={expectedY}
          className="bottle-now-line"
        />

        {/* ml labels on the left */}
        {mlTicks
          .filter((tick) => tick.major)
          .map((tick) => (
            <text
              key={tick.ml}
              x={bodyX - 8}
              y={yFor(tick.ml / target) + 3}
              textAnchor="end"
              className="bottle-ml-label"
            >
              {tick.ml >= 1000 ? `${(tick.ml / 1000).toFixed(1)}L` : tick.ml}
            </text>
          ))}
        <text x={bodyX - 8} y={innerBottom + 3} textAnchor="end" className="bottle-ml-label">
          0
        </text>

        {/* clock marks on the right */}
        {marks.map((mark) => {
          const y = yFor(mark.ratio);
          return (
            <g key={`${mark.minutes}-${mark.ratio}`}>
              <line
                x1={bodyX + bodyW + 2}
                x2={bodyX + bodyW + 8}
                y1={y}
                y2={y}
                className="bottle-clock-tick"
              />
              <text
                x={bodyX + bodyW + 11}
                y={y + 3}
                className={`bottle-clock-label${mark.ratio >= 1 ? ' goal' : ''}`}
              >
                {mark.ratio >= 1 ? `${clockLabel(mark.minutes)} goal` : clockLabel(mark.minutes)}
              </text>
            </g>
          );
        })}

        {/* now marker label */}
        <text
          x={bodyX + bodyW + 11}
          y={expectedY - 5}
          className="bottle-now-label"
        >
          now {pace.clock}
        </text>
      </svg>

      <div className="bottle-gauge-caption">
        <strong>{formatMl(summary.consumedMl)}</strong>
        <span> / {formatMl(target)} · {summary.percent}%</span>
        {summary.activeBottle && (
          <span className="bottle-gauge-sub">
            {summary.activeBottle.name} · {formatMl(summary.activeBottle.capacityMl)}
          </span>
        )}
      </div>
    </div>
  );
}
