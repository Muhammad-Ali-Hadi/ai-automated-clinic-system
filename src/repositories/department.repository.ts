import { prisma } from '../lib/prisma.js';
export const departmentRepository = {
  create: (data: { hospitalId: string; name: string; description?: string }) => prisma.department.create({ data }),
  list: (hospitalId: string, skip: number, take: number, search?: string) => prisma.department.findMany({ where: { hospitalId, isActive: true, ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}) }, skip, take, orderBy: { name: 'asc' } }),
  count: (hospitalId: string, search?: string) => prisma.department.count({ where: { hospitalId, isActive: true, ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}) } })
};
