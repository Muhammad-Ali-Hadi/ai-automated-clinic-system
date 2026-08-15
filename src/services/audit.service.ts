import type { Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
export const auditService = { record: async (auth: { userId: string; hospitalId: string | null }, action: string, resource: string, resourceId?: string, metadata?: unknown) => { await prisma.auditLog.create({ data: { hospitalId: auth.hospitalId, actorUserId: auth.userId, action, resource, resourceId, metadata: metadata as object | undefined } }); } };
export type TenantAuth = { userId: string; hospitalId: string | null; role: Role };
