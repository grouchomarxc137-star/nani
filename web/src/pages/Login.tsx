import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { flushSync } from 'react-dom';
import { get } from '../lib/api.js';
import { useAuth } from '../lib/auth.js';
import { displayName, greeting } from '../lib/companion.js';
import { BrandHeader } from '../components/BrandHeader.js';
import { Henna } from '../components/Henna.js';

interface Person { key: string; name: string }
const PIN_LENGTH = 6;

export function Login() {
  const { signIn } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [selected, setSelected] = useState<Person | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);

  const loadPeople = () => {
    setError(null);
    void get<{ users: Person[] }>('/auth/users').then(({ users }) => setPeople(users)).catch(() => setError('Cannot connect just now. Please try again.'));
  };
  useEffect(loadPeople, []);

  async function submit(candidate: string) {
    if (!selected || submitting.current || candidate.length !== PIN_LENGTH) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try { await signIn(selected.key, candidate); }
    catch (caught) {
      setError((caught as { status?: number }).status === 401 ? 'That PIN didn’t match. Try again.' : (caught as Error).message);
      setPin('');
    } finally { submitting.current = false; setBusy(false); }
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH);
    setPin(digits); setError(null);
    if (digits.length === PIN_LENGTH) void submit(digits);
  }

  return <div className="login">
    <BrandHeader />
    {!selected ? <>
      <section className="login-intro"><Henna /><h1>A little care.<br />One sip at a time.</h1><p>Who’s here for a little care?</p></section>
      <div className="who-picker">{people.map(person => <button type="button" key={person.key} onClick={() => {
        // Focus synchronously within the tap: iOS can suppress keyboards opened from an effect.
        flushSync(() => { setSelected(person); setPin(''); setError(null); });
        inputRef.current?.focus();
      }}>{displayName(person)}<span>{person.name}</span></button>)}</div>
      {people.length === 0 && !error && <p className="empty" role="status">Getting your little corner ready…</p>}
      {error && <div className="notice" role="alert">{error}<button type="button" className="btn ghost" onClick={loadPeople}>Try again</button></div>}
    </> : <>
      <section className="pin-heading"><h1>{greeting(selected, Intl.DateTimeFormat().resolvedOptions().timeZone)}</h1><div className="login-step"><p>Enter your 6-digit PIN.</p><button type="button" className="link-btn" onClick={() => { setSelected(null); setPin(''); setError(null); }}>not you?</button></div></section>
      <form onSubmit={(event: FormEvent) => { event.preventDefault(); void submit(pin); }} aria-busy={busy}>
        <label htmlFor="pin">PIN</label>
        <div className="pin-entry">
          <input id="pin" ref={inputRef} className="pin-input" type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="current-password" maxLength={PIN_LENGTH} value={pin} onChange={handleInput} readOnly={busy} aria-describedby={error ? 'pin-error' : 'pin-help'} aria-invalid={Boolean(error)} />
          <span className="pin-cells" aria-hidden="true">{Array.from({ length: PIN_LENGTH }, (_, i) => <span key={i} className={`${i < pin.length ? 'filled' : ''} ${i === pin.length ? 'active' : ''}`}>{i < pin.length ? '•' : ''}</span>)}</span>
        </div>
        <p id="pin-help" className="pace-note" role="status">{busy ? 'Signing you in…' : 'Signs in after the sixth digit.'}</p>
        {error && <p id="pin-error" className="error" role="alert">{error}</p>}
        <button type="submit" className="visually-hidden">Sign in</button>
      </form>
      <div className="login-companion"><Henna /><p>A little care, one sip at a time.</p></div>
    </>}
  </div>;
}
