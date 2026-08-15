import { AppError } from '../utils/app-error.js';
import { auditService, type TenantAuth } from './audit.service.js';
import { prisma } from '../lib/prisma.js';

const hid = (auth: TenantAuth) => {
  if (!auth.hospitalId) throw new AppError('Tenant context required.', 403);
  return auth.hospitalId;
};

export const supplierService = {
  async createSupplier(
    auth: TenantAuth,
    input: { name: string; contactName?: string; email?: string; phone?: string; address?: string }
  ) {
    const hospitalId = hid(auth);
    const supplier = await prisma.supplier.create({ data: { hospitalId, ...input } });
    await auditService.record(auth, 'CREATE', 'Supplier', supplier.id);
    return supplier;
  },

  async getSupplier(auth: TenantAuth, id: string) {
    const supplier = await prisma.supplier.findFirst({ where: { id, hospitalId: hid(auth) } });
    if (!supplier) throw new AppError('Supplier not found.', 404);
    return supplier;
  },

  async listSuppliers(auth: TenantAuth, query: { search?: string } = {}) {
    const hospitalId = hid(auth);
    return prisma.supplier.findMany({
      where: {
        hospitalId,
        isActive: true,
        ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
      },
      orderBy: { name: 'asc' },
    });
  },
};
