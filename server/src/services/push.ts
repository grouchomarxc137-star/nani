// Web Push delivery. Knows nothing about *whether* a reminder should be sent —
// that decision lives in lib/notifications.ts.

import webpush, { type PushSubscription as WebPushSubscription } from 'web-push';
import { env, pushConfigured } from '../env.js';
import { prisma } from '../prisma.js';

if (pushConfigured) {
  webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey!, env.vapidPrivateKey!);
}

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}

export interface DeliveryReport {
  sent: number;
  removed: number;
  failed: number;
}

/**
 * Sends to every device the user has registered. Subscriptions the push
 * service reports as gone (404/410) are deleted, which is how an uninstalled
 * PWA stops receiving notifications.
 */
export async function sendToUser(userId: string, payload: PushPayload): Promise<DeliveryReport> {
  const report: DeliveryReport = { sent: 0, removed: 0, failed: 0 };
  if (!pushConfigured) return report;

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  const body = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (subscription) => {
      const target: WebPushSubscription = {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      };
      try {
        await webpush.sendNotification(target, body, { TTL: 3600, urgency: 'normal' });
        report.sent += 1;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription
            .delete({ where: { id: subscription.id } })
            .catch(() => undefined);
          report.removed += 1;
        } else {
          report.failed += 1;
          console.error(`[push] delivery failed (${statusCode ?? 'unknown'})`, error);
        }
      }
    }),
  );

  return report;
}

export function pushIsConfigured(): boolean {
  return pushConfigured;
}

export function vapidPublicKey(): string | null {
  return env.vapidPublicKey ?? null;
}
