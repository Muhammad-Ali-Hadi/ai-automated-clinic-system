import { AppError } from '../utils/app-error.js';
import { auditService, type TenantAuth } from './audit.service.js';
import { notificationRepository } from '../repositories/notification.repository.js';
import { prisma } from '../lib/prisma.js';
import type { NotificationChannel } from '@prisma/client';

const hid = (auth: TenantAuth) => {
  if (!auth.hospitalId) throw new AppError('Tenant context required.', 403);
  return auth.hospitalId;
};

/**
 * Provider dispatch — clean interface. Actual delivery requires provider
 * Email is delivered by the worker; SMS, WhatsApp and Push remain explicitly
 * unavailable until real provider adapters are configured.
 */
const dispatchViaProvider = async (
  channel: NotificationChannel,
  _title: string,
  _body: string
): Promise<void> => {
  switch (channel) {
    case 'EMAIL':
      throw new AppError('Email delivery is handled by the PostgreSQL worker.', 500);
    case 'SMS':
      throw new AppError('SMS delivery is not configured.', 503);
    case 'WHATSAPP':
      throw new AppError('WhatsApp delivery is not configured.', 503);
    case 'PUSH':
      throw new AppError('Push delivery is not configured.', 503);
  }
};

const getConfig = async (hospitalId: string) => {
  let settings = await prisma.hospitalSettings.findUnique({ where: { hospitalId } });
  if (!settings) {
    settings = await prisma.hospitalSettings.create({
      data: { hospitalId, preferences: {}, configuration: {} },
    });
  }
  return (settings.configuration as any) || {};
};

const saveConfig = (hospitalId: string, config: object) =>
  prisma.hospitalSettings.update({
    where: { hospitalId },
    data: { configuration: config },
  });

export const notificationService = {
  async send(
    auth: TenantAuth,
    input: {
      userId: string;
      channel: NotificationChannel;
      title: string;
      body: string;
    }
  ) {
    const hospitalId = hid(auth);
    // Persist notification record
    const notification = await notificationRepository.create({
      ...input,
      hospitalId,
    });

    // Enqueue delivery via PostgreSQL-backed background job
    await prisma.backgroundJob.create({
      data: {
        hospitalId,
        type: 'SEND_NOTIFICATION',
        payload: {
          notificationId: notification.id,
          userId: input.userId,
          channel: input.channel,
          title: input.title,
          body: input.body,
        },
        runAt: new Date(),
        maxAttempts: 3,
      },
    });

    await auditService.record(auth, 'SEND_NOTIFICATION', 'Notification', notification.id);
    return notification;
  },

  async getNotification(auth: TenantAuth, id: string) {
    const notification = await notificationRepository.findById(id, hid(auth));
    if (!notification) throw new AppError('Notification not found.', 404);
    return notification;
  },

  async listNotifications(
    auth: TenantAuth,
    query: {
      page?: number;
      limit?: number;
      userId?: string;
      channel?: NotificationChannel;
      unreadOnly?: boolean;
    }
  ) {
    const hospitalId = hid(auth);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filters = { channel: query.channel, unreadOnly: query.unreadOnly };

    const [data, total] = await Promise.all([
      notificationRepository.list(hospitalId, query.userId, (page - 1) * limit, limit, filters),
      notificationRepository.count(hospitalId, query.userId, filters),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async markRead(auth: TenantAuth, id: string) {
    await this.getNotification(auth, id);
    const result = await notificationRepository.markRead(id, hid(auth));
    await auditService.record(auth, 'MARK_READ', 'Notification', id);
    return result;
  },

  async markUnread(auth: TenantAuth, id: string) {
    await this.getNotification(auth, id);
    const result = await notificationRepository.markUnread(id, hid(auth));
    await auditService.record(auth, 'MARK_UNREAD', 'Notification', id);
    return result;
  },

  // ---- Templates ----
  async createTemplate(
    auth: TenantAuth,
    input: { name: string; channel: string; title: string; body: string }
  ) {
    const hospitalId = hid(auth);
    const config = await getConfig(hospitalId);
    const templates = config.notificationTemplates || [];

    const template = { id: crypto.randomUUID(), ...input, createdAt: new Date() };
    templates.push(template);
    await saveConfig(hospitalId, { ...config, notificationTemplates: templates });

    await auditService.record(auth, 'CREATE', 'NotificationTemplate', template.id);
    return template;
  },

  async listTemplates(auth: TenantAuth) {
    const config = await getConfig(hid(auth));
    return config.notificationTemplates || [];
  },

  async getTemplate(auth: TenantAuth, id: string) {
    const templates: any[] = (await getConfig(hid(auth))).notificationTemplates || [];
    const template = templates.find((t) => t.id === id);
    if (!template) throw new AppError('Template not found.', 404);
    return template;
  },

  async updateTemplate(
    auth: TenantAuth,
    id: string,
    input: Partial<{ name: string; channel: string; title: string; body: string }>
  ) {
    const hospitalId = hid(auth);
    const config = await getConfig(hospitalId);
    const templates: any[] = config.notificationTemplates || [];
    const idx = templates.findIndex((t) => t.id === id);
    if (idx === -1) throw new AppError('Template not found.', 404);

    templates[idx] = { ...templates[idx], ...input, updatedAt: new Date() };
    await saveConfig(hospitalId, { ...config, notificationTemplates: templates });
    await auditService.record(auth, 'UPDATE', 'NotificationTemplate', id);
    return templates[idx];
  },

  async deleteTemplate(auth: TenantAuth, id: string) {
    const hospitalId = hid(auth);
    const config = await getConfig(hospitalId);
    const templates: any[] = config.notificationTemplates || [];
    const filtered = templates.filter((t) => t.id !== id);
    if (filtered.length === templates.length) throw new AppError('Template not found.', 404);
    await saveConfig(hospitalId, { ...config, notificationTemplates: filtered });
    await auditService.record(auth, 'DELETE', 'NotificationTemplate', id);
  },

  async broadcast(
    auth: TenantAuth,
    input: {
      channel: NotificationChannel;
      title: string;
      body: string;
      userIds: string[];
    }
  ) {
    const hospitalId = hid(auth);
    const sent = [];
    for (const userId of input.userIds) {
      const notification = await notificationRepository.create({
        userId,
        hospitalId,
        channel: input.channel,
        title: input.title,
        body: input.body,
      });

      await prisma.backgroundJob.create({
        data: {
          hospitalId,
          type: 'SEND_NOTIFICATION',
          payload: {
            notificationId: notification.id,
            userId,
            channel: input.channel,
            title: input.title,
            body: input.body,
          },
          runAt: new Date(),
          maxAttempts: 3,
        },
      });

      sent.push(notification);
    }

    await auditService.record(auth, 'BROADCAST', 'Notification', undefined, {
      count: sent.length,
      channel: input.channel,
    });
    return { sent: sent.length };
  },
};
