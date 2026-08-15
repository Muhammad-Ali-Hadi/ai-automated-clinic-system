import { AppError } from '../utils/app-error.js';
import { auditService, type TenantAuth } from './audit.service.js';
import { prisma } from '../lib/prisma.js';

const hid = (auth: TenantAuth) => {
  if (!auth.hospitalId) throw new AppError('Tenant context required.', 403);
  return auth.hospitalId;
};

export const shiftService = {
  async createShift(
    auth: TenantAuth,
    input: { name: string; startsAt: string; endsAt: string; description?: string }
  ) {
    const hospitalId = hid(auth);
    const shift = await prisma.shift.create({ data: { hospitalId, ...input } });
    await auditService.record(auth, 'CREATE', 'Shift', shift.id);
    return shift;
  },

  async getShift(auth: TenantAuth, id: string) {
    const shift = await prisma.shift.findFirst({
      where: { id, hospitalId: hid(auth) },
    });
    if (!shift) throw new AppError('Shift not found.', 404);
    return shift;
  },

  async listShifts(auth: TenantAuth) {
    return prisma.shift.findMany({
      where: { hospitalId: hid(auth), isActive: true },
      orderBy: { name: 'asc' },
    });
  },

  async updateShift(
    auth: TenantAuth,
    id: string,
    input: { name?: string; startsAt?: string; endsAt?: string; description?: string; isActive?: boolean }
  ) {
    await this.getShift(auth, id);
    await prisma.shift.updateMany({ where: { id, hospitalId: hid(auth) }, data: input });
    await auditService.record(auth, 'UPDATE', 'Shift', id);
    return this.getShift(auth, id);
  },

  async assignShift(auth: TenantAuth, shiftId: string, userId: string) {
    const hospitalId = hid(auth);
    await this.getShift(auth, shiftId);
    const user = await prisma.user.findFirst({ where: { id: userId, hospitalId } });
    if (!user) throw new AppError('User not found.', 404);

    const assignment = await prisma.userShift.upsert({
      where: { userId_shiftId: { userId, shiftId } },
      create: { userId, shiftId },
      update: {},
    });
    await auditService.record(auth, 'ASSIGN_SHIFT', 'Shift', shiftId, { userId });
    return assignment;
  },

  async removeShiftAssignment(auth: TenantAuth, shiftId: string, userId: string) {
    const assignment = await prisma.userShift.findUnique({
      where: { userId_shiftId: { userId, shiftId } },
    });
    if (!assignment) throw new AppError('Shift assignment not found.', 404);
    await prisma.userShift.delete({ where: { userId_shiftId: { userId, shiftId } } });
    await auditService.record(auth, 'REMOVE_SHIFT_ASSIGNMENT', 'Shift', shiftId, { userId });
    return { removed: true };
  },
};
