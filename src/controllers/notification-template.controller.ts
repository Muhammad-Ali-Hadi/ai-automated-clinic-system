import type { RequestHandler } from 'express';
import { notificationTemplateService } from '../services/notification-template.service.js';
import { ok } from '../utils/api-response.js';

export const createNotificationTemplate: RequestHandler = async (req, res) =>
  ok(res, await notificationTemplateService.createTemplate(req.auth!, req.body), 'Notification template created successfully.', 201);

export const listNotificationTemplates: RequestHandler = async (req, res) => {
  const result = await notificationTemplateService.listTemplates(req.auth!, req.query as any);
  ok(res, result.data, 'Notification templates retrieved.', 200, result.meta);
};

export const getNotificationTemplate: RequestHandler = async (req, res) =>
  ok(res, await notificationTemplateService.getTemplate(req.auth!, String(req.params.id)), 'Notification template retrieved.');

export const updateNotificationTemplate: RequestHandler = async (req, res) =>
  ok(res, await notificationTemplateService.updateTemplate(req.auth!, String(req.params.id), req.body), 'Notification template updated successfully.');

