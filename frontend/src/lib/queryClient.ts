import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './apiError';

/**
 * Shared cache. Defaults tuned for an operational dashboard:
 *  - staleTime 30s: quick nav between screens doesn't re-hit the API.
 *  - one retry, but never on 4xx (client errors won't fix themselves).
 *  - refetch on window focus for near-live queue/dashboard data.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        const status = error instanceof ApiError ? error.status : 0;
        // 429 (rate limited) and transient 5xx / network errors are worth retrying.
        if (status === 429) return failureCount < 4;
        if (status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
      // Exponential backoff, a little longer for 429 so the window can clear.
      retryDelay: (attempt, error) => {
        const status = error instanceof ApiError ? error.status : 0;
        const base = status === 429 ? 2_000 : 500;
        return Math.min(base * 2 ** attempt, 15_000);
      },
    },
    mutations: {
      retry: false,
    },
  },
});
