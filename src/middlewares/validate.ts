import type { Request, RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../utils/app-error.js';

type Part = 'body' | 'query' | 'params';

/**
 * Reassign a (possibly getter-only) Express request value such as `query`,
 * which is defined as a getter-only accessor on the Express 5 request prototype.
 * `Object.defineProperty` replaces the accessor on the instance safely, whereas a
 * plain assignment would throw "only has a getter".
 */
const assign = <K extends Part>(req: Request, key: K, value: unknown): void => {
  try {
    req[key] = value as never;
  } catch {
    Object.defineProperty(req, key, {
      value,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }
};

export const validate = (schema: ZodType): RequestHandler => async (req, _res, next) => {
  // GET/HEAD/DELETE requests legitimately have no JSON body (req.body === undefined)
  // and may have no query string / route params. Default each segment to {} so that
  // schemas declaring `body: z.object({})` (etc.) validate correctly instead of
  // failing with "Required".
  const result = await schema.safeParseAsync({
    body: req.body ?? {},
    query: req.query ?? {},
    params: req.params ?? {},
  });

  if (!result.success) {
    // Report errors under the correct segment (body.<field> / query.<field> / params.<field>)
    const errors = result.error.issues.map((issue) => ({
      field: issue.path.filter((p) => typeof p === 'string' || typeof p === 'number').join('.'),
      message: issue.message,
      code: issue.code,
    }));
    return next(new AppError('Validation failed', 422, errors));
  }

  assign(req, 'body', result.data.body);
  assign(req, 'query', result.data.query);
  assign(req, 'params', result.data.params);
  next();
};
