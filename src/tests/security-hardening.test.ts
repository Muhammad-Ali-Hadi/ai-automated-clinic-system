import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { createLogger, redactPaths } from '../lib/logger.js';
import { parseEnv } from '../config/env.js';
import { authenticate, authorize, requireTenant } from '../middlewares/auth.js';
import { AppError } from '../utils/app-error.js';
import { errorHandler, notFound } from '../middlewares/error-handler.js';
import { Prisma } from '@prisma/client';

vi.mock('../services/token.service.js', () => ({ verifyAccessToken: vi.fn() }));
vi.mock('../lib/prisma.js', () => ({ prisma: { session: { findUnique: vi.fn().mockResolvedValue({ userId: 'u1', revokedAt: null, expiresAt: new Date(Date.now() + 60_000) }) } } }));
import { verifyAccessToken } from '../services/token.service.js';

const response = (): Response => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), setHeader: vi.fn() } as unknown as Response);

describe('production security boundaries', () => {
  it('rejects missing and invalid authentication, and accepts a valid JWT claim set', async () => {
    const next = vi.fn();
    await authenticate({ headers: {} } as Request, response(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    next.mockReset();
    vi.mocked(verifyAccessToken).mockImplementationOnce(() => { throw new Error('bad'); });
    await authenticate({ headers: { authorization: 'Bearer bad' } } as Request, response(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    next.mockReset();
    vi.mocked(verifyAccessToken).mockReturnValueOnce({ sub: 'u1', hospitalId: 'h1', role: 'DOCTOR', sessionId: 's1' } as never);
    const req = { headers: { authorization: 'Bearer good' } } as Request;
    await authenticate(req, response(), next);
    expect(req.auth).toEqual({ userId: 'u1', hospitalId: 'h1', role: 'DOCTOR', sessionId: 's1' });
    expect(next).toHaveBeenCalledWith();
  });

  it('enforces RBAC and tenant context, including SUPER_ADMIN exception', () => {
    const next = vi.fn();
    authorize('HOSPITAL_ADMIN')({ auth: { userId: 'u', hospitalId: 'h', role: 'DOCTOR', sessionId: 's' } } as Request, response(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    next.mockReset();
    requireTenant({ auth: { userId: 'u', hospitalId: null, role: 'DOCTOR', sessionId: 's' } } as Request, response(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    next.mockReset();
    requireTenant({ auth: { userId: 'u', hospitalId: null, role: 'SUPER_ADMIN', sessionId: 's' } } as Request, response(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('fails fast on unsafe production configuration and accepts complete configuration', () => {
    const base = { NODE_ENV: 'production', DATABASE_URL: 'https://db.example.test', DIRECT_URL: 'https://db.example.test', JWT_ACCESS_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'b'.repeat(32), CORS_ORIGIN: 'https://app.example.test' };
    expect(() => parseEnv(base)).toThrow();
    expect(parseEnv({ ...base, SMTP_HOST: 'smtp.example.test', SMTP_USER: 'user', SMTP_PASS: 'pass' }).NODE_ENV).toBe('production');
  });

  it('redacts credential-bearing fields in structured logs', async () => {
    expect(redactPaths).toContain('*.refreshToken');
    const stream = new PassThrough(); const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    const testLogger = createLogger(stream);
    testLogger.info({ refreshToken: 'secret-refresh', password: 'secret-password', safe: 'ok' }, 'test');
    await new Promise((resolve) => setImmediate(resolve));
    const line = Buffer.concat(chunks).toString();
    expect(line).not.toContain('secret-refresh');
    expect(line).not.toContain('secret-password');
    expect(line).toContain('[REDACTED]');
  });

  it('returns stable, non-sensitive error responses', () => {
    const res = response();
    errorHandler(new AppError('Denied', 403, [{ field: 'x' }]), { id: 'req-1' } as Request, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Denied' }));
    const dbError = new Prisma.PrismaClientKnownRequestError('secret connection detail', { code: 'P2002', clientVersion: 'test' });
    const dbRes = response(); errorHandler(dbError, { id: 'req-2' } as Request, dbRes, vi.fn());
    expect(dbRes.status).toHaveBeenCalledWith(409); expect(JSON.stringify(vi.mocked(dbRes.json).mock.calls[0])).not.toContain('secret connection detail');
    const missing = response(); notFound({} as Request, missing, vi.fn()); expect(missing.status).toHaveBeenCalledWith(404);
  });
});
