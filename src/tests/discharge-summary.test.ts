import { describe, expect, it, vi, beforeEach } from 'vitest';
import { dischargeSummaryService } from '../services/discharge-summary.service.js';
import { dischargeSummaryRepository } from '../repositories/discharge-summary.repository.js';
import { patientRepository } from '../repositories/patient.repository.js';
import { AppError } from '../utils/app-error.js';

vi.mock('../repositories/discharge-summary.repository.js', () => ({
  dischargeSummaryRepository: {
    create: vi.fn(),
    findLatest: vi.fn(),
  },
}));

vi.mock('../repositories/patient.repository.js', () => ({
  patientRepository: {
    findById: vi.fn(),
  },
}));

vi.mock('../services/audit.service.js', () => ({
  auditService: { record: vi.fn().mockResolvedValue(undefined) },
}));

describe('Discharge Summary Service', () => {
  const auth = { userId: 'user-1', hospitalId: 'hospital-1', role: 'DOCTOR' as const };

  beforeEach(() => vi.clearAllMocks());

  it('creates a discharge summary for a tenant patient', async () => {
    vi.mocked(patientRepository.findById).mockResolvedValue({ id: 'patient-1' } as any);
    vi.mocked(dischargeSummaryRepository.create).mockResolvedValue({ id: 'summary-1', patientId: 'patient-1' } as any);

    const result = await dischargeSummaryService.create(auth, 'patient-1', {
      diagnosis: 'Stable',
      summary: 'Discharged home.',
      medications: 'Continue medication A.',
      followUpInstructions: 'Follow up in 7 days.',
    });

    expect(result.id).toBe('summary-1');
    expect(dischargeSummaryRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      hospitalId: 'hospital-1',
      patientId: 'patient-1',
      dischargedById: 'user-1',
      summary: 'Discharged home.',
    }));
  });

  it('retrieves the latest discharge summary for the same tenant', async () => {
    vi.mocked(patientRepository.findById).mockResolvedValue({ id: 'patient-1' } as any);
    vi.mocked(dischargeSummaryRepository.findLatest).mockResolvedValue({ id: 'summary-1' } as any);

    await expect(dischargeSummaryService.getLatest(auth, 'patient-1')).resolves.toMatchObject({ id: 'summary-1' });
    expect(dischargeSummaryRepository.findLatest).toHaveBeenCalledWith('hospital-1', 'patient-1');
  });

  it('rejects cross-tenant patient access', async () => {
    vi.mocked(patientRepository.findById).mockResolvedValue(null);

    await expect(dischargeSummaryService.getLatest(auth, 'patient-other-tenant')).rejects.toThrow(
      new AppError('Patient not found.', 404)
    );
    expect(dischargeSummaryRepository.findLatest).not.toHaveBeenCalled();
  });
});
