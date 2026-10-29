import { Icon } from './Icon.js';
import { displayName } from '../lib/companion.js';

export function BrandHeader({ person }: { person?: { key: string; name: string } }) {
  return <header className="brand-header">
    <div className="wordmark"><Icon name="drop" /><span>With Henna</span></div>
    {person && <span className="account-mark" aria-label={`Signed in as ${displayName(person)}`}>{displayName(person).slice(0, 1)}</span>}
  </header>;
}
