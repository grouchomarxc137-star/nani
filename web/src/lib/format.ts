/** Small display helpers. Kept out of components so they can be reused. */

export function formatMl(ml: number): string {
  if (ml >= 1000) {
    const litres = ml / 1000;
    return `${litres.toFixed(litres >= 10 ? 1 : 2).replace(/\.?0+$/, '')} L`;
  }
  return `${ml} ml`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  return parsed.toLocaleDateString(undefined, {
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
  small_glass: 'Small Glass',
  large_glass: 'Large Glass',
  custom: 'Custom',
};

export function sourceLabel(sourceType: string, label: string | null): string {
  return label ?? SOURCE_LABELS[sourceType] ?? 'Water';
}
