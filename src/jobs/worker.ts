import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { tick } from './worker-core.js';

const workerId = `worker-${process.pid}`;
let stopping = false;
const stop = (signal: string): void => { stopping = true; logger.info({ signal }, 'Background worker stopping'); };
process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));

async function loop(): Promise<void> {
  logger.info({ workerId }, 'Background worker started');
  while (!stopping) {
    try { await tick({ prisma, env, workerId, logger }); }
    catch (error) { logger.error({ err: error }, 'Background worker tick failed'); }
    await new Promise((resolve) => setTimeout(resolve, env.JOB_POLL_INTERVAL_MS));
  }
}

void loop().finally(() => prisma.$disconnect());
