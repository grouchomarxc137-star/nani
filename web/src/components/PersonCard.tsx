import { formatMl } from '../lib/format.js';
import { livePace, useNow } from '../lib/pace.js';
import type { UserSummary } from '../lib/types.js';

export function PersonCard({ summary, who, isMe }: { summary: UserSummary; who: string; isMe: boolean; animate?: boolean }) {
  const expected = livePace(summary, useNow()).percent;
  return <section className={`person${isMe ? ' is-me' : ''}`} aria-label={`${who}: ${formatMl(summary.consumedMl)} of ${formatMl(summary.dailyTargetMl)}, ${summary.percent}%`}>
    <h2 className="who">{who}</h2>
    <div className="person-numbers"><strong>{formatMl(summary.consumedMl)}</strong><span className="pct">{summary.percent}%</span></div>
    <div className="target">of {formatMl(summary.dailyTargetMl)}</div>
    <div className={`bar${summary.goalReached ? ' is-complete' : ''}`} aria-hidden="true"><div className="fill" style={{ width: `${summary.percentDisplay}%` }} />{!summary.goalReached && <div className="expected" style={{ left: `${Math.min(100, expected)}%` }} />}</div>
    <p className="visually-hidden">Henna: {summary.bird.label}. On-pace by now: {expected}%. {summary.activeBottle ? `${summary.activeBottle.name} · ${formatMl(summary.activeBottle.capacityMl)}` : 'No bottle selected'}</p>
  </section>;
}
