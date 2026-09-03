import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Debounce a fast-changing value (search boxes) so we don't spam the API. */
export function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/**
 * List-screen state (page + search + arbitrary filters) mirrored to the URL query
 * string, so a screen is shareable/refresh-safe and the browser back button works.
 */
export function useListParams(defaults?: Record<string, string>) {
  const [params, setParams] = useSearchParams();

  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const search = params.get('q') ?? '';

  const get = useCallback((key: string) => params.get(key) ?? defaults?.[key] ?? '', [params, defaults]);

  const patch = useCallback(
    (next: Record<string, string | number | undefined>, resetPage = true) => {
      setParams(
        (prev) => {
          const sp = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(next)) {
            if (v === undefined || v === '') sp.delete(k);
            else sp.set(k, String(v));
          }
          if (resetPage && !('page' in next)) sp.set('page', '1');
          return sp;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const setPage = useCallback((p: number) => patch({ page: p }, false), [patch]);
  const setSearch = useCallback((q: string) => patch({ q: q || undefined }), [patch]);

  return { page, search, get, patch, setPage, setSearch };
}

/** Keep a stable ref to the latest callback. */
export function useEvent<T extends (...args: never[]) => unknown>(fn: T): T {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  return useMemo(() => ((...args: never[]) => ref.current(...args)) as T, []);
}
