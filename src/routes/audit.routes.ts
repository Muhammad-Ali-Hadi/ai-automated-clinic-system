import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, requireTenant } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { getAuditLogs, getAuditFilters } from '../controllers/audit.controller.js';

export const auditRouter = Router();
auditRouter.use(authenticate, requireTenant);

auditRouter.get(
  '/',
  authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN'),
  validate(
    z.object({
      params: z.object({}),
      body: z.object({}),
      query: z.object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().min(1).max(200).default(50),
        action: z.string().max(100).optional(),
        resource: z.string().max(100).optional(),
        actorUserId: z.string().uuid().optional(),
        resourceId: z.string().uuid().optional(),
        from: z.string().datetime({ offset: true }).optional(),
        to: z.string().datetime({ offset: true }).optional(),
      }),
    })
  ),
  getAuditLogs
);

auditRouter.get('/filters', authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN'), getAuditFilters);
