/**
 * Offline logging queue.
 *
 * Tapping "finished bottle" while the phone has no signal must still count.
 * Pending taps are kept in localStorage and replayed when connectivity comes
 * back. Two users, one device each — no conflict resolution needed beyond
 * replaying in order.
 */
import { post } from './api.js';
import type { LogResponse, SourceType } from './types.js';

const QUEUE_KEY = 'nani.pendingLogs';

export interface PendingLog {
  clientId: string;
  sourceType: SourceType;
  amountMl?: number;
  queuedAt: string;
}

function read(): PendingLog[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as PendingLog[]) : [];
  } catch {
    return [];
  }
}

function write(items: PendingLog[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    // Nothing sensible to do; the tap is lost rather than crashing the app.
  }
}

export function pendingCount(): number {
  return read().length;
}

export function enqueue(entry: Omit<PendingLog, 'clientId' | 'queuedAt'>): PendingLog {
  const pending: PendingLog = {
    ...entry,
    clientId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: new Date().toISOString(),
  };
  write([...read(), pending]);
  return pending;
}

export function remove(clientId: string): void {
  write(read().filter((item) => item.clientId !== clientId));
}

/** Replays queued taps oldest first. Stops at the first network failure. */
export async function flushQueue(): Promise<number> {
  let flushed = 0;
  for (const item of read()) {
    try {
      await post<LogResponse>('/logs', {
        sourceType: item.sourceType,
        amountMl: item.amountMl,
        clientId: item.clientId,
      });
      remove(item.clientId);
      flushed += 1;
    } catch (error) {
      // A rejected entry (e.g. no active bottle any more) would otherwise block
      // the queue forever, so drop it and keep going.
      const status = (error as { status?: number }).status;
      if (status && status >= 400 && status < 500 && status !== 401) {
        remove(item.clientId);
        continue;
      }
      break;
    }
  }
  return flushed;
}
