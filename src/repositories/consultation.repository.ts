import { prisma } from '../lib/prisma.js';

export const consultationRepository = {
  create: (data: {
    hospitalId: string;
    patientId: string;
    doctorId: string;
    appointmentId?: string;
    clinicalNotes: string;
    diagnosis?: string;
    treatmentPlan?: string;
    followUpAt?: Date;
  }) =>
    prisma.consultation.create({
      data,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, medicalRecordNumber: true } },
        doctor: {
          select: {
            id: true,
            specialization: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
        prescriptions: true,
      },
    }),

  findById: (hospitalId: string, id: string) =>
    prisma.consultation.findFirst({
      where: { id, hospitalId },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, medicalRecordNumber: true } },
        doctor: {
          select: {
            id: true,
            specialization: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
        appointment: true,
        prescriptions: true,
      },
    }),

  list: (
    hospitalId: string,
    skip: number,
    take: number,
    filters: { patientId?: string; doctorId?: string }
  ) =>
    prisma.consultation.findMany({
      where: {
        hospitalId,
        ...(filters.patientId ? { patientId: filters.patientId } : {}),
        ...(filters.doctorId ? { doctorId: filters.doctorId } : {}),
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, medicalRecordNumber: true } },
        doctor: {
          select: {
            id: true,
            specialization: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
        prescriptions: true,
      },
    }),

  count: (hospitalId: string, filters: { patientId?: string; doctorId?: string }) =>
    prisma.consultation.count({
      where: {
        hospitalId,
        ...(filters.patientId ? { patientId: filters.patientId } : {}),
        ...(filters.doctorId ? { doctorId: filters.doctorId } : {}),
      },
    }),

  update: (
    hospitalId: string,
    id: string,
    data: {
      clinicalNotes?: string;
      diagnosis?: string;
      treatmentPlan?: string;
      followUpAt?: Date | null;
    }
  ) => prisma.consultation.updateMany({ where: { id, hospitalId }, data }),
};
