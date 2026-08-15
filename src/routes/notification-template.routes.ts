import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, requireTenant } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  createNotificationTemplate,
  listNotificationTemplates,
  getNotificationTemplate,
  updateNotificationTemplate,
} from '../controllers/notification-template.controller.js';

export const notificationTemplateRouter = Router();
notificationTemplateRouter.use(authenticate, requireTenant);

const envelope = z.object({ params: z.object({}), body: z.object({}), query: z.object({}) });
const adminOnly = authorize('HOSPITAL_ADMIN');

notificationTemplateRouter.post(
  '/',
  adminOnly,
  validate(envelope.extend({
    body: z.object({
      name: z.string().min(1).max(100),
      subject: z.string().max(255).optional(),
      body: z.string().min(1),
      channel: z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'PUSH']),
    }),
  })),
  createNotificationTemplate
);

notificationTemplateRouter.get(
  '/',
  adminOnly,
  validate(envelope.extend({
    query: z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      channel: z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'PUSH']).optional(),
      status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    }),
  })),
  listNotificationTemplates
);

notificationTemplateRouter.get(
  '/:id',
  adminOnly,
  validate(envelope.extend({ params: z.object({ id: z.string().uuid() }) })),
  getNotificationTemplate
);

notificationTemplateRouter.put(
  '/:id',
  adminOnly,
  validate(envelope.extend({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({
      subject: z.string().max(255).optional(),
      body: z.string().min(1).optional(),
      channel: z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'PUSH']).optional(),
      status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    }),
  })),
  updateNotificationTemplate
);
