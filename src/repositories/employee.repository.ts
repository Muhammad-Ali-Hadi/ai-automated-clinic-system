import { prisma } from '../lib/prisma.js';

export const employeeRepository = {
  create: (data: {
    hospitalId: string;
    userId?: string;
    departmentId?: string;
    designation: string;
    joinedAt: Date;
  }) =>
    prisma.employee.create({
      data,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        department: { select: { id: true, name: true } },
      },
    }),

  findById: (hospitalId: string, id: string) =>
    prisma.employee.findFirst({
      where: { id, hospitalId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        department: { select: { id: true, name: true } },
      },
    }),

  update: (
    hospitalId: string,
    id: string,
    data: {
      departmentId?: string | null;
      designation?: string;
      joinedAt?: Date;
    }
  ) =>
    prisma.employee.updateMany({
      where: { id, hospitalId },
      data,
    }),

  delete: (hospitalId: string, id: string) =>
    prisma.employee.deleteMany({ where: { id, hospitalId } }),

  list: (
    hospitalId: string,
    skip: number,
    take: number,
    filters: { departmentId?: string; designation?: string; search?: string } = {}
  ) =>
    prisma.employee.findMany({
      where: {
        hospitalId,
        ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
        ...(filters.designation ? { designation: { contains: filters.designation, mode: 'insensitive' } } : {}),
        ...(filters.search
          ? {
              user: {
                OR: [
                  { firstName: { contains: filters.search, mode: 'insensitive' } },
                  { lastName: { contains: filters.search, mode: 'insensitive' } },
                  { email: { contains: filters.search, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        department: { select: { id: true, name: true } },
      },
    }),

  count: (
    hospitalId: string,
    filters: { departmentId?: string; designation?: string; search?: string } = {}
  ) =>
    prisma.employee.count({
      where: {
        hospitalId,
        ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
        ...(filters.designation ? { designation: { contains: filters.designation, mode: 'insensitive' } } : {}),
      },
    }),
};
