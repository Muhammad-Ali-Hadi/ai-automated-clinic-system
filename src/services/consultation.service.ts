import { AppError } from '../utils/app-error.js';
import { auditService, type TenantAuth } from './audit.service.js';
import { consultationRepository } from '../repositories/consultation.repository.js';
import { patientRepository } from '../repositories/patient.repository.js';

const hid = (auth: TenantAuth) => {
  if (!auth.hospitalId) throw new AppError('Tenant context required.', 403);
  return auth.hospitalId;
};

export const consultationService = {
  async create(
    auth: TenantAuth,
    input: {
      patientId: string;
      doctorId: string;
      appointmentId?: string;
      clinicalNotes: string;
      diagnosis?: string;
      treatmentPlan?: string;
      followUpAt?: string;
    }
  ) {
    const hospitalId = hid(auth);
    // Verify patient belongs to tenant
    const patient = await patientRepository.findById(hospitalId, input.patientId);
    if (!patient) throw new AppError('Patient not found.', 404);

    const consultation = await consultationRepository.create({
      ...input,
      hospitalId,
      followUpAt: input.followUpAt ? new Date(input.followUpAt) : undefined,
    });
    await auditService.record(auth, 'CREATE', 'Consultation', consultation.id);
    return consultation;
  },

  async get(auth: TenantAuth, consultationId: string) {
    const c = await consultationRepository.findById(hid(auth), consultationId);
    if (!c) throw new AppError('Consultation not found.', 404);
    return c;
  },

  async update(
    auth: TenantAuth,
    consultationId: string,
    input: {
      clinicalNotes?: string;
      diagnosis?: string;
      treatmentPlan?: string;
      followUpAt?: string | null;
    }
  ) {
    await this.get(auth, consultationId);
    const result = await consultationRepository.update(hid(auth), consultationId, {
      ...input,
      followUpAt:
        input.followUpAt === null
          ? null
          : input.followUpAt
            ? new Date(input.followUpAt)
            : undefined,
    });
    if (!result.count) throw new AppError('Consultation not found.', 404);
    await auditService.record(auth, 'UPDATE', 'Consultation', consultationId);
    return consultationRepository.findById(hid(auth), consultationId);
  },

  async list(
    auth: TenantAuth,
    query: {
      page?: number;
      limit?: number;
      patientId?: string;
      doctorId?: string;
    }
  ) {
    const hospitalId = hid(auth);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filters = { patientId: query.patientId, doctorId: query.doctorId };
    const [data, total] = await Promise.all([
      consultationRepository.list(hospitalId, (page - 1) * limit, limit, filters),
      consultationRepository.count(hospitalId, filters),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },
};
