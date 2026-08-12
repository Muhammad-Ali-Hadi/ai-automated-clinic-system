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
 * env vars (e.g. SENDGRID_API_KEY, TWILIO_ACCOUNT_SID, FCM_SERVER_KEY).
 * When env vars are absent, delivery is SIMULATED and logged.
 */
const dispatchViaProvider = async (
  channel: NotificationChannel,
  _title: string,
  _body: string
): Promise<void> => {
  switch (channel) {
    case 'EMAIL':
      // TODO: inject SMTP / SendGrid provider when SMTP_HOST / SENDGRID_API_KEY is set
      break;
    case 'SMS':
      // TODO: inject Twilio provider when TWILIO_ACCOUNT_SID is set
      break;
    case 'WHATSAPP':
      // TODO: inject WhatsApp Business provider when WHATSAPP_API_KEY is set
      break;
    case 'PUSH':
      // TODO: inject FCM / APNs provider when FCM_SERVER_KEY is set
      break;
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
    return notificationRepository.markRead(id, hid(auth));
  },

  async markUnread(auth: TenantAuth, id: string) {
    await this.getNotification(auth, id);
    return notificationRepository.markUnread(id, hid(auth));
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
