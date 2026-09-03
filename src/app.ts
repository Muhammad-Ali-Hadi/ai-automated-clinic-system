import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { randomUUID } from 'node:crypto';
import { corsOrigins, env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { apiRouter } from './routes/index.js';
import { errorHandler, notFound } from './middlewares/error-handler.js';
import { openapi } from './docs/openapi.js';

export const app = express();
app.disable('x-powered-by');
if (env.TRUST_PROXY_HOPS > 0) app.set('trust proxy', env.TRUST_PROXY_HOPS);
app.use(pinoHttp({ logger, genReqId: (req, res) => {
  const requestId = req.headers['x-request-id'];
  const id = typeof requestId === 'string' && requestId.length <= 128 ? requestId : randomUUID();
  res.setHeader('x-request-id', id);
  return id;
} }));
app.use(helmet());
app.use(cors({ origin: corsOrigins, credentials: true, methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] }));
app.use(compression());
// Voice transcription carries base64 audio — allow a larger body on that one path only.
// Runs before the global 1 MB parser; body-parser skips the second parse once req._body is set.
app.use('/api/v1/ai/transcribe', express.json({ limit: '25mb', type: ['application/json', 'application/*+json'] }));
app.use(express.json({ limit: '1mb', type: ['application/json', 'application/*+json'] }));
// Global rate limit. Window/max are env-tunable (RATE_LIMIT_WINDOW_MS / RATE_LIMIT_MAX);
// disabled entirely in development so a normal SPA session never trips it. A single SPA
// screen can fire several requests, so the default max is generous — tighten it in prod.
app.use(
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: (req) => env.NODE_ENV === 'development' || req.path === '/health' || req.path === '/ready',
    message: { success: false, message: 'Too many requests. Please slow down and try again shortly.', errors: [], statusCode: 429 },
  }),
);
app.get('/health', (_req, res) => res.json({ success: true, message: 'Healthy', data: { status: 'ok' } }));
app.get('/ready', async (_req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; res.json({ success: true, message: 'Ready', data: { status: 'ready', database: 'ok' } }); }
  catch { res.status(503).json({ success: false, message: 'Service is not ready.', errors: [], statusCode: 503 }); }
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapi, { swaggerOptions: { persistAuthorization: false } }));
app.use('/api/v1', apiRouter);
app.use(notFound);
app.use(errorHandler);
