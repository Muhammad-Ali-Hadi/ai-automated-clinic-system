import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiPost, apiGet } from '../../lib/apiClient';
import { getTokens, setTokens, subscribeTokens, type AuthTokens } from '../../lib/tokenStore';
import { decodeJwt } from './jwt';
import type { AuthUser, Role } from '../../lib/types';

interface LoginResponse extends AuthTokens {
  user: { id: string; email: string; role: Role; hospitalId: string | null };
}

interface RegisterInput {
  hospitalName: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  status: 'loading' | 'authenticated' | 'anonymous';
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: (allSessions?: boolean) => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function userFromTokens(tokens: AuthTokens | null): AuthUser | null {
  if (!tokens) return null;
  const claims = decodeJwt(tokens.accessToken);
  if (!claims) return null;
  return { id: claims.sub, email: '', role: claims.role, hospitalId: claims.hospitalId };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(() => userFromTokens(getTokens()));
  const [status, setStatus] = useState<AuthContextValue['status']>(
    getTokens() ? 'loading' : 'anonymous',
  );
  const hydrated = useRef(false);

  // Keep React state in step with the token store (covers cross-tab + interceptor refresh).
  useEffect(() => {
    return subscribeTokens((tokens) => {
      setUser(userFromTokens(tokens));
      setStatus(tokens ? 'authenticated' : 'anonymous');
    });
  }, []);

  // On boot: if we hold tokens, confirm them by fetching the profile.
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const tokens = getTokens();
    if (!tokens) {
      setStatus('anonymous');
      return;
    }
    apiGet<AuthUser>('/auth/profile')
      .then((profile) => {
        setUser((prev) => ({ ...(prev ?? ({} as AuthUser)), ...profile }));
        setStatus('authenticated');
      })
      .catch(() => {
        setTokens(null);
        setStatus('anonymous');
      });
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await apiPost<LoginResponse>('/auth/login', { email, password });
      setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      setUser({
        id: data.user.id,
        email: data.user.email,
        role: data.user.role,
        hospitalId: data.user.hospitalId,
      });
      setStatus('authenticated');
      await queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const register = useCallback(async (input: RegisterInput) => {
    await apiPost('/auth/register', input);
  }, []);

  const logout = useCallback(
    async (allSessions = false) => {
      try {
        await apiPost(allSessions ? '/auth/logout-all' : '/auth/logout');
      } catch {
        /* best effort — clear locally regardless */
      }
      setTokens(null);
      setUser(null);
      setStatus('anonymous');
      queryClient.clear();
    },
    [queryClient],
  );

  // Interceptor emits this when a refresh ultimately fails.
  useEffect(() => {
    const onForcedLogout = () => {
      setUser(null);
      setStatus('anonymous');
      queryClient.clear();
    };
    window.addEventListener('auth:logout', onForcedLogout);
    return () => window.removeEventListener('auth:logout', onForcedLogout);
  }, [queryClient]);

  const hasRole = useCallback(
    (...roles: Role[]) => (user ? roles.includes(user.role) : false),
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, register, logout, hasRole }),
    [user, status, login, register, logout, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
