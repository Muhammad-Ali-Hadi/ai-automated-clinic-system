import type { RequestHandler } from 'express';
import { reminderService } from '../services/reminder.service.js';
import { ok } from '../utils/api-response.js';
export const scheduleReminder: RequestHandler = async (req, res) => ok(res, await reminderService.schedule(req.auth!, req.body), 'Reminder scheduled.', 201);
export const listReminders: RequestHandler = async (req, res) => { const result = await reminderService.list(req.auth!, req.query as any); ok(res, result.data, 'Reminders retrieved.', 200, result.meta); };
