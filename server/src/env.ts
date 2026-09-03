import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(
      `Missing required environment variable ${name}. See .env.example for the full list.`,
    );
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value === '' ? undefined : value;
}

const isProduction = process.env.NODE_ENV === 'production';

export const env = {
  isProduction,
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required('DATABASE_URL'),

  // Auth for the two-person MVP: one shared password, never sent to the client.
  appPassword: required('APP_PASSWORD'),
  sessionSecret: required('SESSION_SECRET', isProduction ? undefined : 'dev-insecure-secret'),
  sessionDays: Number(process.env.SESSION_DAYS ?? 90),

  // Web Push. Absent keys disable push rather than crashing the app, so the
  // rest of the MVP stays usable while keys are being set up.
  vapidPublicKey: optional('VAPID_PUBLIC_KEY'),
  vapidPrivateKey: optional('VAPID_PRIVATE_KEY'),
  vapidSubject: process.env.VAPID_SUBJECT ?? 'mailto:hello@example.com',

  /** How often the reminder scheduler wakes up. */
  schedulerCron: process.env.SCHEDULER_CRON ?? '*/5 * * * *',
  schedulerEnabled: process.env.SCHEDULER_ENABLED !== 'false',

  /** Where the built frontend lives when the server also serves it. */
  webDistPath: process.env.WEB_DIST_PATH ?? '../web/dist',
  corsOrigin: optional('CORS_ORIGIN'),
};

export const pushConfigured = Boolean(env.vapidPublicKey && env.vapidPrivateKey);
