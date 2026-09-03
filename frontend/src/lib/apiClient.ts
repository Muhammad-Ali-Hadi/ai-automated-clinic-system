import axios, { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { getAccessToken, getTokens, setTokens } from './tokenStore';
import { toApiError } from './apiError';

/**
 * The one HTTP client for the app.
 *
 * System-design properties:
 *  - Same-origin: talks to `/api/v1`, which Vite proxies to the backend in dev.
 *  - Auth: attaches the current access token per request (read fresh, not captured).
 *  - Refresh: on a 401 it performs a single-flight token refresh and replays the
 *    queued requests once — concurrent 401s share one refresh call.
 *  - Failure: a failed refresh clears the session and broadcasts `auth:logout`.
 *  - Errors: every rejection is normalized to `ApiError` for the UI/react-query.
 */

export const API_BASE = '/api/v1';

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    const headers = AxiosHeaders.from(config.headers);
    headers.set('Authorization', `Bearer ${token}`);
    config.headers = headers;
  }
  return config;
});

let refreshInFlight: Promise<string> | null = null;

async function runRefresh(): Promise<string> {
  const current = getTokens();
  if (!current?.refreshToken) throw new Error('No refresh token');

  // Bare axios call so we don't recurse through this interceptor.
  const { data } = await axios.post(`${API_BASE}/auth/refresh`, {
    refreshToken: current.refreshToken,
  });
  const payload = (data?.data ?? data) as { accessToken: string; refreshToken: string };
  if (!payload?.accessToken || !payload?.refreshToken) throw new Error('Malformed refresh response');
  setTokens(payload);
  return payload.accessToken;
}

function forceLogout() {
  setTokens(null);
  window.dispatchEvent(new CustomEvent('auth:logout'));
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const status = error.response?.status;
    const isRefreshCall = original?.url?.includes('/auth/refresh');

    if (status === 401 && original && !original._retried && !isRefreshCall && getTokens()?.refreshToken) {
      original._retried = true;
      try {
        refreshInFlight = refreshInFlight ?? runRefresh().finally(() => (refreshInFlight = null));
        const newToken = await refreshInFlight;
        const headers = AxiosHeaders.from(original.headers);
        headers.set('Authorization', `Bearer ${newToken}`);
        original.headers = headers;
        return api(original);
      } catch {
        forceLogout();
        return Promise.reject(toApiError(error));
      }
    }

    if (status === 401 && !isRefreshCall) forceLogout();
    return Promise.reject(toApiError(error));
  },
);

/** Unwrap the backend envelope: `{ success, message, data, meta }`. */
export interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export async function apiGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const { data } = await api.get<Envelope<T>>(url, { params: clean(params) });
  return data.data;
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await api.post<Envelope<T>>(url, body);
  return data.data;
}

export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await api.patch<Envelope<T>>(url, body);
  return data.data;
}

export async function apiPut<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await api.put<Envelope<T>>(url, body);
  return data.data;
}

export async function apiDelete<T>(url: string): Promise<T> {
  const { data } = await api.delete<Envelope<T>>(url);
  return data.data;
}

/**
 * List endpoints return `data: { data: T[], meta: {...} }` (service-level
 * pagination) OR sometimes `data: T[]`. Normalize both to `Paginated<T>`.
 */
export async function apiList<T>(
  url: string,
  params?: Record<string, unknown>,
): Promise<Paginated<T>> {
  const { data } = await api.get<Envelope<unknown>>(url, { params: clean(params) });
  const payload = data.data as
    | T[]
    | { data: T[]; meta?: { page?: number; limit?: number; total?: number; totalPages?: number } };

  if (Array.isArray(payload)) {
    return { items: payload, page: 1, limit: payload.length, total: payload.length, totalPages: 1 };
  }
  const items = Array.isArray(payload?.data) ? payload.data : [];
  const meta = payload?.meta ?? {};
  return {
    items,
    page: Number(meta.page ?? 1),
    limit: Number(meta.limit ?? items.length),
    total: Number(meta.total ?? items.length),
    totalPages: Number(meta.totalPages ?? 1),
  };
}

/** Drop empty/undefined query params so the URL stays clean and cache keys stable. */
function clean(params?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!params) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    out[k] = v;
  }
  return out;
}
