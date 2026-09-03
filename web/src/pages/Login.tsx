import { useEffect, useRef, useState, type ChangeEvent } from 'react';
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
  const inputRef = useRef<HTMLInputElement>(null);

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

  // The real input is a visually-hidden field kept focused: on a computer a
  // hardware keyboard types straight into it, and on a phone tapping the dots
  // brings up the numeric keyboard. The on-screen keypad stays for tapping.
  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    if (busy) return;
    const digits = event.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH);
    setError(null);
    setPin(digits);
    if (digits.length === PIN_LENGTH) void submit(digits);
  }

  // Fallback for a hardware keyboard when the hidden input is not focused
  // (e.g. right after tapping an on-screen key).
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!selected || busy) return;
      if (document.activeElement === inputRef.current) return;
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        addDigit(event.key);
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        backspace();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, busy]);

  // Keep focus on the hidden input while the PIN step is showing.
  useEffect(() => {
    if (selected && !busy) inputRef.current?.focus();
  }, [selected, busy]);

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

          <label className="pin-entry" onClick={() => inputRef.current?.focus()}>
            <input
              ref={inputRef}
              className="pin-hidden-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d*"
              maxLength={PIN_LENGTH}
              value={pin}
              onChange={handleInput}
              disabled={busy}
              autoFocus
              aria-label={`PIN, ${PIN_LENGTH} digits`}
            />
            <span
              className="pin-dots"
              aria-hidden="true"
            >
              {Array.from({ length: PIN_LENGTH }).map((_, index) => (
                <span
                  key={index}
                  className={`pin-dot${index < pin.length ? ' is-filled' : ''}`}
                />
              ))}
            </span>
          </label>

          {error && <p className="error">{error}</p>}

          <Keypad onDigit={addDigit} onBackspace={backspace} disabled={busy} />
        </>
      )}
    </div>
  );
}
