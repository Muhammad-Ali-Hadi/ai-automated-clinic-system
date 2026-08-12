import { AppError } from '../utils/app-error.js';
import { auditService, type TenantAuth } from './audit.service.js';
import { prisma } from '../lib/prisma.js';
import type { NotificationTemplateChannel, NotificationTemplateStatus } from '@prisma/client';

const hid = (auth: TenantAuth) => {
  if (!auth.hospitalId) throw new AppError('Tenant context required.', 403);
  return auth.hospitalId;
};

export const notificationTemplateService = {
  async createTemplate(
    auth: TenantAuth,
    input: { name: string; subject?: string; body: string; channel: NotificationTemplateChannel }
  ) {
    const hospitalId = hid(auth);
    const template = await prisma.notificationTemplate.create({
      data: { hospitalId, ...input },
    });
    await auditService.record(auth, 'CREATE', 'NotificationTemplate', template.id);
    return template;
  },

  async getTemplate(auth: TenantAuth, id: string) {
    const template = await prisma.notificationTemplate.findFirst({
      where: { id, hospitalId: hid(auth) },
    });
    if (!template) throw new AppError('Notification template not found.', 404);
    return template;
  },

  async listTemplates(
    auth: TenantAuth,
    query: { page?: number; limit?: number; channel?: NotificationTemplateChannel; status?: NotificationTemplateStatus }
  ) {
    const hospitalId = hid(auth);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = {
      hospitalId,
      ...(query.channel ? { channel: query.channel } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.notificationTemplate.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
      }),
      prisma.notificationTemplate.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async updateTemplate(
    auth: TenantAuth,
    id: string,
    input: { subject?: string; body?: string; channel?: NotificationTemplateChannel; status?: NotificationTemplateStatus }
  ) {
    await this.getTemplate(auth, id);
    await prisma.notificationTemplate.updateMany({
      where: { id, hospitalId: hid(auth) },
      data: input,
    });
    await auditService.record(auth, 'UPDATE', 'NotificationTemplate', id);
    return this.getTemplate(auth, id);
  },
};
