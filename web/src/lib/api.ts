// One place that knows how to talk to the API and carry the session token.

const TOKEN_KEY = 'nani.token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private browsing with storage disabled: the session just will not persist.
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  headers.set('accept', 'application/json');
  if (options.body) headers.set('content-type', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);

  const response = await fetch(`/api${path}`, { ...options, headers });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  // A 401 on a request we *sent a token with* means the session is no longer
  // good — drop it and bounce to the login screen. A 401 with no token is just
  // a failed credential check (e.g. a wrong PIN on login); let its message
  // through so the caller can show it.
  if (response.status === 401 && token) {
    setToken(null);
    window.dispatchEvent(new CustomEvent('nani:signed-out'));
    throw new ApiError('Signed out', 401);
  }

  if (!response.ok) {
    throw new ApiError(data.error ?? 'Something went wrong', response.status);
  }
  return data as T;
}

export const get = <T,>(path: string) => api<T>(path);
export const post = <T,>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
export const patch = <T,>(path: string, body: unknown) =>
  api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
export const del = <T,>(path: string) => api<T>(path, { method: 'DELETE' });
