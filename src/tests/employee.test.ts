import { describe, expect, it, vi, beforeEach } from 'vitest';
import { employeeService } from '../services/employee.service.js';
import { employeeRepository } from '../repositories/employee.repository.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/app-error.js';

vi.mock('../repositories/employee.repository.js', () => ({
  employeeRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock('../services/audit.service.js', () => ({
  auditService: { record: vi.fn().mockResolvedValue(undefined) },
}));

const mockSettings = {
  configuration: {} as Record<string, any>,
};

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    hospitalSettings: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    attendance: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    leaveRequest: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe('Staff Management Service', () => {
  const mockAuth = {
    userId: 'user-1',
    hospitalId: 'hospital-uuid-abc',
    role: 'HOSPITAL_ADMIN' as const,
  };
  const mockEmployee = { id: 'emp-1', hospitalId: 'hospital-uuid-abc', designation: 'Nurse' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.hospitalSettings.findUnique).mockResolvedValue({ ...mockSettings, hospitalId: 'hospital-uuid-abc' } as any);
    vi.mocked(prisma.hospitalSettings.update).mockResolvedValue({} as any);
  });

  it('creates an employee successfully', async () => {
    vi.mocked(employeeRepository.create).mockResolvedValue(mockEmployee as any);
    const result = await employeeService.createEmployee(mockAuth, {
      designation: 'Nurse',
      joinedAt: '2025-01-01T00:00:00Z',
    });
    expect(result.id).toBe('emp-1');
  });

  it('throws if employee not found', async () => {
    vi.mocked(employeeRepository.findById).mockResolvedValue(null);
    await expect(employeeService.getEmployee(mockAuth, 'nonexistent')).rejects.toThrow(
      new AppError('Employee not found.', 404)
    );
  });

  it('checks in successfully and prevents double check-in', async () => {
    vi.mocked(employeeRepository.findById).mockResolvedValue(mockEmployee as any);
    const today = new Date().toISOString().slice(0, 10);

    vi.mocked(prisma.attendance.findFirst)
      .mockResolvedValueOnce(null) // first call: no check-in
      .mockResolvedValueOnce({ id: 'att-1', date: today } as any); // second call: already checked in

    vi.mocked(prisma.attendance.create).mockResolvedValue({
      id: 'att-1',
      hospitalId: 'hospital-uuid-abc',
      employeeId: 'emp-1',
      date: today,
      checkIn: new Date(),
    } as any);

    const result = await employeeService.checkIn(mockAuth, 'emp-1');
    expect(result.date).toBe(today);
    expect(result.checkIn).toBeTruthy();

    await expect(employeeService.checkIn(mockAuth, 'emp-1')).rejects.toThrow(
      new AppError('Already checked in today.', 400)
    );
  });

  it('rejects leave approval when already approved', async () => {
    vi.mocked(employeeRepository.findById).mockResolvedValue(mockEmployee as any);
    
    vi.mocked(prisma.leaveRequest.findFirst).mockResolvedValue({
      id: 'leave-1',
      employeeId: 'emp-1',
      status: 'APPROVED', // already approved
      type: 'ANNUAL',
      startDate: '2025-01-01',
      endDate: '2025-01-05',
      reason: 'Vacation',
    } as any);

    await expect(
      employeeService.approveLeave(mockAuth, 'emp-1', 'leave-1')
    ).rejects.toThrow(new AppError('Leave request is not in PENDING status.', 400));
  });
});
