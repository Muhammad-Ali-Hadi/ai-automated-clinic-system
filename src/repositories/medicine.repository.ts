import { prisma } from '../lib/prisma.js';

export const medicineRepository = {
  create: (data: {
    hospitalId: string;
    name: string;
    category?: string;
    sku: string;
    quantity?: number;
    reorderLevel?: number;
    unitPrice: number;
    expiresAt?: Date;
  }) =>
    prisma.medicine.create({
      data: {
        ...data,
        unitPrice: data.unitPrice as never,
      },
    }),

  findById: (hospitalId: string, id: string) =>
    prisma.medicine.findFirst({ where: { id, hospitalId } }),

  findBySku: (hospitalId: string, sku: string) =>
    prisma.medicine.findFirst({ where: { sku, hospitalId } }),

  update: (
    hospitalId: string,
    id: string,
    data: {
      name?: string;
      category?: string;
      sku?: string;
      quantity?: number;
      reorderLevel?: number;
      unitPrice?: number;
      expiresAt?: Date | null;
    }
  ) =>
    prisma.medicine.updateMany({
      where: { id, hospitalId },
      data: {
        ...data,
        unitPrice: data.unitPrice !== undefined ? (data.unitPrice as never) : undefined,
      },
    }),

  delete: (hospitalId: string, id: string) =>
    prisma.medicine.deleteMany({ where: { id, hospitalId } }),

  list: (
    hospitalId: string,
    skip: number,
    take: number,
    filters: {
      category?: string;
      search?: string;
      lowStockOnly?: boolean;
      expiredOnly?: boolean;
    } = {}
  ) => {
    const now = new Date();
    return prisma.medicine.findMany({
      where: {
        hospitalId,
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.search
          ? {
              OR: [
                { name: { contains: filters.search, mode: 'insensitive' } },
                { sku: { contains: filters.search, mode: 'insensitive' } },
              ],
            }
          : {}),
        // Note: lowStockOnly filtering (quantity <= reorderLevel) is applied
        // post-fetch in the service layer as Prisma v5 does not support
        // column-to-column comparisons in standard where clauses.
        ...(filters.expiredOnly ? { expiresAt: { lte: now } } : {}),
      },
      skip,
      take,
      orderBy: { name: 'asc' },
    });
  },

  count: (
    hospitalId: string,
    filters: {
      category?: string;
      search?: string;
      lowStockOnly?: boolean;
      expiredOnly?: boolean;
    } = {}
  ) => {
    const now = new Date();
    return prisma.medicine.count({
      where: {
        hospitalId,
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.search
          ? {
              OR: [
                { name: { contains: filters.search, mode: 'insensitive' } },
                { sku: { contains: filters.search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(filters.expiredOnly ? { expiresAt: { lte: now } } : {}),
      },
    });
  },
};
