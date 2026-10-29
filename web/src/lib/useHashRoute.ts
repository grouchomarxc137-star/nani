import { useEffect, useState } from 'react';

export const ROUTES = ['home', 'history', 'settings'] as const;
export type Route = (typeof ROUTES)[number];

function currentRoute(): Route {
  const hash = window.location.hash.replace('#/', '').replace('#', '');
  return (ROUTES as readonly string[]).includes(hash) ? (hash as Route) : 'home';
}

/**
 * A hash router in a dozen lines. Three tabs do not justify a routing library,
 * and using the hash keeps the iPhone back gesture working.
 */
export function useHashRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(currentRoute);

  useEffect(() => {
    const onChange = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = (next: Route) => {
    window.location.hash = `/${next}`;
    setRoute(next);
  };

  return [route, navigate];
}
