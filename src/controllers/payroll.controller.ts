import type { RequestHandler } from 'express';
import { payrollService } from '../services/payroll.service.js';
import { ok } from '../utils/api-response.js';
export const configurePayroll: RequestHandler = async (req, res) => ok(res, await payrollService.configure(req.auth!, req.body), 'Payroll integration configured.', 201);
export const listPayroll: RequestHandler = async (req, res) => ok(res, await payrollService.get(req.auth!), 'Payroll integrations retrieved.');
