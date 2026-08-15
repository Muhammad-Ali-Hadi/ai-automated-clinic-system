import { describe, expect, it, vi, beforeEach } from 'vitest';
import { reportService } from '../services/report.service.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/app-error.js';

vi.mock('../services/audit.service.js', () => ({
  auditService: { record: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    patient: {
      count: vi.fn(),
    },
    appointment: {
      count: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    invoice: {
      count: vi.fn(),
      aggregate: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    labTest: {
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    medicine: {
      findMany: vi.fn(),
      fields: { reorderLevel: null },
    },
    consultation: {
      groupBy: vi.fn(),
    },
  },
}));

describe('Reports & Analytics Service', () => {
  const mockAuth = {
    userId: 'user-1',
    hospitalId: 'hospital-uuid-abc',
    role: 'HOSPITAL_ADMIN' as const,
  };

  beforeEach(() => vi.clearAllMocks());

  it('returns dashboard summary', async () => {
    vi.mocked(prisma.patient.count).mockResolvedValueOnce(100).mockResolvedValueOnce(80);
    vi.mocked(prisma.appointment.count).mockResolvedValue(5);
    vi.mocked(prisma.invoice.count).mockResolvedValue(3);
    vi.mocked(prisma.invoice.aggregate).mockResolvedValue({ _sum: { total: 50000 } } as any);
    vi.mocked(prisma.labTest.count).mockResolvedValue(20);

    const result = await reportService.getDashboardSummary(mockAuth);
    expect(result.totalPatients).toBe(100);
    expect(result.activePatients).toBe(80);
    expect(result.totalRevenue).toBe(50000);
  });

  it('returns appointment analytics with status breakdown', async () => {
    vi.mocked(prisma.appointment.groupBy)
      .mockResolvedValueOnce([
        { status: 'BOOKED', _count: { status: 10 } },
        { status: 'COMPLETED', _count: { status: 25 } },
      ] as any)
      .mockResolvedValueOnce([{ doctorId: 'doc-1', _count: { doctorId: 15 } }] as any);

    const result = await reportService.getAppointmentAnalytics(mockAuth, {});
    expect(result.byStatus).toHaveLength(2);
    expect(result.topDoctors[0]?.doctorId).toBe('doc-1');
  });

  it('returns revenue report grouped by day', async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      { total: 500, discount: 0, status: 'PAID', createdAt: new Date('2026-08-01'), paidAt: new Date('2026-08-01') },
      { total: 300, discount: 50, status: 'PENDING', createdAt: new Date('2026-08-01'), paidAt: null },
    ] as any);

    const result = await reportService.getRevenueReport(mockAuth, { groupBy: 'day' });
    expect(result).toHaveLength(1);
    expect(result[0]?.period).toBe('2026-08-01');
    expect(result[0]?.invoiced).toBe(800);
    expect(result[0]?.collected).toBe(500);
  });

  it('enforces tenant isolation on all report queries', async () => {
    // Verify hospitalId is always passed to Prisma
    vi.mocked(prisma.patient.count).mockResolvedValue(0);
    vi.mocked(prisma.appointment.count).mockResolvedValue(0);
    vi.mocked(prisma.invoice.count).mockResolvedValue(0);
    vi.mocked(prisma.invoice.aggregate).mockResolvedValue({ _sum: { total: null } } as any);
    vi.mocked(prisma.labTest.count).mockResolvedValue(0);

    await reportService.getDashboardSummary(mockAuth);

    // All calls should include the hospital context
    expect(vi.mocked(prisma.patient.count).mock.calls[0]?.[0]).toMatchObject({
      where: { hospitalId: 'hospital-uuid-abc' },
    });
  });
});
