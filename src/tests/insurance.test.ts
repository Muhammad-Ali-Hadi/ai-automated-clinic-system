import { describe, expect, it, vi, beforeEach } from 'vitest';
import { insuranceService } from '../services/insurance.service.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/app-error.js';

vi.mock('../services/audit.service.js', () => ({
  auditService: { record: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    patient: { findFirst: vi.fn() },
    invoice: { findFirst: vi.fn() },
    insuranceClaim: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

describe('Insurance Claim Service', () => {
  const mockAuth = { userId: 'user-1', hospitalId: 'hospital-uuid-abc', role: 'HOSPITAL_ADMIN' as const };

  beforeEach(() => { vi.clearAllMocks(); });

  it('submits a claim successfully', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'patient-1' } as any);
    vi.mocked(prisma.insuranceClaim.create).mockResolvedValue({ id: 'claim-1', claimNumber: 'CLM-ABC123' } as any);

    const result = await insuranceService.submitClaim(mockAuth, {
      patientId: 'patient-1', providerName: 'Aetna', amount: 500,
    });

    expect(result.id).toBe('claim-1');
    expect(result.claimNumber).toMatch(/^CLM-/);
  });

  it('throws 404 if patient not found on claim submission', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null);
    await expect(insuranceService.submitClaim(mockAuth, { patientId: 'bad', providerName: 'X', amount: 100 }))
      .rejects.toThrow(new AppError('Patient not found.', 404));
  });

  it('approves a pending claim', async () => {
    const pendingClaim = { id: 'claim-1', status: 'PENDING', hospitalId: 'hospital-uuid-abc' };
    const approvedClaim = { ...pendingClaim, status: 'APPROVED' };
    let callCount = 0;
    vi.spyOn(prisma.insuranceClaim, 'findFirst').mockImplementation((async (args: any) => {
      callCount++;
      return callCount === 1 ? pendingClaim : approvedClaim;
    }) as any);
    vi.mocked(prisma.insuranceClaim.updateMany).mockResolvedValue({ count: 1 } as any);

    const result = await insuranceService.approveClaim(mockAuth, 'claim-1');
    expect(result.status).toBe('APPROVED');
  });

  it('rejects a claim with reason', async () => {
    const pendingClaim = { id: 'claim-1', status: 'PENDING', hospitalId: 'hospital-uuid-abc' };
    const rejectedClaim = { ...pendingClaim, status: 'REJECTED' };
    let callCount = 0;
    vi.spyOn(prisma.insuranceClaim, 'findFirst').mockImplementation((async (args: any) => {
      callCount++;
      return callCount === 1 ? pendingClaim : rejectedClaim;
    }) as any);
    vi.mocked(prisma.insuranceClaim.updateMany).mockResolvedValue({ count: 1 } as any);

    const result = await insuranceService.rejectClaim(mockAuth, 'claim-1', 'Missing documentation');
    expect(result.status).toBe('REJECTED');
  });

  it('prevents approval of non-pending claim', async () => {
    vi.mocked(prisma.insuranceClaim.findFirst).mockResolvedValue({ id: 'c1', status: 'APPROVED' } as any);
    await expect(insuranceService.approveClaim(mockAuth, 'c1'))
      .rejects.toThrow(new AppError('Only PENDING claims can be approved.', 400));
  });
});
