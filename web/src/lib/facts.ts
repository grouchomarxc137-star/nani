/**
 * Rotating hydration facts for the home screen.
 *
 * Placeholder copy — general and conservative, not yet sourced or verified.
 * These live in the frontend on purpose for now ("prop facts"); a later
 * version can pull a curated, cited list from the API instead.
 */

export interface WaterFact {
  /** 'benefit' — something water does for you. 'lack' — what suffers without it. */
  kind: 'benefit' | 'lack';
  text: string;
}

export const WATER_FACTS: readonly WaterFact[] = [
  { kind: 'benefit', text: 'Water helps your body hold a steady temperature, sweating to cool down and conserving fluid when you are cold.' },
  { kind: 'benefit', text: 'Joints stay cushioned by fluid, so staying hydrated keeps movement feeling smooth.' },
  { kind: 'benefit', text: 'Blood is mostly water — enough fluid helps your heart move oxygen and nutrients around with less strain.' },
  { kind: 'benefit', text: 'Your kidneys use water to flush waste; a well-watered day means paler urine and easier filtering.' },
  { kind: 'benefit', text: 'Even mild top-ups through the day can help concentration and mood stay level.' },
  { kind: 'benefit', text: 'Water keeps the digestive tract moving and softens things along the way, which helps regularity.' },
  { kind: 'benefit', text: 'Skin looks a little plumper and less tired when you are not running low on fluid.' },
  { kind: 'lack', text: 'Thirst usually shows up after you are already a bit low, so waiting until you feel it means catching up rather than keeping up.' },
  { kind: 'lack', text: 'A common early sign of not drinking enough is a dull headache or trouble focusing.' },
  { kind: 'lack', text: 'Losing just 1–2% of your body water can make effort feel harder and reactions feel slower.' },
  { kind: 'lack', text: 'Too little fluid over a day can leave you tired and irritable without an obvious reason.' },
  { kind: 'lack', text: 'Dark yellow urine is a rough everyday hint that your body would like more water.' },
  { kind: 'lack', text: 'Under-drinking in hot weather or during exercise raises the risk of cramps and dizziness.' },
  { kind: 'lack', text: 'Going short on water repeatedly makes constipation and kidney stones more likely over time.' },
];

// How often the fact advances while the app stays open or is reopened from the
// background. Ten minutes is long enough not to distract, short enough that a
// day of glancing at the app surfaces several facts.
export const FACT_ROTATE_MS = 10 * 60 * 1000;

const INDEX_KEY = 'nani.factIndex';
const CHANGED_AT_KEY = 'nani.factChangedAt';

function readInt(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    const value = raw === null ? NaN : Number(raw);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function writeIndex(index: number): void {
  try {
    localStorage.setItem(INDEX_KEY, String(index));
    localStorage.setItem(CHANGED_AT_KEY, String(Date.now()));
  } catch {
    // No persistence (private mode): rotation still works for this session.
  }
}

/** The fact index to show right now, without advancing it. */
export function currentFactIndex(): number {
  return ((readInt(INDEX_KEY) % WATER_FACTS.length) + WATER_FACTS.length) % WATER_FACTS.length;
}

/** Advance to the next fact and persist it. Returns the new index. */
export function advanceFact(): number {
  const next = (currentFactIndex() + 1) % WATER_FACTS.length;
  writeIndex(next);
  return next;
}

/** Milliseconds since the fact last changed (Infinity if never / unknown). */
export function msSinceFactChange(): number {
  const at = readInt(CHANGED_AT_KEY);
  return at > 0 ? Date.now() - at : Infinity;
}
