import { useCallback, useEffect, useMemo, useState } from 'react';
import { del, get, patch } from '../lib/api.js';
import { LOCALE, formatDate, formatMl, formatTime, sourceLabel } from '../lib/format.js';
import type { HistoryResponse, LogEntry } from '../lib/types.js';

/**
 * A day gets a 1–5 hydration score from how close its total came to the adult
 * fluid guideline for this person (`recommendedMl`, which differs for men and
 * women). 0 means a finished day with no logs at all (untracked); -1 marks a
 * day still in the future.
 */
const SCORE_LABELS = ['untracked', 'parched', 'low', 'okay', 'good', 'well hydrated'] as const;

function hydrationScore(totalMl: number, recommendedMl: number, entries: number): number {
  if (entries === 0) return 0;
  if (recommendedMl <= 0) return 1;
  const ratio = totalMl / recommendedMl;
  if (ratio >= 1) return 5;
  if (ratio >= 0.8) return 4;
  if (ratio >= 0.6) return 3;
  if (ratio >= 0.35) return 2;
  return 1;
}

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const pad2 = (n: number) => String(n).padStart(2, '0');
const dateKey = (year: number, month: number, day: number) =>
  `${year}-${pad2(month + 1)}-${pad2(day)}`;

export function History() {
  const [today, setToday] = useState<LogEntry[]>([]);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Which calendar month the mood grid is showing. Starts on the current month.
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // Inline amount editing, shared by the Today list and the expanded day.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [busy, setBusy] = useState(false);

  const range = useMemo(() => {
    const { year, month } = cursor;
    const lastDay = new Date(year, month + 1, 0).getDate();
    return { from: dateKey(year, month, 1), to: dateKey(year, month, lastDay), lastDay };
  }, [cursor]);

  const loadToday = useCallback(async () => {
    try {
      const result = await get<{ logs: LogEntry[] }>('/logs/today');
      setToday(result.logs);
    } catch (caught) {
      setError((caught as Error).message);
    }
  }, []);

  const loadMonth = useCallback(async () => {
    try {
      const result = await get<HistoryResponse>(
        `/logs/history?from=${range.from}&to=${range.to}`,
      );
      setHistory(result);
      setError(null);
    } catch (caught) {
      setError((caught as Error).message);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    void loadToday();
  }, [loadToday]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  const reload = useCallback(async () => {
    await Promise.all([loadToday(), loadMonth()]);
  }, [loadToday, loadMonth]);

  function shiftMonth(delta: number) {
    setExpanded(null);
    setCursor(({ year, month }) => {
      const m = month + delta;
      return { year: year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  }

  function startEdit(entry: LogEntry) {
    setEditingId(entry.id);
    setEditValue(String(entry.amountMl));
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValue('');
  }

  async function saveEdit(id: string) {
    const amount = Number(editValue);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a number of millilitres.');
      return;
    }
    setBusy(true);
    try {
      await patch(`/logs/${id}`, { amountMl: amount });
      cancelEdit();
      await reload();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeEntry(id: string) {
    setBusy(true);
    try {
      await del(`/logs/${id}`);
      if (editingId === id) cancelEdit();
      await reload();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function EntryRow({ entry }: { entry: LogEntry }) {
    const isEditing = editingId === entry.id;
    return (
      <div className="row" key={entry.id}>
        <div>
          <div>{sourceLabel(entry.sourceType, entry.label)}</div>
          <div className="meta">{formatTime(entry.loggedAt)}</div>
        </div>

        {isEditing ? (
          <div className="entry-edit">
            <input
              type="number"
              inputMode="numeric"
              autoFocus
              value={editValue}
              onChange={(event) => setEditValue(event.target.value)}
              aria-label="Amount in millilitres"
            />
            <button
              className="btn small"
              type="button"
              disabled={busy}
              onClick={() => saveEdit(entry.id)}
            >
              Save
            </button>
            <button className="btn small ghost" type="button" onClick={cancelEdit}>
              Cancel
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="amount">{formatMl(entry.amountMl)}</span>
            <button
              className="btn small"
              type="button"
              disabled={busy}
              onClick={() => startEdit(entry)}
              aria-label={`Edit ${entry.amountMl} ml entry`}
            >
              Edit
            </button>
            <button
              className="btn small danger"
              type="button"
              disabled={busy}
              onClick={() => removeEntry(entry.id)}
              aria-label={`Delete ${entry.amountMl} ml entry`}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    );
  }

  const todayTotal = today.reduce((sum, entry) => sum + entry.amountMl, 0);
  const recommended = history?.recommendedMl ?? 0;

  const todayKey =
    history?.today ?? dateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  const dayMap = useMemo(() => {
    const map = new Map<string, { totalMl: number; entries: number }>();
    for (const day of history?.days ?? []) {
      map.set(day.date, { totalMl: day.totalMl, entries: day.entries });
    }
    return map;
  }, [history]);

  // A flat list of cells: leading blanks to line up the first weekday, then
  // every day of the month.
  const cells = useMemo(() => {
    const { year, month } = cursor;
    const lead = new Date(year, month, 1).getDay();
    const out: (number | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= range.lastDay; d += 1) out.push(d);
    return out;
  }, [cursor, range.lastDay]);

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString(LOCALE, {
    month: 'long',
    year: 'numeric',
  });

  // Only days that have actually finished count towards the tally — today is
  // still filling up, so judging it "by the end of the day" isn't possible yet.
  const monthStats = useMemo(() => {
    let well = 0;
    let tracked = 0;
    for (const [date, info] of dayMap) {
      if (date >= todayKey || info.entries === 0) continue;
      tracked += 1;
      if (hydrationScore(info.totalMl, recommended, info.entries) >= 4) well += 1;
    }
    return { well, tracked };
  }, [dayMap, recommended, todayKey]);

  const expandedInfo = expanded ? dayMap.get(expanded) : undefined;
  const expandedEntries = expanded
    ? (history?.logs ?? []).filter((log) => log.localDate === expanded)
    : [];
  const expandedScore = hydrationScore(
    expandedInfo?.totalMl ?? 0,
    recommended,
    expandedInfo?.entries ?? 0,
  );
  const expandedPercent =
    recommended && expandedInfo
      ? Math.round((expandedInfo.totalMl / recommended) * 100)
      : 0;

  return (
    <>
      <header className="header">
        <h1>History</h1>
        <span className="coins">{formatMl(todayTotal)} today</span>
      </header>

      {error && <div className="notice">{error}</div>}

      <div className="card">
        <h2>Today</h2>
        {today.length === 0 && <div className="empty">Nothing logged yet today.</div>}
        {today.map((entry) => (
          <EntryRow entry={entry} key={entry.id} />
        ))}
      </div>

      <div className="card">
        <div className="mood-head">
          <button
            className="btn small ghost"
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
          >
            ‹
          </button>
          <h2>{monthLabel}</h2>
          <button
            className="btn small ghost"
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
          >
            ›
          </button>
        </div>

        <p className="mood-caption">
          {monthStats.tracked === 0
            ? 'No finished days this month yet.'
            : `${monthStats.well} of ${monthStats.tracked} finished ${
                monthStats.tracked === 1 ? 'day' : 'days'
              } near the ${formatMl(recommended)} guideline`}
        </p>

        <div className="mood-cal">
          {WEEKDAY_INITIALS.map((initial, index) => (
            <div key={index} className="mood-dowhead" aria-hidden="true">
              {initial}
            </div>
          ))}

          {cells.map((day, index) => {
            if (day === null) {
              return <div key={`blank-${index}`} className="mood-slot" aria-hidden="true" />;
            }
            const date = dateKey(cursor.year, cursor.month, day);
            const info = dayMap.get(date);
            const isFuture = date > todayKey;
            const isToday = date === todayKey;
            const score = isFuture
              ? -1
              : hydrationScore(info?.totalMl ?? 0, recommended, info?.entries ?? 0);
            const isOpen = expanded === date;
            return (
              <button
                key={date}
                type="button"
                className={`mood-cell${isOpen ? ' is-open' : ''}${isToday ? ' is-today' : ''}${
                  isFuture ? ' is-future' : ''
                }`}
                data-score={isFuture ? undefined : score}
                disabled={isFuture}
                aria-pressed={isOpen}
                aria-label={`${formatDate(date)}: ${
                  isFuture
                    ? 'upcoming'
                    : `${formatMl(info?.totalMl ?? 0)}${isToday ? ' so far' : ''}, ${
                        SCORE_LABELS[score]
                      }`
                }`}
                onClick={() => setExpanded(isOpen ? null : date)}
              >
                <span className="mood-dom">{day}</span>
              </button>
            );
          })}
        </div>

        <div className="mood-legend" aria-hidden="true">
          <span>Parched</span>
          {[1, 2, 3, 4, 5].map((score) => (
            <span key={score} className="mood-swatch" data-score={score} />
          ))}
          <span>Hydrated</span>
        </div>

        <p className="mood-sub">
          Shaded against the general {formatMl(recommended)}/day adult fluid guideline. A
          full block means the day reached it; today fills in as you drink.
        </p>

        {expanded && (
          <div className="mood-detail">
            <div className="day-toggle" aria-expanded="true">
              <div>
                <div>{formatDate(expanded)}</div>
                <div className="meta">
                  {expandedInfo?.entries ?? 0}{' '}
                  {(expandedInfo?.entries ?? 0) === 1 ? 'entry' : 'entries'} ·{' '}
                  {SCORE_LABELS[expandedScore]}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="amount">{formatMl(expandedInfo?.totalMl ?? 0)}</div>
                <div className="meta">{expandedPercent}% of {formatMl(recommended)}</div>
              </div>
            </div>
            <div className="day-entries">
              {expandedEntries.length === 0 && (
                <div className="empty">Nothing logged this day.</div>
              )}
              {expandedEntries.map((entry) => (
                <EntryRow entry={entry} key={entry.id} />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
