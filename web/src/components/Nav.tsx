import type { Route } from '../lib/useHashRoute.js';

const TABS: { route: Route; label: string; icon: string }[] = [
  { route: 'home', label: 'Home', icon: '💧' },
  { route: 'history', label: 'History', icon: '📋' },
  { route: 'store', label: 'Store', icon: '🪙' },
  { route: 'settings', label: 'Settings', icon: '⚙️' },
];

export function Nav({
  route,
  onNavigate,
}: {
  route: Route;
  onNavigate: (route: Route) => void;
}) {
  return (
    <nav className="nav">
      {TABS.map((tab) => (
        <button
          key={tab.route}
          type="button"
          onClick={() => onNavigate(tab.route)}
          aria-current={route === tab.route ? 'page' : undefined}
        >
          <span className="icon" aria-hidden="true">
            {tab.icon}
          </span>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
