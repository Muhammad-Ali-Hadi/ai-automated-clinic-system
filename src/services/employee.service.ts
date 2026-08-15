import { AppError } from '../utils/app-error.js';
import { auditService, type TenantAuth } from './audit.service.js';
import { employeeRepository } from '../repositories/employee.repository.js';
import { prisma } from '../lib/prisma.js';

const hid = (auth: TenantAuth) => {
  if (!auth.hospitalId) throw new AppError('Tenant context required.', 403);
  return auth.hospitalId;
};

export const employeeService = {
  async createEmployee(
    auth: TenantAuth,
    input: {
      userId?: string;
      departmentId?: string;
      designation: string;
      joinedAt: string;
    }
  ) {
    const hospitalId = hid(auth);
    const employee = await employeeRepository.create({
      hospitalId,
      userId: input.userId,
      departmentId: input.departmentId,
      designation: input.designation,
      joinedAt: new Date(input.joinedAt),
    });
    await auditService.record(auth, 'CREATE', 'Employee', employee.id);
    return employee;
  },

  async getEmployee(auth: TenantAuth, id: string) {
    const employee = await employeeRepository.findById(hid(auth), id);
    if (!employee) throw new AppError('Employee not found.', 404);
    return employee;
  },

  async updateEmployee(
    auth: TenantAuth,
    id: string,
    input: { departmentId?: string | null; designation?: string; joinedAt?: string }
  ) {
    await this.getEmployee(auth, id);
    const result = await employeeRepository.update(hid(auth), id, {
      departmentId: input.departmentId,
      designation: input.designation,
      joinedAt: input.joinedAt ? new Date(input.joinedAt) : undefined,
    });
    if (!result.count) throw new AppError('Employee not found.', 404);
    await auditService.record(auth, 'UPDATE', 'Employee', id);
    return this.getEmployee(auth, id);
  },

  async deleteEmployee(auth: TenantAuth, id: string) {
    await this.getEmployee(auth, id);
    await employeeRepository.delete(hid(auth), id);
    await auditService.record(auth, 'DELETE', 'Employee', id);
  },

  async listEmployees(
    auth: TenantAuth,
    query: {
      page?: number;
      limit?: number;
      departmentId?: string;
      designation?: string;
      search?: string;
    }
  ) {
    const hospitalId = hid(auth);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [data, total] = await Promise.all([
      employeeRepository.list(hospitalId, (page - 1) * limit, limit, query),
      employeeRepository.count(hospitalId, query),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  // ---- Attendance ----
  async checkIn(auth: TenantAuth, employeeId: string) {
    const hospitalId = hid(auth);
    await this.getEmployee(auth, employeeId);
    const today = new Date().toISOString().slice(0, 10);
    // Ensure not already checked in today
    const existing = await prisma.attendance.findFirst({
      where: { hospitalId, employeeId, date: today, checkOut: null },
    });
    if (existing) throw new AppError('Already checked in today.', 400);
    const record = await prisma.attendance.create({
      data: { hospitalId, employeeId, date: today, checkIn: new Date() },
    });
    await auditService.record(auth, 'CHECK_IN', 'Employee', employeeId);
    return record;
  },

  async checkOut(auth: TenantAuth, employeeId: string) {
    const hospitalId = hid(auth);
    await this.getEmployee(auth, employeeId);
    const today = new Date().toISOString().slice(0, 10);
    const record = await prisma.attendance.findFirst({
      where: { hospitalId, employeeId, date: today, checkOut: null },
    });
    if (!record) throw new AppError('No active check-in found for today.', 400);
    const updated = await prisma.attendance.update({
      where: { id: record.id },
      data: { checkOut: new Date() },
    });
    await auditService.record(auth, 'CHECK_OUT', 'Employee', employeeId);
    return updated;
  },

  async getAttendanceHistory(
    auth: TenantAuth,
    employeeId: string,
    query: { page?: number; limit?: number }
  ) {
    await this.getEmployee(auth, employeeId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 30;
    const [data, total] = await Promise.all([
      prisma.attendance.findMany({
        where: { hospitalId: hid(auth), employeeId },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.attendance.count({ where: { hospitalId: hid(auth), employeeId } }),
    ]);
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  // ---- Shifts (persisted via Shift + UserShift models) ----
  async createShift(
    auth: TenantAuth,
    input: { name: string; startTime: string; endTime: string; days: number[] }
  ) {
    const hospitalId = hid(auth);
    // Days stored comma-joined in description for multi-day shift representation
    const shift = await prisma.shift.create({
      data: {
        hospitalId,
        name: input.name,
        startsAt: input.startTime,
        endsAt: input.endTime,
        description: input.days.join(','),
        isActive: true,
      },
    });
    await auditService.record(auth, 'CREATE', 'Shift', shift.id);
    return shift;
  },

  async listShifts(auth: TenantAuth) {
    return prisma.shift.findMany({
      where: { hospitalId: hid(auth), isActive: true },
      orderBy: { name: 'asc' },
    });
  },

  async assignShift(auth: TenantAuth, employeeId: string, shiftId: string) {
    const hospitalId = hid(auth);
    const employee = await this.getEmployee(auth, employeeId);
    if (!employee.userId) throw new AppError('Employee has no linked user account for shift assignment.', 400);

    // Verify shift exists and belongs to this hospital
    const shift = await prisma.shift.findFirst({ where: { id: shiftId, hospitalId } });
    if (!shift) throw new AppError('Shift not found.', 404);

    // Idempotent upsert to avoid duplicate shift assignment
    await prisma.userShift.upsert({
      where: { userId_shiftId: { userId: employee.userId, shiftId } },
      create: { userId: employee.userId, shiftId },
      update: {},
    });
    await auditService.record(auth, 'ASSIGN_SHIFT', 'Employee', employeeId, { shiftId });
    return { employeeId, shiftId };
  },

  // ---- Leave Requests ----
  async requestLeave(
    auth: TenantAuth,
    employeeId: string,
    input: { type: string; startDate: string; endDate: string; reason: string }
  ) {
    const hospitalId = hid(auth);
    await this.getEmployee(auth, employeeId);
    const record = await prisma.leaveRequest.create({
      data: {
        hospitalId,
        employeeId,
        type: input.type,
        startDate: input.startDate,
        endDate: input.endDate,
        reason: input.reason,
        status: 'PENDING',
      },
    });
    await auditService.record(auth, 'LEAVE_REQUEST', 'Employee', employeeId);
    return record;
  },

  async approveLeave(auth: TenantAuth, employeeId: string, leaveId: string) {
    const hospitalId = hid(auth);
    const leaveReq = await prisma.leaveRequest.findFirst({
      where: { id: leaveId, employeeId, hospitalId },
    });
    if (!leaveReq) throw new AppError('Leave request not found.', 404);
    if (leaveReq.status !== 'PENDING') throw new AppError('Leave request is not in PENDING status.', 400);

    await prisma.leaveRequest.update({
      where: { id: leaveId },
      data: { status: 'APPROVED', approvedAt: new Date() },
    });
    await auditService.record(auth, 'APPROVE_LEAVE', 'Employee', employeeId, { leaveId });
    return await prisma.leaveRequest.findUnique({ where: { id: leaveId } });
  },

  async rejectLeave(auth: TenantAuth, employeeId: string, leaveId: string) {
    const hospitalId = hid(auth);
    const leaveReq = await prisma.leaveRequest.findFirst({
      where: { id: leaveId, employeeId, hospitalId },
    });
    if (!leaveReq) throw new AppError('Leave request not found.', 404);
    if (leaveReq.status !== 'PENDING') throw new AppError('Leave request is not in PENDING status.', 400);

    await prisma.leaveRequest.update({
      where: { id: leaveId },
      data: { status: 'REJECTED', rejectedAt: new Date() },
    });
    await auditService.record(auth, 'REJECT_LEAVE', 'Employee', employeeId, { leaveId });
    return await prisma.leaveRequest.findUnique({ where: { id: leaveId } });
  },

  async leaveHistory(auth: TenantAuth, employeeId: string) {
    await this.getEmployee(auth, employeeId);
    const records = await prisma.leaveRequest.findMany({
      where: { hospitalId: hid(auth), employeeId },
      orderBy: { createdAt: 'desc' },
    });
    return records;
  },

  // ---- Performance Notes (persisted via Prisma, tenant-scoped) ----
  async addPerformanceNote(
    auth: TenantAuth,
    employeeId: string,
    input: { note: string; rating?: number }
  ) {
    const hospitalId = hid(auth);
    await this.getEmployee(auth, employeeId);
    const noteRecord = await prisma.performanceNote.create({
      data: {
        hospitalId,
        employeeId,
        note: input.note,
        rating: input.rating ?? null,
        recordedById: auth.userId,
      },
    });
    await auditService.record(auth, 'ADD_PERFORMANCE_NOTE', 'Employee', employeeId);
    return noteRecord;
  },

  async listPerformanceNotes(auth: TenantAuth, employeeId: string) {
    await this.getEmployee(auth, employeeId);
    return prisma.performanceNote.findMany({
      where: { hospitalId: hid(auth), employeeId },
      orderBy: { createdAt: 'desc' },
    });
  },
};
