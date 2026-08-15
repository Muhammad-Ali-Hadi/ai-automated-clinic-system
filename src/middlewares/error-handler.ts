import { Prisma } from '@prisma/client';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../utils/app-error.js';
import { logger } from '../lib/logger.js';

export const notFound: RequestHandler = (_req, res) => res.status(404).json({ success: false, message: 'Resource not found.', errors: [], statusCode: 404 });

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ success: false, message: error.message, errors: error.errors, statusCode: error.statusCode });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const statusCode = error.code === 'P2025' ? 404 : error.code === 'P2002' || error.code === 'P2003' ? 409 : 500;
    if (statusCode === 500) logger.error({ err: error, requestId: req.id }, 'Unhandled database error');
    const message = statusCode === 404 ? 'Resource not found.' : statusCode === 409 ? 'The request conflicts with existing data.' : 'An unexpected error occurred.';
    res.status(statusCode).json({ success: false, message, errors: [], statusCode });
    return;
  }
  logger.error({ err: error, requestId: req.id }, 'Unhandled application error');
  res.status(500).json({ success: false, message: 'An unexpected error occurred.', errors: [], statusCode: 500 });
};
