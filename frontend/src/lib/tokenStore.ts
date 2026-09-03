/**
 * Single source of truth for auth tokens.
 *
 * Tokens live in memory for the app's lifetime and are mirrored to localStorage
 * so a refresh survives a reload. The API client reads the access token
 * synchronously on every request; the AuthProvider hydrates/clears this on
 * login/logout. Subscribers are notified so React state can follow.
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const STORAGE_KEY = 'renovia.auth';

let tokens: AuthTokens | null = load();
const listeners = new Set<(t: AuthTokens | null) => void>();

function load(): AuthTokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthTokens;
    if (parsed?.accessToken && parsed?.refreshToken) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function getTokens(): AuthTokens | null {
  return tokens;
}

export function getAccessToken(): string | null {
  return tokens?.accessToken ?? null;
}

export function setTokens(next: AuthTokens | null): void {
  tokens = next;
  try {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage disabled — memory copy still works for this tab */
  }
  listeners.forEach((fn) => fn(next));
}

export function subscribeTokens(fn: (t: AuthTokens | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Cross-tab sync: if another tab logs out/in, follow it. */
window.addEventListener('storage', (e) => {
  if (e.key !== STORAGE_KEY) return;
  tokens = load();
  listeners.forEach((fn) => fn(tokens));
});
