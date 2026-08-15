import type { Request, Response } from 'express';
import { auditLogService } from '../services/audit-log.service.js';

export const getAuditLogs = async (req: Request, res: Response): Promise<void> => {
  const q = req.query as any;
  const result = await auditLogService.list(req.auth!, {
    page: q.page ? Number(q.page) : undefined,
    limit: q.limit ? Number(q.limit) : undefined,
    action: q.action,
    resource: q.resource,
    actorUserId: q.actorUserId,
    resourceId: q.resourceId,
    from: q.from,
    to: q.to,
  });
  res.json({ success: true, message: 'Audit logs retrieved.', data: result.data, meta: result.meta });
};

export const getAuditFilters = async (req: Request, res: Response): Promise<void> => {
  const result = await auditLogService.actions(req.auth!);
  res.json({ success: true, message: 'Audit filter options.', data: result });
};
