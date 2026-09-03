import { useCallback, useEffect, useState } from 'react';
import { del, get } from '../lib/api.js';
import { formatDate, formatMl, formatTime, sourceLabel } from '../lib/format.js';
import type { HistoryResponse, LogEntry } from '../lib/types.js';

export function History() {
  const [today, setToday] = useState<LogEntry[]>([]);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [todayResult, historyResult] = await Promise.all([
        get<{ logs: LogEntry[] }>('/logs/today'),
        get<HistoryResponse>('/logs/history?days=14'),
      ]);
      setToday(todayResult.logs);
      setHistory(historyResult);
      setError(null);
    } catch (caught) {
      setError((caught as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function removeEntry(id: string) {
    try {
      await del(`/logs/${id}`);
      await load();
    } catch (caught) {
      setError((caught as Error).message);
    }
  }

  const todayTotal = today.reduce((sum, entry) => sum + entry.amountMl, 0);
  const previousDays = history?.days.filter((day) => day.date !== history.today) ?? [];

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
          <div className="row" key={entry.id}>
            <div>
              <div>{sourceLabel(entry.sourceType, entry.label)}</div>
              <div className="meta">{formatTime(entry.loggedAt)}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="amount">{formatMl(entry.amountMl)}</span>
              <button
                className="btn small danger"
                type="button"
                onClick={() => removeEntry(entry.id)}
                aria-label={`Delete ${entry.amountMl} ml entry`}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Recent days</h2>
        {previousDays.length === 0 && <div className="empty">No earlier days yet.</div>}
        {previousDays.map((day) => {
          const percent = history
            ? Math.round((day.totalMl / history.dailyTargetMl) * 100)
            : 0;
          return (
            <div className="row" key={day.date}>
              <div>
                <div>{formatDate(day.date)}</div>
                <div className="meta">
                  {day.entries} {day.entries === 1 ? 'entry' : 'entries'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="amount">{formatMl(day.totalMl)}</div>
                <div className="meta">{percent}%</div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
