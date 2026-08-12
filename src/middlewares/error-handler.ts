import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../utils/app-error.js';
import { logger } from '../lib/logger.js';
export const notFound: RequestHandler = (_req, res) => res.status(404).json({ success: false, message: 'Resource not found.', errors: [], statusCode: 404 });
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const known = error instanceof AppError;
  if (!known) logger.error({ err: error }, 'Unhandled application error');
  res.status(known ? error.statusCode : 500).json({ success: false, message: known ? error.message : 'An unexpected error occurred.', errors: known ? error.errors : [], statusCode: known ? error.statusCode : 500 });
};
