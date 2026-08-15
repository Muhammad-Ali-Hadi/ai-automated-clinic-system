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
app.use(express.json({ limit: '1mb', type: ['application/json', 'application/*+json'] }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-8', legacyHeaders: false }));
app.get('/health', (_req, res) => res.json({ success: true, message: 'Healthy', data: { status: 'ok' } }));
app.get('/ready', async (_req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; res.json({ success: true, message: 'Ready', data: { status: 'ready', database: 'ok' } }); }
  catch { res.status(503).json({ success: false, message: 'Service is not ready.', errors: [], statusCode: 503 }); }
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapi, { swaggerOptions: { persistAuthorization: false } }));
app.use('/api/v1', apiRouter);
app.use(notFound);
app.use(errorHandler);
