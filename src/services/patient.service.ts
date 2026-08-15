import type { Role } from '@prisma/client';
import { AppError } from '../utils/app-error.js';
import { patientRepository } from '../repositories/patient.repository.js';
import { auditService } from './audit.service.js';

type Auth = { userId: string; hospitalId: string | null; role: Role };

const hid = (auth: Auth) => {
  if (!auth.hospitalId) throw new AppError('Tenant context required.', 403);
  return auth.hospitalId;
};

const ensurePatient = async (auth: Auth, patientId: string) => {
  const patient = await patientRepository.findById(hid(auth), patientId);
  if (!patient) throw new AppError('Patient not found.', 404);
  return patient;
};

export const patientService = {
  async create(
    auth: Auth,
    input: {
      medicalRecordNumber: string;
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      phone?: string;
      email?: string;
    }
  ) {
    const hospitalId = hid(auth);
    const patient = await patientRepository.create({
      ...input,
      dateOfBirth: new Date(input.dateOfBirth),
      hospitalId,
    });
    await auditService.record(auth, 'CREATE', 'Patient', patient.id);
    return patient;
  },

  async list(
    auth: Auth,
    query: { page?: number; limit?: number; search?: string; status?: string }
  ) {
    const hospitalId = hid(auth);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      patientRepository.list(hospitalId, skip, limit, query.search, query.status),
      patientRepository.count(hospitalId, query.search, query.status),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async profile(auth: Auth, patientId: string) {
    const patient = await patientRepository.profile(hid(auth), patientId);
    if (!patient) throw new AppError('Patient not found.', 404);
    return patient;
  },

  async update(
    auth: Auth,
    patientId: string,
    input: {
      firstName?: string;
      lastName?: string;
      dateOfBirth?: string;
      phone?: string | null;
      email?: string | null;
    }
  ) {
    await ensurePatient(auth, patientId);
    const result = await patientRepository.update(hid(auth), patientId, {
      ...input,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
    });
    if (!result.count) throw new AppError('Patient not found.', 404);
    await auditService.record(auth, 'UPDATE', 'Patient', patientId);
    return patientRepository.profile(hid(auth), patientId);
  },

  async archive(auth: Auth, patientId: string) {
    const result = await patientRepository.archive(hid(auth), patientId);
    if (!result.count) throw new AppError('Patient not found.', 404);
    await auditService.record(auth, 'ARCHIVE', 'Patient', patientId);
  },

  async merge(auth: Auth, sourceId: string, targetId: string) {
    if (sourceId === targetId) throw new AppError('Source and target patients must be different.', 400);
    const hospitalId = hid(auth);
    // Verify both patients exist in this tenant
    const [source, target] = await Promise.all([
      patientRepository.findById(hospitalId, sourceId),
      patientRepository.findById(hospitalId, targetId),
    ]);
    if (!source) throw new AppError('Source patient not found.', 404);
    if (!target) throw new AppError('Target patient not found.', 404);
    const merged = await patientRepository.merge(hospitalId, sourceId, targetId);
    await auditService.record(auth, 'MERGE', 'Patient', sourceId, { targetId });
    return merged;
  },

  // --- Vitals ---
  async addVital(
    auth: Auth,
    patientId: string,
    input: {
      temperature?: number;
      systolicBp?: number;
      diastolicBp?: number;
      pulse?: number;
      weightKg?: number;
    }
  ) {
    await ensurePatient(auth, patientId);
    const vital = await patientRepository.addVital({
      hospitalId: hid(auth),
      patientId,
      recordedById: auth.userId,
      ...input,
    });
    await auditService.record(auth, 'CREATE', 'PatientVital', vital.id);
    return vital;
  },

  async listVitals(auth: Auth, patientId: string, query: { page?: number; limit?: number }) {
    await ensurePatient(auth, patientId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [data, total] = await Promise.all([
      patientRepository.listVitals(hid(auth), patientId, (page - 1) * limit, limit),
      patientRepository.countVitals(hid(auth), patientId),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  // --- Allergies ---
  async addAllergy(
    auth: Auth,
    patientId: string,
    input: { substance: string; severity?: string; reaction?: string }
  ) {
    await ensurePatient(auth, patientId);
    const allergy = await patientRepository.addAllergy({
      hospitalId: hid(auth),
      patientId,
      ...input,
    });
    await auditService.record(auth, 'CREATE', 'PatientAllergy', allergy.id);
    return allergy;
  },

  async listAllergies(auth: Auth, patientId: string) {
    await ensurePatient(auth, patientId);
    return patientRepository.listAllergies(hid(auth), patientId);
  },

  async removeAllergy(auth: Auth, patientId: string, allergyId: string) {
    await ensurePatient(auth, patientId);
    const result = await patientRepository.deleteAllergy(hid(auth), allergyId, patientId);
    if (!result.count) throw new AppError('Allergy record not found.', 404);
    await auditService.record(auth, 'DELETE', 'PatientAllergy', allergyId);
  },

  // --- Insurance ---
  async addInsurance(
    auth: Auth,
    patientId: string,
    input: { provider: string; policyNumber: string; expiresAt?: string }
  ) {
    await ensurePatient(auth, patientId);
    const insurance = await patientRepository.addInsurance({
      hospitalId: hid(auth),
      patientId,
      ...input,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
    });
    await auditService.record(auth, 'CREATE', 'PatientInsurance', insurance.id);
    return insurance;
  },

  async listInsurance(auth: Auth, patientId: string) {
    await ensurePatient(auth, patientId);
    return patientRepository.listInsurance(hid(auth), patientId);
  },

  async removeInsurance(auth: Auth, patientId: string, insuranceId: string) {
    await ensurePatient(auth, patientId);
    const result = await patientRepository.deleteInsurance(hid(auth), insuranceId, patientId);
    if (!result.count) throw new AppError('Insurance record not found.', 404);
    await auditService.record(auth, 'DELETE', 'PatientInsurance', insuranceId);
  },

  // --- Chronic Diseases ---
  async addChronicDisease(
    auth: Auth,
    patientId: string,
    input: { name: string; diagnosedAt?: string; notes?: string }
  ) {
    await ensurePatient(auth, patientId);
    const disease = await patientRepository.addChronicDisease({
      hospitalId: hid(auth),
      patientId,
      ...input,
      diagnosedAt: input.diagnosedAt ? new Date(input.diagnosedAt) : undefined,
    });
    await auditService.record(auth, 'CREATE', 'ChronicDisease', disease.id);
    return disease;
  },

  async listChronicDiseases(auth: Auth, patientId: string) {
    await ensurePatient(auth, patientId);
    return patientRepository.listChronicDiseases(hid(auth), patientId);
  },

  async removeChronicDisease(auth: Auth, patientId: string, diseaseId: string) {
    await ensurePatient(auth, patientId);
    const result = await patientRepository.deleteChronicDisease(hid(auth), diseaseId, patientId);
    if (!result.count) throw new AppError('Chronic disease record not found.', 404);
    await auditService.record(auth, 'DELETE', 'ChronicDisease', diseaseId);
  },

  // --- Emergency Contacts ---
  async addEmergencyContact(
    auth: Auth,
    patientId: string,
    input: { name: string; relationship: string; phone: string }
  ) {
    await ensurePatient(auth, patientId);
    const contact = await patientRepository.addEmergencyContact({
      hospitalId: hid(auth),
      patientId,
      ...input,
    });
    await auditService.record(auth, 'CREATE', 'EmergencyContact', contact.id);
    return contact;
  },

  async listEmergencyContacts(auth: Auth, patientId: string) {
    await ensurePatient(auth, patientId);
    return patientRepository.listEmergencyContacts(hid(auth), patientId);
  },

  async removeEmergencyContact(auth: Auth, patientId: string, contactId: string) {
    await ensurePatient(auth, patientId);
    const result = await patientRepository.deleteEmergencyContact(hid(auth), contactId, patientId);
    if (!result.count) throw new AppError('Emergency contact not found.', 404);
    await auditService.record(auth, 'DELETE', 'EmergencyContact', contactId);
  },

  // --- Notes ---
  async addNote(auth: Auth, patientId: string, content: string) {
    await ensurePatient(auth, patientId);
    const note = await patientRepository.addNote({
      hospitalId: hid(auth),
      patientId,
      authorId: auth.userId,
      content,
    });
    await auditService.record(auth, 'CREATE', 'PatientNote', note.id);
    return note;
  },

  async listNotes(auth: Auth, patientId: string, query: { page?: number; limit?: number }) {
    await ensurePatient(auth, patientId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [data, total] = await Promise.all([
      patientRepository.listNotes(hid(auth), patientId, (page - 1) * limit, limit),
      patientRepository.countNotes(hid(auth), patientId),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },
};
