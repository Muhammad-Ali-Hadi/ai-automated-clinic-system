import { prisma } from '../lib/prisma.js';

export const prescriptionRepository = {
  create: (data: {
    hospitalId: string;
    patientId: string;
    consultationId?: string;
    prescribedById: string;
    medicineName: string;
    dosage: string;
    frequency: string;
    durationDays: number;
    instructions?: string;
  }) =>
    prisma.prescription.create({
      data,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, medicalRecordNumber: true } },
      },
    }),

  findById: (hospitalId: string, id: string) =>
    prisma.prescription.findFirst({
      where: { id, hospitalId },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, medicalRecordNumber: true } },
        consultation: { select: { id: true, clinicalNotes: true, diagnosis: true } },
      },
    }),

  list: (
    hospitalId: string,
    skip: number,
    take: number,
    filters: { patientId?: string; consultationId?: string }
  ) =>
    prisma.prescription.findMany({
      where: {
        hospitalId,
        ...(filters.patientId ? { patientId: filters.patientId } : {}),
        ...(filters.consultationId ? { consultationId: filters.consultationId } : {}),
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, medicalRecordNumber: true } },
        consultation: { select: { id: true, diagnosis: true } },
      },
    }),

  count: (hospitalId: string, filters: { patientId?: string; consultationId?: string }) =>
    prisma.prescription.count({
      where: {
        hospitalId,
        ...(filters.patientId ? { patientId: filters.patientId } : {}),
        ...(filters.consultationId ? { consultationId: filters.consultationId } : {}),
      },
    }),
};
