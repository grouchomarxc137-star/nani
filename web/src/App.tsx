import { useAuth } from './lib/auth.js';
import { useHashRoute } from './lib/useHashRoute.js';
import { Login } from './pages/Login.js';
import { Home } from './pages/Home.js';
import { History } from './pages/History.js';
import { Store } from './pages/Store.js';
import { Settings } from './pages/Settings.js';
import { Nav } from './components/Nav.js';

export function App() {
  const { account, loading } = useAuth();
  const [route, navigate] = useHashRoute();

  if (loading) return <div className="spinner">Loading…</div>;
  if (!account) return <Login />;

  return (
    <div className="app">
      <main className="main">
        {route === 'home' && <Home />}
        {route === 'history' && <History />}
        {route === 'store' && <Store />}
        {route === 'settings' && <Settings />}
      </main>
      <Nav route={route} onNavigate={navigate} />
    </div>
  );
}
