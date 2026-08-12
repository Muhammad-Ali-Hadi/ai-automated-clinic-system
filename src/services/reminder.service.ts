import { AppError } from '../utils/app-error.js';
import { prisma } from '../lib/prisma.js';
import { auditService, type TenantAuth } from './audit.service.js';

export const reminderService = {
  async schedule(auth: TenantAuth, input: { type: 'APPOINTMENT' | 'PAYMENT' | 'PRESCRIPTION'; subject: string; body: string; runAt: string; userId?: string }) {
    if (!auth.hospitalId) throw new AppError('Tenant context required.', 403);
    const runAt = new Date(input.runAt);
    if (runAt <= new Date()) throw new AppError('Reminder time must be in the future.', 400);
    const reminder = await prisma.$transaction(async (tx) => {
      const job = await tx.backgroundJob.create({ data: { hospitalId: auth.hospitalId!, type: 'REMINDER', runAt, payload: { type: input.type, subject: input.subject, body: input.body, userId: input.userId ?? null } } });
      return tx.reminder.create({ data: { hospitalId: auth.hospitalId!, userId: input.userId, type: input.type, subject: input.subject, body: input.body, runAt, backgroundJobId: job.id } });
    });
    await auditService.record(auth, 'CREATE', 'Reminder', reminder.id);
    return reminder;
  },
  async list(auth: TenantAuth, query: { page?: number; limit?: number }) {
    if (!auth.hospitalId) throw new AppError('Tenant context required.', 403);
    const page = query.page ?? 1; const limit = query.limit ?? 20;
    const where = { hospitalId: auth.hospitalId };
    const [data, total] = await Promise.all([prisma.reminder.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { runAt: 'asc' } }), prisma.reminder.count({ where })]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },
};
