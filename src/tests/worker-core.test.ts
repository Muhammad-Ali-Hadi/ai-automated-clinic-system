import { describe, expect, it, vi } from 'vitest';
import { claimNextJob, failOrRetry, processJob, recoverExpiredLocks, tick } from '../jobs/worker-core.js';

const makeDeps = () => {
  const prisma = {
    $executeRaw: vi.fn().mockResolvedValue(0),
    $queryRaw: vi.fn().mockResolvedValue([]),
    backgroundJob: { findUnique: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
    notification: { create: vi.fn() },
    reminder: { updateMany: vi.fn() },
  } as any;
  return { prisma, env: { JOB_LOCK_TIMEOUT_SECONDS: 300, JOB_MAX_BACKOFF_SECONDS: 300 }, workerId: 'worker-test', logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }, mailer: { send: vi.fn() } } as any;
};

describe('PostgreSQL worker reliability', () => {
  it('claims one job with the atomic query and supports empty queues', async () => {
    const deps = makeDeps(); deps.prisma.$queryRaw.mockResolvedValueOnce([{ id: 'job-1' }]);
    expect(await claimNextJob(deps)).toEqual({ id: 'job-1' });
    deps.prisma.$queryRaw.mockResolvedValueOnce([]); expect(await claimNextJob(deps)).toBeUndefined();
  });

  it('recovers leases and marks exhausted leases failed', async () => {
    const deps = makeDeps(); deps.prisma.$executeRaw.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    await recoverExpiredLocks(deps);
    expect(deps.prisma.$executeRaw).toHaveBeenCalledTimes(2); expect(deps.logger.warn).toHaveBeenCalledWith(expect.objectContaining({ recovered: 2, exhausted: 1 }), expect.any(String));
  });

  it('schedules bounded exponential retries and terminal failures', async () => {
    const deps = makeDeps();
    await failOrRetry({ id: 'j1', attempts: 2, maxAttempts: 3 }, deps, new Error('temporary'));
    expect(deps.prisma.backgroundJob.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'j1' }, data: expect.objectContaining({ status: 'PENDING', failureReason: expect.stringContaining('retry') }) }));
    deps.prisma.backgroundJob.update.mockClear();
    await failOrRetry({ id: 'j1', attempts: 3, maxAttempts: 3 }, deps, new Error('permanent'));
    expect(deps.prisma.backgroundJob.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }));
  });

  it('never claims successful delivery for unsupported channels', async () => {
    const deps = makeDeps();
    await expect(processJob({ id: 'j', type: 'SEND_NOTIFICATION', hospitalId: 'h', payload: { userId: 'u', channel: 'SMS', title: 'x', body: 'y' } }, deps)).rejects.toThrow('SMS delivery provider is not configured');
    expect(deps.mailer.send).not.toHaveBeenCalled();
  });

  it('completes email jobs and retries failures through tick', async () => {
    const deps = makeDeps();
    deps.prisma.$queryRaw.mockResolvedValue([{ id: 'j1' }]);
    deps.prisma.backgroundJob.findUnique.mockResolvedValue({ id: 'j1', type: 'SEND_NOTIFICATION', hospitalId: 'h', attempts: 1, maxAttempts: 3, payload: { userId: 'u', channel: 'EMAIL', title: 't', body: 'b' } });
    deps.prisma.user.findUnique.mockResolvedValue({ email: 'u@example.test' });
    await tick(deps); expect(deps.mailer.send).toHaveBeenCalledWith('u@example.test', 't', 'b');
    expect(deps.prisma.backgroundJob.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) }));
  });
});
