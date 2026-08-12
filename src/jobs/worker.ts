import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

const workerId = `worker-${process.pid}`;
let stopping = false;

async function claim() {
  return prisma.$queryRaw<Array<{ id: string }>>`
    WITH next AS (
      SELECT id
      FROM "BackgroundJob"
      WHERE status = 'PENDING' AND "runAt" <= NOW()
      ORDER BY "runAt"
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE "BackgroundJob" j
    SET status = 'PROCESSING', "lockedAt" = NOW(), "lockedBy" = ${workerId}, attempts = attempts + 1
    FROM next
    WHERE j.id = next.id
    RETURNING j.id
  `;
}

async function tick() {
  const [claimed] = await claim();
  if (!claimed) return;

  try {
    const job = await prisma.backgroundJob.findUnique({ where: { id: claimed.id } });
    if (!job) throw new Error('Background job not found.');

    logger.info({ jobId: job.id, type: job.type }, 'Processing job');

    if (job.type === 'REMINDER') {
      const payload = job.payload as { userId?: string | null; subject: string; body: string };
      if (payload.userId) {
        // Guard against stale/deleted user ids: only create the notification when the
        // target user actually exists, otherwise the FK on Notification.userId would
        // throw and mark an otherwise-valid REMINDER job as FAILED.
        const target = await prisma.user.findUnique({ where: { id: payload.userId }, select: { id: true } });
        if (target) {
          await prisma.notification.create({
            data: {
              hospitalId: job.hospitalId,
              userId: payload.userId,
              channel: 'PUSH',
              title: payload.subject,
              body: payload.body,
            },
          });
        } else {
          logger.warn({ jobId: job.id, userId: payload.userId }, 'Skipping notification for unknown user');
        }
      }
      await prisma.reminder.updateMany({
        where: { backgroundJobId: job.id },
        data: { status: 'SENT' },
      });
    }

    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: { status: 'COMPLETED', completedAt: new Date(), lockedAt: null, lockedBy: null },
    });
  } catch (error) {
    logger.error({ err: error, jobId: claimed.id }, 'Job failed');
    await prisma.backgroundJob.update({
      where: { id: claimed.id },
      data: { status: 'FAILED', failureReason: 'Worker execution failed', lockedAt: null, lockedBy: null },
    });
  }
}

async function loop() {
  while (!stopping) {
    await tick();
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

process.on('SIGTERM', () => { stopping = true; });
process.on('SIGINT', () => { stopping = true; });
void loop().finally(() => prisma.$disconnect());
