import { useCallback, useEffect, useState } from 'react';
import { get, post } from '../lib/api.js';
import type { StoreResponse } from '../lib/types.js';

export function Store() {
  const [store, setStore] = useState<StoreResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStore(await get<StoreResponse>('/store'));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: 'purchase' | 'select', birdId: string) {
    setBusy(true);
    setMessage(null);
    try {
      await post(`/store/${action}`, { birdId });
      await load();
      setMessage(action === 'purchase' ? 'Unlocked ♡' : 'Switched');
    } catch (caught) {
      setMessage((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!store) return <div className="spinner">Loading…</div>;

  return (
    <>
      <header className="header">
        <h1>Store</h1>
        <span className="coins">🪙 {store.coinBalance}</span>
      </header>

      <div className="notice">
        Coins come from completing your daily goal. Drinking beyond the goal never earns more.
        Everything here is cosmetic.
      </div>

      {message && <div className="notice">{message}</div>}

      <div className="bird-grid">
        {store.birds.map((bird) => (
          <div className={`bird-card${bird.active ? ' is-active' : ''}`} key={bird.id}>
            <div className="face" aria-hidden="true">
              {bird.emoji}
            </div>
            <div className="name">{bird.name}</div>
            <div className="desc">{bird.description}</div>

            {bird.active ? (
              <span className="pill">Selected</span>
            ) : bird.owned ? (
              <button
                className="btn small"
                type="button"
                disabled={busy}
                onClick={() => act('select', bird.id)}
              >
                Use
              </button>
            ) : (
              <button
                className="btn small"
                type="button"
                disabled={busy || !bird.affordable}
                onClick={() => act('purchase', bird.id)}
              >
                {bird.affordable ? `Buy · ${bird.priceCoins}` : `🪙 ${bird.priceCoins}`}
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
