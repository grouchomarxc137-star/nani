# Nani 💧

A small shared hydration companion for two people. Open it, see how you and your
partner are doing, tap once, close it.

Not a clinical tracker. A bird called Henna reacts to how the day is going, and
finishing your daily goal earns coins you can spend on cosmetic birds.

---

## What it does

- **Side-by-side home screen.** Both people's intake, goal, percentage, current
  bottle and bird, visible the moment the app opens.
- **One-tap logging.** "Finished bottle" logs your active bottle's capacity.
  Small / Medium / Large intake log your three configured sizes. No typing
  millilitres.
- **A time-aware bird.** Henna's mood compares your progress against where you'd
  be if you spread the day's target evenly across your waking hours. 50% at noon
  is fine; 50% at 20:00 is not.
- **Coins.** Reaching 100% of the daily goal awards coins once per day.
  Overshooting earns nothing extra.
- **Gentle push reminders** that stop for the day once you hit your goal and
  respect quiet hours.
- **Rotating hydration facts** on the home screen — a benefit of drinking, or
  what suffers when you don't. Advances once per app launch, every 10 minutes
  while open, and on returning after 10+ minutes in the background. Placeholder
  copy for now, held in the frontend.
- **Undo, edit and delete.** Accidental taps are easy to take back; any past
  entry's amount can be corrected from History.
- **Works offline.** Taps made without signal are queued and synced on reconnect.
- **Installs on iPhone** via Add to Home Screen and receives push while closed.

---

## Stack

React + TypeScript (Vite) · Node + Express + TypeScript · PostgreSQL · Prisma ·
Web Push with VAPID · a hand-written service worker · deployed on Railway.

Frontend and backend live in one repository as npm workspaces. In production the
API process also serves the built frontend, so Railway needs a single service
plus a Postgres database.

```
nani/
├── server/                 API, scheduler, database
│   ├── prisma/             schema, migrations, seed
│   └── src/
│       ├── lib/            pure logic — hydration maths, bird, rewards,
│       │                   notification rules, timezones. All unit tested.
│       ├── services/       database-facing code that calls lib/
│       ├── routes/         REST endpoints
│       └── tests/
├── web/                    the PWA
│   ├── public/             manifest, service worker, icons
│   └── src/
│       ├── lib/            API client, auth, offline queue, push
│       ├── components/
│       └── pages/          Home, History, Store, Settings, Login
└── scripts/                local database, VAPID keys, icon generation
```

The split matters: **all hydration, bird, reward and notification rules are pure
functions in `server/src/lib/`** with no database or network access. They are
where the behaviour lives and where the tests point. Redesigning the UI later
does not touch them.

---

## Running it locally

You need Node 20 or newer. You do **not** need PostgreSQL installed — a real
Postgres runs out of `node_modules` for development.

```bash
npm install
```

**1. Create your `.env`** in the repository root:

```bash
cp .env.example .env
```

**2. Generate a VAPID keypair** and paste the two keys into `.env`:

```bash
npm run vapid
```

**3. Start the database** and leave it running in its own terminal:

```bash
npm run db
```

**4. Create the tables and seed the two users:**

```bash
npm run prisma:migrate
npm run seed
```

**5. Start the app** — API on :3000, frontend on :5173:

```bash
npm run dev
```

Open http://localhost:5173 and sign in as Principe or Principessa with the
password from `APP_PASSWORD`.

### Useful commands

| Command | What it does |
| --- | --- |
| `npm test` | Runs the logic test suite |
| `npm run typecheck` | Type-checks both workspaces |
| `npm run build` | Production build of frontend and backend |
| `npm run seed` | Re-seeds users, bottles, birds and facts (safe to re-run) |
| `npm run db:reset` | Drops and rebuilds the database |
| `node scripts/generate-icons.mjs` | Regenerates the placeholder app icons |

---

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `APP_PASSWORD` | yes | The shared login password. Server-side only — never sent to the browser |
| `SESSION_SECRET` | yes | Signs session tokens. Use a long random value in production |
| `SESSION_DAYS` | no | How long a device stays signed in. Default 90 |
| `VAPID_PUBLIC_KEY` | for push | Public key, served to the browser |
| `VAPID_PRIVATE_KEY` | for push | Private key. **Never expose this** |
| `VAPID_SUBJECT` | for push | A `mailto:` address for the push service |
| `SCHEDULER_CRON` | no | How often reminders are evaluated. Default every 5 minutes |
| `SCHEDULER_ENABLED` | no | Set `false` to turn the scheduler off |
| `PORT` | no | Default 3000 |
| `CORS_ORIGIN` | no | Only needed if the frontend is served from another origin |

Without VAPID keys the app runs normally and push is simply disabled.

Generate a session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Deploying to Railway

1. **Create the project** and add a **PostgreSQL** database to it.
2. **Add a service** from this repository. `railway.json` sets the build and
   start commands and a health check on `/api/health`.
3. **Set the variables** on the service:
   - `DATABASE_URL` → reference the database with `${{Postgres.DATABASE_URL}}`
   - `APP_PASSWORD`, `SESSION_SECRET`
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
   - `NODE_ENV=production`
4. **Deploy.** The start command runs `prisma migrate deploy` before booting, so
   migrations apply automatically on every release.
5. **Seed once**, from the Railway shell:

   ```bash
   npm run seed
   ```

6. Open the generated `*.up.railway.app` URL and sign in.

Railway provides HTTPS, which Web Push requires.

---

## Installing on an iPhone

Push notifications on iOS only work for web apps launched from the Home Screen.
The order matters:

1. Open the Railway URL in **Safari** (not Chrome, not an in-app browser).
2. Tap **Share → Add to Home Screen**.
3. Open Nani **from the Home Screen icon**.
4. Go to **Settings → Notifications on this device → Turn on** and accept the
   iOS prompt.
5. Tap **Send test** to confirm a notification arrives.

Requires iOS 16.4 or newer. If you turn notifications on from a Safari tab
rather than the installed app, iOS will refuse.

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

**Coins.** A `DailyReward` row is written with a unique constraint on
`(userId, date)`. That constraint, not application logic, is what guarantees the
reward cannot be granted twice. Deleting a log afterwards does not claw coins
back — the goal genuinely was reached.

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
| `GET` | `/store` | Coin balance and the bird catalogue |
| `POST` | `/store/purchase` | Spend coins on a bird |
| `POST` | `/store/select` | Set the active bird |
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

The suite covers the logic that could produce wrong totals, wrong rewards or
unwanted notifications: daily totals and recalculation after deletion, expected
progress by time of day, Henna's states, the reward firing exactly once and
never paying more for overshooting, bottle and intake amounts, quiet hours,
reminder throttling, and reminders stopping once the goal is reached.

---

## Known limits

- Placeholder art throughout: birds are emoji, the app icon is a generated
  water drop. The component structure assumes these get replaced.
- Hydration facts shown on the home screen live in `web/src/lib/facts.ts` as
  placeholder copy — general and conservative, not yet sourced or cited. (The
  seed still carries an unused `HydrationFact` table for a later API-backed
  version.)
- The daily target is a number the user picks. It is not a recommendation and
  the app does not present it as medical advice.
- Partner progress refreshes by polling every 20 seconds and on app focus.
- The Prisma **CLI** (a dev dependency) has known advisories in its own tooling
  chain. The runtime client does not, and nothing vulnerable ships to
  production.
