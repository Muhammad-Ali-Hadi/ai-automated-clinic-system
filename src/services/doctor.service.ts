import { AppError } from '../utils/app-error.js';
import { auditService, type TenantAuth } from './audit.service.js';
import { doctorRepository } from '../repositories/doctor.repository.js';

const hid = (auth: TenantAuth) => {
  if (!auth.hospitalId) throw new AppError('Tenant context required.', 403);
  return auth.hospitalId;
};

const ensureDoctor = async (auth: TenantAuth, doctorId: string) => {
  const doctor = await doctorRepository.findById(hid(auth), doctorId);
  if (!doctor) throw new AppError('Doctor profile not found.', 404);
  return doctor;
};

export const doctorService = {
  async createProfile(
    auth: TenantAuth,
    input: {
      userId: string;
      specialization: string;
      licenseNumber: string;
      consultationFee?: number;
      signatureUrl?: string;
    }
  ) {
    const hospitalId = hid(auth);
    // Prevent duplicate profile for same user in same hospital
    const existing = await doctorRepository.findByUserId(hospitalId, input.userId);
    if (existing) throw new AppError('A doctor profile already exists for this user.', 409);
    const doctor = await doctorRepository.create({ hospitalId, ...input });
    await auditService.record(auth, 'CREATE', 'DoctorProfile', doctor.id);
    return doctor;
  },

  async getProfile(auth: TenantAuth, doctorId: string) {
    return ensureDoctor(auth, doctorId);
  },

  async updateProfile(
    auth: TenantAuth,
    doctorId: string,
    input: {
      specialization?: string;
      licenseNumber?: string;
      consultationFee?: number | null;
      signatureUrl?: string | null;
    }
  ) {
    await ensureDoctor(auth, doctorId);
    const result = await doctorRepository.update(hid(auth), doctorId, input);
    if (!result.count) throw new AppError('Doctor profile not found.', 404);
    await auditService.record(auth, 'UPDATE', 'DoctorProfile', doctorId);
    return doctorRepository.findById(hid(auth), doctorId);
  },

  async listDoctors(
    auth: TenantAuth,
    query: { page?: number; limit?: number; search?: string; specialization?: string }
  ) {
    const hospitalId = hid(auth);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [data, total] = await Promise.all([
      doctorRepository.list(
        hospitalId,
        (page - 1) * limit,
        limit,
        query.search,
        query.specialization
      ),
      doctorRepository.count(hospitalId, query.search, query.specialization),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async setAvailability(
    auth: TenantAuth,
    doctorId: string,
    slots: { weekday: number; startsAt: string; endsAt: string; isAvailable?: boolean }[]
  ) {
    await ensureDoctor(auth, doctorId);
    const result = await doctorRepository.setAvailability(doctorId, hid(auth), slots);
    await auditService.record(auth, 'UPDATE', 'DoctorAvailability', doctorId);
    return result;
  },

  async getAvailability(auth: TenantAuth, doctorId: string) {
    await ensureDoctor(auth, doctorId);
    return doctorRepository.getAvailability(hid(auth), doctorId);
  },

  async listConsultations(
    auth: TenantAuth,
    doctorId: string,
    query: { page?: number; limit?: number }
  ) {
    await ensureDoctor(auth, doctorId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const hospitalId = hid(auth);
    const [data, total] = await Promise.all([
      doctorRepository.listConsultations(hospitalId, doctorId, (page - 1) * limit, limit),
      doctorRepository.countConsultations(hospitalId, doctorId),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },
};
