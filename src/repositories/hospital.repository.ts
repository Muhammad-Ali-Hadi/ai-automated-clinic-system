import { prisma } from '../lib/prisma.js';

export const hospitalRepository = {
  profile: (hospitalId: string) =>
    prisma.hospital.findUnique({ where: { id: hospitalId }, include: { settings: true } }),

  updateProfile: (hospitalId: string, data: { name?: string; isActive?: boolean }) =>
    prisma.hospital.update({ where: { id: hospitalId }, data }),

  upsertSettings: (
    hospitalId: string,
    data: {
      preferences?: object;
      configuration?: object;
      subscriptionPlan?: string;
      subscriptionEndsAt?: Date | null;
      logoKey?: string | null;
    }
  ) =>
    prisma.hospitalSettings.upsert({
      where: { hospitalId },
      create: { hospitalId, ...data },
      update: data,
    }),

  createBranch: (data: { hospitalId: string; name: string; address?: string; phone?: string }) =>
    prisma.branch.create({ data }),

  listBranches: (hospitalId: string, skip: number, take: number, search?: string) =>
    prisma.branch.findMany({
      where: {
        hospitalId,
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      include: { workingHours: { orderBy: { weekday: 'asc' } } },
      orderBy: { name: 'asc' },
      skip,
      take,
    }),

  countBranches: (hospitalId: string, search?: string) =>
    prisma.branch.count({
      where: {
        hospitalId,
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
    }),

  branch: (hospitalId: string, id: string) =>
    prisma.branch.findFirst({ where: { id, hospitalId } }),

  updateBranch: (
    hospitalId: string,
    id: string,
    data: { name?: string; address?: string; phone?: string; isActive?: boolean }
  ) =>
    prisma.branch.updateMany({ where: { id, hospitalId }, data }),

  deleteBranch: (hospitalId: string, id: string) =>
    prisma.branch.deleteMany({ where: { id, hospitalId } }),

  replaceWorkingHours: (
    branchId: string,
    hours: { weekday: number; opensAt: string; closesAt: string; isClosed?: boolean }[]
  ) =>
    prisma.$transaction(async (tx: any) => {
      await tx.workingHour.deleteMany({ where: { branchId } });
      await tx.workingHour.createMany({ data: hours.map((hour) => ({ branchId, ...hour })) });
      return tx.workingHour.findMany({ where: { branchId }, orderBy: { weekday: 'asc' } });
    }),
};
