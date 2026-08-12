import { describe, expect, it, vi, beforeEach } from 'vitest';
import { labTestService } from '../services/lab-test.service.js';
import { labTestRepository } from '../repositories/lab-test.repository.js';
import { patientRepository } from '../repositories/patient.repository.js';
import { AppError } from '../utils/app-error.js';

vi.mock('../repositories/lab-test.repository.js', () => ({
  labTestRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    updateStatus: vi.fn(),
    list: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock('../repositories/patient.repository.js', () => ({
  patientRepository: {
    findById: vi.fn(),
  },
}));

vi.mock('../services/audit.service.js', () => ({
  auditService: {
    record: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Laboratory Service', () => {
  const mockAuth = {
    userId: 'user-1',
    hospitalId: 'hospital-uuid-abc',
    role: 'LABORATORY_TECHNICIAN' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a lab test request successfully', async () => {
    vi.mocked(patientRepository.findById).mockResolvedValue({ id: 'patient-1' } as any);
    vi.mocked(labTestRepository.create).mockResolvedValue({ id: 'test-1' } as any);

    const result = await labTestService.createRequest(mockAuth, {
      patientId: 'patient-1',
      testName: 'Complete Blood Count',
    });

    expect(result.id).toBe('test-1');
  });

  it('collects sample and updates status', async () => {
    vi.mocked(labTestRepository.findById).mockResolvedValue({ id: 'test-1', status: 'REQUESTED' } as any);
    vi.mocked(labTestRepository.updateStatus).mockResolvedValue({ count: 1 } as any);

    const result = await labTestService.collectSample(mockAuth, 'test-1');
    expect(labTestRepository.updateStatus).toHaveBeenCalledWith(
      'hospital-uuid-abc',
      'test-1',
      'COLLECTED',
      expect.any(Object)
    );
  });

  it('prevents invalid status transitions', async () => {
    vi.mocked(labTestRepository.findById).mockResolvedValue({ id: 'test-1', status: 'COMPLETED' } as any);

    await expect(labTestService.collectSample(mockAuth, 'test-1')).rejects.toThrow(
      new AppError('Cannot collect sample for request in COMPLETED status.', 400)
    );
  });
});

  const rejectionAuth = { userId: 'user-1', hospitalId: 'hospital-uuid-abc', role: 'LABORATORY_TECHNICIAN' as const };

  it('rejects a processing result and persists the reason', async () => {
    vi.mocked(labTestRepository.findById)
      .mockResolvedValueOnce({ id: 'test-1', status: 'PROCESSING' } as any)
      .mockResolvedValueOnce({ id: 'test-1', status: 'CANCELLED', rejectionReason: 'Insufficient sample', rejectedAt: new Date() } as any);
    vi.mocked(labTestRepository.updateStatus).mockResolvedValue({ count: 1 } as any);

    const result = await labTestService.rejectResult(rejectionAuth, 'test-1', ' Insufficient sample ');

    expect(labTestRepository.updateStatus).toHaveBeenCalledWith('hospital-uuid-abc', 'test-1', 'CANCELLED', expect.objectContaining({ rejectionReason: 'Insufficient sample', rejectedAt: expect.any(Date) }));
    expect(result.rejectionReason).toBe('Insufficient sample');
  });

  it('rejects a result from an invalid state', async () => {
    vi.mocked(labTestRepository.findById).mockResolvedValue({ id: 'test-1', status: 'COLLECTED' } as any);

    await expect(labTestService.rejectResult(rejectionAuth, 'test-1', 'bad sample')).rejects.toThrow(
      new AppError('Can only reject results when request is in PROCESSING status.', 400)
    );
  });

  it('does not access a lab test outside the authenticated tenant', async () => {
    (vi.mocked(labTestRepository.findById) as any).mockImplementation(async (hospitalId: string) => {
      expect(hospitalId).toBe('hospital-uuid-abc');
      return null as any;
    });

    await expect(labTestService.rejectResult(rejectionAuth, 'test-from-other-tenant', 'bad sample')).rejects.toThrow(
      new AppError('Laboratory request not found.', 404)
    );
  });

it('approves an unapproved completed result', async () => {
  const auth = { userId: 'doctor-1', hospitalId: 'hospital-uuid-abc', role: 'DOCTOR' as const };
  vi.mocked(labTestRepository.findById)
    .mockResolvedValueOnce({ id: 'test-2', status: 'COMPLETED', approvedAt: null } as any)
    .mockResolvedValueOnce({ id: 'test-2', status: 'COMPLETED', approvedAt: new Date() } as any);
  vi.mocked(labTestRepository.updateStatus).mockResolvedValue({ count: 1 } as any);
  await labTestService.approveResult(auth, 'test-2');
  expect(labTestRepository.updateStatus).toHaveBeenCalledWith('hospital-uuid-abc', 'test-2', 'COMPLETED', { approvedAt: expect.any(Date) });
});