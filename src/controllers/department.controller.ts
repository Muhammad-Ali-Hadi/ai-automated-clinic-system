import type { RequestHandler } from 'express'; import { departmentService } from '../services/department.service.js'; import { ok } from '../utils/api-response.js';
export const createDepartment: RequestHandler = async (req, res) => ok(res, await departmentService.create(req.auth!, req.body), 'Department created.', 201);
export const listDepartments: RequestHandler = async (req, res) => { const result = await departmentService.list(req.auth!, req.query as any); ok(res, result.data, 'Departments retrieved.', 200, result.meta); };
