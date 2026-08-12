import type { RequestHandler } from 'express';
import { notificationService } from '../services/notification.service.js';
import { ok } from '../utils/api-response.js';

export const sendNotification: RequestHandler = async (req, res) =>
  ok(res, await notificationService.send(req.auth!, req.body), 'Notification sent.', 201);

export const getNotification: RequestHandler = async (req, res) =>
  ok(res, await notificationService.getNotification(req.auth!, String(req.params.id)), 'Notification retrieved.');

export const listNotifications: RequestHandler = async (req, res) => {
  const result = await notificationService.listNotifications(req.auth!, req.query as any);
  ok(res, result.data, 'Notifications retrieved.', 200, result.meta);
};

export const markRead: RequestHandler = async (req, res) =>
  ok(res, await notificationService.markRead(req.auth!, String(req.params.id)), 'Notification marked as read.');

export const markUnread: RequestHandler = async (req, res) =>
  ok(res, await notificationService.markUnread(req.auth!, String(req.params.id)), 'Notification marked as unread.');

export const createTemplate: RequestHandler = async (req, res) =>
  ok(res, await notificationService.createTemplate(req.auth!, req.body), 'Template created.', 201);

export const listTemplates: RequestHandler = async (req, res) =>
  ok(res, await notificationService.listTemplates(req.auth!), 'Templates retrieved.');

export const getTemplate: RequestHandler = async (req, res) =>
  ok(res, await notificationService.getTemplate(req.auth!, String(req.params.id)), 'Template retrieved.');

export const updateTemplate: RequestHandler = async (req, res) =>
  ok(res, await notificationService.updateTemplate(req.auth!, String(req.params.id), req.body), 'Template updated.');

export const deleteTemplate: RequestHandler = async (req, res) => {
  await notificationService.deleteTemplate(req.auth!, String(req.params.id));
  ok(res, null, 'Template deleted.');
};

export const broadcast: RequestHandler = async (req, res) =>
  ok(res, await notificationService.broadcast(req.auth!, req.body), 'Broadcast sent.');
