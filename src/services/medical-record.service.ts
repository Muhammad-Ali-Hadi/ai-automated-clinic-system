import { AppError } from '../utils/app-error.js';
import { auditService, type TenantAuth } from './audit.service.js';
import { medicalRecordRepository } from '../repositories/medical-record.repository.js';
import { patientRepository } from '../repositories/patient.repository.js';
import { prisma } from '../lib/prisma.js';

const hid = (auth: TenantAuth) => {
  if (!auth.hospitalId) throw new AppError('Tenant context required.', 403);
  return auth.hospitalId;
};

export const medicalRecordService = {
  async create(
    auth: TenantAuth,
    input: { patientId: string; recordType: string; title: string; content: string }
  ) {
    const hospitalId = hid(auth);
    // Verify patient exists
    const patient = await patientRepository.findById(hospitalId, input.patientId);
    if (!patient) throw new AppError('Patient not found.', 404);

    const record = await medicalRecordRepository.create({
      ...input,
      hospitalId,
      recordedById: auth.userId,
    });
    await auditService.record(auth, 'CREATE', 'MedicalRecord', record.id);
    return record;
  },

  async get(auth: TenantAuth, id: string) {
    const record = await medicalRecordRepository.findById(hid(auth), id);
    if (!record) throw new AppError('Medical record not found.', 404);
    return record;
  },

  async update(
    auth: TenantAuth,
    id: string,
    input: { title?: string; content?: string; recordType?: string }
  ) {
    await this.get(auth, id);
    const result = await medicalRecordRepository.update(hid(auth), id, input);
    if (!result.count) throw new AppError('Medical record not found.', 404);
    await auditService.record(auth, 'UPDATE', 'MedicalRecord', id);
    return this.get(auth, id);
  },

  async list(
    auth: TenantAuth,
    patientId: string,
    query: { page?: number; limit?: number; recordType?: string }
  ) {
    const hospitalId = hid(auth);
    // Verify patient exists
    const patient = await patientRepository.findById(hospitalId, patientId);
    if (!patient) throw new AppError('Patient not found.', 404);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [data, total] = await Promise.all([
      medicalRecordRepository.list(hospitalId, patientId, (page - 1) * limit, limit, query.recordType),
      medicalRecordRepository.count(hospitalId, patientId, query.recordType),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async getTimeline(auth: TenantAuth, patientId: string) {
    const hospitalId = hid(auth);
    // Verify patient exists
    const patient = await patientRepository.findById(hospitalId, patientId);
    if (!patient) throw new AppError('Patient not found.', 404);

    // Fetch medical records, consultations, and prescriptions
    const [records, consultations, prescriptions] = await Promise.all([
      prisma.medicalRecord.findMany({
        where: { hospitalId, patientId },
        orderBy: { createdAt: 'desc' },
        include: { recordedBy: { select: { id: true, firstName: true, lastName: true } } },
      }),
      prisma.consultation.findMany({
        where: { hospitalId, patientId },
        orderBy: { createdAt: 'desc' },
        include: {
          doctor: {
            select: {
              id: true,
              specialization: true,
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
      prisma.prescription.findMany({
        where: { hospitalId, patientId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Map all of them to a common schema for timeline
    const timeline = [
      ...records.map((r) => ({
        id: r.id,
        type: 'medical_record',
        recordType: r.recordType,
        title: r.title,
        content: r.content,
        timestamp: r.createdAt,
        recordedBy: r.recordedBy,
      })),
      ...consultations.map((c) => ({
        id: c.id,
        type: 'consultation',
        title: `Consultation with Dr. ${c.doctor.user.firstName} ${c.doctor.user.lastName}`,
        content: c.clinicalNotes,
        diagnosis: c.diagnosis,
        treatmentPlan: c.treatmentPlan,
        followUpAt: c.followUpAt,
        timestamp: c.createdAt,
      })),
      ...prescriptions.map((p) => ({
        id: p.id,
        type: 'prescription',
        title: `Prescription: ${p.medicineName}`,
        content: `${p.dosage} - ${p.frequency} for ${p.durationDays} days. Instructions: ${p.instructions ?? 'None'}`,
        timestamp: p.createdAt,
      })),
    ];

    // Sort by timestamp descending
    timeline.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return timeline;
  },
};
