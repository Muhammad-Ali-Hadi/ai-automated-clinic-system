import { describe, expect, it, vi, beforeEach } from 'vitest';
import { hospitalService } from '../services/hospital.service.js';
import { hospitalRepository } from '../repositories/hospital.repository.js';
import { AppError } from '../utils/app-error.js';
import type { TenantAuth } from '../services/audit.service.js';

vi.mock('../repositories/hospital.repository.js', () => ({
  hospitalRepository: {
    profile: vi.fn(),
    updateProfile: vi.fn(),
    upsertSettings: vi.fn(),
    createBranch: vi.fn(),
    listBranches: vi.fn(),
    countBranches: vi.fn(),
    branch: vi.fn(),
    updateBranch: vi.fn(),
    deleteBranch: vi.fn(),
    replaceWorkingHours: vi.fn(),
  },
}));

vi.mock('../services/audit.service.js', () => ({
  auditService: {
    record: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Hospital Service', () => {
  const mockAuth: TenantAuth = {
    userId: 'user-id-123',
    hospitalId: 'hospital-uuid-abc',
    role: 'HOSPITAL_ADMIN',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws AppError if tenant context is missing', async () => {
    const noTenantAuth = { ...mockAuth, hospitalId: null };
    await expect(hospitalService.profile(noTenantAuth)).rejects.toThrow(
      new AppError('Tenant context required.', 403)
    );
  });

  it('gets hospital profile successfully', async () => {
    const mockProfile = { id: 'hospital-uuid-abc', name: 'Test Hospital' };
    vi.mocked(hospitalRepository.profile).mockResolvedValue(mockProfile as any);

    const result = await hospitalService.profile(mockAuth);
    expect(result).toEqual(mockProfile);
    expect(hospitalRepository.profile).toHaveBeenCalledWith('hospital-uuid-abc');
  });

  it('updates hospital profile successfully', async () => {
    const mockProfile = { id: 'hospital-uuid-abc', name: 'Updated Hospital' };
    vi.mocked(hospitalRepository.updateProfile).mockResolvedValue(mockProfile as any);

    const result = await hospitalService.updateProfile(mockAuth, { name: 'Updated Hospital' });
    expect(result).toEqual(mockProfile);
    expect(hospitalRepository.updateProfile).toHaveBeenCalledWith('hospital-uuid-abc', {
      name: 'Updated Hospital',
    });
  });

  it('updates branch successfully', async () => {
    vi.mocked(hospitalRepository.branch).mockResolvedValue({ id: 'branch-1', hospitalId: 'hospital-uuid-abc' } as any);
    vi.mocked(hospitalRepository.updateBranch).mockResolvedValue({ count: 1 } as any);

    await hospitalService.updateBranch(mockAuth, 'branch-1', { name: 'New Name' });
    expect(hospitalRepository.branch).toHaveBeenCalledWith('hospital-uuid-abc', 'branch-1');
    expect(hospitalRepository.updateBranch).toHaveBeenCalledWith('hospital-uuid-abc', 'branch-1', {
      name: 'New Name',
    });
  });

  it('throws 404 if branch to update is not found or from another tenant', async () => {
    vi.mocked(hospitalRepository.branch).mockResolvedValue(null);

    await expect(
      hospitalService.updateBranch(mockAuth, 'invalid-branch', { name: 'New Name' })
    ).rejects.toThrow(new AppError('Branch not found.', 404));
  });
});
