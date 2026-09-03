/** Small display helpers. Kept out of components so they can be reused. */

// The UI is English-only, so dates and times are formatted in a fixed locale
// rather than the browser's — otherwise month and weekday names come out in
// whatever language the device is set to.
export const LOCALE = 'en-GB';

export function formatMl(ml: number): string {
  if (ml >= 1000) {
    const litres = ml / 1000;
    return `${litres.toFixed(litres >= 10 ? 1 : 2).replace(/\.?0+$/, '')} L`;
  }
  return `${ml} ml`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  return parsed.toLocaleDateString(LOCALE, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function minutesToLabel(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function labelToMinutes(label: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(label.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (hours > 23 || mins > 59) return null;
  return hours * 60 + mins;
}

const SOURCE_LABELS: Record<string, string> = {
  bottle: 'Bottle',
  small_intake: 'Small intake',
  medium_intake: 'Medium intake',
  large_intake: 'Large intake',
  custom: 'Custom',
  // Pre-rename history rows still carry their own `label`, but keep a fallback.
  small_glass: 'Small intake',
  large_glass: 'Large intake',
};

export function sourceLabel(sourceType: string, label: string | null): string {
  return label ?? SOURCE_LABELS[sourceType] ?? 'Water';
}
