import { describe, expect, it, vi, beforeEach } from 'vitest';
import { doctorService } from '../services/doctor.service.js';
import { doctorRepository } from '../repositories/doctor.repository.js';
import { AppError } from '../utils/app-error.js';

vi.mock('../repositories/doctor.repository.js', () => ({
  doctorRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    findByUserId: vi.fn(),
    update: vi.fn(),
    list: vi.fn(),
    count: vi.fn(),
    setAvailability: vi.fn(),
    getAvailability: vi.fn(),
    listConsultations: vi.fn(),
    countConsultations: vi.fn(),
  },
}));

vi.mock('../services/audit.service.js', () => ({
  auditService: {
    record: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Doctor Service', () => {
  const mockAuth = {
    userId: 'user-id-123',
    hospitalId: 'hospital-uuid-abc',
    role: 'HOSPITAL_ADMIN' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates doctor profile successfully', async () => {
    const input = {
      userId: 'user-2',
      specialization: 'Cardiology',
      licenseNumber: 'LIC-777',
      consultationFee: 150,
    };
    vi.mocked(doctorRepository.findByUserId).mockResolvedValue(null);
    vi.mocked(doctorRepository.create).mockResolvedValue({ id: 'doc-1', ...input } as any);

    const result = await doctorService.createProfile(mockAuth, input);
    expect(result.id).toBe('doc-1');
    expect(doctorRepository.create).toHaveBeenCalledWith({
      hospitalId: 'hospital-uuid-abc',
      ...input,
    });
  });

  it('throws AppError if doctor profile already exists for user', async () => {
    const input = {
      userId: 'user-2',
      specialization: 'Cardiology',
      licenseNumber: 'LIC-777',
    };
    vi.mocked(doctorRepository.findByUserId).mockResolvedValue({ id: 'existing-doc-1' } as any);

    await expect(doctorService.createProfile(mockAuth, input)).rejects.toThrow(
      new AppError('A doctor profile already exists for this user.', 409)
    );
  });

  it('sets availability successfully', async () => {
    const slots = [{ weekday: 1, startsAt: '09:00', endsAt: '17:00' }];
    vi.mocked(doctorRepository.findById).mockResolvedValue({ id: 'doc-1' } as any);
    vi.mocked(doctorRepository.setAvailability).mockResolvedValue(slots as any);

    const result = await doctorService.setAvailability(mockAuth, 'doc-1', slots);
    expect(result).toEqual(slots);
    expect(doctorRepository.setAvailability).toHaveBeenCalledWith('doc-1', 'hospital-uuid-abc', slots);
  });
});
