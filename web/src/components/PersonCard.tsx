import { formatMl } from '../lib/format.js';
import type { UserSummary } from '../lib/types.js';

/**
 * One side of the side-by-side couple view. Shows intake, goal, percentage,
 * the current bottle and the bird — the five things the spec asks to be
 * visible the moment the app opens.
 */
export function PersonCard({
  summary,
  who,
  isMe,
  animate,
}: {
  summary: UserSummary;
  who: string;
  isMe: boolean;
  animate?: boolean;
}) {
  return (
    <div className={`person${isMe ? ' is-me' : ''}`}>
      <div className="who">{who}</div>

      <div className={`bird${animate ? ' just-logged' : ''}`} aria-hidden="true">
        {summary.bird.emoji}
      </div>
      <div className="bird-label">
        {summary.bird.name} · {summary.bird.label}
      </div>

      <div className="amount">
        {formatMl(summary.consumedMl)}
        <span className="target"> / {formatMl(summary.dailyTargetMl)}</span>
      </div>
      <div className="pct">{summary.percent}%</div>

      <div className={`bar${summary.goalReached ? ' is-complete' : ''}`}>
        <div className="fill" style={{ width: `${summary.percentDisplay}%` }} />
        {!summary.goalReached && (
          <div
            className="expected"
            style={{ left: `${Math.min(100, summary.expectedPercent)}%` }}
            title="Where you would be if you were on pace"
          />
        )}
      </div>

      <div className="bottle-line">
        {summary.activeBottle
          ? `${summary.activeBottle.name} · ${formatMl(summary.activeBottle.capacityMl)}`
          : 'No bottle selected'}
      </div>
    </div>
  );
}
