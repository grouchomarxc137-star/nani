import { useEffect, useState, type FormEvent } from 'react';
import { get } from '../lib/api.js';
import { useAuth } from '../lib/auth.js';

interface Person {
  key: string;
  name: string;
}

export function Login() {
  const { signIn } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    get<{ users: Person[] }>('/auth/users')
      .then(({ users }) => setPeople(users))
      .catch(() => setError('Cannot reach the server.'));
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selected) {
      setError('Choose who you are first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(selected, password);
    } catch (caught) {
      setError((caught as Error).message);
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <h1>Nani</h1>
      <p className="tagline">A shared hydration companion 💧</p>

      <form onSubmit={onSubmit}>
        <div className="who-picker">
          {people.map((person) => (
            <button
              key={person.key}
              type="button"
              aria-pressed={selected === person.key}
              onClick={() => setSelected(person.key)}
            >
              {person.name}
            </button>
          ))}
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        <button className="btn primary" type="submit" disabled={busy || !selected}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}
