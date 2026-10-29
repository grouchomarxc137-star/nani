import { useAuth } from './lib/auth.js';
import { useHashRoute } from './lib/useHashRoute.js';
import { Login } from './pages/Login.js';
import { Home } from './pages/Home.js';
import { History } from './pages/History.js';
import { Settings } from './pages/Settings.js';
import { Henna } from './components/Henna.js';
import { useEffect, useRef } from 'react';
import { Nav } from './components/Nav.js';

export function App() {
  const { account, loading } = useAuth();
  const [route, navigate] = useHashRoute();

  const main = useRef<HTMLElement>(null);
  const previousRoute = useRef(route);
  useEffect(() => {
    if (previousRoute.current !== route) {
      window.scrollTo({ top: 0 });
      main.current?.focus({ preventScroll: true });
      previousRoute.current = route;
    }
  }, [route]);

  if (loading) return <div className="loading-state"><Henna /><p role="status">Getting your little corner ready…</p></div>;
  if (!account) return <Login />;

  return (
    <div className="app">
      <main className="main" ref={main} tabIndex={-1}>
        {route === 'home' && <Home />}
        {route === 'history' && <History />}
        {route === 'settings' && <Settings />}
      </main>
      <Nav route={route} onNavigate={navigate} />
    </div>
  );
}
