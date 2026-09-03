import { useCallback, useEffect, useRef, useState } from 'react';
import { del, get, post } from '../lib/api.js';
import { enqueue, flushQueue, pendingCount, remove } from '../lib/offlineQueue.js';
import { formatMl } from '../lib/format.js';
import { livePace, useNow } from '../lib/pace.js';
import type { LogResponse, SourceType, SummaryResponse } from '../lib/types.js';
import { PersonCard } from '../components/PersonCard.js';
import { BottleGauge } from '../components/BottleGauge.js';
import { WaterFact } from '../components/WaterFact.js';
import { Toast } from '../components/Toast.js';

const POLL_MS = 20_000;
const UNDO_MS = 7_000;

interface UndoState {
  logId: string;
  amountMl: number;
}

export function Home() {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [pending, setPending] = useState(pendingCount());
  const [animate, setAnimate] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customMl, setCustomMl] = useState('');

  const now = useNow();

  const undoTimer = useRef<number | null>(null);
  const flashTimer = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      setData(await get<SummaryResponse>('/summary'));
      setError(null);
    } catch (caught) {
      setError((caught as Error).message);
    }
  }, []);

  // Polling keeps the partner's progress current without WebSockets.
  useEffect(() => {
    void refresh();
    const interval = window.setInterval(refresh, POLL_MS);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refresh]);

  // Replay anything logged while offline as soon as we are back.
  useEffect(() => {
    const sync = async () => {
      if (pendingCount() === 0) return;
      const flushed = await flushQueue();
      setPending(pendingCount());
      if (flushed > 0) {
        showFlash(`Synced ${flushed} offline ${flushed === 1 ? 'entry' : 'entries'} 💧`);
        void refresh();
      }
    };
    void sync();
    window.addEventListener('online', sync);
    return () => window.removeEventListener('online', sync);
  }, [refresh]);

  useEffect(
    () => () => {
      if (undoTimer.current) window.clearTimeout(undoTimer.current);
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    },
    [],
  );

  function showFlash(message: string) {
    setFlash(message);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 3000);
  }

  function celebrate() {
    setAnimate(true);
    window.setTimeout(() => setAnimate(false), 500);
  }

  async function logWater(sourceType: SourceType, amountMl?: number) {
    setBusy(true);
    setError(null);
    try {
      const result = await post<LogResponse>('/logs', { sourceType, amountMl });
      setData((current) => (current ? { ...current, me: result.summary } : current));
      celebrate();

      setUndo({ logId: result.logId, amountMl: result.summary.consumedMl });
      if (undoTimer.current) window.clearTimeout(undoTimer.current);
      undoTimer.current = window.setTimeout(() => setUndo(null), UNDO_MS);

      if (result.coinsAwarded > 0) {
        showFlash(`Goal complete 💧 +${result.coinsAwarded} coins`);
      }
      void refresh();
    } catch (caught) {
      // Offline or the server is unreachable: keep the tap and replay later.
      if (!navigator.onLine || (caught as { status?: number }).status === undefined) {
        const queued = enqueue({ sourceType, amountMl });
        setPending(pendingCount());
        showFlash('Saved offline — will sync when you are back');
        setUndo(null);
        void queued;
      } else {
        setError((caught as Error).message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function undoLast() {
    if (!undo) return;
    const target = undo;
    setUndo(null);
    try {
      const result = await del<{ summary: SummaryResponse['me'] }>(`/logs/${target.logId}`);
      setData((current) => (current ? { ...current, me: result.summary } : current));
      showFlash('Removed');
    } catch (caught) {
      setError((caught as Error).message);
    }
  }

  async function submitCustom() {
    const amount = Number(customMl);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a number of millilitres.');
      return;
    }
    setCustomOpen(false);
    setCustomMl('');
    await logWater('custom', amount);
  }

  function clearOfflineQueue() {
    for (const item of JSON.parse(localStorage.getItem('nani.pendingLogs') ?? '[]')) {
      remove(item.clientId);
    }
    setPending(pendingCount());
  }

  if (!data) {
    return <div className="spinner">{error ?? 'Loading…'}</div>;
  }

  const { me, partner } = data;
  const expectedPercent = livePace(me, now).percent;

  return (
    <>
      <header className="header">
        <h1>Nani</h1>
        <span className="coins">🪙 {me.coinBalance}</span>
      </header>

      {pending > 0 && (
        <div className="notice">
          {pending} {pending === 1 ? 'entry is' : 'entries are'} waiting to sync.{' '}
          <button className="btn small ghost" type="button" onClick={clearOfflineQueue}>
            Discard
          </button>
        </div>
      )}

      <WaterFact />

      <div className="pair">
        <PersonCard summary={me} who="Me" isMe animate={animate} />
        {partner ? (
          <PersonCard summary={partner} who={partner.name} isMe={false} />
        ) : (
          <div className="person">
            <div className="who">Partner</div>
            <div className="empty">Not set up yet</div>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Your bottle today</h2>
        <BottleGauge summary={me} />
      </div>

      <div className="card">
        <h2>{me.bird.name}</h2>
        <p style={{ margin: 0 }}>{me.bird.message}</p>
        <p className="pace-note">
          {me.goalReached
            ? 'Daily goal reached. Anything more is entirely up to you.'
            : `${formatMl(me.remainingMl)} to go · on-pace for now is about ${expectedPercent}%`}
        </p>
      </div>

      <div className="card">
        <h2>Log water</h2>

        <button
          className="btn primary"
          type="button"
          disabled={busy || !me.activeBottle}
          onClick={() => logWater('bottle')}
        >
          {me.activeBottle
            ? `Finished bottle · ${formatMl(me.activeBottle.capacityMl)}`
            : 'Choose a bottle in Settings'}
        </button>

        <div className="btn-row three" style={{ marginTop: 12 }}>
          <button
            className="btn"
            type="button"
            disabled={busy}
            onClick={() => logWater('small_intake')}
          >
            Small
            <span className="sub">{me.smallIntakeMl} ml</span>
          </button>
          <button
            className="btn"
            type="button"
            disabled={busy}
            onClick={() => logWater('medium_intake')}
          >
            Medium
            <span className="sub">{me.mediumIntakeMl} ml</span>
          </button>
          <button
            className="btn"
            type="button"
            disabled={busy}
            onClick={() => logWater('large_intake')}
          >
            Large
            <span className="sub">{me.largeIntakeMl} ml</span>
          </button>
        </div>

        <button
          className="btn ghost"
          type="button"
          disabled={busy}
          style={{ marginTop: 12 }}
          onClick={() => setCustomOpen((open) => !open)}
        >
          Custom amount
        </button>

        {customOpen && (
          <div className="field-row" style={{ marginTop: 12 }}>
            <input
              type="number"
              inputMode="numeric"
              placeholder="e.g. 125"
              value={customMl}
              onChange={(event) => setCustomMl(event.target.value)}
            />
            <button className="btn" type="button" onClick={submitCustom} disabled={busy}>
              Add
            </button>
          </div>
        )}
      </div>

      {undo && <Toast message="Logged 💧" actionLabel="Undo" onAction={undoLast} />}
      {!undo && flash && <Toast message={flash} />}
      {error && <Toast message={error} isError />}
    </>
  );
}
