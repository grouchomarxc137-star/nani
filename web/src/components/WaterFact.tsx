import { useEffect, useRef, useState } from 'react';
import {
  WATER_FACTS,
  FACT_ROTATE_MS,
  advanceFact,
  currentFactIndex,
  msSinceFactChange,
} from '../lib/facts.js';

const LAUNCH_FLAG = 'nani.factLaunchHandled';

function handledThisLaunch(): boolean {
  try {
    if (sessionStorage.getItem(LAUNCH_FLAG)) return true;
    sessionStorage.setItem(LAUNCH_FLAG, '1');
    return false;
  } catch {
    return false;
  }
}

/**
 * A hydration fact on the home screen. It advances:
 *   - once on every app launch (fresh load / reopened from the Home Screen),
 *   - every 10 minutes while the app stays open,
 *   - on returning to the app if it sat in the background for 10+ minutes.
 *
 * The index is persisted in localStorage, so each launch genuinely moves to
 * the next fact rather than restarting the list.
 */
export function WaterFact() {
  const [index, setIndex] = useState(() =>
    handledThisLaunch() ? currentFactIndex() : advanceFact(),
  );
  const [shown, setShown] = useState(true);
  const indexRef = useRef(index);
  indexRef.current = index;

  useEffect(() => {
    function showIndex(next: number) {
      if (next === indexRef.current) return;
      setShown(false);
      window.setTimeout(() => {
        setIndex(next);
        setShown(true);
      }, 260);
    }

    const timer = window.setInterval(() => showIndex(advanceFact()), FACT_ROTATE_MS);

    function onVisible() {
      if (document.visibilityState === 'visible' && msSinceFactChange() >= FACT_ROTATE_MS) {
        showIndex(advanceFact());
      }
    }
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const fact = WATER_FACTS[index];

  return (
    <div className="card fact-card">
      <h2>Henna’s little water notes</h2>
      <p className={`fact-text${shown ? ' is-shown' : ''}`}>
        <span aria-hidden="true" className="fact-mark">
          {fact.kind === 'benefit' ? '💧' : '🥵'}
        </span>
        {fact.text}
      </p>
    </div>
  );
}
