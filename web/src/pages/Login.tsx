import { useEffect, useState } from 'react';
import { get } from '../lib/api.js';
import { useAuth } from '../lib/auth.js';
import { Keypad } from '../components/Keypad.js';

interface Person {
  key: string;
  name: string;
}

// The shared password is a 6-digit number; the keypad submits as soon as the
// sixth digit is entered. If the password length ever changes, change this.
const PIN_LENGTH = 6;

export function Login() {
  const { signIn } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    get<{ users: Person[] }>('/auth/users')
      .then(({ users }) => setPeople(users))
      .catch(() => setError('Cannot reach the server.'));
  }, []);

  async function submit(candidate: string) {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(selected, candidate);
    } catch (caught) {
      setError((caught as Error).message);
      setPin('');
    } finally {
      setBusy(false);
    }
  }

  function addDigit(digit: string) {
    if (busy) return;
    setError(null);
    setPin((current) => {
      if (current.length >= PIN_LENGTH) return current;
      const next = current + digit;
      if (next.length === PIN_LENGTH) void submit(next);
      return next;
    });
  }

  function backspace() {
    if (busy) return;
    setError(null);
    setPin((current) => current.slice(0, -1));
  }

  const selectedPerson = people.find((person) => person.key === selected) ?? null;

  return (
    <div className="login">
      <h1>Nani</h1>
      <p className="tagline">A shared hydration companion 💧</p>

      {!selectedPerson ? (
        <>
          <p className="login-step">Who are you?</p>
          <div className="who-picker">
            {people.map((person) => (
              <button
                key={person.key}
                type="button"
                onClick={() => {
                  setSelected(person.key);
                  setPin('');
                  setError(null);
                }}
              >
                {person.name}
              </button>
            ))}
          </div>
          {error && <p className="error">{error}</p>}
        </>
      ) : (
        <>
          <p className="login-step">
            Hi {selectedPerson.name} — enter your PIN
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setSelected(null);
                setPin('');
                setError(null);
              }}
            >
              not you?
            </button>
          </p>

          <div className="pin-dots" aria-label={`${pin.length} of ${PIN_LENGTH} digits entered`}>
            {Array.from({ length: PIN_LENGTH }).map((_, index) => (
              <span
                key={index}
                className={`pin-dot${index < pin.length ? ' is-filled' : ''}`}
              />
            ))}
          </div>

          {error && <p className="error">{error}</p>}

          <Keypad onDigit={addDigit} onBackspace={backspace} disabled={busy} />
        </>
      )}
    </div>
  );
}
