import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/app-error.js';

type Auth = { userId: string; hospitalId: string | null; role: string };
function hid(auth: Auth): string {
  if (!auth.hospitalId) throw new AppError('A tenant context is required.', 403);
  return auth.hospitalId;
}

export const auditLogService = {
  async list(
    auth: Auth,
    query: { page?: number; limit?: number; action?: string; resource?: string; actorUserId?: string; resourceId?: string; from?: string; to?: string }
  ) {
    const hospitalId = hid(auth);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Record<string, unknown> = { hospitalId };
    if (query.action) where['action'] = { contains: query.action, mode: 'insensitive' };
    if (query.resource) where['resource'] = { contains: query.resource, mode: 'insensitive' };
    if (query.actorUserId) where['actorUserId'] = query.actorUserId;
    if (query.resourceId) where['resourceId'] = query.resourceId;
    if (query.from || query.to) {
      where['createdAt'] = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }
    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit, include: { actor: { select: { id: true, email: true, firstName: true, lastName: true, role: true } } } }),
      prisma.auditLog.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async actions(auth: Auth) {
    const hospitalId = hid(auth);
    const rows = await prisma.auditLog.findMany({ where: { hospitalId }, select: { action: true, resource: true }, distinct: ['action', 'resource'] });
    return { actions: [...new Set(rows.map((r) => r.action))], resources: [...new Set(rows.map((r) => r.resource))] };
  },
};
