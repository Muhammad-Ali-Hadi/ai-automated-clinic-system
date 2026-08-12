import { AppError } from '../utils/app-error.js';
import { auditService, type TenantAuth } from './audit.service.js';
import { prescriptionRepository } from '../repositories/prescription.repository.js';
import { patientRepository } from '../repositories/patient.repository.js';

const hid = (auth: TenantAuth) => {
  if (!auth.hospitalId) throw new AppError('Tenant context required.', 403);
  return auth.hospitalId;
};

export const prescriptionService = {
  async create(
    auth: TenantAuth,
    input: {
      patientId: string;
      consultationId?: string;
      medicineName: string;
      dosage: string;
      frequency: string;
      durationDays: number;
      instructions?: string;
    }
  ) {
    const hospitalId = hid(auth);
    // Verify patient belongs to tenant
    const patient = await patientRepository.findById(hospitalId, input.patientId);
    if (!patient) throw new AppError('Patient not found.', 404);

    const prescription = await prescriptionRepository.create({
      ...input,
      hospitalId,
      prescribedById: auth.userId,
    });
    await auditService.record(auth, 'CREATE', 'Prescription', prescription.id);
    return prescription;
  },

  async get(auth: TenantAuth, prescriptionId: string) {
    const p = await prescriptionRepository.findById(hid(auth), prescriptionId);
    if (!p) throw new AppError('Prescription not found.', 404);
    return p;
  },

  async list(
    auth: TenantAuth,
    query: {
      page?: number;
      limit?: number;
      patientId?: string;
      consultationId?: string;
    }
  ) {
    const hospitalId = hid(auth);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filters = { patientId: query.patientId, consultationId: query.consultationId };
    const [data, total] = await Promise.all([
      prescriptionRepository.list(hospitalId, (page - 1) * limit, limit, filters),
      prescriptionRepository.count(hospitalId, filters),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },
};
