import { useCallback, useEffect, useRef, useState } from 'react';
import { del, get, post } from '../lib/api.js';
import { clearQueue, enqueue, flushQueue, pendingCount } from '../lib/offlineQueue.js';
import { formatMl } from '../lib/format.js';
import { livePace, useNow } from '../lib/pace.js';
import type { LogResponse, SourceType, SummaryResponse } from '../lib/types.js';
import { PersonCard } from '../components/PersonCard.js';
import { BottleGauge } from '../components/BottleGauge.js';
import { WaterFact } from '../components/WaterFact.js';
import { Toast } from '../components/Toast.js';
import { BrandHeader } from '../components/BrandHeader.js';
import { Henna } from '../components/Henna.js';
import { displayName, greeting, loggedMessage } from '../lib/companion.js';

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

  const logging = useRef(false);
  const customInput = useRef<HTMLInputElement>(null);
  const customTrigger = useRef<HTMLButtonElement>(null);

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
    if (logging.current) return false;
    logging.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await post<LogResponse>('/logs', { sourceType, amountMl });
      setData((current) => (current ? { ...current, me: result.summary } : current));
      celebrate();

      setUndo({ logId: result.logId, amountMl: result.summary.consumedMl });
      if (undoTimer.current) window.clearTimeout(undoTimer.current);
      undoTimer.current = window.setTimeout(() => setUndo(null), UNDO_MS);

      void refresh();
      return true;
    } catch (caught) {
      // Offline or the server is unreachable: keep the tap and replay later.
      if (!navigator.onLine || (caught as { status?: number }).status === undefined) {
        try {
          enqueue({ sourceType, amountMl });
          setPending(pendingCount());
          showFlash('Saved on your phone. Will sync when you’re back online.');
          setUndo(null);
          return true;
        } catch { setError('Could not save on this phone. Keep this amount and try again.'); }
      } else {
        setError((caught as Error).message);
      }
      return false;
    } finally {
      logging.current = false;
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
      showFlash('That entry is removed.');
    } catch (caught) {
      setError((caught as Error).message);
    }
  }

  async function submitCustom() {
    const amount = Number(customMl);
    if (!Number.isFinite(amount) || amount < 1 || amount > 5000) {
      setError('Enter an amount from 1 to 5000 ml.');
      return;
    }
    if (await logWater('custom', amount)) {
      setCustomOpen(false);
      setCustomMl('');
      customTrigger.current?.focus();
    }
  }

  function clearOfflineQueue() {
    try { clearQueue(); setPending(pendingCount()); }
    catch { setError('Could not discard these entries. Please try again.'); }
  }

  useEffect(() => { if (customOpen) customInput.current?.focus(); }, [customOpen]);

  if (!data) {
    return <div className="loading-state"><Henna /><p role={error ? 'alert' : 'status'}>{error ?? 'Getting your water day ready…'}</p>{error && <button type="button" className="btn" onClick={() => void refresh()}>Try again</button>}</div>;
  }

  const { me, partner } = data;
  const expectedPercent = livePace(me, now).percent;
  const hello = greeting(me, me.timezone, now);

  return (
    <>
      <BrandHeader person={me} />
      <section className="home-greeting">
        <div><h1>{hello === 'Buongiorno Amira💛' ? <>Buongiorno<br /><span className="keep-together">Amira💛</span></> : hello}</h1><p>{new Date(now).toLocaleDateString('en-GB', { timeZone: me.timezone, weekday: 'long', day: 'numeric', month: 'long' })}</p></div>
        <Henna celebrate={animate || me.goalReached} />
      </section>

      {pending > 0 && (
        <div className="notice">
          {pending} {pending === 1 ? 'entry is' : 'entries are'} waiting to sync.{' '}
          <button className="btn small ghost" type="button" onClick={clearOfflineQueue}>
            Discard
          </button>
        </div>
      )}

      <div className="pair">
        <PersonCard summary={me} who={`Me · ${displayName(me)}`} isMe animate={animate} />
        {partner ? (
          <PersonCard summary={partner} who={partner.name} isMe={false} />
        ) : (
          <div className="person">
            <div className="who">Partner</div>
            <div className="empty">Not set up yet</div>
          </div>
        )}
      </div>

      <section className="card log-card" aria-busy={busy}>
        <h2>A sip for you</h2>

        <button
          className="btn primary"
          type="button"
          disabled={busy || !me.activeBottle}
          onClick={() => logWater('bottle')}
        >
          {me.activeBottle
            ? `+  Finished bottle · ${formatMl(me.activeBottle.capacityMl)}`
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
          ref={customTrigger}
          aria-expanded={customOpen}
          aria-controls="custom-water"
          onClick={() => setCustomOpen((open) => !open)}
        >
          + Custom amount
        </button>

        {customOpen && (
          <form id="custom-water" className="custom-form" onSubmit={(event) => { event.preventDefault(); void submitCustom(); }}>
            <label htmlFor="custom-ml">Amount (ml)</label>
            <div className="field-row"><input
              ref={customInput}
              id="custom-ml"
              min="1"
              max="5000"
              step="1"
              type="number"
              inputMode="numeric"
              placeholder="e.g. 125"
              value={customMl}
              onChange={(event) => setCustomMl(event.target.value)}
            />
            <button className="btn" type="submit" disabled={busy}>
              Add
            </button></div>
          </form>
        )}
      </section>

      <section className="card daily-card">
        <h2>Your water today</h2>
        <div className="daily-summary"><BottleGauge summary={me} compact /><div>
          <p className="daily-remaining">{me.goalReached ? loggedMessage(me.key, true) : `${formatMl(me.remainingMl)} to go`}</p>
          <p className="pace-note">{me.percent}% of your {formatMl(me.dailyTargetMl)} daily goal</p>
        </div></div>
        <details className="pace-details"><summary>Daily pace &amp; bottle details</summary><BottleGauge summary={me} />
          <p className="pace-note">{formatMl(me.bottleMl)} from bottles · {formatMl(me.intakeMl + me.customMl)} other water</p>
          <p className="pace-note">{me.bottlesFinishedToday} finished {me.bottlesFinishedToday === 1 ? 'bottle' : 'bottles'} today. {me.activeBottle ? `${me.activeBottle.name} · ${formatMl(me.activeBottle.capacityMl)}` : 'No bottle selected.'}</p>
        </details>
      </section>
      <section className="card companion-card"><Henna celebrate={me.goalReached} /><div><h2>A note from Henna</h2><p>{me.bird.message}</p><p className="pace-note">{me.goalReached ? 'No more reminders today.' : `On-pace by now: ${expectedPercent}%`}</p></div></section>
      <WaterFact />

      {undo && !error && <Toast message={loggedMessage(me.key, me.goalReached)} actionLabel="Undo" onAction={undoLast} />}
      {!undo && !error && flash && <Toast message={flash} />}
      {error && <Toast message={error} isError />}
    </>
  );
}
