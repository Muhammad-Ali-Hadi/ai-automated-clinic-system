import { describe, expect, it, vi, beforeEach } from 'vitest';
import { consultationService } from '../services/consultation.service.js';
import { prescriptionService } from '../services/prescription.service.js';
import { medicalRecordService } from '../services/medical-record.service.js';
import { consultationRepository } from '../repositories/consultation.repository.js';
import { prescriptionRepository } from '../repositories/prescription.repository.js';
import { patientRepository } from '../repositories/patient.repository.js';
import { medicalRecordRepository } from '../repositories/medical-record.repository.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/app-error.js';

vi.mock('../repositories/consultation.repository.js', () => ({
  consultationRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    list: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../repositories/prescription.repository.js', () => ({
  prescriptionRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    list: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock('../repositories/patient.repository.js', () => ({
  patientRepository: {
    findById: vi.fn(),
  },
}));

vi.mock('../repositories/medical-record.repository.js', () => ({
  medicalRecordRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    list: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    medicalRecord: { findMany: vi.fn() },
    consultation: { findMany: vi.fn() },
    prescription: { findMany: vi.fn() },
  },
}));

vi.mock('../services/audit.service.js', () => ({
  auditService: {
    record: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('EHR Service', () => {
  const mockAuth = {
    userId: 'user-id-123',
    hospitalId: 'hospital-uuid-abc',
    role: 'DOCTOR' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Consultation Service', () => {
    it('creates consultation successfully', async () => {
      const input = {
        patientId: 'patient-1',
        doctorId: 'doctor-1',
        clinicalNotes: 'Patient feels better',
        diagnosis: 'Flu',
        treatmentPlan: 'Rest',
      };
      vi.mocked(patientRepository.findById).mockResolvedValue({ id: 'patient-1' } as any);
      vi.mocked(consultationRepository.create).mockResolvedValue({ id: 'consult-1', ...input } as any);

      const result = await consultationService.create(mockAuth, input);
      expect(result.id).toBe('consult-1');
      expect(consultationRepository.create).toHaveBeenCalledWith({
        ...input,
        hospitalId: 'hospital-uuid-abc',
      });
    });

    it('throws AppError if patient is not found during consultation creation', async () => {
      vi.mocked(patientRepository.findById).mockResolvedValue(null);

      await expect(
        consultationService.create(mockAuth, {
          patientId: 'invalid-patient',
          doctorId: 'doctor-1',
          clinicalNotes: 'Notes',
        })
      ).rejects.toThrow(new AppError('Patient not found.', 404));
    });
  });

  describe('Prescription Service', () => {
    it('creates prescription successfully', async () => {
      const input = {
        patientId: 'patient-1',
        medicineName: 'Aspirin',
        dosage: '100mg',
        frequency: 'Once daily',
        durationDays: 7,
      };
      vi.mocked(patientRepository.findById).mockResolvedValue({ id: 'patient-1' } as any);
      vi.mocked(prescriptionRepository.create).mockResolvedValue({ id: 'presc-1', ...input } as any);

      const result = await prescriptionService.create(mockAuth, input);
      expect(result.id).toBe('presc-1');
      expect(prescriptionRepository.create).toHaveBeenCalledWith({
        ...input,
        hospitalId: 'hospital-uuid-abc',
        prescribedById: 'user-id-123',
      });
    });
  });

  describe('Timeline Service', () => {
    it('generates a sorted medical timeline successfully', async () => {
      vi.mocked(patientRepository.findById).mockResolvedValue({ id: 'patient-1' } as any);
      
      const recordDate = new Date('2026-08-01T10:00:00Z');
      const consultationDate = new Date('2026-08-02T10:00:00Z');
      const prescriptionDate = new Date('2026-08-03T10:00:00Z');

      vi.mocked(prisma.medicalRecord.findMany).mockResolvedValue([
        {
          id: 'rec-1',
          recordType: 'LAB_REPORT',
          title: 'Blood Test',
          content: 'Normal',
          createdAt: recordDate,
          recordedBy: { firstName: 'Nurse', lastName: 'Joy' },
        },
      ] as any);

      vi.mocked(prisma.consultation.findMany).mockResolvedValue([
        {
          id: 'consult-1',
          clinicalNotes: 'Checkup',
          diagnosis: 'Healthy',
          treatmentPlan: 'Maintain diet',
          createdAt: consultationDate,
          doctor: { user: { firstName: 'Dr.', lastName: 'Smith' } },
        },
      ] as any);

      vi.mocked(prisma.prescription.findMany).mockResolvedValue([
        {
          id: 'presc-1',
          medicineName: 'Vitamins',
          dosage: '1 tablet',
          frequency: 'Daily',
          durationDays: 30,
          instructions: 'After meal',
          createdAt: prescriptionDate,
        },
      ] as any);

      const timeline = await medicalRecordService.getTimeline(mockAuth, 'patient-1');

      expect(timeline).toHaveLength(3);
      // Timeline should be sorted descending (newest first)
      expect(timeline[0]?.type).toBe('prescription'); // Aug 3
      expect(timeline[1]?.type).toBe('consultation'); // Aug 2
      expect(timeline[2]?.type).toBe('medical_record'); // Aug 1
    });
  });
});
