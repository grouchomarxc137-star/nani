import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { get, post, setToken, getToken } from './api.js';

interface Account {
  id: string;
  key: string;
  name: string;
}

interface AuthContextValue {
  account: Account | null;
  loading: boolean;
  signIn: (userKey: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ACCOUNT_KEY = 'nani.account';

function readStoredAccount(): Account | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    return raw ? (JSON.parse(raw) as Account) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(() =>
    getToken() ? readStoredAccount() : null,
  );
  const [loading, setLoading] = useState(Boolean(getToken()));

  // Confirm the stored token is still valid, so a device that has been signed
  // out server-side does not sit on a stale home screen.
  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    get<{ me: { id: string; key: string; name: string } }>('/auth/me')
      .then(({ me }) => setAccount({ id: me.id, key: me.key, name: me.name }))
      .catch(() => setAccount(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onSignedOut = () => setAccount(null);
    window.addEventListener('nani:signed-out', onSignedOut);
    return () => window.removeEventListener('nani:signed-out', onSignedOut);
  }, []);

  const signIn = useCallback(async (userKey: string, password: string) => {
    const result = await post<{ token: string; user: Account }>('/auth/login', {
      userKey,
      password,
    });
    setToken(result.token);
    try {
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify(result.user));
    } catch {
      // Not fatal — the session simply will not survive a reload.
    }
    setAccount(result.user);
  }, []);

  const signOut = useCallback(() => {
    post('/auth/logout').catch(() => undefined);
    setToken(null);
    try {
      localStorage.removeItem(ACCOUNT_KEY);
    } catch {
      // ignore
    }
    setAccount(null);
  }, []);

  const value = useMemo(
    () => ({ account, loading, signIn, signOut }),
    [account, loading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
