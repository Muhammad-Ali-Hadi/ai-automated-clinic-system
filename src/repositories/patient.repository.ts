import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';

export const patientRepository = {
  create: (data: Prisma.PatientUncheckedCreateInput) => prisma.patient.create({ data }),

  update: (
    hospitalId: string,
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      dateOfBirth?: Date;
      phone?: string | null;
      email?: string | null;
    }
  ) => prisma.patient.updateMany({ where: { id, hospitalId, deletedAt: null }, data }),

  list: (hospitalId: string, skip: number, take: number, search?: string, status?: string) =>
    prisma.patient.findMany({
      where: {
        hospitalId,
        deletedAt: null,
        ...(status ? { status: status as never } : {}),
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { medicalRecordNumber: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),

  count: (hospitalId: string, search?: string, status?: string) =>
    prisma.patient.count({
      where: {
        hospitalId,
        deletedAt: null,
        ...(status ? { status: status as never } : {}),
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { medicalRecordNumber: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
    }),

  profile: (hospitalId: string, id: string) =>
    prisma.patient.findFirst({
      where: { id, hospitalId, deletedAt: null },
      include: {
        emergencyContacts: true,
        allergies: true,
        chronicDiseases: true,
        insurances: true,
        vitals: { take: 20, orderBy: { recordedAt: 'desc' } },
        notes: { take: 20, orderBy: { createdAt: 'desc' } },
      },
    }),

  findById: (hospitalId: string, id: string) =>
    prisma.patient.findFirst({ where: { id, hospitalId, deletedAt: null } }),

  archive: (hospitalId: string, id: string) =>
    prisma.patient.updateMany({
      where: { id, hospitalId, deletedAt: null },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    }),

  softDelete: (hospitalId: string, id: string) =>
    prisma.patient.updateMany({
      where: { id, hospitalId, deletedAt: null },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    }),

  restore: (hospitalId: string, id: string) =>
    prisma.patient.updateMany({
      where: { id, hospitalId, deletedAt: { not: null } },
      data: { deletedAt: null, status: 'ACTIVE', archivedAt: null },
    }),

  merge: (hospitalId: string, sourceId: string, targetId: string) =>
    prisma.$transaction(async (tx) => {
      // Reassign all related records to target patient
      await tx.appointment.updateMany({ where: { patientId: sourceId, hospitalId }, data: { patientId: targetId } });
      await tx.consultation.updateMany({ where: { patientId: sourceId, hospitalId }, data: { patientId: targetId } });
      await tx.prescription.updateMany({ where: { patientId: sourceId, hospitalId }, data: { patientId: targetId } });
      await tx.medicalRecord.updateMany({ where: { patientId: sourceId, hospitalId }, data: { patientId: targetId } });
      await tx.labTest.updateMany({ where: { patientId: sourceId, hospitalId }, data: { patientId: targetId } });
      await tx.invoice.updateMany({ where: { patientId: sourceId, hospitalId }, data: { patientId: targetId } });
      await tx.patientVital.updateMany({ where: { patientId: sourceId, hospitalId }, data: { patientId: targetId } });
      await tx.patientNote.updateMany({ where: { patientId: sourceId, hospitalId }, data: { patientId: targetId } });
      await tx.emergencyContact.updateMany({ where: { patientId: sourceId, hospitalId }, data: { patientId: targetId } });
      await tx.patientInsurance.updateMany({ where: { patientId: sourceId, hospitalId }, data: { patientId: targetId } });
      await tx.patientAllergy.updateMany({ where: { patientId: sourceId, hospitalId }, data: { patientId: targetId } });
      await tx.chronicDisease.updateMany({ where: { patientId: sourceId, hospitalId }, data: { patientId: targetId } });
      await tx.fileObject.updateMany({ where: { patientId: sourceId, hospitalId }, data: { patientId: targetId } });
      // Mark source as MERGED (soft delete)
      await tx.patient.update({
        where: { id: sourceId },
        data: { status: 'MERGED', archivedAt: new Date() },
      });
      return tx.patient.findUnique({ where: { id: targetId } });
    }),

  // Vitals
  addVital: (data: {
    hospitalId: string;
    patientId: string;
    recordedById: string;
    temperature?: number;
    systolicBp?: number;
    diastolicBp?: number;
    pulse?: number;
    weightKg?: number;
  }) =>
    prisma.patientVital.create({
      data: {
        hospitalId: data.hospitalId,
        patientId: data.patientId,
        recordedById: data.recordedById,
        temperature: data.temperature as never,
        systolicBp: data.systolicBp,
        diastolicBp: data.diastolicBp,
        pulse: data.pulse,
        weightKg: data.weightKg as never,
      },
    }),

  listVitals: (hospitalId: string, patientId: string, skip: number, take: number) =>
    prisma.patientVital.findMany({
      where: { hospitalId, patientId },
      skip,
      take,
      orderBy: { recordedAt: 'desc' },
      include: { recordedBy: { select: { id: true, firstName: true, lastName: true, role: true } } },
    }),

  countVitals: (hospitalId: string, patientId: string) =>
    prisma.patientVital.count({ where: { hospitalId, patientId } }),

  // Allergies
  addAllergy: (data: {
    hospitalId: string;
    patientId: string;
    substance: string;
    severity?: string;
    reaction?: string;
  }) => prisma.patientAllergy.create({ data }),

  listAllergies: (hospitalId: string, patientId: string) =>
    prisma.patientAllergy.findMany({
      where: { hospitalId, patientId },
      orderBy: { createdAt: 'desc' },
    }),

  deleteAllergy: (hospitalId: string, id: string, patientId: string) =>
    prisma.patientAllergy.deleteMany({ where: { id, hospitalId, patientId } }),

  // Insurance
  addInsurance: (data: {
    hospitalId: string;
    patientId: string;
    provider: string;
    policyNumber: string;
    expiresAt?: Date;
  }) => prisma.patientInsurance.create({ data }),

  listInsurance: (hospitalId: string, patientId: string) =>
    prisma.patientInsurance.findMany({
      where: { hospitalId, patientId },
      orderBy: { createdAt: 'desc' },
    }),

  deleteInsurance: (hospitalId: string, id: string, patientId: string) =>
    prisma.patientInsurance.deleteMany({ where: { id, hospitalId, patientId } }),

  // Chronic diseases
  addChronicDisease: (data: {
    hospitalId: string;
    patientId: string;
    name: string;
    diagnosedAt?: Date;
    notes?: string;
  }) => prisma.chronicDisease.create({ data }),

  listChronicDiseases: (hospitalId: string, patientId: string) =>
    prisma.chronicDisease.findMany({
      where: { hospitalId, patientId },
      orderBy: { createdAt: 'desc' },
    }),

  deleteChronicDisease: (hospitalId: string, id: string, patientId: string) =>
    prisma.chronicDisease.deleteMany({ where: { id, hospitalId, patientId } }),

  // Emergency contacts
  addEmergencyContact: (data: {
    hospitalId: string;
    patientId: string;
    name: string;
    relationship: string;
    phone: string;
  }) => prisma.emergencyContact.create({ data }),

  listEmergencyContacts: (hospitalId: string, patientId: string) =>
    prisma.emergencyContact.findMany({
      where: { hospitalId, patientId },
      orderBy: { createdAt: 'desc' },
    }),

  deleteEmergencyContact: (hospitalId: string, id: string, patientId: string) =>
    prisma.emergencyContact.deleteMany({ where: { id, hospitalId, patientId } }),

  // Notes
  addNote: (data: {
    hospitalId: string;
    patientId: string;
    authorId: string;
    content: string;
  }) => prisma.patientNote.create({ data }),

  listNotes: (hospitalId: string, patientId: string, skip: number, take: number) =>
    prisma.patientNote.findMany({
      where: { hospitalId, patientId },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { id: true, firstName: true, lastName: true, role: true } } },
    }),

  countNotes: (hospitalId: string, patientId: string) =>
    prisma.patientNote.count({ where: { hospitalId, patientId } }),
};
