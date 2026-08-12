import { describe, expect, it, vi, beforeEach } from 'vitest';
import { patientService } from '../services/patient.service.js';
import { patientRepository } from '../repositories/patient.repository.js';
import { AppError } from '../utils/app-error.js';

vi.mock('../repositories/patient.repository.js', () => ({
  patientRepository: {
    create: vi.fn(),
    update: vi.fn(),
    list: vi.fn(),
    count: vi.fn(),
    profile: vi.fn(),
    findById: vi.fn(),
    archive: vi.fn(),
    merge: vi.fn(),
    addVital: vi.fn(),
    listVitals: vi.fn(),
    countVitals: vi.fn(),
    addAllergy: vi.fn(),
    listAllergies: vi.fn(),
    deleteAllergy: vi.fn(),
    addInsurance: vi.fn(),
    listInsurance: vi.fn(),
    deleteInsurance: vi.fn(),
    addChronicDisease: vi.fn(),
    listChronicDiseases: vi.fn(),
    deleteChronicDisease: vi.fn(),
    addEmergencyContact: vi.fn(),
    listEmergencyContacts: vi.fn(),
    deleteEmergencyContact: vi.fn(),
    addNote: vi.fn(),
    listNotes: vi.fn(),
    countNotes: vi.fn(),
  },
}));

vi.mock('../services/audit.service.js', () => ({
  auditService: {
    record: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Patient Service', () => {
  const mockAuth = {
    userId: 'user-id-123',
    hospitalId: 'hospital-uuid-abc',
    role: 'HOSPITAL_ADMIN' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates patient successfully', async () => {
    const mockPatientInput = {
      medicalRecordNumber: 'MRN-001',
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '1990-01-01',
    };
    const mockPatient = { id: 'patient-id-1', ...mockPatientInput, dateOfBirth: new Date('1990-01-01') };
    vi.mocked(patientRepository.create).mockResolvedValue(mockPatient as any);

    const result = await patientService.create(mockAuth, mockPatientInput);
    expect(result).toEqual(mockPatient);
    expect(patientRepository.create).toHaveBeenCalledWith({
      ...mockPatientInput,
      dateOfBirth: new Date('1990-01-01'),
      hospitalId: 'hospital-uuid-abc',
    });
  });

  it('archives patient successfully', async () => {
    vi.mocked(patientRepository.archive).mockResolvedValue({ count: 1 } as any);

    await patientService.archive(mockAuth, 'patient-id-1');
    expect(patientRepository.archive).toHaveBeenCalledWith('hospital-uuid-abc', 'patient-id-1');
  });

  it('throws 404 when archiving a non-existent patient', async () => {
    vi.mocked(patientRepository.archive).mockResolvedValue({ count: 0 } as any);

    await expect(patientService.archive(mockAuth, 'invalid-id')).rejects.toThrow(
      new AppError('Patient not found.', 404)
    );
  });

  it('merges two patients successfully', async () => {
    const sourcePatient = { id: 'source-id', hospitalId: 'hospital-uuid-abc' };
    const targetPatient = { id: 'target-id', hospitalId: 'hospital-uuid-abc' };
    vi.mocked(patientRepository.findById)
      .mockResolvedValueOnce(sourcePatient as any)
      .mockResolvedValueOnce(targetPatient as any);
    vi.mocked(patientRepository.merge).mockResolvedValue(targetPatient as any);

    const result = await patientService.merge(mockAuth, 'source-id', 'target-id');
    expect(result).toEqual(targetPatient);
    expect(patientRepository.merge).toHaveBeenCalledWith('hospital-uuid-abc', 'source-id', 'target-id');
  });

  it('prevents merging patient with themselves', async () => {
    await expect(patientService.merge(mockAuth, 'patient-id-1', 'patient-id-1')).rejects.toThrow(
      new AppError('Source and target patients must be different.', 400)
    );
  });

  it('prevents cross-tenant merging', async () => {
    vi.mocked(patientRepository.findById)
      .mockResolvedValueOnce({ id: 'source-id', hospitalId: 'hospital-uuid-abc' } as any)
      .mockResolvedValueOnce(null); // not found in this tenant

    await expect(patientService.merge(mockAuth, 'source-id', 'foreign-id')).rejects.toThrow(
      new AppError('Target patient not found.', 404)
    );
  });
});
