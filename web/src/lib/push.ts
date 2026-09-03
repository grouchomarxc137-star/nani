/**
 * Web Push subscription from the browser side.
 *
 * iOS notes, which drive the shape of this file:
 *  - Push only works once the app has been added to the Home Screen and is
 *    launched from there (iOS 16.4+).
 *  - Permission must be requested from a real user gesture, not on load.
 */
import { post } from './api.js';

export interface PushStatus {
  supported: boolean;
  standalone: boolean;
  permission: NotificationPermission | 'unsupported';
  subscribed: boolean;
  reason?: string;
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export async function getPushStatus(): Promise<PushStatus> {
  const standalone = isStandalone();
  const supported =
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  if (!supported) {
    return {
      supported: false,
      standalone,
      permission: 'unsupported',
      subscribed: false,
      reason: isIos()
        ? 'On iPhone, add Nani to the Home Screen first, then open it from there.'
        : 'This browser does not support push notifications.',
    };
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  return {
    supported: true,
    standalone,
    permission: Notification.permission,
    subscribed: Boolean(subscription),
  };
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalised);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

/** Must be called from a click handler, or iOS silently refuses. */
export async function enablePush(): Promise<{ ok: boolean; error?: string }> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, error: 'Push is not supported here.' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, error: 'Notifications were not allowed.' };
  }

  const { publicKey, configured } = await fetch('/api/push/key').then((r) => r.json());
  if (!configured || !publicKey) {
    return { ok: false, error: 'Push is not configured on the server yet.' };
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    }));

  const json = subscription.toJSON() as { endpoint?: string; keys?: Record<string, string> };
  await post('/push/subscribe', { endpoint: json.endpoint, keys: json.keys });
  return { ok: true };
}

export async function disablePush(): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await post('/push/unsubscribe', { endpoint: subscription.endpoint }).catch(() => undefined);
    await subscription.unsubscribe();
  } else {
    await post('/push/unsubscribe', {}).catch(() => undefined);
  }
}

export async function sendTestPush(): Promise<{ sent: number }> {
  const result = await post<{ report: { sent: number } }>('/push/test');
  return { sent: result.report.sent };
}
