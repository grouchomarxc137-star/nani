import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enqueue, flushQueue, pendingCount, clearQueue } from '../../../web/src/lib/offlineQueue.js';

let stored: Map<string, string>;
beforeEach(() => {
  stored = new Map();
  vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) });
});
afterEach(() => vi.unstubAllGlobals());

describe('offline logging feedback contract', () => {
  it('reports failed persistence instead of claiming a sip was saved', () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => { throw new Error('Storage unavailable'); } });
    expect(() => enqueue({ sourceType: 'custom', amountMl: 125 })).toThrow('Could not save this entry');
  });
  it('retains an entry during a network failure and clears it after successful replay', async () => {
    const entry = enqueue({ sourceType: 'custom', amountMl: 125 });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Offline')));
    expect(await flushQueue()).toBe(0);
    expect(pendingCount()).toBe(1);
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ logId: 'demo' }), { status: 201 }));
    vi.stubGlobal('fetch', fetcher);
    expect(await flushQueue()).toBe(1);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ amountMl: 125, clientId: entry.clientId });
    expect(pendingCount()).toBe(0);
  });
  it('explicitly discards only the pending entries', () => {
    stored.set('nani.token', 'keep-session');
    enqueue({ sourceType: 'small_intake' });
    clearQueue();
    expect(pendingCount()).toBe(0);
    expect(stored.get('nani.token')).toBe('keep-session');
  });
});
