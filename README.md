# Nani 💧

A shared hydration companion for two people. React + TypeScript frontend, Express API, Prisma and SQLite. The API serves the production PWA.

## Local setup

Use Node 22. Install with `npm ci`, copy `.env.example` to `.env`, and set `DATABASE_URL` to an absolute SQLite path such as `file:/tmp/nani-dev.db`. Run `npm run prisma:deploy`, then `npm run seed`, then `npm run dev`. No separate database server is needed.

The seed creates Principe and Principessa, bottles and sample drinking logs. Run it only for initial setup: rerunning it can change settings and add demo logs.

## Railway

Deploy this repository from its root using the Dockerfile. Create one service, one replica, and a persistent volume mounted at `/data`. Set `DATABASE_URL=file:/data/nani.db`, `NODE_ENV=production`, `APP_PASSWORD`, and a random `SESSION_SECRET`. Leave Railway's PORT available to the server.

Startup runs Prisma migrations before starting the API. The volume must be mounted during startup; do not move SQLite migrations into a build or pre-deploy step. Run `npm run seed` once inside the deployed service after initial deployment. Do not seed on each restart.

Generate a public HTTPS domain. Generate keys with `npm run vapid`, store VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Railway variables, and set VAPID_SUBJECT to the app's HTTPS URL. Keep the scheduler enabled and service sleeping disabled for reminders. Enable daily volume backups. Deployments with the volume can have brief downtime.

This SQLite migration history is for a fresh database. It does not transfer an existing PostgreSQL database. Database files must stay on the volume to survive deployments.

## Phone notifications

On iPhone, open the HTTPS URL in Safari, choose Share → Add to Home Screen, launch the installed app, and enable notifications in Settings. Use Send test to verify delivery. VAPID_SUBJECT identifies the application; notifications go to subscribed devices, not email.

## Checks

`npm test` runs the logic tests. `npm run typecheck` checks both workspaces. `npm run build` creates the production frontend and API.

---

## How the rules work

**Daily reset.** A hydration log stores `localDate`, the calendar date in that
user's own timezone at the moment of logging. Days therefore roll over at local
midnight for each person independently, and history is never rewritten.

**Expected progress.** Linear across the awake window configured in Settings.
At the wake time the expectation is 0%, at the quiet time it is 100%. Henna's
mood comes from the gap between actual and expected, not from raw percentage.
This is one function, `expectedProgressRatio`, and it is the single place to
change if a smarter curve is wanted later.

**Reminders.** A scheduler inside the API process wakes every five minutes and
asks, per user: are reminders enabled, is there a subscription, is it quiet
hours, is the goal already reached, has the interval elapsed? Only if all of
those pass does it choose a tone from the person's pace and send. Deciding is
separate from delivering, so the rules are testable without the network.

**Bottle vs daily progress.** These are kept apart deliberately. An intake
(a glass, a mug, a tumbler) never counts as bottle progress. Bottle capacity is
snapshotted onto each log, so renaming or resizing a bottle later leaves history
untouched. Editing an entry only changes its amount — the source and any bottle
snapshot stay as first logged.

---

## API

All routes are under `/api`. Everything except the first three needs an
`Authorization: Bearer <token>` header.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness and database check |
| `GET` | `/auth/users` | The two selectable people |
| `POST` | `/auth/login` | `{ userKey, password }` → session token |
| `GET` | `/push/key` | Public VAPID key |
| `GET` | `/auth/me` | The signed-in user's summary |
| `POST` | `/auth/logout` | Ends the session client-side |
| `GET` | `/summary` | **Home screen**: both people, side by side |
| `POST` | `/logs` | Log water: `{ sourceType, amountMl? }` |
| `PATCH` | `/logs/:id` | Correct an entry's amount: `{ amountMl }` |
| `DELETE` | `/logs/:id` | Remove an entry and recalculate |
| `GET` | `/logs/today` | Today's entries |
| `GET` | `/logs/history?days=14` | Recent days, grouped by local date |
| `PATCH` | `/settings/me` | Target, timezone, intake sizes, name |
| `GET`/`POST` | `/settings/bottles` | List and create bottles |
| `PATCH`/`DELETE` | `/settings/bottles/:id` | Edit, activate or archive |
| `GET`/`PATCH` | `/settings/notifications` | Reminder interval and quiet hours |
| `POST` | `/push/subscribe` | Register a device |
| `POST` | `/push/unsubscribe` | Remove a device |
| `POST` | `/push/test` | Send yourself a test notification |
| `POST` | `/push/sweep` | Run the reminder decision immediately (for testing) |

`sourceType` is one of `bottle`, `small_intake`, `medium_intake`,
`large_intake`, `custom`. `amountMl` is only used for `custom`.

---

## Authentication

Deliberately minimal, and confined to `server/src/auth.ts` so it can be replaced
without touching anything else.

Two fixed accounts, Principe and Principessa, share one password held in
`APP_PASSWORD`. The password is compared on the server in constant time and
never reaches the browser. A successful login returns an HMAC-signed token that
the device stores and sends on later requests. Settings has a Log out / switch
user button.

There is no registration, password reset, email or OAuth, and none is planned
for this stage.

---

## Testing

```bash
npm test
```

The suite covers the logic that could produce wrong totals or
unwanted notifications: daily totals and recalculation after deletion, expected
progress by time of day, Henna's states, bottle and intake amounts, quiet hours,
reminder throttling, and reminders stopping once the goal is reached.

---
