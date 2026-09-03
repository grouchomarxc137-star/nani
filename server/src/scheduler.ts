import { schedule, validate, type ScheduledTask } from 'node-cron';
import { env } from './env.js';
import { runReminderSweep } from './services/reminders.js';

let task: ScheduledTask | null = null;

export function startScheduler(): void {
  if (!env.schedulerEnabled) {
    console.log('[scheduler] disabled by SCHEDULER_ENABLED=false');
    return;
  }
  if (!validate(env.schedulerCron)) {
    console.error(`[scheduler] invalid SCHEDULER_CRON "${env.schedulerCron}", not starting`);
    return;
  }

  task = schedule(env.schedulerCron, () => {
    runReminderSweep().catch((error) => console.error('[scheduler] sweep failed', error));
  });

  console.log(`[scheduler] reminder sweep scheduled "${env.schedulerCron}"`);
}

export function stopScheduler(): void {
  task?.stop();
  task = null;
}
