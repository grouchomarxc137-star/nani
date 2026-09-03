import { useCallback, useEffect, useState } from 'react';
import { del, get, patch, post } from '../lib/api.js';
import { useAuth } from '../lib/auth.js';
import { formatMl, labelToMinutes, minutesToLabel } from '../lib/format.js';
import {
  disablePush,
  enablePush,
  getPushStatus,
  isIos,
  sendTestPush,
  type PushStatus,
} from '../lib/push.js';
import type { Bottle, NotificationSettings, UserSummary } from '../lib/types.js';

const BOTTLE_PRESETS = [2000, 1750, 1500, 1000, 750, 500];

export function Settings() {
  const { account, signOut } = useAuth();
  const [me, setMe] = useState<UserSummary | null>(null);
  const [bottles, setBottles] = useState<Bottle[]>([]);
  const [notifications, setNotifications] = useState<NotificationSettings | null>(null);
  const [push, setPush] = useState<PushStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [newBottleName, setNewBottleName] = useState('');
  const [newBottleMl, setNewBottleMl] = useState('');

  const load = useCallback(async () => {
    const [meResult, bottleResult, notificationResult] = await Promise.all([
      get<{ me: UserSummary }>('/auth/me'),
      get<{ bottles: Bottle[] }>('/settings/bottles'),
      get<{ settings: NotificationSettings | null }>('/settings/notifications'),
    ]);
    setMe(meResult.me);
    setBottles(bottleResult.bottles);
    setNotifications(notificationResult.settings);
  }, []);

  useEffect(() => {
    void load();
    void getPushStatus().then(setPush);
  }, [load]);

  async function save(body: Record<string, unknown>) {
    setMessage(null);
    try {
      const result = await patch<{ me: UserSummary }>('/settings/me', body);
      setMe(result.me);
      setMessage('Saved');
    } catch (caught) {
      setMessage((caught as Error).message);
    }
  }

  async function saveNotifications(body: Record<string, unknown>) {
    setMessage(null);
    try {
      const result = await patch<{ settings: NotificationSettings }>('/settings/notifications', body);
      setNotifications(result.settings);
      setMessage('Saved');
    } catch (caught) {
      setMessage((caught as Error).message);
    }
  }

  async function addBottle(name: string, capacityMl: number) {
    if (!name.trim() || !Number.isFinite(capacityMl) || capacityMl <= 0) {
      setMessage('Give the bottle a name and a size.');
      return;
    }
    await post('/settings/bottles', { name: name.trim(), capacityMl, makeActive: true });
    setNewBottleName('');
    setNewBottleMl('');
    await load();
  }

  async function activate(id: string) {
    await patch(`/settings/bottles/${id}`, { isActive: true });
    await load();
  }

  async function removeBottle(id: string) {
    await del(`/settings/bottles/${id}`);
    await load();
  }

  async function togglePush() {
    setMessage(null);
    try {
      if (push?.subscribed) {
        await disablePush();
        setMessage('Notifications turned off on this device.');
      } else {
        const result = await enablePush();
        setMessage(result.ok ? 'Notifications are on for this device.' : result.error ?? 'Failed');
      }
      setPush(await getPushStatus());
    } catch (caught) {
      setMessage((caught as Error).message);
    }
  }

  if (!me) return <div className="spinner">Loading…</div>;

  return (
    <>
      <header className="header">
        <h1>Settings</h1>
        <span className="coins">{account?.name}</span>
      </header>

      {message && <div className="notice">{message}</div>}

      <div className="card">
        <h2>Daily target</h2>
        <div className="field-row">
          <input
            type="number"
            inputMode="numeric"
            defaultValue={me.dailyTargetMl}
            onBlur={(event) => save({ dailyTargetMl: Number(event.target.value) })}
            aria-label="Daily target in millilitres"
          />
          <div className="meta" style={{ alignSelf: 'center' }}>
            {formatMl(me.dailyTargetMl)} per day
          </div>
        </div>
        <p className="pace-note">
          A starting point you can change any time. This is not medical advice.
        </p>
      </div>

      <div className="card">
        <h2>Bottles</h2>
        {bottles.map((bottle) => (
          <div className="row" key={bottle.id}>
            <div>
              <div>{bottle.name}</div>
              <div className="meta">{formatMl(bottle.capacityMl)}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {bottle.isActive ? (
                <span className="pill">Active</span>
              ) : (
                <button className="btn small" type="button" onClick={() => activate(bottle.id)}>
                  Use
                </button>
              )}
              {bottles.length > 1 && (
                <button
                  className="btn small danger"
                  type="button"
                  onClick={() => removeBottle(bottle.id)}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}

        <div style={{ marginTop: 14 }}>
          <label>Add a bottle</label>
          <div className="field-row">
            <input
              placeholder="Name"
              value={newBottleName}
              onChange={(event) => setNewBottleName(event.target.value)}
            />
            <input
              type="number"
              inputMode="numeric"
              placeholder="ml"
              value={newBottleMl}
              onChange={(event) => setNewBottleMl(event.target.value)}
            />
          </div>
          <div className="btn-row three" style={{ marginBottom: 10 }}>
            {BOTTLE_PRESETS.map((preset) => (
              <button
                key={preset}
                className="btn small"
                type="button"
                onClick={() => setNewBottleMl(String(preset))}
              >
                {formatMl(preset)}
              </button>
            ))}
          </div>
          <button
            className="btn"
            type="button"
            onClick={() => addBottle(newBottleName, Number(newBottleMl))}
          >
            Add bottle
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Intake sizes</h2>
        <p className="pace-note" style={{ marginTop: 0 }}>
          The one-tap amounts on the home screen — a glass, a mug, a big tumbler.
        </p>
        <div className="btn-row three">
          <div>
            <label htmlFor="small-intake">Small intake</label>
            <input
              id="small-intake"
              type="number"
              inputMode="numeric"
              defaultValue={me.smallIntakeMl}
              onBlur={(event) => save({ smallIntakeMl: Number(event.target.value) })}
            />
          </div>
          <div>
            <label htmlFor="medium-intake">Medium intake</label>
            <input
              id="medium-intake"
              type="number"
              inputMode="numeric"
              defaultValue={me.mediumIntakeMl}
              onBlur={(event) => save({ mediumIntakeMl: Number(event.target.value) })}
            />
          </div>
          <div>
            <label htmlFor="large-intake">Large intake</label>
            <input
              id="large-intake"
              type="number"
              inputMode="numeric"
              defaultValue={me.largeIntakeMl}
              onBlur={(event) => save({ largeIntakeMl: Number(event.target.value) })}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Reminders</h2>

        <div className="row">
          <div>
            <div>Notifications on this device</div>
            <div className="meta">
              {push?.subscribed ? 'On' : push?.reason ?? 'Off'}
            </div>
          </div>
          <button className="btn small" type="button" onClick={togglePush}>
            {push?.subscribed ? 'Turn off' : 'Turn on'}
          </button>
        </div>

        {push?.subscribed && (
          <div className="row">
            <div className="meta">Check it works</div>
            <button
              className="btn small"
              type="button"
              onClick={async () => {
                const result = await sendTestPush();
                setMessage(
                  result.sent > 0
                    ? 'Test sent — it should arrive in a moment.'
                    : 'No devices are subscribed yet.',
                );
              }}
            >
              Send test
            </button>
          </div>
        )}

        {isIos() && !push?.standalone && (
          <div className="notice" style={{ marginTop: 12 }}>
            On iPhone: tap Share, then <strong>Add to Home Screen</strong>, and open Nani from
            there. iOS only allows notifications for installed web apps.
          </div>
        )}

        {notifications && (
          <>
            <div className="row">
              <div>Send reminders</div>
              <button
                className="btn small"
                type="button"
                onClick={() => saveNotifications({ enabled: !notifications.enabled })}
              >
                {notifications.enabled ? 'On' : 'Off'}
              </button>
            </div>

            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="interval">Reminder gap (minutes)</label>
              <input
                id="interval"
                type="number"
                inputMode="numeric"
                defaultValue={notifications.intervalMinutes}
                onBlur={(event) =>
                  saveNotifications({ intervalMinutes: Number(event.target.value) })
                }
              />
            </div>

            <div className="field-row">
              <div>
                <label htmlFor="wake">Awake from</label>
                <input
                  id="wake"
                  type="time"
                  defaultValue={minutesToLabel(notifications.wakeMinute)}
                  onBlur={(event) => {
                    const minutes = labelToMinutes(event.target.value);
                    if (minutes !== null) saveNotifications({ wakeMinute: minutes });
                  }}
                />
              </div>
              <div>
                <label htmlFor="sleep">Quiet from</label>
                <input
                  id="sleep"
                  type="time"
                  defaultValue={minutesToLabel(notifications.sleepMinute)}
                  onBlur={(event) => {
                    const minutes = labelToMinutes(event.target.value);
                    if (minutes !== null) saveNotifications({ sleepMinute: minutes });
                  }}
                />
              </div>
            </div>
            <p className="pace-note">
              No reminders outside these hours. Once you hit your goal, reminders stop for the
              day. These hours also set the pace {me.bird.name} judges you against.
            </p>
          </>
        )}
      </div>

      <div className="card">
        <h2>Timezone</h2>
        <input
          defaultValue={me.timezone}
          onBlur={(event) => save({ timezone: event.target.value.trim() })}
          aria-label="Timezone"
        />
        <p className="pace-note">
          Your day resets, and reminders arrive, in your own local time. Currently {me.localTime}{' '}
          on {me.localDate}.
        </p>
      </div>

      <div className="card">
        <h2>Account</h2>
        <button className="btn danger" type="button" onClick={signOut}>
          Log out / switch user
        </button>
      </div>
    </>
  );
}
