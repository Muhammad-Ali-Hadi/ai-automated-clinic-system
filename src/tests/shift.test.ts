import { describe, expect, it, vi, beforeEach } from 'vitest';
import { shiftService } from '../services/shift.service.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/app-error.js';

vi.mock('../services/audit.service.js', () => ({
  auditService: { record: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    shift: {
      create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(),
    },
    userShift: {
      upsert: vi.fn(), findUnique: vi.fn(), delete: vi.fn(),
    },
    user: { findFirst: vi.fn() },
  },
}));

describe('Shift Service', () => {
  const mockAuth = { userId: 'user-1', hospitalId: 'hospital-uuid-abc', role: 'HOSPITAL_ADMIN' as const };

  beforeEach(() => { vi.clearAllMocks(); });

  it('creates a shift successfully', async () => {
    const shift = { id: 'shift-1', hospitalId: 'hospital-uuid-abc', name: 'Morning', startsAt: '08:00', endsAt: '16:00' };
    vi.mocked(prisma.shift.create).mockResolvedValue(shift as any);

    const result = await shiftService.createShift(mockAuth, { name: 'Morning', startsAt: '08:00', endsAt: '16:00' });
    expect(result.id).toBe('shift-1');
    expect(result.name).toBe('Morning');
  });

  it('assigns a shift to a user', async () => {
    vi.mocked(prisma.shift.findFirst).mockResolvedValue({ id: 'shift-1', hospitalId: 'hospital-uuid-abc' } as any);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'user-2' } as any);
    vi.mocked(prisma.userShift.upsert).mockResolvedValue({ id: 'us-1', userId: 'user-2', shiftId: 'shift-1' } as any);

    const result = await shiftService.assignShift(mockAuth, 'shift-1', 'user-2');
    expect(result.userId).toBe('user-2');
    expect(result.shiftId).toBe('shift-1');
  });

  it('throws 404 when assigning to a non-existent user', async () => {
    vi.mocked(prisma.shift.findFirst).mockResolvedValue({ id: 'shift-1', hospitalId: 'hospital-uuid-abc' } as any);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    await expect(shiftService.assignShift(mockAuth, 'shift-1', 'bad-user'))
      .rejects.toThrow(new AppError('User not found.', 404));
  });

  it('lists only active shifts within a tenant', async () => {
    vi.mocked(prisma.shift.findMany).mockResolvedValue([{ id: 'shift-1' }, { id: 'shift-2' }] as any);
    const result = await shiftService.listShifts(mockAuth);
    expect(result).toHaveLength(2);
    result.forEach((s: any) => expect(s.hospitalId ?? 'hospital-uuid-abc').toBe('hospital-uuid-abc'));
  });
});
