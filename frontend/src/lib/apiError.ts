import { AxiosError } from 'axios';

export interface FieldError {
  field: string;
  message: string;
  code?: string;
}

/** Normalized error surfaced to the UI regardless of transport failure mode. */
export class ApiError extends Error {
  status: number;
  fieldErrors: FieldError[];
  raw: unknown;

  constructor(message: string, status: number, fieldErrors: FieldError[] = [], raw?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.raw = raw;
  }

  /** Map of field -> first message, handy for form binding. */
  get fieldMap(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const fe of this.fieldErrors) {
      const key = fe.field.replace(/^body\./, '');
      if (!(key in out)) out[key] = fe.message;
    }
    return out;
  }
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;

  if (err instanceof AxiosError) {
    if (err.code === 'ERR_NETWORK') {
      return new ApiError('Cannot reach the server. Is the API running on :4000?', 0, [], err);
    }
    if (err.code === 'ECONNABORTED') {
      return new ApiError('The request timed out. Please try again.', 0, [], err);
    }
    const res = err.response;
    const body = res?.data as
      | { message?: string; errors?: FieldError[]; statusCode?: number }
      | undefined;
    const status = res?.status ?? body?.statusCode ?? 0;
    const fallback =
      status === 429
        ? 'The server is rate limiting requests — retrying automatically…'
        : err.message || 'Request failed';
    return new ApiError(
      body?.message || fallback,
      status,
      Array.isArray(body?.errors) ? (body!.errors as FieldError[]) : [],
      body,
    );
  }

  if (err instanceof Error) return new ApiError(err.message, 0, [], err);
  return new ApiError('Unknown error', 0, [], err);
}
