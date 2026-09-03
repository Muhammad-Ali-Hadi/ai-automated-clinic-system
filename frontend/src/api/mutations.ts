import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useToast } from '../components/ui/Toast';
import { ApiError } from '../lib/apiError';

interface Options<TVars, TData> {
  mutationFn: (vars: TVars) => Promise<TData>;
  /** query keys (prefixes) to invalidate on success */
  invalidate?: QueryKey[];
  successMessage?: string | ((data: TData, vars: TVars) => string);
  onSuccess?: (data: TData, vars: TVars) => void;
}

/**
 * Thin wrapper over useMutation that standardises the write path:
 *  - success toast + cache invalidation (declarative list of keys)
 *  - error toast with the backend message; field errors bubble via ApiError
 */
export function useApiMutation<TVars = void, TData = unknown>({
  mutationFn,
  invalidate = [],
  successMessage,
  onSuccess,
}: Options<TVars, TData>) {
  const qc = useQueryClient();
  const toast = useToast();

  return useMutation<TData, ApiError, TVars>({
    mutationFn,
    onSuccess: (data, vars) => {
      invalidate.forEach((key) => qc.invalidateQueries({ queryKey: key }));
      if (successMessage) {
        toast.success(typeof successMessage === 'function' ? successMessage(data, vars) : successMessage);
      }
      onSuccess?.(data, vars);
    },
    onError: (err) => {
      // Validation errors are shown inline by forms; still surface a toast summary.
      toast.error(err.message || 'Something went wrong');
    },
  });
}
