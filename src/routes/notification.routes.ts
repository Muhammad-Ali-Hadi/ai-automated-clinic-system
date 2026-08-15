import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, requireTenant } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  broadcast,
  createTemplate,
  deleteTemplate,
  getNotification,
  getTemplate,
  listNotifications,
  listTemplates,
  markRead,
  markUnread,
  sendNotification,
  updateTemplate,
} from '../controllers/notification.controller.js';

export const notificationRouter = Router();
notificationRouter.use(authenticate, requireTenant);

const envelope = z.object({ params: z.object({}), body: z.object({}), query: z.object({}) });
const idParam = z.object({ id: z.string().uuid() });
const channelEnum = z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'PUSH']);

const adminOnly = authorize('HOSPITAL_ADMIN');
const staffAll = authorize('HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST');

notificationRouter.post(
  '/',
  adminOnly,
  validate(
    envelope.extend({
      body: z.object({
        userId: z.string().uuid(),
        channel: channelEnum,
        title: z.string().min(2).max(200),
        body: z.string().min(1).max(2000),
      }),
    })
  ),
  sendNotification
);

notificationRouter.get(
  '/',
  adminOnly,
  validate(
    envelope.extend({
      query: z.object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        userId: z.string().uuid().optional(),
        channel: channelEnum.optional(),
        unreadOnly: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
      }),
    })
  ),
  listNotifications
);

notificationRouter.get(
  '/:id',
  staffAll,
  validate(envelope.extend({ params: idParam })),
  getNotification
);

notificationRouter.post(
  '/:id/read',
  staffAll,
  validate(envelope.extend({ params: idParam })),
  markRead
);

notificationRouter.post(
  '/:id/unread',
  staffAll,
  validate(envelope.extend({ params: idParam })),
  markUnread
);

// Templates
notificationRouter.post(
  '/templates',
  adminOnly,
  validate(
    envelope.extend({
      body: z.object({
        name: z.string().min(2).max(200),
        channel: channelEnum,
        title: z.string().min(2).max(200),
        body: z.string().min(1).max(5000),
      }),
    })
  ),
  createTemplate
);

notificationRouter.get('/templates/list', adminOnly, listTemplates);

notificationRouter.get(
  '/templates/:id',
  adminOnly,
  validate(envelope.extend({ params: idParam })),
  getTemplate
);

notificationRouter.patch(
  '/templates/:id',
  adminOnly,
  validate(
    envelope.extend({
      params: idParam,
      body: z
        .object({
          name: z.string().min(2).max(200).optional(),
          channel: channelEnum.optional(),
          title: z.string().min(2).max(200).optional(),
          body: z.string().min(1).max(5000).optional(),
        })
        .refine((v) => Object.keys(v).length > 0, 'At least one field to update'),
    })
  ),
  updateTemplate
);

notificationRouter.delete(
  '/templates/:id',
  adminOnly,
  validate(envelope.extend({ params: idParam })),
  deleteTemplate
);

// Broadcast
notificationRouter.post(
  '/broadcast',
  adminOnly,
  validate(
    envelope.extend({
      body: z.object({
        channel: channelEnum,
        title: z.string().min(2).max(200),
        body: z.string().min(1).max(2000),
        userIds: z.array(z.string().uuid()).min(1),
      }),
    })
  ),
  broadcast
);
