import { AppError } from '../utils/app-error.js';
import { prisma } from '../lib/prisma.js';
import { auditService, type TenantAuth } from './audit.service.js';

export const payrollService = {
  async configure(auth: TenantAuth, input: { providerName: string; status?: string; configuration?: Record<string, unknown> }) {
    if (!auth.hospitalId) throw new AppError('Tenant context required.', 403);
    const row = await prisma.payrollIntegration.upsert({ where: { hospitalId_providerName: { hospitalId: auth.hospitalId, providerName: input.providerName } }, create: { hospitalId: auth.hospitalId, providerName: input.providerName, status: input.status ?? 'CONFIGURED', configuration: input.configuration as any }, update: { status: input.status ?? 'CONFIGURED', configuration: input.configuration as any } });
    await auditService.record(auth, 'UPDATE', 'PayrollIntegration', row.id);
    return row;
  },
  async get(auth: TenantAuth) {
    if (!auth.hospitalId) throw new AppError('Tenant context required.', 403);
    return prisma.payrollIntegration.findMany({ where: { hospitalId: auth.hospitalId }, orderBy: { providerName: 'asc' } });
  },
};
