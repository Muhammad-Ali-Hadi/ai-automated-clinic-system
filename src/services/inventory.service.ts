import { AppError } from '../utils/app-error.js';
import { prisma } from '../lib/prisma.js';
import { auditService, type TenantAuth } from './audit.service.js';

const hid = (auth: TenantAuth) => {
  if (!auth.hospitalId) throw new AppError('Tenant context required.', 403);
  return auth.hospitalId;
};

export const inventoryService = {
  async create(auth: TenantAuth, input: { name: string; type: 'EQUIPMENT' | 'CONSUMABLE'; category?: string; quantity?: number; reorderLevel?: number; unitCost?: number; location?: string; supplierName?: string }) {
    const item = await prisma.inventoryItem.create({ data: { hospitalId: hid(auth), ...input, unitCost: input.unitCost as never } });
    await auditService.record(auth, 'CREATE', 'InventoryItem', item.id);
    return item;
  },
  async list(auth: TenantAuth, query: { page?: number; limit?: number; type?: 'EQUIPMENT' | 'CONSUMABLE'; lowStockOnly?: boolean; search?: string }) {
    const hospitalId = hid(auth); const page = query.page ?? 1; const limit = query.limit ?? 20;
    const where = { hospitalId, ...(query.type ? { type: query.type } : {}), ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}) };
    const [rows, total] = await Promise.all([
      prisma.inventoryItem.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { name: 'asc' } }),
      prisma.inventoryItem.count({ where }),
    ]);
    const data = query.lowStockOnly ? rows.filter((item) => item.quantity <= item.reorderLevel) : rows;
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },
  async update(auth: TenantAuth, id: string, input: { name?: string; quantity?: number; reorderLevel?: number; location?: string; status?: 'ACTIVE' | 'RETIRED'; supplierName?: string }) {
    const result = await prisma.inventoryItem.updateMany({ where: { id, hospitalId: hid(auth) }, data: input });
    if (!result.count) throw new AppError('Inventory item not found.', 404);
    await auditService.record(auth, 'UPDATE', 'InventoryItem', id);
    return prisma.inventoryItem.findFirst({ where: { id, hospitalId: hid(auth) } });
  },
};
