import type { PrismaClient } from '@prisma/client';
import type { AppEnv } from '../config/env.js';
import { logger as defaultLogger } from '../lib/logger.js';
import { mailer as defaultMailer } from '../lib/mailer.js';
import { notificationProviders } from '../services/notification-provider.js';

export type WorkerLogger = Pick<typeof defaultLogger, 'info' | 'warn' | 'error'>;
export type WorkerMailer = Pick<typeof defaultMailer, 'send'>;
export type WorkerDeps = { prisma: PrismaClient; env: Pick<AppEnv, 'JOB_LOCK_TIMEOUT_SECONDS' | 'JOB_MAX_BACKOFF_SECONDS'>; workerId: string; logger?: WorkerLogger; mailer?: WorkerMailer };
type ClaimedJob = { id: string };

export async function recoverExpiredLocks({ prisma, env, logger = defaultLogger }: WorkerDeps): Promise<void> {
  const lockExpiry = new Date(Date.now() - env.JOB_LOCK_TIMEOUT_SECONDS * 1_000);
  const recovered = await prisma.$executeRaw`
    UPDATE "BackgroundJob" SET status = 'PENDING', "lockedAt" = NULL, "lockedBy" = NULL, "runAt" = NOW()
    WHERE status = 'PROCESSING' AND "lockedAt" < ${lockExpiry} AND attempts < "maxAttempts"
  `;
  const exhausted = await prisma.$executeRaw`
    UPDATE "BackgroundJob" SET status = 'FAILED', "failureReason" = 'Worker lease expired after maximum attempts', "lockedAt" = NULL, "lockedBy" = NULL
    WHERE status = 'PROCESSING' AND "lockedAt" < ${lockExpiry} AND attempts >= "maxAttempts"
  `;
  if (recovered || exhausted) logger.warn({ recovered, exhausted }, 'Recovered expired job leases');
}

export async function claimNextJob({ prisma, workerId }: WorkerDeps): Promise<ClaimedJob | undefined> {
  const [claimed] = await prisma.$queryRaw<ClaimedJob[]>`
    WITH next AS (
      SELECT id FROM "BackgroundJob"
      WHERE status = 'PENDING' AND "runAt" <= NOW()
      ORDER BY "runAt", "createdAt"
      FOR UPDATE SKIP LOCKED LIMIT 1
    )
    UPDATE "BackgroundJob" j
    SET status = 'PROCESSING', "lockedAt" = NOW(), "lockedBy" = ${workerId}, attempts = attempts + 1
    FROM next WHERE j.id = next.id RETURNING j.id
  `;
  return claimed;
}

export async function processJob(job: { id: string; type: string; hospitalId: string | null; payload: unknown }, { prisma, mailer = defaultMailer }: WorkerDeps): Promise<void> {
  if (job.type === 'REMINDER') {
    const payload = job.payload as { userId?: string | null; subject: string; body: string };
    if (payload.userId) {
      const target = await prisma.user.findUnique({ where: { id: payload.userId }, select: { id: true } });
      if (target) await prisma.notification.create({ data: { hospitalId: job.hospitalId, userId: payload.userId, channel: 'PUSH', title: payload.subject, body: payload.body } });
    }
    await prisma.reminder.updateMany({ where: { backgroundJobId: job.id }, data: { status: 'SENT' } });
    return;
  }
  if (job.type === 'SEND_NOTIFICATION') {
    const payload = job.payload as { userId: string; channel: string; title: string; body: string };
    const provider = notificationProviders[payload.channel as keyof typeof notificationProviders];
    if (!provider) throw new Error(`No delivery provider configured for ${payload.channel}`);
    if (payload.channel !== 'EMAIL') await provider.send({ recipient: '', title: payload.title, body: payload.body });
    const recipient = await prisma.user.findUnique({ where: { id: payload.userId }, select: { email: true } });
    if (!recipient) throw new Error('Notification recipient not found');
    if (payload.channel === 'EMAIL') await mailer.send(recipient.email, payload.title, payload.body);
    else await provider.send({ recipient: recipient.email, title: payload.title, body: payload.body });
    return;
  }
  throw new Error(`Unsupported background job type: ${job.type}`);
}

export async function failOrRetry(job: { id: string; attempts: number; maxAttempts: number }, { prisma, env, logger = defaultLogger }: WorkerDeps, error: unknown): Promise<void> {
  const retry = job.attempts < job.maxAttempts;
  const backoffSeconds = Math.min(2 ** Math.max(0, job.attempts - 1), env.JOB_MAX_BACKOFF_SECONDS);
  await prisma.backgroundJob.update({ where: { id: job.id }, data: retry
    ? { status: 'PENDING', runAt: new Date(Date.now() + backoffSeconds * 1_000), lockedAt: null, lockedBy: null, failureReason: 'Worker execution failed; retry scheduled' }
    : { status: 'FAILED', failureReason: 'Worker execution failed after maximum attempts', lockedAt: null, lockedBy: null } });
  logger.error({ err: error, jobId: job.id, attempts: job.attempts, retry }, 'Background job execution failed');
}

export async function tick(deps: WorkerDeps): Promise<void> {
  await recoverExpiredLocks(deps);
  const claimed = await claimNextJob(deps);
  if (!claimed) return;
  const job = await deps.prisma.backgroundJob.findUnique({ where: { id: claimed.id } });
  if (!job) return;
  try {
    (deps.logger ?? defaultLogger).info({ jobId: job.id, type: job.type, attempts: job.attempts }, 'Processing background job');
    await processJob(job, deps);
    await deps.prisma.backgroundJob.update({ where: { id: job.id }, data: { status: 'COMPLETED', completedAt: new Date(), lockedAt: null, lockedBy: null, failureReason: null } });
  } catch (error) {
    await failOrRetry(job, deps, error);
  }
}
