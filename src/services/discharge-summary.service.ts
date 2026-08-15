import { AppError } from '../utils/app-error.js';
import { auditService, type TenantAuth } from './audit.service.js';
import { patientRepository } from '../repositories/patient.repository.js';
import { dischargeSummaryRepository } from '../repositories/discharge-summary.repository.js';

const hid = (auth: TenantAuth) => {
  if (!auth.hospitalId) throw new AppError('Tenant context required.', 403);
  return auth.hospitalId;
};

export const dischargeSummaryService = {
  async create(
    auth: TenantAuth,
    patientId: string,
    input: {
      diagnosis?: string;
      summary: string;
      medications?: string;
      followUpInstructions?: string;
      dischargedAt?: string;
    }
  ) {
    const hospitalId = hid(auth);
    const patient = await patientRepository.findById(hospitalId, patientId);
    if (!patient) throw new AppError('Patient not found.', 404);

    const summary = await dischargeSummaryRepository.create({
      hospitalId,
      patientId,
      dischargedById: auth.userId,
      diagnosis: input.diagnosis,
      summary: input.summary,
      medications: input.medications,
      followUpInstructions: input.followUpInstructions,
      dischargedAt: input.dischargedAt ? new Date(input.dischargedAt) : undefined,
    });

    await auditService.record(auth, 'CREATE', 'DischargeSummary', summary.id);
    return summary;
  },

  async getLatest(auth: TenantAuth, patientId: string) {
    const hospitalId = hid(auth);
    const patient = await patientRepository.findById(hospitalId, patientId);
    if (!patient) throw new AppError('Patient not found.', 404);

    const summary = await dischargeSummaryRepository.findLatest(hospitalId, patientId);
    if (!summary) throw new AppError('Discharge summary not found.', 404);
    return summary;
  },
};
