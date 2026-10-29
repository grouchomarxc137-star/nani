import type { Route } from '../lib/useHashRoute.js';
import { Icon } from './Icon.js';

const TABS: { route: Route; label: string }[] = [
  { route: 'home', label: 'Home' },
  { route: 'history', label: 'History' },
  { route: 'settings', label: 'Settings' },
];

export function Nav({ route, onNavigate }: { route: Route; onNavigate: (route: Route) => void }) {
  return <nav className="nav" aria-label="Main navigation">
    {TABS.map(tab => <button key={tab.route} type="button" onClick={() => onNavigate(tab.route)} aria-current={route === tab.route ? 'page' : undefined}>
      <Icon name={tab.route} />{tab.label}
    </button>)}
  </nav>;
}
